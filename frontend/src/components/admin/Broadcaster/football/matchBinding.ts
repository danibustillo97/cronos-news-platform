// Any match -> scoreboard data for the on-air designs, so each graphic can be
// bound to ITS match (scoreboard of A, line-ups of B, stats of C at once) and
// refresh by itself. Pure + tested; logos come pre-converted to data URLs.

import type { FootballScoreboard, FootballTeamPlayer } from "../graphicExport";
import type { MatchDetail } from "./analysis";
import { parseClock, periodOf } from "./autoSync";
import { COMPETITIONS } from "./competitions";
import { createMatch } from "./useFootballMatch";

export interface MatchRef { league: string; id: string }

type DetailWithLineups = MatchDetail & {
  period?: number;
  lineups?: { home: { id: string; name: string; jersey?: string | null; position?: string | null; starter: boolean }[]; away: { id: string; name: string; jersey?: string | null; position?: string | null; starter: boolean }[] };
};

const POS: Record<string, FootballTeamPlayer["position"]> = { G: "POR", GK: "POR", D: "DEF", CB: "DEF", LB: "DEF", RB: "DEF", M: "MED", CM: "MED", DM: "MED", AM: "MED", F: "ATA", FW: "ATA", ST: "ATA" };

function players(list: NonNullable<DetailWithLineups["lineups"]>["home"]): FootballTeamPlayer[] {
  return list.map((p) => ({
    id: p.id, name: p.name, dorsal: Number(p.jersey) || 0, starter: p.starter, captain: false,
    position: POS[(p.position || "").toUpperCase()] ?? (/^g/i.test(p.position || "") ? "POR" : /^d/i.test(p.position || "") ? "DEF" : /^f|^a/i.test(p.position || "") ? "ATA" : "MED"),
  }));
}

export function toScoreboard(detail: DetailWithLineups, logos: { home?: string; away?: string } = {}): FootballScoreboard {
  const theme = COMPETITIONS.find((c) => c.espn === detail.league);
  const { base, added } = parseClock(detail.clock);
  const count = (kind: string, team: "home" | "away") => detail.events.filter((e) => e.type === kind && e.team === team).length;
  const scorers = (team: "home" | "away") => detail.events
    .filter((e) => (e.type === "goal" || e.type === "penalty-goal") && e.team === team && e.player)
    .map((e) => `${e.player!.name.split(" ").slice(-1)[0]} ${e.minute}`);
  const period = periodOf(detail);
  return {
    ...createMatch(),
    competitionId: theme?.id ?? "custom",
    competition: theme?.name ?? detail.leagueName,
    homeTeam: detail.home.name, awayTeam: detail.away.name,
    homeShort: detail.home.short, awayShort: detail.away.short,
    homeLogo: logos.home, awayLogo: logos.away,
    homeScore: detail.home.score ?? 0, awayScore: detail.away.score ?? 0,
    period, clockSeconds: base * 60, addedTime: added,
    homeYellow: count("yellow", "home"), awayYellow: count("yellow", "away"),
    homeRed: count("red", "home"), awayRed: count("red", "away"),
    scorers: { home: scorers("home"), away: scorers("away") },
    lineups: detail.lineups ? { home: players(detail.lineups.home), away: players(detail.lineups.away) } : undefined,
    stats: detail.stats.map((s) => ({ label: s.label, home: Math.round(s.home), away: Math.round(s.away) })),
    matchStatus: period === "FT" ? "finished" : period === "HT" ? "halftime" : period === "PRE" ? "scheduled" : "live",
  };
}
