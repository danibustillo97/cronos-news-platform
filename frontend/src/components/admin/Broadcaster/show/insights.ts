// Data intelligence: angles a sports editor would find, computed ONLY from the real data
// (goal timeline with minutes, ESPN stats, pre-match odds, standings). Every insight carries
// the numbers it states, so the narration can be checked against them. Nothing is guessed:
// if the data needed for an angle is missing, the angle simply doesn't appear.

import type { RecapGoal, RecapMatch } from "../football/recap";
import type { StandingRow } from "./editorial";

export type InsightKind = "comeback" | "late" | "early" | "hattrick" | "brace" | "rout" | "upset" | "paradox" | "efficiency" | "keeper" | "red" | "leader" | "cleansheet"
  | "day-scorer" | "day-league" | "day-away" | "day-goals" | "day-comebacks";
export interface Insight { kind: InsightKind; text: string; weight: number; matchId?: string }

const minuteOf = (m: string) => { const p = (m.match(/\d+/g) ?? []).map(Number); return (p[0] ?? 0) + (p[1] ?? 0); };
const last = (name: string) => name.split(" ").slice(-1)[0];
const stat = (m: RecapMatch, label: RegExp) => m.stats.find((s) => label.test(s.label));
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const sameTeam = (a: string, b: string) => norm(a) === norm(b) || norm(a).includes(norm(b)) || norm(b).includes(norm(a));

interface TimelineGoal extends RecapGoal { side: "home" | "away"; at: number }
/** Goals in order with the score after each one (own goals count for the side they were credited to). */
export function timeline(m: RecapMatch): { goal: TimelineGoal; home: number; away: number }[] {
  const all: TimelineGoal[] = [...m.goals.home.map((g) => ({ ...g, side: "home" as const, at: minuteOf(g.minute) })), ...m.goals.away.map((g) => ({ ...g, side: "away" as const, at: minuteOf(g.minute) }))]
    .sort((a, b) => a.at - b.at);
  let h = 0, a = 0;
  return all.map((goal) => { if (goal.side === "home") h++; else a++; return { goal, home: h, away: a }; });
}

export function matchInsights(m: RecapMatch, table: StandingRow[] = []): Insight[] {
  const out: Insight[] = [];
  const hs = m.home.score, as = m.away.score;
  const winner = hs > as ? "home" : as > hs ? "away" : null;
  const W = winner ? m[winner] : null, L = winner ? m[winner === "home" ? "away" : "home"] : null;
  const tl = timeline(m);
  const complete = tl.length === hs + as; // the minute-by-minute angles need every goal

  if (complete && winner && tl.length) {
    // comeback: the winner was behind at some point
    const deficit = Math.max(0, ...tl.map((x) => (winner === "home" ? x.away - x.home : x.home - x.away)));
    if (deficit > 0) out.push({ kind: "comeback", weight: 0.9 + deficit * 0.05, matchId: m.id, text: `Remontada: ${W!.name} llegó a ir perdiendo por ${deficit} y terminó ganando ${Math.max(hs, as)}-${Math.min(hs, as)}.` });
    // late decisive goal: from 85' on, the goal that gave the win
    const decisive = [...tl].reverse().find((x) => x.goal.side === winner && (winner === "home" ? x.home - x.away : x.away - x.home) === 1 && (winner === "home" ? hs - as : as - hs) === 1);
    if (decisive && decisive.goal.at >= 85 && decisive.goal.kind !== "own") out.push({ kind: "late", weight: 0.85, matchId: m.id, text: `Gol agónico: ${decisive.goal.player} le dio la victoria a ${W!.name} al minuto ${decisive.goal.at}.` });
  }
  if (complete && !winner && tl.length) {
    const lastGoal = tl[tl.length - 1];
    if (lastGoal.goal.at >= 85 && lastGoal.home === lastGoal.away) out.push({ kind: "late", weight: 0.75, matchId: m.id, text: `Empate sobre el final: ${lastGoal.goal.player} igualó para ${m[lastGoal.goal.side].name} al minuto ${lastGoal.goal.at}.` });
  }
  if (complete && tl[0] && tl[0].goal.at <= 5) out.push({ kind: "early", weight: 0.45, matchId: m.id, text: `Gol tempranero: ${tl[0].goal.player} marcó al minuto ${tl[0].goal.at} para ${m[tl[0].goal.side].name}.` });

  // braces and hat-tricks (own goals excluded)
  for (const side of ["home", "away"] as const) {
    const count = new Map<string, number>();
    m.goals[side].filter((g) => g.kind !== "own").forEach((g) => count.set(g.player, (count.get(g.player) ?? 0) + 1));
    for (const [player, n] of count) {
      if (n >= 3) out.push({ kind: "hattrick", weight: 0.95, matchId: m.id, text: `Triplete de ${player}: ${n} goles para ${m[side].name}.` });
      else if (n === 2) out.push({ kind: "brace", weight: 0.6, matchId: m.id, text: `Doblete de ${player} para ${m[side].name}.` });
    }
  }

  if (winner && Math.abs(hs - as) >= 3) out.push({ kind: "rout", weight: 0.7, matchId: m.id, text: `Goleada de ${W!.name}: ${Math.max(hs, as)}-${Math.min(hs, as)}, diferencia de ${Math.abs(hs - as)} goles.` });
  if (winner && Math.min(hs, as) === 0 && Math.max(hs, as) >= 2) out.push({ kind: "cleansheet", weight: 0.35, matchId: m.id, text: `${W!.name} ganó sin recibir goles.` });

  if (winner && m.odds) {
    const paid = winner === "home" ? m.odds.home : m.odds.away;
    const fav = Math.min(m.odds.home, m.odds.away);
    if (paid >= 2.6 && paid > fav) out.push({ kind: "upset", weight: 0.85, matchId: m.id, text: `Sorpresa: en las cuotas previas ${W!.name} pagaba ${paid.toFixed(2)} y ${L!.name} era favorito con ${fav.toFixed(2)}.` });
  }

  // the game the numbers don't explain
  const pos = stat(m, /posesi/i), shots = stat(m, /^remates$/i), onT = stat(m, /al arco/i), saves = stat(m, /atajadas/i);
  if (winner && pos) {
    const wp = winner === "home" ? pos.home : pos.away;
    if (wp <= 42) out.push({ kind: "paradox", weight: 0.7, matchId: m.id, text: `${W!.name} ganó con solo ${wp}% de posesión: ${L!.name} tuvo la pelota (${100 - wp}%) pero no el resultado.` });
  }
  if (winner && shots) {
    const ws = winner === "home" ? shots.home : shots.away, ls = winner === "home" ? shots.away : shots.home;
    if (ls >= ws + 5) out.push({ kind: "efficiency", weight: 0.65, matchId: m.id, text: `Eficacia: ${W!.name} ganó con ${ws} remates contra ${ls} de ${L!.name}.` });
  }
  if (onT && saves) {
    for (const side of ["home", "away"] as const) {
      const sv = saves[side];
      if (sv >= 6) out.push({ kind: "keeper", weight: 0.55, matchId: m.id, text: `El arquero de ${m[side].name} hizo ${sv} atajadas.` });
    }
  }
  if (m.reds.length && complete) {
    for (const r of m.reds) {
      const at = minuteOf(r.minute);
      const after = tl.filter((x) => x.goal.at > at && x.goal.side !== r.team).length;
      if (after > 0) out.push({ kind: "red", weight: 0.7, matchId: m.id, text: `La expulsión de ${r.player} al minuto ${at} pesó: con uno más, el rival marcó ${after} ${after === 1 ? "gol" : "goles"} después.` });
    }
  }

  // the leader stumbled / the leader won
  const leader = table.find((r) => r.pos === 1);
  if (leader) {
    const side = sameTeam(leader.team, m.home.name) ? "home" : sameTeam(leader.team, m.away.name) ? "away" : null;
    if (side) {
      const res = winner === side ? "ganó" : winner ? "perdió" : "empató";
      out.push({ kind: "leader", weight: winner === side ? 0.5 : 0.85, matchId: m.id, text: `${m[side].name}, líder con ${leader.points} puntos, ${res} ${hs}-${as}.` });
    }
  }
  return out.sort((a, b) => b.weight - a.weight);
}

/** Angles of the whole period (a jornada / a week). */
export function dayInsights(matches: RecapMatch[]): Insight[] {
  const out: Insight[] = [];
  if (!matches.length) return out;
  // top scorer of the period
  const scorers = new Map<string, { n: number; team: string }>();
  for (const m of matches) for (const side of ["home", "away"] as const) for (const g of m.goals[side]) {
    if (g.kind === "own") continue;
    const k = `${g.player}|${m[side].name}`;
    scorers.set(k, { n: (scorers.get(k)?.n ?? 0) + 1, team: m[side].name });
  }
  const top = [...scorers].sort((a, b) => b[1].n - a[1].n)[0];
  if (top && top[1].n >= 2) out.push({ kind: "day-scorer", weight: 0.8, text: `El goleador del periodo: ${top[0].split("|")[0]}, con ${top[1].n} goles para ${top[1].team}.` });
  // the league with more goals per match (2+ matches)
  const byLeague = new Map<string, { goals: number; n: number }>();
  matches.forEach((m) => { const l = byLeague.get(m.leagueName) ?? { goals: 0, n: 0 }; l.goals += m.home.score + m.away.score; l.n++; byLeague.set(m.leagueName, l); });
  const leagues = [...byLeague].filter(([, v]) => v.n >= 2).map(([k, v]) => ({ k, avg: v.goals / v.n, ...v })).sort((a, b) => b.avg - a.avg);
  if (leagues.length >= 2) out.push({ kind: "day-league", weight: 0.55, text: `${leagues[0].k} fue la liga más goleadora: ${leagues[0].goals} goles en ${leagues[0].n} partidos, ${leagues[0].avg.toFixed(1)} por partido.` });
  const away = matches.filter((m) => m.away.score > m.home.score).length, home = matches.filter((m) => m.home.score > m.away.score).length;
  if (matches.length >= 4 && away > home) out.push({ kind: "day-away", weight: 0.6, text: `Jornada de visitantes: ${away} victorias fuera de casa contra ${home} de los locales.` });
  const goals = matches.map((m) => ({ m, g: m.home.score + m.away.score })).sort((a, b) => b.g - a.g)[0];
  if (goals && goals.g >= 5) out.push({ kind: "day-goals", weight: 0.5, text: `El partido con más goles: ${goals.m.home.name} ${goals.m.home.score}-${goals.m.away.score} ${goals.m.away.name}, ${goals.g} goles.` });
  const comebacks = matches.filter((m) => matchInsights(m).some((i) => i.kind === "comeback")).length;
  if (comebacks >= 2) out.push({ kind: "day-comebacks", weight: 0.6, text: `Hubo ${comebacks} remontadas en el periodo.` });
  return out.sort((a, b) => b.weight - a.weight);
}
