// Phase 3 — advanced sports graphics: turns REAL match data (match detail
// events, player insights, portal polls) into the content of the graphics:
// substitution, booking, match timeline, player duel, debate result.
// Pure + tested; the designs live in designs.ts.

export interface TeamSide { name: string; short: string; logo?: string; color?: string }
export interface DetailEvent { id: string; minute: string; type: string; team: "home" | "away" | null; player: { id: string; name: string } | null; assist?: { id: string; name: string } | null; text: string }
export interface MatchDetailLite {
  id: string; league: string; leagueName?: string; state?: string; statusText?: string;
  home: { id?: string; name: string; short?: string; logo?: string; color?: string; score?: number | null };
  away: { id?: string; name: string; short?: string; logo?: string; color?: string; score?: number | null };
  events: DetailEvent[];
}

export interface SubCard { team: TeamSide; minute: string; playerIn: string; playerOut?: string; injury: boolean; competition?: string }
export interface BookingCard { team: TeamSide; minute: string; player: string; color: "yellow" | "red"; competition?: string }
export interface TimelineEvent { minute: number; label: string; type: "goal" | "yellow" | "red" | "sub"; team: "home" | "away"; player: string }
export interface Timeline { home: TeamSide; away: TeamSide; score: string; status: string; competition?: string; events: TimelineEvent[]; end: number }

export const minuteValue = (m: string) => { const n = (m.match(/\d+/g) ?? []).map(Number); return (n[0] ?? 0) + (n[1] ?? 0); };
const side = (d: MatchDetailLite, s: "home" | "away"): TeamSide => ({ name: d[s].name, short: d[s].short || d[s].name.slice(0, 3).toUpperCase(), logo: d[s].logo, color: d[s].color });

/** "Substitution, Barcelona. Dani Olmo replaces Pedri because of an injury." → in / out / injury. */
export function parseSubText(text: string): { playerIn?: string; playerOut?: string; injury: boolean } {
  const m = text.match(/\.\s*(.+?) replaces (.+?)(?: because of an injury)?\.?\s*$/i);
  return { playerIn: m?.[1]?.trim(), playerOut: m?.[2]?.trim(), injury: /because of an injury/i.test(text) };
}

export function subFromEvent(d: MatchDetailLite, e: DetailEvent): SubCard | null {
  if (e.type !== "sub" || !e.team) return null;
  const parsed = parseSubText(e.text);
  const playerIn = e.player?.name || parsed.playerIn;
  if (!playerIn) return null;
  return { team: side(d, e.team), minute: e.minute, playerIn, playerOut: parsed.playerOut, injury: parsed.injury, competition: d.leagueName };
}

export function bookingFromEvent(d: MatchDetailLite, e: DetailEvent): BookingCard | null {
  if ((e.type !== "yellow" && e.type !== "red") || !e.team || !e.player) return null;
  return { team: side(d, e.team), minute: e.minute, player: e.player.name, color: e.type, competition: d.leagueName };
}

/** Most recent event of a kind (the list comes in match order). */
export function lastEvent(d: MatchDetailLite, types: string[]): DetailEvent | null {
  return [...d.events].reverse().find((e) => types.includes(e.type)) ?? null;
}

export function timelineFrom(d: MatchDetailLite): Timeline {
  const events: TimelineEvent[] = d.events
    .filter((e) => ["goal", "penalty-goal", "own-goal", "yellow", "red", "sub"].includes(e.type) && e.team)
    .map((e) => {
      const type = (e.type.includes("goal") ? "goal" : e.type) as TimelineEvent["type"];
      const sub = type === "sub" ? parseSubText(e.text) : null;
      const who = e.player?.name ?? sub?.playerIn ?? "";
      return { minute: minuteValue(e.minute), label: e.minute, type, team: e.team as "home" | "away", player: who };
    });
  const end = Math.max(90, ...events.map((e) => e.minute));
  return {
    home: side(d, "home"), away: side(d, "away"), score: `${d.home.score ?? 0}-${d.away.score ?? 0}`,
    status: d.state === "post" ? "FINAL" : d.state === "in" ? (d.statusText || "EN VIVO") : "PREVIA", competition: d.leagueName, events, end,
  };
}

// ---------------------------------------------------------------- player duel
export interface PlayerInsight {
  player: { id: string; name: string; team?: string; image?: string; position?: string };
  lastGames?: { goals?: number; assists?: number }[];
  season?: { season?: string; competition?: string; goals?: number; assists?: number; starts?: number; shots?: number; shotsOnTarget?: number } | null;
}
export interface DuelRow { label: string; a: number; b: number; suffix?: string }
export interface Duel { a: { name: string; team?: string; image?: string; position?: string; competition?: string }; b: { name: string; team?: string; image?: string; position?: string; competition?: string }; rows: DuelRow[] }

/** Side-by-side numbers of two players (only what both have; nothing estimated). */
export function duelFrom(a: PlayerInsight, b: PlayerInsight): Duel {
  const sa = a.season ?? {};
  const sb = b.season ?? {};
  const rows: DuelRow[] = [];
  const add = (label: string, x?: number, y?: number, suffix?: string) => { if (typeof x === "number" && typeof y === "number") rows.push({ label, a: x, b: y, suffix }); };
  add("Goles", sa.goals, sb.goals);
  add("Asistencias", sa.assists, sb.assists);
  add("Titularidades", sa.starts, sb.starts);
  add("Remates", sa.shots, sb.shots);
  add("Remates al arco", sa.shotsOnTarget, sb.shotsOnTarget);
  const pct = (s: typeof sa) => (s.shots ? Math.round(((s.shotsOnTarget ?? 0) / s.shots) * 100) : undefined);
  add("Precisión de remate", pct(sa), pct(sb), "%");
  const last = (p: PlayerInsight) => (p.lastGames?.length ? p.lastGames.slice(0, 5).reduce((n, g) => n + (g.goals ?? 0), 0) : undefined);
  add("Goles (últimos 5)", last(a), last(b));
  const info = (p: PlayerInsight, s: typeof sa) => ({ name: p.player.name, team: p.player.team, image: p.player.image, position: p.player.position, competition: s.competition ? `${s.competition} ${s.season ?? ""}`.trim() : undefined });
  return { a: info(a, sa), b: info(b, sb), rows };
}

/** Best default for a duel: a starting attacker, then any starting outfield player, never the goalkeeper first. */
export function duelDefault(players: { id: string; name: string; starter?: boolean; position?: string | null }[]): string {
  const pos = (p: { position?: string | null }) => (p.position ?? "").toUpperCase();
  const starters = players.filter((p) => p.starter);
  const attacker = starters.find((p) => /^(F|FW|ST|CF|LW|RW|SS|AM|CAM)/.test(pos(p)));
  const outfield = starters.find((p) => pos(p) && !/^G/.test(pos(p)));
  return (attacker ?? outfield ?? starters[0] ?? players[0])?.id ?? "";
}

// ---------------------------------------------------------------- debate / poll result
export interface PollResult { question: string; kind: "poll" | "debate"; total: number; options: { label: string; votes: number; pct: number; winner: boolean }[] }
export function pollResult(board: { question: string; kind: "poll" | "debate"; options: { label: string; votes: number }[]; total?: number }): PollResult {
  const total = board.options.reduce((n, o) => n + o.votes, 0);
  const max = Math.max(0, ...board.options.map((o) => o.votes));
  const options = board.options.map((o) => ({ label: o.label, votes: o.votes, pct: total ? Math.round((o.votes / total) * 100) : 0, winner: total > 0 && o.votes === max }));
  return { question: board.question, kind: board.kind, total, options };
}

// ---------------------------------------------------------------- result card (half-time / full-time)
export interface ResultCard { label: string; home: TeamSide; away: TeamSide; score: { home: number; away: number }; scorers: { home: string[]; away: string[] }; competition?: string }
export function resultFrom(d: MatchDetailLite, label: string): ResultCard {
  const scorers = { home: [] as string[], away: [] as string[] };
  for (const e of d.events) {
    if (!e.team || !["goal", "penalty-goal", "own-goal"].includes(e.type)) continue;
    const who = (e.player?.name ?? "").split(" ").slice(-1)[0];
    // an own goal counts for the other side
    const side = e.type === "own-goal" ? (e.team === "home" ? "away" : "home") : e.team;
    scorers[side].push(`${who}${e.type === "penalty-goal" ? " (p)" : e.type === "own-goal" ? " (e.c.)" : ""} ${e.minute}`);
  }
  return { label, home: side(d, "home"), away: side(d, "away"), score: { home: d.home.score ?? 0, away: d.away.score ?? 0 }, scorers, competition: d.leagueName };
}

// ---------------------------------------------------------------- featured player (only from real numbers)
/** Top scorer of the match (own goals excluded); tie → the one in the winning team. Null when nobody scored. */
export function featuredPlayerId(d: MatchDetailLite): { id: string; name: string; goals: number; team: "home" | "away" } | null {
  const count = new Map<string, { id: string; name: string; goals: number; team: "home" | "away" }>();
  for (const e of d.events) {
    if (!e.player || !e.team || (e.type !== "goal" && e.type !== "penalty-goal")) continue;
    const c = count.get(e.player.id) ?? { id: e.player.id, name: e.player.name, goals: 0, team: e.team };
    c.goals += 1;
    count.set(e.player.id, c);
  }
  const winner = (d.home.score ?? 0) > (d.away.score ?? 0) ? "home" : (d.away.score ?? 0) > (d.home.score ?? 0) ? "away" : null;
  return [...count.values()].sort((a, b) => b.goals - a.goals || Number(b.team === winner) - Number(a.team === winner))[0] ?? null;
}
export interface PlayerCard { name: string; team?: string; image?: string; position?: string; headline: string; rows: { label: string; value: string }[]; facts: string[] }
export function playerCardFrom(p: PlayerInsight & { facts?: string[] }, headline: string): PlayerCard {
  const s = p.season ?? {};
  const rows: { label: string; value: string }[] = [];
  const add = (label: string, v?: number) => { if (typeof v === "number") rows.push({ label, value: String(v) }); };
  add("Goles", s.goals); add("Asistencias", s.assists); add("Titularidades", s.starts); add("Remates al arco", s.shotsOnTarget);
  return { name: p.player.name, team: p.player.team, image: p.player.image, position: p.player.position, headline: headline || (s.competition ? `${s.competition} ${s.season ?? ""}` : ""), rows, facts: (p.facts ?? []).slice(0, 2) };
}
