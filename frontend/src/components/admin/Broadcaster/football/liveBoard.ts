// Live board for the broadcaster: every followed match at once.
//  - feeds the "multi" graphic (Resultados en vivo) via setMultiScores
//  - detects NEW goals in other matches (from /api/matches/moments) so the
//    studio can air a "goal-alert" automatically.
// Pure helpers are exported for tests; the hook polls every 30 s.

import { useEffect, useRef, useState } from "react";
import { setMultiScores, type MultiScore } from "./designs";
import { logoToDataUrl } from "./raster";

export interface BoardMatch {
  id: string; league?: string; leagueName?: string; homeTeam: string; awayTeam: string; homeLogo?: string; awayLogo?: string;
  homeScore?: number | null; awayScore?: number | null; status: string; statusDetail?: string; date?: string;
}
export interface GoalMoment {
  id: string; kind: string; matchId: string; leagueName?: string; minute?: string; headline: string;
  player?: { id: string; name: string } | null; home?: { name?: string; logo?: string | null }; away?: { name?: string; logo?: string | null }; score?: { home: number; away: number };
  team?: "home" | "away" | null; assist?: { id: string; name: string } | null;
}

const STATUS_ORDER: Record<string, number> = { live: 0, halftime: 1, finished: 2, scheduled: 3 };

export type Flash = NonNullable<MultiScore["flash"]> & { until: number };

export function toMultiScores(matches: BoardMatch[], max = 10, opts: {
  selected?: string[]; flashes?: Record<string, Flash>; logos?: Map<string, string>; now?: number;
} = {}): MultiScore[] {
  const now = opts.now ?? Date.now();
  const chosen = opts.selected?.length ? matches.filter((m) => opts.selected!.includes(m.id)) : [];
  // Default: what is being played (+ kick-offs in the next 3 h). Finished games only when chosen by hand.
  let pool = chosen.length ? chosen : matches.filter((m) => m.status === "live" || m.status === "halftime" || (m.status === "scheduled" && isSoon(m.date)));
  if (!pool.length) pool = matches.filter((m) => m.status === "scheduled" && m.date && new Date(m.date).getTime() > now && new Date(m.date).toDateString() === new Date(now).toDateString());
  return [...pool]
    .sort((a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9))
    .slice(0, max)
    .map((m) => ({
      id: m.id, league: m.leagueName ?? m.league ?? "", leagueSlug: m.league, home: m.homeTeam, away: m.awayTeam,
      homeLogo: m.homeLogo ? opts.logos?.get(m.homeLogo) : undefined, awayLogo: m.awayLogo ? opts.logos?.get(m.awayLogo) : undefined,
      flash: opts.flashes?.[m.id] && opts.flashes[m.id].until > now
        ? { kind: opts.flashes[m.id].kind, text: opts.flashes[m.id].text, side: opts.flashes[m.id].side } : null,
      homeScore: m.status === "scheduled" ? null : m.homeScore ?? 0, awayScore: m.status === "scheduled" ? null : m.awayScore ?? 0,
      status: (["live", "halftime", "finished"].includes(m.status) ? m.status : "scheduled") as MultiScore["status"],
      detail: m.status === "finished" ? "Final" : m.status === "halftime" ? "ET" : m.status === "scheduled" && m.date
        ? new Date(m.date).toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" }) : m.statusDetail ?? "",
    }));
}

function isSoon(date?: string): boolean {
  if (!date) return false;
  const diff = new Date(date).getTime() - Date.now();
  return diff > 0 && diff < 3 * 3600_000;
}

/** Goals and red cards not seen before -> tile highlight for 60 s. */
export function flashesFrom(moments: GoalMoment[], seen: Set<string>, now: number): Record<string, Flash> {
  const out: Record<string, Flash> = {};
  for (const m of moments) {
    if ((m.kind !== "goal" && m.kind !== "red") || seen.has(m.id)) continue;
    const who = m.player?.name ? m.player.name.split(" ").slice(-1)[0] : "";
    out[m.matchId] = { kind: m.kind as "goal" | "red", text: [m.minute, who].filter(Boolean).join(" "), side: (m as { team?: "home" | "away" | null }).team ?? null, until: now + 60_000 };
  }
  return out;
}

const SEL = "nexus.broadcast.multiSel";
export function readMultiSelection(): string[] {
  try { return JSON.parse(localStorage.getItem(SEL) || "[]") as string[]; } catch { return []; }
}
export function writeMultiSelection(ids: string[]) {
  try { localStorage.setItem(SEL, JSON.stringify(ids)); } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent("nexus:multi-selection", { detail: ids }));
}

/** Goals not seen before, excluding the match on air (it has its own goal animation). */
export function newGoals(moments: GoalMoment[], seen: Set<string>, onAirMatchId: string | null): GoalMoment[] {
  return moments.filter((m) => m.kind === "goal" && !seen.has(m.id) && m.matchId !== onAirMatchId);
}

export function goalAlertText(m: GoalMoment): { title: string; subtitle: string } {
  const score = m.score ? `${m.home?.name ?? ""} ${m.score.home}-${m.score.away} ${m.away?.name ?? ""}`.trim() : m.headline;
  const who = m.player?.name ? `${m.player.name}${m.minute ? ` · ${m.minute}` : ""}` : m.minute ?? "";
  return { title: score, subtitle: [who, m.leagueName].filter(Boolean).join(" · ") };
}

const PREF = "nexus.broadcast.goalAlerts";
export function readGoalAlertsPref(): boolean {
  try { return localStorage.getItem(PREF) !== "off"; } catch { return true; }
}
export function writeGoalAlertsPref(on: boolean) {
  try { localStorage.setItem(PREF, on ? "on" : "off"); } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent("nexus:goal-alerts", { detail: on }));
}

export function useGoalAlertsPref(): boolean {
  const [on, setOn] = useState(true);
  useEffect(() => {
    setOn(readGoalAlertsPref());
    const listener = (e: Event) => setOn(Boolean((e as CustomEvent).detail));
    window.addEventListener("nexus:goal-alerts", listener);
    return () => window.removeEventListener("nexus:goal-alerts", listener);
  }, []);
  return on;
}

/** Polls scoreboard + moments while enabled; calls onGoal for each new goal in other matches. */
export function useLiveBoard(enabled: boolean, onAirMatchId: string | null, onGoal: (goal: GoalMoment) => void) {
  const [matches, setMatches] = useState<BoardMatch[]>([]);
  const seen = useRef<Set<string> | null>(null);
  const flashes = useRef<Record<string, Flash>>({});
  const logos = useRef(new Map<string, string>());
  const selection = useRef<string[]>([]);
  const onGoalRef = useRef(onGoal);
  onGoalRef.current = onGoal;
  const airRef = useRef(onAirMatchId);
  airRef.current = onAirMatchId;

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    selection.current = readMultiSelection();
    const publish = (list: BoardMatch[]) => setMultiScores(toMultiScores(list, 10, { selected: selection.current, flashes: flashes.current, logos: logos.current }));
    const onSelection = (e: Event) => { selection.current = (e as CustomEvent).detail as string[]; publish(latest.current); };
    window.addEventListener("nexus:multi-selection", onSelection);
    const latest = { current: [] as BoardMatch[] };
    const tick = async () => {
      const [board, moments] = await Promise.all([
        fetch("/api/sports/scoreboard").then((r) => (r.ok ? r.json() : [])).catch(() => []),
        fetch("/api/matches/moments").then((r) => (r.ok ? r.json() : { moments: [] })).catch(() => ({ moments: [] })),
      ]);
      if (!alive) return;
      const list = (Array.isArray(board) ? board : []) as BoardMatch[];
      latest.current = list;
      setMatches(list);
      const all = ((moments?.moments ?? []) as GoalMoment[]);
      if (seen.current === null) { // first load: remember what already happened, alert only new goals
        seen.current = new Set(all.map((m) => m.id));
      } else {
        Object.assign(flashes.current, flashesFrom(all, seen.current, Date.now()));
        for (const goal of newGoals(all, seen.current, airRef.current)) onGoalRef.current(goal);
        all.forEach((m) => seen.current!.add(m.id));
      }
      publish(list);
      // crests as data URLs (the raster can't load remote images); refresh the panel when they arrive
      const missing = [...new Set(list.flatMap((m) => [m.homeLogo, m.awayLogo]).filter((u): u is string => Boolean(u) && !logos.current.has(u as string)))];
      if (missing.length) {
        await Promise.all(missing.slice(0, 24).map(async (url) => {
          try { logos.current.set(url, await logoToDataUrl(url, 96)); } catch { /* keep the monogram */ }
        }));
        if (alive) publish(list);
      }
    };
    void tick();
    const timer = window.setInterval(() => void tick(), 30_000);
    const fade = window.setInterval(() => publish(latest.current), 10_000); // let highlights expire
    return () => { alive = false; window.clearInterval(timer); window.clearInterval(fade); window.removeEventListener("nexus:multi-selection", onSelection); };
  }, [enabled]);

  return matches;
}
