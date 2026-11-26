"use client";

// One poller for the matches of the Colombia day (yesterday / today / tomorrow in
// America/Bogota) across the followed leagues, using the existing service
// /api/football/fixtures (now with the canonical real status). Every 30 s:
// reconcile (failed read → keep known states as stale, never promote to live;
// missing match → kept until verified), verify active matches that vanished with
// the match-detail endpoint, and classify into EN VIVO AHORA / PRÓXIMOS /
// FINALIZADOS HOY / ANTERIORES. Nothing is persisted as "live" between sessions.

import { useEffect, useMemo, useRef, useState } from "react";
import { COMPETITIONS } from "../football/competitions";
import { bogotaYmd, classify, isActive, reconcile, statusFromDetail, type CenterMatch, type MatchStatus } from "./matchStatus";

const LEAGUES = COMPETITIONS.filter((c) => c.espn && c.id !== "mls");
const REFRESH_MS = 30_000;

interface FixtureLite {
  id: string; league: string; date: string; status?: MatchStatus; statusName?: string; detail?: string; clock?: string; period?: number;
  home: { id: string; name: string; short?: string; logo?: string; score?: number };
  away: { id: string; name: string; short?: string; logo?: string; score?: number };
}

export function toCenter(f: FixtureLite, leagueName: string): Omit<CenterMatch, "seenAt" | "missing" | "stale"> {
  const team = (t: FixtureLite["home"]) => ({ id: t.id, name: t.name, short: t.short || t.name.slice(0, 3).toUpperCase(), logo: t.logo || undefined, score: t.score ?? 0 });
  return { id: f.id, league: f.league, leagueName, kickoff: f.date, status: f.status ?? "UNKNOWN", statusName: f.statusName ?? "", detail: f.detail ?? "", clock: f.clock ?? "", period: f.period ?? 0, home: team(f.home), away: team(f.away) };
}

export function useMatchCenter(enabled: boolean) {
  const [matches, setMatches] = useState<Map<string, CenterMatch>>(new Map());
  const [lastOk, setLastOk] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const ref = useRef(matches);
  ref.current = matches;

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const read = async () => {
      const t = Date.now();
      const range = `${bogotaYmd(t, -1)}-${bogotaYmd(t, 1)}`;
      const lists = await Promise.all(LEAGUES.map(async (c) => {
        try {
          const res = await fetch(`/api/football/fixtures?league=${encodeURIComponent(c.espn!)}&dates=${range}`);
          if (!res.ok) return null;
          const body = await res.json() as { fixtures?: FixtureLite[] };
          return (body.fixtures ?? []).map((f) => toCenter(f, c.short));
        } catch { return null; }
      }));
      if (!alive) return;
      const ok = lists.filter((l): l is NonNullable<typeof l> => l !== null);
      // every league failed → the source is down: keep what we know, stale
      let next = reconcile(ref.current, ok.length ? ok.flat() : null, t);
      // leagues that failed individually keep their matches (not counted as "missing")
      if (ok.length && ok.length < lists.length) {
        const failed = new Set(LEAGUES.filter((_, i) => lists[i] === null).map((c) => c.espn));
        ref.current.forEach((m, id) => { if (failed.has(m.league)) next.set(id, { ...m, stale: true }); });
      }
      // an active match that vanished from the list is verified with its own detail before anything changes
      const toVerify = [...next.values()].filter((m) => m.missing > 0 && isActive(m.status));
      await Promise.all(toVerify.map(async (m) => {
        try {
          const res = await fetch(`/api/matches/${encodeURIComponent(m.league)}/${encodeURIComponent(m.id)}`);
          if (!res.ok) return;
          const d = await res.json() as { state?: string; statusText?: string; home?: { score?: number }; away?: { score?: number } };
          next.set(m.id, { ...m, status: statusFromDetail(d.state, d.statusText), detail: d.statusText ?? m.detail, home: { ...m.home, score: d.home?.score ?? m.home.score }, away: { ...m.away, score: d.away?.score ?? m.away.score }, stale: false });
        } catch { /* stays stale */ }
      }));
      if (!alive) return;
      next = new Map(next);
      setMatches(next);
      setNow(Date.now());
      if (ok.length) { setLastOk(t); setError(ok.length < lists.length ? "Algunas ligas no respondieron" : null); } else setError("La fuente de partidos no responde: datos desactualizados");
    };
    void read();
    const i = window.setInterval(() => void read(), REFRESH_MS);
    const c = window.setInterval(() => setNow(Date.now()), 20_000);
    return () => { alive = false; window.clearInterval(i); window.clearInterval(c); };
  }, [enabled]);

  const categories = useMemo(() => classify(matches.values(), now), [matches, now]);
  const liveIds = useMemo(() => new Set(categories.live.map((m) => m.id)), [categories]);
  return { matches, categories, liveIds, lastOk, error, statusOf: (id: string) => matches.get(id)?.status };
}
export type MatchCenter = ReturnType<typeof useMatchCenter>;
