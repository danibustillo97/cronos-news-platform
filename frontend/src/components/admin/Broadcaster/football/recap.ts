// Matchday recap: turns an ESPN match summary into what the automatic show puts
// on screen — result, scorers, key stats, analysis sentences and how the table
// looks now. Every sentence is computed from the numbers (no AI). Pure + tested.

// ESPN payloads are loosely typed on purpose.
export type EspnSummaryLite = any;

export interface RecapTeam { id: string; name: string; short: string; logo?: string; color?: string; score: number }
export interface RecapGoal { player: string; minute: string; assist?: string; kind: "goal" | "penalty" | "own" }
export interface RecapStat { label: string; home: number; away: number; percent?: boolean }
export interface RecapRow { pos: number; teamId: string; team: string; points: number; played: number; gd: number }
export interface RecapMatch {
  id: string; league: string; leagueName: string; date?: string;
  home: RecapTeam; away: RecapTeam;
  goals: { home: RecapGoal[]; away: RecapGoal[] };
  reds: { team: "home" | "away"; player: string; minute: string }[];
  stats: RecapStat[];
  headline: string;
  analysis: string[];
  impact: string[];
  table: RecapRow[];
  tableName?: string;
  /** Pre-match odds (decimal) kept by ESPN after the game. */
  odds?: { home: number; draw: number; away: number; ou?: number; over?: number; under?: number; provider?: string };
}

/** A pick that WON, with its decimal odds. */
export interface WinningPick { matchId: string; match: string; pick: string; odds: number; league: string }
export interface Parlay { name: string; picks: WinningPick[]; odds: number }

const STATS: [string, string, boolean?][] = [
  ["possessionPct", "Posesión", true], ["totalShots", "Remates"], ["shotsOnTarget", "Al arco"], ["wonCorners", "Córners"],
  ["passPct", "Precisión de pase", true], ["foulsCommitted", "Faltas"], ["saves", "Atajadas"],
];

const num = (v: unknown) => { const n = Number(String(v ?? "").replace("%", "")); return Number.isFinite(n) ? n : 0; };
const minuteOf = (m: string) => { const parts = (m.match(/\d+/g) ?? []).map(Number); return (parts[0] ?? 0) + (parts[1] ?? 0); };
const surname = (name: string) => { const p = name.trim().split(/\s+/); return p.length > 1 ? p.slice(1).join(" ") : name; };
const pts = (n: number) => `${n} ${n === 1 ? "punto" : "puntos"}`;

function team(c: any): RecapTeam {
  const t = c?.team ?? {};
  const color = typeof t.color === "string" && /^[0-9a-f]{6}$/i.test(t.color) ? `#${t.color}` : undefined;
  return { id: String(t.id ?? ""), name: t.displayName ?? t.name ?? "", short: t.abbreviation ?? (t.displayName ?? "").slice(0, 3).toUpperCase(),
    logo: t.logos?.[0]?.href ?? t.logo, color, score: num(c?.score) };
}

/** Phase rules per competition (who goes through) used in the table sentence. */
export function zoneOf(league: string, pos: number, size: number): string | null {
  if (["uefa.champions", "uefa.europa", "uefa.europa.conf"].includes(league) && size >= 24) return pos <= 8 ? "octavos directos" : pos <= 24 ? "playoff" : "eliminación";
  if (league === "col.1" && size >= 16) return pos <= 8 ? "cuadrangulares" : "fuera de los 8";
  if (["conmebol.libertadores", "conmebol.sudamericana"].includes(league) && size <= 4) return pos <= 2 ? "clasificación" : pos === 3 ? "repechaje" : "eliminación";
  return null;
}

export function buildRecapMatch(league: string, data: EspnSummaryLite): RecapMatch | null {
  const comp = data?.header?.competitions?.[0];
  const cs: any[] = comp?.competitors ?? [];
  const hc = cs.find((c) => c.homeAway === "home");
  const ac = cs.find((c) => c.homeAway === "away");
  if (!hc || !ac) return null;
  const home = team(hc);
  const away = team(ac);
  const side = (id: unknown): "home" | "away" | null => (String(id) === home.id ? "home" : String(id) === away.id ? "away" : null);

  const goals: RecapMatch["goals"] = { home: [], away: [] };
  const reds: RecapMatch["reds"] = [];
  const order: ("home" | "away")[] = [];
  for (const k of data?.keyEvents ?? []) {
    const text = String(k?.type?.text ?? "");
    const minute = String(k?.clock?.displayValue ?? "");
    const who = k?.participants?.[0]?.athlete?.displayName ?? "";
    const s = side(k?.team?.id);
    if (k?.scoringPlay && s) {
      const kind = /own/i.test(text) ? "own" : /penalty/i.test(text) ? "penalty" : "goal";
      goals[s].push({ player: who, minute, assist: kind === "goal" ? k?.participants?.[1]?.athlete?.displayName : undefined, kind });
      order.push(s);
    } else if (/red card/i.test(text) && s) {
      reds.push({ team: s, player: who, minute });
    }
  }

  const box: any[] = data?.boxscore?.teams ?? [];
  const statsOf = (id: string) => Object.fromEntries((box.find((t) => String(t?.team?.id) === id)?.statistics ?? []).map((s: any) => [s.name, s.displayValue]));
  const hs = statsOf(home.id);
  const as = statsOf(away.id);
  // ESPN gives some percentages as fractions (passPct 0.84) and others as 0-100 (possession 71.4)
  const pct = (v: number) => Math.round(v <= 1 && v > 0 ? v * 100 : v);
  const stats = STATS.filter(([k]) => k in hs || k in as).map(([k, label, percent]) => ({ label, home: percent ? pct(num(hs[k])) : num(hs[k]), away: percent ? pct(num(as[k])) : num(as[k]), percent }))
    .filter((s) => s.home || s.away);

  // table (the group that has these teams)
  let table: RecapRow[] = [];
  let tableName: string | undefined;
  for (const g of data?.standings?.groups ?? []) {
    const entries: any[] = g?.standings?.entries ?? [];
    if (!entries.some((e) => String(e.id) === home.id || String(e.id) === away.id)) continue;
    table = entries.map((e, i) => {
      const st = Object.fromEntries((e.stats ?? []).map((s: any) => [s.name, s.value]));
      return { pos: num(st.rank) || i + 1, teamId: String(e.id ?? ""), team: e.team ?? "", points: num(st.points), played: num(st.gamesPlayed), gd: num(st.pointDifferential) };
    }).sort((a, b) => a.pos - b.pos);
    tableName = g.header;
    break;
  }

  const pc = data?.pickcenter?.[0];
  const dec = (ml: unknown) => { const v = Number(ml); if (!Number.isFinite(v) || v === 0) return 0; return Math.round((v > 0 ? 1 + v / 100 : 1 + 100 / Math.abs(v)) * 100) / 100; };
  const odds = pc ? { home: dec(pc.homeTeamOdds?.moneyLine), draw: dec(pc.drawOdds?.moneyLine), away: dec(pc.awayTeamOdds?.moneyLine),
    ou: Number(pc.overUnder) || undefined, over: dec(pc.overOdds) || undefined, under: dec(pc.underOdds) || undefined, provider: pc.provider?.name } : undefined;
  const m: RecapMatch = {
    id: String(comp?.id ?? ""), league, leagueName: data?.header?.league?.name ?? league, date: comp?.date,
    home, away, goals, reds, stats, table, tableName: tableName && !/standings/i.test(tableName) ? tableName.replace(/^Group/i, "Grupo") : undefined,
    headline: "", analysis: [], impact: [], odds: odds && (odds.home || odds.away) ? odds : undefined,
  };
  m.headline = headlineOf(m);
  m.analysis = analysisOf(m, order);
  m.impact = impactOf(m);
  return m;
}

export function headlineOf(m: RecapMatch): string {
  const { home, away } = m;
  const diff = home.score - away.score;
  if (diff === 0) return home.score === 0 ? `${home.name} y ${away.name} no se hicieron daño: 0-0` : `${home.name} y ${away.name} igualaron ${home.score}-${away.score}`;
  const [w, l, ws, ls, awayWin] = diff > 0 ? [home, away, home.score, away.score, false] : [away, home, away.score, home.score, true];
  if (ws - ls >= 3) return `${w.name} goleó ${ws}-${ls} a ${l.name}${awayWin ? " de visitante" : ""}`;
  return awayWin ? `${w.name} ganó ${ws}-${ls} en su visita a ${l.name}` : `${w.name} venció ${ws}-${ls} a ${l.name}`;
}

export function scorersLine(goals: RecapGoal[]): string {
  const by = new Map<string, string[]>();
  for (const g of goals) {
    const name = `${surname(g.player || "Gol")}${g.kind === "own" ? " (e.c.)" : g.kind === "penalty" ? " (p)" : ""}`;
    by.set(name, [...(by.get(name) ?? []), g.minute]);
  }
  return [...by].map(([n, mins]) => `${n} ${mins.join(" ")}`).join(" · ");
}

function analysisOf(m: RecapMatch, order: ("home" | "away")[]): string[] {
  const out: string[] = [];
  const { home, away } = m;
  const winner = home.score > away.score ? "home" : away.score > home.score ? "away" : null;
  const T = { home, away };
  const stat = (label: string) => m.stats.find((s) => s.label === label);

  // comeback / decisive late goal
  if (winner && order.length >= 2 && order[0] !== winner) out.push(`Remontada: ${T[order[0]].name} se adelantó y ${T[winner].name} le dio vuelta al marcador.`);
  const winGoals = winner ? m.goals[winner] : [];
  const loseGoals = winner ? m.goals[winner === "home" ? "away" : "home"] : [];
  if (winner && winGoals.length === loseGoals.length + 1) {
    const decisive = winGoals[winGoals.length - 1];
    if (decisive && minuteOf(decisive.minute) >= 80) out.push(`El gol del triunfo llegó al ${decisive.minute}: ${decisive.player}.`);
  }
  // braces / hat-tricks
  for (const s of ["home", "away"] as const) {
    const count = new Map<string, number>();
    m.goals[s].filter((g) => g.kind !== "own").forEach((g) => count.set(g.player, (count.get(g.player) ?? 0) + 1));
    for (const [p, n] of count) if (n >= 2) out.push(`${n >= 3 ? "Hat-trick" : "Doblete"} de ${p} para ${T[s].name}.`);
  }
  // possession and shots
  const pos = stat("Posesión");
  if (pos && winner) {
    const wp = Math.round(winner === "home" ? pos.home : pos.away);
    if (wp && wp < 45) out.push(`${T[winner].name} ganó con solo ${wp}% de la pelota: fue más directo y efectivo.`);
    else if (wp >= 60) out.push(`${T[winner].name} dominó la posesión (${wp}%) y lo reflejó en el marcador.`);
  } else if (pos && !winner && Math.max(pos.home, pos.away) >= 60) {
    const s = pos.home > pos.away ? "home" : "away";
    out.push(`${T[s].name} tuvo la pelota (${Math.round(Math.max(pos.home, pos.away))}%) pero no encontró el gol del triunfo.`);
  }
  const shots = stat("Remates");
  const onT = stat("Al arco");
  if (shots && (shots.home || shots.away)) {
    const s = shots.home >= shots.away ? "home" : "away";
    const o = s === "home" ? "away" : "home";
    if (winner && s !== winner && shots[s] - shots[o] >= 4) out.push(`${T[winner].name} ganó pese a rematar menos: ${shots[winner]} remates contra ${shots[s]} de ${T[s].name}.`);
    else out.push(`${T[s].name} remató ${shots[s]} veces${onT ? ` (${onT[s]} al arco)` : ""} contra ${shots[o]} de ${T[o].name}.`);
  }
  for (const r of m.reds) out.push(`Expulsión de ${r.player} (${T[r.team].name}) al ${r.minute}.`);
  return out.slice(0, 4);
}

function impactOf(m: RecapMatch): string[] {
  if (!m.table.length) return [];
  const size = m.table.length;
  const leader = m.table[0];
  return [m.home, m.away].map((t) => {
    const row = m.table.find((r) => r.teamId === t.id);
    if (!row) return "";
    let s = `${t.name} queda ${row.pos}.º con ${pts(row.points)}`;
    const zone = zoneOf(m.league, row.pos, size);
    if (zone) s += ` (zona de ${zone})`;
    if (row.pos === 1) s += "; es el líder";
    else if (leader && leader.points - row.points <= 3) s += `; a ${pts(leader.points - row.points)} del líder`;
    return `${s}.`;
  }).filter(Boolean);
}

/** Picks that won in each match: the result (1X2) and over/under when there are odds. */
export function winningPicks(matches: RecapMatch[]): WinningPick[] {
  const out: WinningPick[] = [];
  for (const m of matches) {
    if (!m.odds) continue;
    const label = `${m.home.short} ${m.home.score}-${m.away.score} ${m.away.short}`;
    const r = m.home.score > m.away.score ? ["home", `Gana ${m.home.name}`] : m.away.score > m.home.score ? ["away", `Gana ${m.away.name}`] : ["draw", "Empate"];
    const o = m.odds[r[0] as "home" | "draw" | "away"];
    if (o > 1) out.push({ matchId: m.id, match: label, pick: r[1], odds: o, league: m.league });
    const total = m.home.score + m.away.score;
    if (m.odds.ou && total !== m.odds.ou) {
      const over = total > m.odds.ou;
      const ou = over ? m.odds.over : m.odds.under;
      if (ou && ou > 1) out.push({ matchId: m.id, match: label, pick: `${over ? "Más" : "Menos"} de ${m.odds.ou} goles`, odds: ou, league: m.league });
    }
  }
  return out;
}

/** "Parley seguro" (favourites that delivered) and "Parley bomba" (the best-paying winners), one pick per match. */
export function bestParlays(picks: WinningPick[], size = 3): Parlay[] {
  const results = picks.filter((p) => !/goles$/.test(p.pick));
  const oneEach = (list: WinningPick[]) => { const seen = new Set<string>(); return list.filter((p) => (seen.has(p.matchId) ? false : (seen.add(p.matchId), true))); };
  const make = (name: string, list: WinningPick[]): Parlay | null => {
    const chosen = oneEach(list).slice(0, size);
    if (chosen.length < 2) return null;
    return { name, picks: chosen, odds: Math.round(chosen.reduce((n, p) => n * p.odds, 1) * 100) / 100 };
  };
  const safe = make("Parley seguro", [...results].filter((p) => p.odds >= 1.15).sort((a, b) => a.odds - b.odds));
  const bomb = make("Parley bomba", [...picks].sort((a, b) => b.odds - a.odds));
  return [safe, bomb].filter((p): p is Parlay => Boolean(p));
}

export interface JornadaNumbers {
  matches: number; goals: number; homeWins: number; draws: number; awayWins: number;
  byLeague: { league: string; name: string; goals: number; matches: number }[];
  scorers: { player: string; team: string; goals: number }[];
}
export function jornadaNumbers(leagues: { league: string; leagueName: string; matches: RecapMatch[] }[]): JornadaNumbers {
  const all = leagues.flatMap((l) => l.matches);
  const scorers = new Map<string, { player: string; team: string; goals: number }>();
  for (const m of all) for (const s of ["home", "away"] as const) for (const g of m.goals[s]) {
    if (g.kind === "own" || !g.player) continue;
    const key = `${g.player}|${m[s].name}`;
    scorers.set(key, { player: g.player, team: m[s].name, goals: (scorers.get(key)?.goals ?? 0) + 1 });
  }
  return {
    matches: all.length, goals: all.reduce((n, m) => n + m.home.score + m.away.score, 0),
    homeWins: all.filter((m) => m.home.score > m.away.score).length, draws: all.filter((m) => m.home.score === m.away.score).length,
    awayWins: all.filter((m) => m.away.score > m.home.score).length,
    byLeague: leagues.map((l) => ({ league: l.league, name: l.leagueName, matches: l.matches.length, goals: l.matches.reduce((n, m) => n + m.home.score + m.away.score, 0) })),
    scorers: [...scorers.values()].sort((a, b) => b.goals - a.goals).slice(0, 5),
  };
}

// ------------------------------------------------------------------ the show
export type SlideKind = "intro" | "league" | "result" | "stats" | "analysis" | "impact" | "numbers" | "parlays" | "outro";
export interface RecapLeague { league: string; leagueName: string; matches: RecapMatch[] }
export interface Slide {
  kind: SlideKind; seconds: number; league?: string; leagueName?: string; match?: RecapMatch; matches?: RecapMatch[]; title?: string; lines?: string[];
  numbers?: JornadaNumbers; parlays?: Parlay[]; picks?: WinningPick[];
}

export interface RundownOptions { stats: boolean; analysis: boolean; impact: boolean; speed: number; title: string; numbers?: boolean; parlays?: boolean }

/** The program: intro → per league (title, then per match: result, stats, analysis, impact) → closing. */
export function buildRundown(leagues: RecapLeague[], opts: RundownOptions): Slide[] {
  const k = Math.max(0.5, opts.speed);
  const s = (n: number) => Math.round(n * k);
  const all = leagues.flatMap((l) => l.matches);
  if (!all.length) return [];
  const slides: Slide[] = [{ kind: "intro", seconds: s(7), title: opts.title, matches: all, lines: leagues.map((l) => `${l.leagueName}: ${l.matches.length} ${l.matches.length === 1 ? "partido" : "partidos"}`) }];
  for (const l of leagues) {
    slides.push({ kind: "league", seconds: s(6), league: l.league, leagueName: l.leagueName, matches: l.matches });
    for (const m of l.matches) {
      slides.push({ kind: "result", seconds: s(9), league: l.league, leagueName: l.leagueName, match: m });
      if (opts.stats && m.stats.length) slides.push({ kind: "stats", seconds: s(9), league: l.league, leagueName: l.leagueName, match: m });
      if (opts.analysis && m.analysis.length) slides.push({ kind: "analysis", seconds: s(6 + m.analysis.length * 2), league: l.league, leagueName: l.leagueName, match: m, lines: m.analysis });
      if (opts.impact && m.impact.length) slides.push({ kind: "impact", seconds: s(10), league: l.league, leagueName: l.leagueName, match: m, lines: m.impact });
    }
  }
  if (opts.numbers !== false) slides.push({ kind: "numbers", seconds: s(12), title: "La jornada en números", numbers: jornadaNumbers(leagues), matches: all });
  const picks = winningPicks(all);
  const parlays = bestParlays(picks);
  if (opts.parlays !== false && parlays.length) {
    slides.push({ kind: "parlays", seconds: s(13), title: "Los parleys ganadores", parlays, picks: [...picks].sort((a, b) => b.odds - a.odds).slice(0, 5) });
  }
  const goals = all.reduce((n, m) => n + m.home.score + m.away.score, 0);
  const big = [...all].sort((a, b) => Math.abs(b.home.score - b.away.score) - Math.abs(a.home.score - a.away.score))[0];
  slides.push({ kind: "outro", seconds: s(9), title: "Así fue la jornada", matches: all, lines: [
    `${all.length} partidos · ${goals} goles (${(goals / all.length).toFixed(1)} por partido)`,
    big ? `El resultado más amplio: ${big.headline}` : "",
  ].filter(Boolean) });
  return slides;
}

export const yyyymmdd = (d: Date) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
