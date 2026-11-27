import { describe, expect, it } from "vitest";
import type { RecapMatch } from "../football/recap";
import { acceptLine } from "./aiWriter";
import { dayInsights, matchInsights } from "./insights";

const g = (player: string, minute: string, kind: "goal" | "penalty" | "own" = "goal") => ({ player, minute, kind });
const match = (p: Partial<RecapMatch> & { hs: number; as: number }): RecapMatch => ({
  id: p.id ?? "m1", league: "eng.1", leagueName: "Premier League",
  home: { id: "h", name: "Arsenal", short: "ARS", score: p.hs }, away: { id: "a", name: "Chelsea", short: "CHE", score: p.as },
  goals: p.goals ?? { home: [], away: [] }, reds: p.reds ?? [], stats: p.stats ?? [], headline: "", analysis: [], impact: [], table: [], odds: p.odds,
} as RecapMatch);

describe("data insights (only from real data)", () => {
  it("detects a comeback and a late winner from the goal timeline", () => {
    const m = match({ hs: 2, as: 1, goals: { home: [g("Saka", "60'"), g("Havertz", "90+2'")], away: [g("Palmer", "10'")] } });
    const kinds = matchInsights(m).map((i) => i.kind);
    expect(kinds).toContain("comeback");
    expect(kinds).toContain("late");
    expect(matchInsights(m).find((i) => i.kind === "late")!.text).toContain("92");
  });

  it("hat-tricks, braces, upsets and the possession paradox", () => {
    const m = match({ hs: 3, as: 0, goals: { home: [g("Saka", "5'"), g("Saka", "40'"), g("Saka", "70'")], away: [] }, odds: { home: 3.4, draw: 3.2, away: 2.1 }, stats: [{ label: "Posesión", home: 38, away: 62, percent: true }, { label: "Remates", home: 6, away: 15 }] });
    const kinds = matchInsights(m).map((i) => i.kind);
    expect(kinds).toEqual(expect.arrayContaining(["hattrick", "rout", "upset", "paradox", "efficiency"]));
  });

  it("never claims a minute-based angle when goals are missing from the timeline", () => {
    const m = match({ hs: 2, as: 1, goals: { home: [g("Saka", "90'")], away: [g("Palmer", "10'")] } }); // one home goal missing
    expect(matchInsights(m).map((i) => i.kind)).not.toContain("comeback");
  });

  it("the leader stumbling is an angle; period insights need enough data", () => {
    const m = match({ hs: 0, as: 1, goals: { home: [], away: [g("Palmer", "50'")] } });
    expect(matchInsights(m, [{ pos: 1, team: "Arsenal", points: 30, played: 12, gd: 15 }]).find((i) => i.kind === "leader")!.text).toContain("perdió");
    expect(dayInsights([m])).toEqual([]);
  });
});

describe("AI line validation", () => {
  const allowed = new Set(["2", "1", "92", "3.40"]);
  it("accepts lines whose numbers are all in the facts", () => {
    expect(acceptLine("Arsenal lo dio vuelta: 2 a 1 con un gol al minuto 92.", allowed)).toBe(true);
  });
  it("rejects invented figures and broken output", () => {
    expect(acceptLine("Arsenal suma 7 victorias seguidas.", allowed)).toBe(false);
    expect(acceptLine("undefined", allowed)).toBe(false);
    expect(acceptLine("Tres goles en el primer tiempo.", allowed)).toBe(false); // 3 is not in the facts
    expect(acceptLine("Dos goles para darle la vuelta.", allowed)).toBe(true);
    expect(acceptLine("Un clásico del fútbol colombiano.", allowed, "Deportivo Cali vs Bucaramanga")).toBe(false);
    expect(acceptLine("Un clásico del fútbol colombiano.", allowed, "Es un clásico.")).toBe(true);
    expect(acceptLine("Una goleada en Portugal.", allowed, "Viktoria Plzen 4-0 Benfica")).toBe(false);
  });
});
