import { describe, expect, it } from "vitest";
import { goalAlertText, newGoals, toMultiScores, type BoardMatch, type GoalMoment } from "./liveBoard";

describe("liveBoard", () => {
  it("orders live first and formats scores", () => {
    const matches: BoardMatch[] = [
      { id: "1", leagueName: "LaLiga", homeTeam: "Betis", awayTeam: "Sevilla", homeScore: 2, awayScore: 1, status: "finished" },
      { id: "2", leagueName: "Champions League", homeTeam: "Arsenal", awayTeam: "Dortmund", homeScore: 1, awayScore: 0, status: "live", statusDetail: "63'" },
      { id: "3", leagueName: "Serie A", homeTeam: "Inter", awayTeam: "Milan", status: "scheduled", date: "2099-01-01T00:00:00Z" },
    ];
    const out = toMultiScores(matches);
    expect(out.map((m) => m.id)).toEqual(["2"]); // only live: finished and scheduled never enter the live multi-screen
    expect(out[0]).toMatchObject({ homeScore: 1, awayScore: 0, status: "live", detail: "63'" });
    expect(toMultiScores(matches, 10, { selected: ["1"] }).map((m) => m.id)).toEqual(["2"]); // a finished match can't be forced in
    expect(toMultiScores(matches, 10, { selected: ["gone"] }).map((m) => m.id)).toEqual(["2"]); // stale choice -> all live
  });

  it("alerts only new goals from other matches", () => {
    const moments: GoalMoment[] = [
      { id: "a", kind: "goal", matchId: "10", headline: "" },
      { id: "b", kind: "goal", matchId: "11", headline: "" },
      { id: "c", kind: "final", matchId: "12", headline: "" },
      { id: "d", kind: "goal", matchId: "99", headline: "" },
    ];
    expect(newGoals(moments, new Set(["a"]), "99").map((m) => m.id)).toEqual(["b"]);
  });

  it("builds the alert text", () => {
    const t = goalAlertText({ id: "x", kind: "goal", matchId: "1", headline: "¡Gol de Bellingham!", minute: "23'", leagueName: "Champions League",
      player: { id: "1", name: "Jude Bellingham" }, home: { name: "Real Madrid" }, away: { name: "PSV" }, score: { home: 1, away: 0 } });
    expect(t).toEqual({ title: "Real Madrid 1-0 PSV", subtitle: "Jude Bellingham · 23' · Champions League" });
  });
});
