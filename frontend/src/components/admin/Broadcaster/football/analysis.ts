// Live analysis for the commentator: talking points computed from the real
// match data (/api/matches/{league}/{event}). Pure and tested -- no AI, no
// invented numbers: every sentence is derived from a stat or an event.

export interface MatchTeam { id: string; name: string; short: string; logo: string | null; score: number | null; form?: string | null }
export interface MatchEventItem {
  id: string; minute: string;
  type: "goal" | "own-goal" | "penalty-goal" | "penalty-miss" | "yellow" | "red" | "sub" | "var" | "period" | "other";
  team: "home" | "away" | null; player: { id: string; name: string } | null; assist: { id: string; name: string } | null; text: string;
}
export interface MatchStat { key: string; label: string; home: number; away: number; percent: boolean }
export interface MatchDetail {
  id: string; league: string; leagueName: string; state: "pre" | "in" | "post"; clock: string; statusText: string;
  home: MatchTeam; away: MatchTeam; events: MatchEventItem[]; stats: MatchStat[];
  commentary: { minute: string; text: string }[];
}
export interface PlayerInsights {
  player: { id: string; name: string; team: string | null; image: string | null; position: string | null };
  facts: string[];
  lastGames: { date: string; opponent: string; result: string; score: string; goals: number; assists: number }[];
  season: { season: string; competition: string; goals: number; assists: number; starts: number } | null;
}

export const GOAL_TYPES = new Set<MatchEventItem["type"]>(["goal", "penalty-goal", "own-goal"]);

const stat = (m: MatchDetail, key: string) => m.stats.find((s) => s.key === key);
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(0));

export function talkingPoints(m: MatchDetail): string[] {
  const points: string[] = [];
  const h = m.home.short || m.home.name;
  const a = m.away.short || m.away.name;
  const goals = m.events.filter((e) => GOAL_TYPES.has(e.type));
  const last = goals[goals.length - 1];
  if (last) {
    const who = last.player?.name ?? "";
    const team = last.team === "home" ? m.home.name : last.team === "away" ? m.away.name : "";
    const how = last.type === "penalty-goal" ? " de penal" : last.type === "own-goal" ? " (en contra)" : "";
    points.push(`Último gol: ${who}${how} al ${last.minute} para ${team}${last.assist ? `, asistencia de ${last.assist.name}` : ""}.`);
  } else if (m.state === "in") {
    points.push(`Sigue el 0-0 al ${m.clock}.`);
  }

  const pos = stat(m, "possessionPct");
  if (pos && Math.abs(pos.home - pos.away) >= 20) {
    const [dom, val, other] = pos.home > pos.away ? [m.home.name, pos.home, m.away.name] : [m.away.name, pos.away, m.home.name];
    points.push(`${dom} domina la pelota con ${fmt(val)}% de posesión; ${other} espera para salir de contra.`);
  } else if (pos) {
    points.push(`Partido parejo en la posesión: ${fmt(pos.home)}% ${h} - ${fmt(pos.away)}% ${a}.`);
  }

  const shots = stat(m, "totalShots");
  const onTarget = stat(m, "shotsOnTarget");
  if (shots && onTarget) {
    points.push(`Remates: ${fmt(shots.home)} (${fmt(onTarget.home)} al arco) para ${h} y ${fmt(shots.away)} (${fmt(onTarget.away)} al arco) para ${a}.`);
    for (const [side, name] of [["home", m.home.name], ["away", m.away.name]] as const) {
      if (shots[side] >= 3 && onTarget[side] === 0) points.push(`${name} remata pero no inquieta: ${fmt(shots[side])} remates y ninguno al arco.`);
    }
  }

  const reds = m.events.filter((e) => e.type === "red");
  for (const r of reds) {
    const team = r.team === "home" ? m.home.name : m.away.name;
    points.push(`${team} juega con uno menos desde el ${r.minute}${r.player ? ` por la expulsión de ${r.player.name}` : ""}.`);
  }
  const yellows = stat(m, "yellowCards");
  if (yellows && yellows.home + yellows.away >= 4) points.push(`Partido caliente: ${fmt(yellows.home + yellows.away)} amarillas.`);

  const corners = stat(m, "wonCorners");
  if (corners && Math.abs(corners.home - corners.away) >= 4) {
    points.push(`${corners.home > corners.away ? m.home.name : m.away.name} carga por las bandas: ${fmt(Math.max(corners.home, corners.away))} córners.`);
  }
  const saves = stat(m, "saves");
  if (saves && Math.max(saves.home, saves.away) >= 3) {
    points.push(`El arquero de ${saves.home > saves.away ? m.home.name : m.away.name} sostiene a su equipo: ${fmt(Math.max(saves.home, saves.away))} atajadas.`);
  }
  return points;
}

/** Text for an on-screen lower third built from one insight. */
export function insightLowerThird(ins: PlayerInsights, fact: string): { title: string; subtitle: string } {
  return { title: ins.player.name.toUpperCase(), subtitle: fact.length > 90 ? `${fact.slice(0, 89).trimEnd()}…` : fact };
}
