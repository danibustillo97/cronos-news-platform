import { describe, expect, it } from "vitest";
import { toScoreboard } from "./matchBinding";

describe("toScoreboard", () => {
  it("maps any match into scoreboard data", () => {
    const sb = toScoreboard({
      id: "9", league: "uefa.champions", leagueName: "UEFA Champions League", state: "in", clock: "45'+2'", statusText: "45'+2'", period: 1,
      home: { id: "h", name: "Club Brugge", short: "BRU", logo: null, score: 1 }, away: { id: "a", name: "Liverpool", short: "LIV", logo: null, score: 2 },
      events: [
        { id: "1", minute: "12'", type: "goal", team: "away", player: { id: "p", name: "Mohamed Salah" }, assist: null, text: "" },
        { id: "2", minute: "30'", type: "yellow", team: "home", player: { id: "q", name: "X" }, assist: null, text: "" },
      ],
      stats: [{ key: "possessionPct", label: "Posesión", home: 41.4, away: 58.6, percent: true }], commentary: [],
      lineups: { home: [{ id: "1", name: "Mignolet", jersey: "22", position: "G", starter: true }], away: [{ id: "2", name: "Salah", jersey: "11", position: "F", starter: true }] },
    }, { home: "data:h" });
    expect(sb).toMatchObject({ competitionId: "champions", homeShort: "BRU", awayScore: 2, period: "1T", clockSeconds: 45 * 60, addedTime: 2, homeYellow: 1, homeLogo: "data:h" });
    expect(sb.scorers).toEqual({ home: [], away: ["Salah 12'"] });
    expect(sb.lineups?.home[0]).toMatchObject({ name: "Mignolet", dorsal: 22, position: "POR" });
    expect(sb.lineups?.away[0].position).toBe("ATA");
    expect(sb.stats?.[0]).toEqual({ label: "Posesión", home: 41, away: 59 });
  });
});
