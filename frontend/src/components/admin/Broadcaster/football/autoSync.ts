// Automatic mode: turns the live match data (/api/matches/{league}/{id}) into
// the broadcaster's scoreboard state -- period, running clock, added time,
// score, cards -- plus the NEW events to animate on air (goal, cards, subs).
// Pure and tested; the hook in useFootballMatch applies it every 15 s.

import type { FootballScoreboard } from "../graphicExport";
import type { MatchDetail } from "./analysis";

export type Period = FootballScoreboard["period"];

export interface SyncEvent {
  id: string;
  kind: "goal" | "yellow" | "red" | "sub";
  team: "home" | "away";
  player: string;
  minute: number;
  detail?: string;
}

export interface SyncPlan {
  period: Period;
  clockSeconds: number;
  addedTime: number;
  running: boolean;
  homeScore: number;
  awayScore: number;
  homeYellow: number;
  awayYellow: number;
  homeRed: number;
  awayRed: number;
  newEvents: SyncEvent[];
  eventIds: string[];
}

/** "63'" -> {base: 63, added: 0}; "45'+2'" -> {base: 45, added: 2}; "" -> {0,0}. */
export function parseClock(clock: string): { base: number; added: number } {
  const nums = (clock || "").match(/\d+/g)?.map(Number) ?? [];
  return { base: nums[0] ?? 0, added: nums[1] ?? 0 };
}

export function periodOf(detail: Pick<MatchDetail, "state" | "statusText"> & { period?: number }): Period {
  if (detail.state === "pre") return "PRE";
  if (detail.state === "post") return "FT";
  const text = (detail.statusText || "").toLowerCase();
  if (/\bht\b|half ?time|descanso|entretiempo/.test(text)) return "HT";
  if (/pen/.test(text) || (detail.period ?? 0) >= 5) return "PEN";
  if ((detail.period ?? 0) >= 3 || /\bet\b|extra/.test(text)) return "ET";
  if ((detail.period ?? 0) === 2) return "2T";
  return "1T";
}

const KIND: Record<string, SyncEvent["kind"] | undefined> = {
  goal: "goal", "penalty-goal": "goal", "own-goal": "goal", yellow: "yellow", red: "red", sub: "sub",
};

export function planSync(detail: MatchDetail & { period?: number }, handled: Set<string>): SyncPlan {
  const period = periodOf(detail);
  const { base, added } = parseClock(detail.clock);
  const running = period === "1T" || period === "2T" || period === "ET";
  const count = (kind: string, team: "home" | "away") => detail.events.filter((e) => e.type === kind && e.team === team).length;
  const newEvents: SyncEvent[] = [];
  for (const e of detail.events) {
    const kind = KIND[e.type];
    if (!kind || !e.team || handled.has(`m:${e.id}`)) continue;
    const detailText = e.type === "penalty-goal" ? "Penal" : e.type === "own-goal" ? "Autogol" : kind === "goal" && e.assist ? `Asistencia: ${e.assist.name}` : undefined;
    newEvents.push({ id: `m:${e.id}`, kind, team: e.team, player: e.player?.name ?? "", minute: parseClock(e.minute).base, detail: detailText });
  }
  return {
    period, clockSeconds: base * 60, addedTime: added, running,
    homeScore: detail.home.score ?? 0, awayScore: detail.away.score ?? 0,
    homeYellow: count("yellow", "home"), awayYellow: count("yellow", "away"),
    homeRed: count("red", "home"), awayRed: count("red", "away"),
    newEvents, eventIds: detail.events.map((e) => `m:${e.id}`),
  };
}
