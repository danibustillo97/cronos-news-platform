import { describe, expect, it } from "vitest";
import { parseClock, periodOf, planSync } from "./autoSync";
import type { MatchDetail } from "./analysis";

const detail = (over: Partial<MatchDetail & { period: number }> = {}): MatchDetail & { period: number } => ({
  id: "1", league: "uefa.champions", leagueName: "Champions", state: "in", clock: "63'", statusText: "63'", period: 2,
  home: { id: "h", name: "Arsenal", short: "ARS", logo: null, score: 2 }, away: { id: "a", name: "Dortmund", short: "BVB", logo: null, score: 1 },
  events: [
    { id: "g1", minute: "10'", type: "goal", team: "home", player: { id: "1", name: "Gyökeres" }, assist: { id: "2", name: "Madueke" }, text: "" },
    { id: "y1", minute: "34'", type: "yellow", team: "away", player: { id: "3", name: "Can" }, assist: null, text: "" },
    { id: "g2", minute: "51'", type: "penalty-goal", team: "away", player: { id: "4", name: "Guirassy" }, assist: null, text: "" },
    { id: "g3", minute: "60'", type: "goal", team: "home", player: { id: "5", name: "Saka" }, assist: null, text: "" },
    { id: "k", minute: "", type: "period", team: null, player: null, assist: null, text: "" },
  ],
  stats: [], commentary: [], ...over,
});

describe("autoSync", () => {
  it("parses clocks with added time", () => {
    expect(parseClock("63'")).toEqual({ base: 63, added: 0 });
    expect(parseClock("45'+2'")).toEqual({ base: 45, added: 2 });
    expect(parseClock("")).toEqual({ base: 0, added: 0 });
  });

  it("maps match state to periods", () => {
    expect(periodOf({ state: "pre", statusText: "" })).toBe("PRE");
    expect(periodOf({ state: "in", statusText: "HT", period: 1 })).toBe("HT");
    expect(periodOf({ state: "in", statusText: "63'", period: 2 })).toBe("2T");
    expect(periodOf({ state: "in", statusText: "105'", period: 3 })).toBe("ET");
    expect(periodOf({ state: "post", statusText: "FT" })).toBe("FT");
  });

  it("takes the authoritative scoreboard and only NEW events", () => {
    const plan = planSync(detail(), new Set(["m:g1", "m:y1"]));
    expect(plan).toMatchObject({ period: "2T", clockSeconds: 63 * 60, running: true, homeScore: 2, awayScore: 1, awayYellow: 1, homeYellow: 0 });
    expect(plan.newEvents.map((e) => [e.kind, e.team, e.player, e.minute, e.detail])).toEqual([
      ["goal", "away", "Guirassy", 51, "Penal"],
      ["goal", "home", "Saka", 60, undefined],
    ]);
    expect(plan.eventIds).toContain("m:k");
  });

  it("does not run the clock at half time", () => {
    expect(planSync(detail({ statusText: "HT", clock: "45'+3'", period: 1 }), new Set()).running).toBe(false);
  });
});
