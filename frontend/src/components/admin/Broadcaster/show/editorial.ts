// Editorial + Narrative engine of the AI program. Pure (no I/O): it receives the REAL
// data gathered by show/data.ts and returns an Edition — a running order of segments,
// each a sequence of beats (narration line + set configuration + camera + LED content
// + lower third), with sources, priorities, validity and planned durations.
//
// Rules it enforces:
// - nothing is invented: every sentence is built from a fact in the data (ESPN results,
//   stats, standings, fixtures, published news, real poll votes); missing data → the
//   beat is not produced, never filled in;
// - live means LIVE/HT/BREAK confirmed by the provider; past matches are results;
// - rumours (conditional wording in the headline) are said as "según <fuente>" and
//   flagged PROVISIONAL, never as confirmed;
// - predictions are labelled as such (here: only "expectation", no score predictions);
// - Colombia time (America/Bogota) for every day and kick-off;
// - one item airs in one segment (no repeated stories), except the closing summary;
// - durations follow the content: a segment is as long as its real material, inside
//   [min, max]; the engine never pads to reach the target.

import { estimateSeconds, lineSegments, type NarrationLine, type NarrationProfile } from "../engine/narration";
import { spokenDate, spokenTime } from "../engine/narratorScript";
import { scorersLine, type RecapLeague, type RecapMatch } from "../football/recap";
import { dayInsights, matchInsights, type Insight } from "./insights";
import { PRIORITY_RANK, SEGMENT_LABEL, type Beat, type Edition, type Item, type Mode, type Priority, type ScreenContent, type Segment, type SegmentKind, type Source, type StageId, type TeamRef } from "./types";

// ------------------------------------------------------------------ input
export interface MatchLite {
  id: string; league: string; leagueName: string; kickoff: string;
  status: "SCHEDULED" | "LIVE" | "HT" | "BREAK" | "FINISHED" | "POSTPONED" | "CANCELLED" | "UNKNOWN";
  clock?: string; detail?: string;
  home: TeamRef; away: TeamRef;
}
export interface NewsLite { id: string; title: string; summary?: string | null; excerpt?: string | null; source?: string | null; source_url?: string | null; published_at: string; updated_at?: string | null; category?: string | null }
export interface StandingRow { pos: number; team: string; logo?: string; played: number; points: number; gd: number; goalsFor?: number; group?: string }
export interface PollLite { id: string; matchId?: string; question: string; options: { label: string; votes: number }[]; status: "draft" | "open" | "closed" }
export interface ShowData {
  now: number;
  recaps: { day: string; leagues: RecapLeague[] }[]; // finished matches with ESPN analysis, by Colombia day (YYYYMMDD)
  live: MatchLite[];
  upcoming: MatchLite[];
  news: NewsLite[];
  standings: Record<string, { leagueName: string; rows: StandingRow[] }>;
  polls: PollLite[];
  logos: Record<string, string>; // remote crest URL → data URL
}
export interface EditionOptions { modes: Mode[]; leagues: string[]; targetMin: 15 | 30 | 45 | 60; title?: string }

// ------------------------------------------------------------------ editorial weights (audience: Colombia)
const LEAGUE_WEIGHT: Record<string, number> = {
  "col.1": 1, "uefa.champions": 0.95, "conmebol.libertadores": 0.92, "eng.1": 0.82, "esp.1": 0.82, "conmebol.sudamericana": 0.78,
  "uefa.europa": 0.72, "ita.1": 0.7, "ger.1": 0.66, "fra.1": 0.62,
};
const weightOf = (league?: string) => LEAGUE_WEIGHT[league ?? ""] ?? 0.55;
const CLASSICS = [["Millonarios", "Santa Fe"], ["Atlético Nacional", "Independiente Medellín"], ["América de Cali", "Deportivo Cali"], ["Atlético Nacional", "Millonarios"], ["Junior", "Atlético Nacional"], ["Real Madrid", "Barcelona"], ["Boca Juniors", "River Plate"]];
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
export function isClassic(a: string, b: string): boolean {
  return CLASSICS.some(([x, y]) => (norm(a).includes(norm(x)) && norm(b).includes(norm(y))) || (norm(a).includes(norm(y)) && norm(b).includes(norm(x))));
}
const RUMOUR = /\b(tendr[ií]a|estar[ií]a|podr[ií]a|ser[ií]a|rumor|negocia|interesa|suena|apunta a)\b/i;

export const priorityOf = (score: number): Priority => (score >= 0.85 ? "CRITICAL" : score >= 0.65 ? "HIGH" : score >= 0.45 ? "MEDIUM" : "LOW");

const TZ = "America/Bogota";
const ymd = (at: number | string) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(at)).replaceAll("-", "");
const dayLabel = (at: string, now: number) => {
  const d = ymd(at), t = ymd(now), tm = ymd(now + 86400000);
  return d === t ? "hoy" : d === tm ? "mañana" : new Intl.DateTimeFormat("es-CO", { timeZone: TZ, weekday: "long" }).format(new Date(at));
};
const clockTime = (at: string) => new Date(at).toLocaleTimeString("es-CO", { timeZone: TZ, hour: "numeric", minute: "2-digit" });

/** Upset: the winner was the clear underdog in the pre-match odds ESPN kept. */
export function upset(m: RecapMatch): boolean {
  if (!m.odds || m.home.score === m.away.score) return false;
  const [win, lose] = m.home.score > m.away.score ? [m.odds.home, m.odds.away] : [m.odds.away, m.odds.home];
  return win >= 2.6 && win > lose * 1.6;
}

export function scoreResult(m: RecapMatch, ageDays: number): { score: number; reason: string } {
  const goals = m.home.score + m.away.score, margin = Math.abs(m.home.score - m.away.score);
  let s = weightOf(m.league) * 0.6;
  const why: string[] = [`${m.leagueName}`];
  if (goals >= 4) { s += 0.12; why.push(`${goals} goles`); }
  if (margin >= 3) { s += 0.08; why.push("goleada"); }
  if (upset(m)) { s += 0.22; why.push("sorpresa según las cuotas previas"); }
  if (m.reds.length) { s += 0.05; why.push("expulsión"); }
  if (isClassic(m.home.name, m.away.name)) { s += 0.18; why.push("clásico"); }
  if (m.impact.length) { s += 0.05; why.push("cambia la tabla"); }
  s -= Math.min(0.2, ageDays * 0.03);
  return { score: Math.max(0, Math.min(1, s)), reason: why.join(" · ") };
}

// ------------------------------------------------------------------ helpers
let seq = 0;
const uid = (p: string) => `${p}-${(++seq).toString(36)}`;
const line = (text: string, profile: NarrationProfile, extra: Partial<NarrationLine> = {}): NarrationLine => ({ id: uid("n"), text, profile, ...extra });
const team = (t: { name: string; short?: string; logo?: string; score?: number }, logos: Record<string, string>): TeamRef => ({ name: t.name, short: t.short, logo: t.logo ? logos[t.logo] ?? undefined : undefined, score: t.score });
const beatSeconds = (b: Beat) => (b.narration ? estimateSeconds(lineSegments(b.narration)) : 0) + (b.holdMs ?? 0) / 1000;
export const segmentSeconds = (beats: Beat[]) => beats.reduce((t, b) => t + beatSeconds(b), 0);
const first = (text?: string | null, max = 220) => {
  if (!text) return "";
  const clean = text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const sentence = clean.match(/^.{20,}?[.!?](\s|$)/)?.[0] ?? clean;
  return sentence.length > max ? `${sentence.slice(0, max).replace(/\s+\S*$/, "")}…` : sentence.trim();
};
const statusLabel = (m: MatchLite) => (m.status === "HT" ? "DESCANSO" : m.status === "BREAK" ? "PAUSA" : `EN VIVO${m.clock ? ` · ${m.clock}` : ""}`);

// ------------------------------------------------------------------ items
export function collectItems(data: ShowData, opts: EditionOptions): { items: Item[]; results: Map<string, RecapMatch>; matches: Map<string, MatchLite> } {
  const want = new Set(opts.leagues);
  const inLeague = (l: string) => !want.size || want.has(l);
  const items: Item[] = [];
  const results = new Map<string, RecapMatch>();
  const matches = new Map<string, MatchLite>();
  const today = ymd(data.now), yesterday = ymd(data.now - 86400000);
  const days = new Set<string>();
  if (opts.modes.includes("yesterday")) days.add(yesterday);
  if (opts.modes.includes("today")) days.add(today);
  if (opts.modes.includes("week")) for (let i = 0; i < 7; i++) days.add(ymd(data.now - i * 86400000));

  for (const r of data.recaps) {
    if (!days.has(r.day)) continue;
    const ageDays = Math.round((Date.parse(`${today.slice(0, 4)}-${today.slice(4, 6)}-${today.slice(6)}`) - Date.parse(`${r.day.slice(0, 4)}-${r.day.slice(4, 6)}-${r.day.slice(6)}`)) / 86400000);
    for (const l of r.leagues) for (const m of l.matches) {
      if (!inLeague(m.league) || results.has(m.id)) continue;
      const { score, reason } = scoreResult(m, ageDays);
      results.set(m.id, m);
      items.push({ id: `res:${m.id}`, kind: "result", title: m.headline, priority: priorityOf(score), score, verification: "CONFIRMED", source: { name: "ESPN", publishedAt: m.date },
        matchId: m.id, league: m.league, leagueName: m.leagueName, entities: [m.home.name, m.away.name], reason: `${reason}${r.day === today ? " · hoy" : r.day === yesterday ? " · ayer" : ""}` });
    }
  }
  if (opts.modes.includes("today")) for (const m of data.live) {
    if (!inLeague(m.league) || !["LIVE", "HT", "BREAK"].includes(m.status)) continue; // only provider-confirmed live
    matches.set(m.id, m);
    items.push({ id: `live:${m.id}`, kind: "live", title: `${m.home.name} ${m.home.score ?? 0}-${m.away.score ?? 0} ${m.away.name}`, priority: "CRITICAL", score: 1, verification: "PROVISIONAL",
      source: { name: "ESPN (en vivo)" }, validUntil: new Date(data.now + 30 * 60000).toISOString(), matchId: m.id, league: m.league, leagueName: m.leagueName, entities: [m.home.name, m.away.name], reason: "partido en juego ahora (estado confirmado por el proveedor)" });
  }
  if (opts.modes.includes("upcoming") || opts.modes.includes("today")) for (const m of data.upcoming) {
    if (!inLeague(m.league) || m.status !== "SCHEDULED") continue;
    const isToday = ymd(m.kickoff) === today;
    if (!opts.modes.includes("upcoming") && !isToday) continue;
    matches.set(m.id, m);
    const classic = isClassic(m.home.name, m.away.name);
    const table = data.standings[m.league]?.rows ?? [];
    const top = table.filter((r) => r.pos <= 4 && (r.team === m.home.name || r.team === m.away.name)).length;
    const score = Math.min(1, weightOf(m.league) * 0.55 + (classic ? 0.25 : 0) + top * 0.08 + (isToday ? 0.08 : 0));
    items.push({ id: `fix:${m.id}`, kind: "fixture", title: `${m.home.name} vs ${m.away.name}`, priority: priorityOf(score), score, verification: "CONFIRMED", source: { name: "ESPN (calendario)" },
      validUntil: m.kickoff, matchId: m.id, league: m.league, leagueName: m.leagueName, entities: [m.home.name, m.away.name], reason: [m.leagueName, classic ? "clásico" : "", top ? "equipos de arriba en la tabla" : "", isToday ? "hoy" : ""].filter(Boolean).join(" · ") });
  }
  const newsFloor = opts.modes.includes("week") ? data.now - 7 * 86400000 : data.now - 36 * 3600000;
  for (const n of data.news) {
    const t = Date.parse(n.published_at);
    if (!Number.isFinite(t) || t < newsFloor || t > data.now) continue;
    const provisional = RUMOUR.test(n.title);
    const ageH = (data.now - t) / 3600000;
    const score = Math.max(0.2, Math.min(0.9, 0.75 - ageH / 96 - (provisional ? 0.15 : 0)));
    items.push({ id: `news:${n.id}`, kind: "news", title: n.title, priority: priorityOf(score), score, verification: provisional ? "PROVISIONAL" : "CONFIRMED",
      source: { name: n.source || "NEXUS News", url: n.source_url ?? undefined, publishedAt: n.published_at, updatedAt: n.updated_at ?? undefined }, entities: [], reason: `${provisional ? "información sin confirmar · " : ""}publicada hace ${Math.max(1, Math.round(ageH))} h` });
  }
  // expired items never air
  const live = items.filter((i) => !i.validUntil || Date.parse(i.validUntil) > data.now || i.kind === "live");
  live.sort((a, b) => PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority] || b.score - a.score);
  return { items: live, results, matches };
}

// ------------------------------------------------------------------ narrative: one story = a sequence of beats
function resultStory(m: RecapMatch, item: Item, logos: Record<string, string>, deep: boolean, insights: Insight[] = []): Beat[] {
  const critical = item.priority === "CRITICAL";
  const home = team(m.home, logos), away = team(m.away, logos);
  const scr = (reveal: number): ScreenContent => ({ type: "result", league: m.leagueName, home, away, status: "FINAL", scorers: { home: m.goals.home.map((g) => `${g.player.split(" ").slice(-1)[0]} ${g.minute}`), away: m.goals.away.map((g) => `${g.player.split(" ").slice(-1)[0]} ${g.minute}`) }, reveal });
  const beats: Beat[] = [];
  const surprise = upset(m);
  beats.push({ id: uid("b"), stage: "MATCH_CENTER", shot: critical ? "HERO" : "SCREEN", screen: scr(0), weight: item.priority, lower: { kicker: m.leagueName, text: `${m.home.name} vs ${m.away.name}` },
    narration: line(surprise ? `Atención con lo que pasó en ${m.leagueName}.` : `Vamos a ${m.leagueName}.`, critical ? "EPIC" : "NEWS", { pauseAfterMs: 150 }) });
  beats.push({ id: uid("b"), screen: scr(1), shot: "SCREEN", sfx: critical ? "whistle" : undefined, weight: item.priority,
    narration: line(`${m.headline}.`, critical ? "EPIC" : "NEWS", { emphasis: critical }) });
  const said = (gs: RecapMatch["goals"]["home"]) => gs.map((g) => `${g.player.split(" ").slice(-1)[0]}${g.kind === "own" ? " en contra" : g.kind === "penalty" ? " de penal" : ""} al minuto ${g.minute.replace(/'/g, "")}`).join(", ");
  const spoken = [m.goals.home.length ? `por ${m.home.name}, ${said(m.goals.home)}` : "", m.goals.away.length ? `por ${m.away.name}, ${said(m.goals.away)}` : ""].filter(Boolean).join("; ");
  const written = [m.goals.home.length ? `${m.home.short ?? m.home.name}: ${scorersLine(m.goals.home)}` : "", m.goals.away.length ? `${m.away.short ?? m.away.name}: ${scorersLine(m.goals.away)}` : ""].filter(Boolean).join("   ·   ");
  if (spoken) beats.push({ id: uid("b"), screen: scr(2), narration: line(`Los goles: ${spoken}.`, "NEWS"), lower: { kicker: "Goles", text: written, source: "ESPN" } });
  // the angles the data reveals (comeback, late winner, hat-trick, upset, possession paradox…)
  const keys = insights.slice(0, deep ? 5 : 2);
  keys.forEach((k) => beats.push({ id: uid("b"), narration: line(k.text, k.weight >= 0.8 ? "EPIC" : "ANALYSIS", { emphasis: k.weight >= 0.9 }), lower: { kicker: "La clave", text: k.text, source: k.kind === "upset" ? m.odds?.provider ?? "ESPN" : "ESPN" }, weight: k.weight >= 0.85 ? "HIGH" : undefined }));
  if (surprise && !keys.some((k) => k.kind === "upset")) beats.push({ id: uid("b"), narration: line(`Y es una sorpresa con datos: en las cuotas previas, el ganador pagaba ${(m.home.score > m.away.score ? m.odds!.home : m.odds!.away).toFixed(2)}.`, "ANALYSIS"), lower: { kicker: "Dato", text: "El ganador era el menos favorito en las cuotas previas", source: m.odds?.provider ?? "ESPN" } });
  if (m.reds.length && !keys.some((k) => k.kind === "red")) beats.push({ id: uid("b"), narration: line(`Partido marcado por la expulsión de ${m.reds.map((r) => `${r.player} al ${r.minute}`).join(" y de ")}.`, "NEWS") });
  if (deep && m.stats.length) {
    // progressive comparison: the most telling stats first, one at a time
    const rows = [...m.stats].sort((a, b) => Math.abs(b.home - b.away) / (b.home + b.away || 1) - Math.abs(a.home - a.away) / (a.home + a.away || 1)).slice(0, 4);
    const base = { type: "stats" as const, title: "Los números del partido", home, away, rows };
    beats.push({ id: uid("b"), stage: "ANALYSIS", shot: "DATA", screen: { ...base, reveal: 0 }, narration: line("Ahora, los números que explican el resultado.", "ANALYSIS", { pauseAfterMs: 150 }) });
    rows.forEach((r, i) => {
      const lead = r.home === r.away ? "igualdad" : r.home > r.away ? m.home.name : m.away.name;
      const unit = r.percent ? " por ciento" : "";
      beats.push({ id: uid("b"), screen: { ...base, reveal: i + 1 }, narration: line(r.home === r.away ? `${r.label}: igualdad, ${r.home}${unit} para cada uno.` : `${r.label}: ${r.home}${unit} contra ${r.away}${unit}, ventaja de ${lead}.`, "ANALYSIS") });
    });
    m.analysis.slice(0, 2).forEach((a) => beats.push({ id: uid("b"), shot: "HERO", narration: line(a, "ANALYSIS") }));
  }
  const impact = m.impact[0];
  if (impact) beats.push({ id: uid("b"), narration: line(impact, "NEWS"), lower: { kicker: "Consecuencia", text: impact, source: "ESPN" } });
  return beats;
}

function liveStory(m: MatchLite, logos: Record<string, string>): Beat[] {
  const home = team(m.home, logos), away = team(m.away, logos);
  const scr: ScreenContent = { type: "result", league: m.leagueName, home, away, status: statusLabel(m), scorers: { home: [], away: [] }, reveal: 1 };
  const state = m.status === "HT" ? "en el descanso" : m.clock ? `al minuto ${m.clock.replace(/'/g, "")}` : "en juego";
  return [{ id: uid("b"), stage: "MATCH_CENTER", shot: "SCREEN", screen: scr, weight: "CRITICAL", lower: { kicker: "En vivo", text: `${m.home.name} ${m.home.score ?? 0}-${m.away.score ?? 0} ${m.away.name}`, source: "ESPN" },
    narration: line(`En vivo, en ${m.leagueName}: ${m.home.name} ${m.home.score ?? 0} a ${m.away.score ?? 0} ${m.away.name}, ${state}.`, "EPIC", { emphasis: true }) }];
}

function newsStory(n: NewsLite, item: Item, now: number): Beat[] {
  const provisional = item.verification === "PROVISIONAL";
  const src = n.source || "NEXUS News";
  const body = first(n.summary || n.excerpt);
  const when = dayLabel(n.published_at, now);
  const beats: Beat[] = [{ id: uid("b"), stage: "NEWSROOM", shot: "HERO", weight: item.priority,
    screen: { type: "headline", kicker: provisional ? "Sin confirmar" : "Actualidad", title: n.title, body: body || undefined, source: src, date: new Date(n.published_at).toLocaleDateString("es-CO", { timeZone: TZ, day: "numeric", month: "short" }), provisional },
    lower: { kicker: provisional ? "Según " + src : "Noticia", text: n.title, source: src },
    narration: line(provisional ? `Según ${src}, ${n.title.charAt(0).toLowerCase()}${n.title.slice(1)}. Por ahora no está confirmado.` : `${n.title}.`, "NEWS") }];
  if (body) beats.push({ id: uid("b"), shot: "SCREEN", narration: line(body, "NEWS"), holdMs: 300 });
  beats.push({ id: uid("b"), narration: line(`Lo publicó ${src} ${when === "hoy" ? "hoy" : when === "mañana" ? "" : `el ${when}`}.`.replace(/\s+\./, "."), "NEWS", { pauseAfterMs: 200 }) });
  return beats;
}

// ------------------------------------------------------------------ segments
const BASE: Record<SegmentKind, { min: number; rec: number; max: number; stage: StageId }> = {
  opening: { min: 60, rec: 110, max: 150, stage: "OPENING" },
  news: { min: 90, rec: 280, max: 360, stage: "NEWSROOM" },
  matchcenter: { min: 120, rec: 300, max: 420, stage: "MATCH_CENTER" },
  analysis: { min: 90, rec: 200, max: 300, stage: "ANALYSIS" },
  debate: { min: 60, rec: 200, max: 300, stage: "DEBATE" },
  data: { min: 90, rec: 220, max: 300, stage: "STATS" },
  next: { min: 90, rec: 260, max: 320, stage: "UPCOMING" },
  closing: { min: 45, rec: 120, max: 180, stage: "CLOSING" },
};

function segment(kind: SegmentKind, beats: Beat[], scale: number, itemIds: string[], sources: Source[], priority: Priority, note?: string): Segment {
  const b = BASE[kind];
  return { id: uid("seg"), kind, title: SEGMENT_LABEL[kind], stage: b.stage, minS: Math.round(b.min * scale), recS: Math.round(b.rec * scale), maxS: Math.round(b.max * scale), priority,
    status: "pending", approved: false, locked: false, beats, itemIds, sources, estimatedS: Math.round(segmentSeconds(beats)), note };
}

/** Adds stories while they fit under the segment's max; returns the ids used. */
function fill(target: Beat[], stories: { id: string; beats: Beat[] }[], maxS: number, used: Set<string>): string[] {
  const ids: string[] = [];
  for (const s of stories) {
    if (used.has(s.id) || !s.beats.length) continue;
    if (ids.length && segmentSeconds([...target, ...s.beats]) > maxS) continue;
    target.push(...s.beats); ids.push(s.id); used.add(s.id);
  }
  return ids;
}

export function buildEdition(data: ShowData, opts: EditionOptions): Edition {
  const scale = opts.targetMin / 30;
  const { items, results, matches } = collectItems(data, opts);
  const byId = Object.fromEntries(items.map((i) => [i.id, i]));
  const used = new Set<string>();
  const segs: Segment[] = [];
  const warnings: string[] = [];
  const now = data.now;
  const max = (k: SegmentKind) => BASE[k].max * scale;
  const newsById = new Map(data.news.map((n) => [`news:${n.id}`, n]));
  const resultsItems = items.filter((i) => i.kind === "result");
  const top = items.slice(0, 4);

  // ---- 1. OPENING: who we are, what day it is, the stories of the edition
  const opening: Beat[] = [
    { id: uid("b"), stage: "OPENING", shot: "WIDE", screen: { type: "title", kicker: "NEXUS SPORT", title: opts.title ?? "El programa", subtitle: spokenDate(now) }, narration: line(`Bienvenidos a NEXUS SPORT. Hoy es ${spokenDate(now)}.`, "FRIENDLY", { pauseAfterMs: 300 }), holdMs: 1200 },
  ];
  if (top.length) {
    opening.push({ id: uid("b"), shot: "HERO", screen: { type: "headlines", title: "En este programa", items: top.map((i) => i.title), reveal: 0 }, narration: line("Esto es lo que tenemos.", "EXPECTATION", { pauseAfterMs: 150 }) });
    top.forEach((it, i) => opening.push({ id: uid("b"), screen: { type: "headlines", title: "En este programa", items: top.map((x) => x.title), reveal: i + 1 }, narration: line(`${it.title}.`, it.priority === "CRITICAL" ? "EPIC" : "EXPECTATION") }));
  } else {
    warnings.push("No hay contenido verificado para las modalidades y ligas elegidas.");
  }
  segs.push(segment("opening", opening, scale, [], [], "HIGH"));

  // ---- 2. NEWS (Actualidad)
  const newsBeats: Beat[] = [];
  const newsStories = items.filter((i) => i.kind === "news").map((i) => ({ id: i.id, beats: newsStory(newsById.get(i.id)!, i, now) }));
  if (newsStories.length) {
    newsBeats.push({ id: uid("b"), stage: "NEWSROOM", shot: "WIDE", screen: { type: "title", kicker: "Actualidad", title: "Lo que hay que saber" }, narration: line("Empezamos con la actualidad.", "NEWS", { pauseAfterMs: 200 }) });
    const ids = fill(newsBeats, newsStories, max("news"), used);
    segs.push(segment("news", newsBeats, scale, ids, ids.map((id) => byId[id].source), byId[ids[0]]?.priority ?? "MEDIUM"));
  } else warnings.push("Actualidad: no hay noticias publicadas y vigentes en el periodo.");

  // ---- 3. MATCH CENTER: live first (CRITICAL), then results by relevance; the best result is kept for the analysis
  const deepItem = resultsItems.find((i) => (results.get(i.matchId!)?.stats.length ?? 0) > 0);
  const mc: Beat[] = [];
  const liveStories = items.filter((i) => i.kind === "live").map((i) => ({ id: i.id, beats: liveStory(matches.get(i.matchId!)!, data.logos) }));
  const keysOf = (m: RecapMatch) => matchInsights(m, data.standings[m.league]?.rows ?? []);
  const resultStories = resultsItems.filter((i) => i.id !== deepItem?.id).map((i) => { const m = results.get(i.matchId!)!; return { id: i.id, beats: resultStory(m, i, data.logos, false, keysOf(m)) }; });
  if (liveStories.length || resultStories.length) {
    mc.push({ id: uid("b"), stage: "MATCH_CENTER", shot: "WIDE", screen: { type: "title", kicker: "Match Center", title: liveStories.length ? "Partidos en juego y resultados" : "Los resultados" }, narration: line(liveStories.length ? "Vamos al Match Center: hay partidos en juego." : "Vamos al Match Center con los resultados.", liveStories.length ? "EPIC" : "NEWS", { pauseAfterMs: 200 }) });
    const ids = fill(mc, [...liveStories, ...resultStories], max("matchcenter"), used);
    segs.push(segment("matchcenter", mc, scale, ids, [{ name: "ESPN" }], liveStories.length ? "CRITICAL" : byId[ids[0]]?.priority ?? "MEDIUM"));
  } else warnings.push("Match Center: no hay partidos en juego ni resultados en el periodo.");

  // ---- 4. ANALYSIS: the story of the edition, in depth (stats revealed one by one)
  if (deepItem) {
    const m = results.get(deepItem.matchId!)!;
    const beats = [{ id: uid("b"), stage: "ANALYSIS" as StageId, shot: "WIDE" as const, screen: { type: "title" as const, kicker: "Análisis", title: m.headline }, narration: line(`El partido que más dejó para analizar: ${m.home.name} contra ${m.away.name}.`, "ANALYSIS", { pauseAfterMs: 250 }) }, ...resultStory(m, deepItem, data.logos, true, keysOf(m))];
    used.add(deepItem.id);
    segs.push(segment("analysis", beats, scale, [deepItem.id], [{ name: "ESPN" }], deepItem.priority));
  } else warnings.push("Análisis: no hay un partido con estadísticas en el periodo.");

  // ---- 5. DEBATE: a real poll if one exists; otherwise the question, with no invented votes
  const poll = data.polls.find((p) => p.status !== "draft" && (!p.matchId || [...results.keys(), ...matches.keys()].includes(p.matchId))) ?? data.polls.find((p) => p.status !== "draft");
  const debateMatch = deepItem ? results.get(deepItem.matchId!) : resultsItems[0] ? results.get(resultsItems[0].matchId!) : undefined;
  if (poll || debateMatch) {
    const total = poll ? poll.options.reduce((n, o) => n + o.votes, 0) : 0;
    const question = poll?.question ?? (debateMatch && (debateMatch.goals.home.length + debateMatch.goals.away.length) >= 2 ? `¿Quién fue la figura de ${debateMatch.home.name} contra ${debateMatch.away.name}?` : `¿Qué le dejó a usted ${debateMatch!.home.name} contra ${debateMatch!.away.name}?`);
    const options = poll?.options ?? [];
    const scr: ScreenContent = { type: "poll", question, options, state: poll ? (poll.status === "open" ? "open" : "closed") : "none", total };
    const beats: Beat[] = [
      { id: uid("b"), stage: "DEBATE", shot: "DEBATE", screen: { type: "title", kicker: "Debate", title: question }, narration: line("Llega el momento del debate.", "DEBATE", { pauseAfterMs: 300 }) },
      { id: uid("b"), shot: "SCREEN", screen: scr, narration: line(question, "DEBATE", { pauseAfterMs: 400 }) },
    ];
    if (poll && total > 0) {
      const lead = [...options].sort((a, b) => b.votes - a.votes)[0];
      beats.push({ id: uid("b"), narration: line(`Con ${total} votos reales del portal, va adelante ${lead.label}, con el ${Math.round((lead.votes / total) * 100)} por ciento.`, "DEBATE") });
    } else if (poll) {
      beats.push({ id: uid("b"), narration: line("La votación está abierta y todavía no tiene votos. Puede participar en el portal de NEXUS SPORT.", "FRIENDLY") });
    } else {
      beats.push({ id: uid("b"), narration: line("Déjenos su opinión en el portal de NEXUS SPORT; cuando se abra la votación, aquí verá los resultados reales.", "FRIENDLY") });
    }
    segs.push(segment("debate", beats, scale, poll ? [`poll:${poll.id}`] : [], [{ name: poll ? "Votos del portal" : "NEXUS SPORT" }], "MEDIUM", poll ? undefined : "Sin votación abierta: el director puede abrirla desde Audiencia"));
  } else warnings.push("Debate: no hay votación ni partido para debatir.");

  // ---- 6. DATA ARENA: the numbers of the period + standings
  const data6: Beat[] = [];
  const allLeagues = data.recaps.flatMap((r) => r.leagues).filter((l) => !opts.leagues.length || opts.leagues.includes(l.league));
  const finished = [...results.values()];
  if (finished.length) {
    const goals = finished.reduce((n, m) => n + m.home.score + m.away.score, 0);
    const homeW = finished.filter((m) => m.home.score > m.away.score).length, draws = finished.filter((m) => m.home.score === m.away.score).length;
    const best = [...finished].sort((a, b) => Math.abs(b.home.score - b.away.score) - Math.abs(a.home.score - a.away.score))[0];
    const nums = [
      { label: "partidos analizados", value: String(finished.length) },
      { label: "goles", value: String(goals) },
      { label: "goles por partido", value: (goals / finished.length).toFixed(1) },
      { label: "victorias locales", value: String(homeW) },
      { label: "empates", value: String(draws) },
      { label: `mayor diferencia: ${best.home.short ?? best.home.name} ${best.home.score}-${best.away.score} ${best.away.short ?? best.away.name}`, value: `+${Math.abs(best.home.score - best.away.score)}` },
    ];
    const base = { type: "numbers" as const, title: "El periodo en números", items: nums };
    data6.push({ id: uid("b"), stage: "STATS", shot: "WIDE", screen: { ...base, reveal: 0 }, narration: line("Pasamos a la Data Arena.", "ANALYSIS", { pauseAfterMs: 200 }) });
    data6.push({ id: uid("b"), shot: "DATA", screen: { ...base, reveal: 3 }, narration: line(`${finished.length} partidos, ${goals} goles: ${(goals / finished.length).toFixed(1)} por partido.`, "ANALYSIS") });
    data6.push({ id: uid("b"), screen: { ...base, reveal: 6 }, narration: line(`${homeW} victorias locales y ${draws} empates. La mayor diferencia: ${best.home.name} ${best.home.score} a ${best.away.score} ${best.away.name}.`, "ANALYSIS") });
    // what the period says beyond the totals
    dayInsights(finished).slice(0, 3).forEach((k) => data6.push({ id: uid("b"), shot: "HERO", narration: line(k.text, "ANALYSIS"), lower: { kicker: "Tendencia", text: k.text, source: "ESPN" } }));
  }
  void allLeagues;
  const tableLeague = Object.keys(data.standings).filter((l) => !opts.leagues.length || opts.leagues.includes(l)).sort((a, b) => weightOf(b) - weightOf(a))[0];
  const st = tableLeague ? data.standings[tableLeague] : undefined;
  if (st?.rows.length) {
    const played = new Set(finished.filter((m) => m.league === tableLeague).flatMap((m) => [m.home.name, m.away.name]));
    const group = st.rows[0].group;
    const shown = group ? st.rows.filter((r) => r.group === group) : st.rows;
    const rows = shown.slice(0, 8).map((r) => ({ ...r, logo: r.logo ? data.logos[r.logo] : undefined }));
    const base = { type: "table" as const, title: group ? `${st.leagueName} · ${group}` : st.leagueName, rows, highlight: [...played] };
    const leader = shown[0], second = shown[1];
    data6.push({ id: uid("b"), shot: "DATA", screen: { ...base, reveal: 0 }, narration: line(group ? `Así va el ${group} de ${st.leagueName}.` : `Así va la tabla de ${st.leagueName}.`, "ANALYSIS", { pauseAfterMs: 150 }) });
    data6.push({ id: uid("b"), screen: { ...base, reveal: 4 }, narration: line(`${leader.team} lidera con ${leader.points} puntos${second ? `; ${second.team} es segundo con ${second.points}` : ""}.`, "ANALYSIS") });
    data6.push({ id: uid("b"), screen: { ...base, reveal: 8 }, holdMs: 2500 });
  }
  if (data6.length) segs.push(segment("data", data6, scale, [], [{ name: "ESPN" }], "MEDIUM"));
  else warnings.push("Data Arena: sin resultados ni tabla disponibles.");

  // ---- 7. WHAT'S NEXT: fixtures in Colombia time, with table context (expectation, never a prediction of the score)
  const fixtures = items.filter((i) => i.kind === "fixture" && !used.has(i.id)).map((i) => matches.get(i.matchId!)!).filter(Boolean);
  if (fixtures.length) {
    const byTime = [...fixtures].sort((a, b) => Date.parse(a.kickoff) - Date.parse(b.kickoff));
    const rows = byTime.slice(0, 6).map((m) => ({ time: clockTime(m.kickoff), day: dayLabel(m.kickoff, now), league: m.leagueName, home: team(m.home, data.logos), away: team(m.away, data.logos) }));
    const base = { type: "fixtures" as const, title: "Lo que viene", rows };
    const beats: Beat[] = [{ id: uid("b"), stage: "UPCOMING", shot: "SPLIT", screen: { ...base, reveal: rows.length }, narration: line("Y ahora, lo que viene.", "EXPECTATION", { pauseAfterMs: 250 }) }];
    const featured = items.filter((i) => i.kind === "fixture" && !used.has(i.id)).slice(0, 4);
    for (const it of featured) {
      const m = matches.get(it.matchId!)!;
      const table = data.standings[m.league]?.rows ?? [];
      const pos = (n: string) => table.find((r) => r.team === n);
      const ph = pos(m.home.name), pa = pos(m.away.name);
      const where = (r: { pos: number; group?: string }) => (r.group ? `${r.pos}° del ${r.group}` : `${r.pos}°`);
      const ctx = ph && pa ? ` ${m.home.name} llega ${where(ph)} con ${ph.points} puntos y ${m.away.name}, ${where(pa)} con ${pa.points}.` : "";
      const classic = isClassic(m.home.name, m.away.name) ? " Es un clásico." : "";
      beats.push({ id: uid("b"), shot: "SCREEN", lower: { kicker: `${dayLabel(m.kickoff, now)} · ${clockTime(m.kickoff)}`, text: `${m.home.name} vs ${m.away.name}`, source: "ESPN" },
        narration: line(`${dayLabel(m.kickoff, now) === "hoy" ? "Hoy" : dayLabel(m.kickoff, now) === "mañana" ? "Mañana" : `El ${dayLabel(m.kickoff, now)}`}, ${spokenTime(m.kickoff)}, en ${m.leagueName}: ${m.home.name} contra ${m.away.name}.${classic}${ctx}`, "EXPECTATION") });
      used.add(it.id);
    }
    segs.push(segment("next", beats, scale, featured.map((f) => f.id), [{ name: "ESPN (calendario)" }], featured[0]?.priority ?? "MEDIUM"));
  } else if (opts.modes.includes("upcoming")) warnings.push("Próximos días: no hay partidos programados en las ligas elegidas.");

  // ---- 8. CLOSING: summary of the edition, the poll, the next match
  const summary = items.filter((i) => used.has(i.id)).slice(0, 3).map((i) => i.title);
  const nextUp = fixtures.sort((a, b) => Date.parse(a.kickoff) - Date.parse(b.kickoff))[0];
  const closeLines = [...summary, ...(nextUp ? [`Próximo: ${nextUp.home.name} vs ${nextUp.away.name}, ${dayLabel(nextUp.kickoff, now)} ${clockTime(nextUp.kickoff)}`] : [])];
  const closing: Beat[] = [{ id: uid("b"), stage: "CLOSING", shot: "HERO", screen: { type: "closing", title: "Lo que nos deja el programa", lines: closeLines, reveal: 0 }, narration: line("Vamos cerrando.", "FRIENDLY", { pauseAfterMs: 250 }) }];
  summary.forEach((s, i) => closing.push({ id: uid("b"), screen: { type: "closing", title: "Lo que nos deja el programa", lines: closeLines, reveal: i + 1 }, narration: line(`${s}.`, "NEWS") }));
  if (nextUp) closing.push({ id: uid("b"), screen: { type: "closing", title: "Lo que nos deja el programa", lines: closeLines, reveal: closeLines.length }, narration: line(`Y no se pierda ${nextUp.home.name} contra ${nextUp.away.name}, ${dayLabel(nextUp.kickoff, now)} ${spokenTime(nextUp.kickoff)}.`, "EXPECTATION") });
  closing.push({ id: uid("b"), shot: "CLOSING", screen: { type: "title", kicker: "NEXUS SPORT", title: "Gracias por acompañarnos", subtitle: "Nos vemos en la próxima edición" }, narration: line("Gracias por acompañarnos. Esto fue NEXUS SPORT. Nos vemos en la próxima edición.", "FRIENDLY"), holdMs: 2500 });
  segs.push(segment("closing", closing, scale, [], [], "HIGH"));

  // durations follow content: report segments that could not reach their minimum (never padded)
  segs.forEach((s) => { if (s.estimatedS < s.minS && s.kind !== "opening" && s.kind !== "closing") s.note = [s.note, `Contenido para ${s.estimatedS} s (mínimo sugerido ${s.minS} s): no se rellena`].filter(Boolean).join(" · "); });
  const estimatedS = segs.reduce((t, s) => t + s.estimatedS, 0);
  if (estimatedS < opts.targetMin * 60 * 0.6) warnings.push(`La edición dura unos ${Math.round(estimatedS / 60)} min de ${opts.targetMin}: no hay más contenido verificado y no se rellena.`);
  const modes = opts.modes.map((m) => ({ yesterday: "Resumen de ayer", today: "Actualidad de hoy", week: "Balance semanal", upcoming: "Próximos días" })[m]);
  return { id: uid("ed"), createdAt: now, title: opts.title ?? modes.join(" + "), modes: opts.modes, leagues: opts.leagues, targetMin: opts.targetMin, segments: segs, items: byId, estimatedS, warnings };
}

/** Re-estimates a segment after the director edited it. */
export function reestimate(s: Segment): Segment { return { ...s, estimatedS: Math.round(segmentSeconds(s.beats)) }; }
