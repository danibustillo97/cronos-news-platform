import { describe, expect, it } from "vitest";
import summary from "./__fixtures__/ucl-summary.json";
import { bestParlays, buildRecapMatch, buildRundown, headlineOf, scorersLine, winningPicks } from "./recap";

describe("matchday recap", () => {
  const m = buildRecapMatch("uefa.champions", summary)!;

  it("reads result, scorers, stats and table from the ESPN summary", () => {
    expect(m.home).toMatchObject({ name: "Sabah FK", score: 1 });
    expect(m.away).toMatchObject({ name: "Barcelona", score: 4, short: "BAR" });
    expect(m.goals.away).toHaveLength(4);
    expect(scorersLine(m.goals.away)).toContain("Gordon 31' 51'");
    expect(m.stats.find((s) => s.label === "Posesión")).toBeTruthy();
    expect(m.table.length).toBeGreaterThan(20);
  });

  it("writes the headline, analysis and impact", () => {
    expect(m.headline).toBe("Barcelona goleó 4-1 a Sabah FK de visitante");
    expect(m.analysis.some((a) => a.startsWith("Doblete de Anthony Gordon"))).toBe(true);
    expect(m.impact[1]).toMatch(/^Barcelona queda \d+\.º con \d+ puntos \(zona de /);
  });

  it("builds the program in order", () => {
    const show = buildRundown([{ league: "uefa.champions", leagueName: "Champions", matches: [m] }], { stats: true, analysis: true, impact: true, speed: 1, title: "Jornada" });
    expect(show.map((s) => s.kind)).toEqual(["intro", "league", "result", "stats", "analysis", "impact", "numbers", "outro"]); // one match: no parlay
    expect(headlineOf({ ...m, home: { ...m.home, score: 0 }, away: { ...m.away, score: 0 } })).toContain("0-0");
  });

  it("finds the winning picks with their odds and builds parlays", () => {
    expect(m.odds).toMatchObject({ home: 29, away: 1.06, draw: 14 });
    const picks = winningPicks([m]);
    expect(picks[0]).toMatchObject({ pick: "Gana Barcelona", odds: 1.06 });
    expect(picks.some((p) => p.pick === "Más de 4.5 goles")).toBe(true);
    const other = { ...m, id: "2", home: { ...m.home, score: 2 }, away: { ...m.away, score: 0 } };
    const parlays = bestParlays(winningPicks([m, other]));
    const bomb = parlays.find((p) => p.name === "Parley bomba")!;
    expect(bomb.picks).toHaveLength(2); // one pick per match
    expect(bomb.odds).toBeGreaterThan(29);
  });
});
