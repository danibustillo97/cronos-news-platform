import { describe, expect, it } from "vitest";
import { debatePrompts } from "./debate";
import type { MatchDetail } from "./analysis";

const live: MatchDetail = {
  id: "1", league: "uefa.champions", leagueName: "Champions", state: "in", clock: "63'", statusText: "63'",
  home: { id: "h", name: "Arsenal", short: "ARS", logo: null, score: 1 }, away: { id: "a", name: "Dortmund", short: "BVB", logo: null, score: 0 },
  events: [{ id: "g", minute: "10'", type: "goal", team: "home", player: { id: "1", name: "Viktor Gyökeres" }, assist: null, text: "" }],
  stats: [{ key: "possessionPct", label: "Posesión", home: 72, away: 28, percent: true }], commentary: [],
};

describe("debatePrompts", () => {
  it("builds debates from real numbers", () => {
    const ps = debatePrompts("Arsenal", "Dortmund", live, {
      favorite: { side: "home", label: "Favorito claro", probability: 68 },
      keyPlayers: [{ name: "Saka", team: "home", stat: "4 goles" }, { name: "Guirassy", team: "away", stat: "5 goles" }],
    });
    const ids = ps.map((p) => p.id);
    expect(ids).toEqual(["winner", "upset", "possession", "mvp", "duel"]);
    expect(ps[0].context).toBe("Van 1-0 al 63'");
    expect(ps[1].question).toBe("¿Puede Dortmund dar la sorpresa ante Arsenal?");
    expect(ps[2].question).toBe("¿Arsenal gana por dominar la pelota?");
    expect(ps[3].question).toBe("¿Viktor Gyökeres es la figura del partido?");
    expect(ps.every((p) => p.kind === "poll" || p.options.length === 2)).toBe(true);
  });

  it("after the final asks if it was fair, without the winner question", () => {
    const ps = debatePrompts("Arsenal", "Dortmund", { ...live, state: "post" }, null);
    expect(ps.map((p) => p.id)).toEqual(["mvp", "fair"]);
  });
});
