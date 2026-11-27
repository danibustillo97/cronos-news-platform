// Data gathering for the AI program — ONLY existing, real sources (no new services):
//   /api/football/recap      finished matches with ESPN analysis (per Colombia day)
//   /api/football/fixtures   live and scheduled matches with canonical status
//   /api/sports/standings    tables (backend)
//   Supabase `news`          published stories
//   /api/polls               real portal polls and votes
// Crests become data URLs (logoToDataUrl) so the studio canvases stay untainted.
// Every source reports its own failure; a failed source never becomes invented data.

import { supabase } from "@/lib/supabaseClient";
import { apiUrl } from "@/studio/lab/api-client";
import { logoToDataUrl } from "../football/raster";
import type { RecapLeague } from "../football/recap";
import { matchNewsId } from "../engine/audience";
import type { MatchLite, NewsLite, PollLite, ShowData, StandingRow } from "./editorial";
import type { Mode } from "./types";

export const SHOW_LEAGUES: { id: string; name: string }[] = [
  { id: "col.1", name: "Liga BetPlay" }, { id: "uefa.champions", name: "Champions League" }, { id: "conmebol.libertadores", name: "Libertadores" },
  { id: "conmebol.sudamericana", name: "Sudamericana" }, { id: "eng.1", name: "Premier League" }, { id: "esp.1", name: "LaLiga" },
  { id: "uefa.europa", name: "Europa League" }, { id: "ita.1", name: "Serie A" }, { id: "ger.1", name: "Bundesliga" }, { id: "fra.1", name: "Ligue 1" },
];
const NAME = Object.fromEntries(SHOW_LEAGUES.map((l) => [l.id, l.name]));
const TABLE_LEAGUES = new Set(["col.1", "eng.1", "esp.1", "ita.1", "ger.1", "uefa.champions"]);
const TZ = "America/Bogota";
export const ymd = (at: number) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(at)).replaceAll("-", "");

export interface GatherReport { source: string; ok: boolean; detail: string }

async function json<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

export async function gatherShowData(modes: Mode[], leagues: string[], onProgress: (msg: string) => void = () => undefined): Promise<{ data: ShowData; report: GatherReport[] }> {
  const now = Date.now();
  const report: GatherReport[] = [];
  const lg = leagues.length ? leagues : SHOW_LEAGUES.map((l) => l.id);
  const days = new Set<string>();
  if (modes.includes("yesterday")) days.add(ymd(now - 86400000));
  if (modes.includes("today")) days.add(ymd(now));
  if (modes.includes("week")) for (let i = 0; i < 7; i++) days.add(ymd(now - i * 86400000));

  // ---- finished matches with analysis (recap)
  onProgress("Reuniendo resultados, calendario, tablas y noticias…");
  const recaps: ShowData["recaps"] = [];
  const live: MatchLite[] = [], upcoming: MatchLite[] = [];
  const standings: ShowData["standings"] = {};
  let news: NewsLite[] = [];
  const pRecaps = (async () => {
  await Promise.all([...days].map(async (day) => {
    try {
      const body = await json<{ leagues: RecapLeague[] }>(`/api/football/recap?date=${day}&leagues=${lg.join(",")}`);
      recaps.push({ day, leagues: body.leagues ?? [] });
    } catch (err) { report.push({ source: `Resultados ${day}`, ok: false, detail: String(err) }); }
  }));
  const nRes = recaps.reduce((n, r) => n + r.leagues.reduce((k, l) => k + l.matches.length, 0), 0);
  report.push({ source: "Resultados ESPN", ok: true, detail: `${nRes} partidos finalizados` });

  })();

  // ---- live and scheduled (fixtures, canonical status)
  const pFixtures = (async () => {
  if (modes.includes("today") || modes.includes("upcoming")) {
    const range = `${ymd(now)}-${ymd(now + (modes.includes("upcoming") ? 3 : 0) * 86400000)}`;
    let failed = 0;
    await Promise.all(lg.map(async (league) => {
      try {
        const body = await json<{ fixtures?: { id: string; league: string; date: string; status?: MatchLite["status"]; clock?: string; detail?: string; home: { name: string; short?: string; logo?: string; score?: number }; away: { name: string; short?: string; logo?: string; score?: number } }[] }>(`/api/football/fixtures?league=${encodeURIComponent(league)}&dates=${range}`);
        for (const f of body.fixtures ?? []) {
          const m: MatchLite = { id: f.id, league, leagueName: NAME[league] ?? league, kickoff: f.date, status: f.status ?? "UNKNOWN", clock: f.clock, detail: f.detail, home: f.home, away: f.away };
          if (["LIVE", "HT", "BREAK"].includes(m.status)) live.push(m);
          else if (m.status === "SCHEDULED" && Date.parse(m.kickoff) > now) upcoming.push(m);
        }
      } catch { failed++; }
    }));
    report.push({ source: "Calendario ESPN", ok: failed < lg.length, detail: `${live.length} en juego · ${upcoming.length} programados${failed ? ` · ${failed} ligas sin respuesta` : ""}` });
  }

  })();

  // ---- standings
  const pTables = (async () => {
  await Promise.all(lg.filter((l) => TABLE_LEAGUES.has(l)).map(async (league) => {
    try {
      type Row = { rank?: string; team: string; logo?: string; played?: string; points?: string; goalDifference?: string; goalsFor?: string };
      const body = await json<{ leagueName: string; table: Row[]; groups?: { name: string; table: Row[] }[] }>(apiUrl(`/api/sports/standings?league=${league}`));
      const map = (r: Row, i: number, group?: string): StandingRow => ({ pos: Number(r.rank ?? i + 1), team: r.team, logo: r.logo, played: Number(r.played ?? 0), points: Number(r.points ?? 0), gd: Number(String(r.goalDifference ?? "0").replace("+", "")), goalsFor: Number(r.goalsFor ?? 0), group });
      const grouped = (body.groups?.length ?? 0) > 1;
      const rows: StandingRow[] = (grouped ? body.groups!.flatMap((g) => g.table.map((r, i) => map(r, i, g.name)).sort((a, b) => a.pos - b.pos)) : (body.table ?? []).map((r, i) => map(r, i)).sort((a, b) => a.pos - b.pos));
      if (rows.length) standings[league] = { leagueName: body.leagueName ?? NAME[league], rows };
    } catch { /* reported below */ }
  }));
  report.push({ source: "Tablas", ok: Object.keys(standings).length > 0, detail: `${Object.keys(standings).length} tablas` });

  })();

  // ---- news (published, inside the period)
  const pNews = (async () => {
  try {
    const floor = new Date(now - (modes.includes("week") ? 7 * 86400000 : 36 * 3600000)).toISOString();
    const { data, error } = await supabase.from("news").select("*").eq("status", "published").gte("published_at", floor).order("published_at", { ascending: false }).limit(30);
    if (error) throw error;
    news = (data ?? []) as NewsLite[];
    report.push({ source: "Noticias", ok: true, detail: `${news.length} publicadas en el periodo` });
  } catch (err) { report.push({ source: "Noticias", ok: false, detail: err instanceof Error ? err.message : String(err) }); }

  })();

  // the four sources run at the same time
  await Promise.all([pRecaps, pFixtures, pTables, pNews]);

  // ---- real polls: of the featured matches, else the portal's open ones (in parallel with the crests)
  onProgress("Votaciones y escudos…");
  const polls: PollLite[] = [];
  const pPolls = (async () => {
  const featured = [...live.slice(0, 3), ...recaps.flatMap((r) => r.leagues.flatMap((l) => l.matches.map((m) => ({ id: m.id, league: m.league })))).slice(0, 4)];
  await Promise.all(featured.map(async (m) => {
    try {
      const body = await json<{ polls?: { id: string; question: string; status?: string; options?: { label: string; votes?: number }[] }[] }>(`/api/polls?newsId=${encodeURIComponent(matchNewsId(m.league, m.id))}&limit=5`);
      for (const p of body.polls ?? []) polls.push({ id: p.id, matchId: m.id, question: p.question, status: (p.status as PollLite["status"]) ?? "open", options: (p.options ?? []).map((o) => ({ label: o.label, votes: o.votes ?? 0 })) });
    } catch { /* none */ }
  }));
  if (!polls.length) {
    try {
      const body = await json<{ polls?: { id: string; question: string; status?: string; options?: { label: string; votes?: number }[] }[] }>("/api/polls?placement=pulse&limit=5");
      for (const p of body.polls ?? []) polls.push({ id: p.id, question: p.question, status: (p.status as PollLite["status"]) ?? "open", options: (p.options ?? []).map((o) => ({ label: o.label, votes: o.votes ?? 0 })) });
    } catch { /* none */ }
  }
  report.push({ source: "Votaciones", ok: true, detail: `${polls.length} votaciones reales` });

  })();

  // ---- crests → data URLs (untainted canvases)
  const urls = new Set<string>();
  recaps.forEach((r) => r.leagues.forEach((l) => l.matches.forEach((m) => { if (m.home.logo) urls.add(m.home.logo); if (m.away.logo) urls.add(m.away.logo); })));
  [...live, ...upcoming.slice(0, 20)].forEach((m) => { if (m.home.logo) urls.add(m.home.logo); if (m.away.logo) urls.add(m.away.logo); });
  Object.values(standings).forEach((s) => s.rows.slice(0, 8).forEach((r) => { if (r.logo) urls.add(r.logo); }));
  const logos: Record<string, string> = {};
  const list = [...urls].slice(0, 80);
  for (let i = 0; i < list.length; i += 16) {
    await Promise.all(list.slice(i, i + 16).map(async (u) => { try { logos[u] = await logoToDataUrl(u, 200); } catch { /* monogram */ } }));
  }
  await pPolls;
  recaps.sort((a, b) => b.day.localeCompare(a.day));
  return { data: { now, recaps, live, upcoming, news, standings, polls, logos }, report };
}
