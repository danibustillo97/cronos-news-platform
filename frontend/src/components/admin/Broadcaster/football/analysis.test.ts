import { describe, expect, it } from "vitest";
import { insightLowerThird, talkingPoints, type MatchDetail } from "./analysis";

const base: MatchDetail = {
  id: "1", league: "uefa.champions", leagueName: "UEFA Champions League", state: "in", clock: "13'", statusText: "13'",
  home: { id: "359", name: "Arsenal", short: "ARS", logo: null, score: 1 },
  away: { id: "124", name: "Borussia Dortmund", short: "BVB", logo: null, score: 0 },
  events: [{ id: "b", minute: "10'", type: "goal", team: "home", player: { id: "258906", name: "Viktor Gyökeres" }, assist: { id: "2", name: "Noni Madueke" }, text: "" }],
  stats: [
    { key: "possessionPct", label: "Posesión", home: 77.2, away: 22.8, percent: true },
    { key: "totalShots", label: "Remates", home: 4, away: 3, percent: false },
    { key: "shotsOnTarget", label: "Remates al arco", home: 2, away: 0, percent: false },
  ],
  commentary: [],
};

describe("talkingPoints", () => {
  it("builds points only from real data", () => {
    const pts = talkingPoints(base);
    expect(pts[0]).toBe("Último gol: Viktor Gyökeres al 10' para Arsenal, asistencia de Madueke.".replace("Madueke", "Noni Madueke"));
    expect(pts).toContain("Arsenal domina la pelota con 77% de posesión; Borussia Dortmund espera para salir de contra.");
    expect(pts).toContain("Borussia Dortmund remata pero no inquieta: 3 remates y ninguno al arco.");
  });

  it("handles 0-0, red cards and a balanced game", () => {
    const pts = talkingPoints({
      ...base, events: [{ id: "r", minute: "40'", type: "red", team: "away", player: { id: "9", name: "Emre Can" }, assist: null, text: "" }],
      stats: [{ key: "possessionPct", label: "Posesión", home: 52, away: 48, percent: true }],
    });
    expect(pts[0]).toBe("Sigue el 0-0 al 13'.");
    expect(pts).toContain("Partido parejo en la posesión: 52% ARS - 48% BVB.");
    expect(pts).toContain("Borussia Dortmund juega con uno menos desde el 40' por la expulsión de Emre Can.");
  });

  it("lower third trims long facts", () => {
    const lt = insightLowerThird({ player: { id: "1", name: "Viktor Gyökeres", team: null, image: null, position: null }, facts: [], lastGames: [], season: null }, "x".repeat(120));
    expect(lt.title).toBe("VIKTOR GYÖKERES");
    expect(lt.subtitle.length).toBe(90);
  });
});
