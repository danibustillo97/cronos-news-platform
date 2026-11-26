import { describe, expect, it } from "vitest";
import detail from "./__fixtures__/ucl-detail.json";
import playerA from "./__fixtures__/player-a.json";
import playerB from "./__fixtures__/player-b.json";
import { bookingFromEvent, duelDefault, duelFrom, featuredPlayerId, playerCardFrom, resultFrom, lastEvent, parseSubText, pollResult, subFromEvent, timelineFrom, type MatchDetailLite, type PlayerInsight } from "./eventGraphics";

const d = detail as unknown as MatchDetailLite;

describe("advanced graphics from real match data", () => {
  it("reads substitutions (in, out, injury)", () => {
    expect(parseSubText("Substitution, Barcelona. Dani Olmo replaces Pedri.")).toEqual({ playerIn: "Dani Olmo", playerOut: "Pedri", injury: false });
    expect(parseSubText("Substitution, Barcelona. João Cancelo replaces Alejandro Balde because of an injury.")).toMatchObject({ playerOut: "Alejandro Balde", injury: true });
    const sub = subFromEvent(d, lastEvent(d, ["sub"])!)!;
    expect(sub).toMatchObject({ minute: "86'", playerIn: "Brian Fariñas", playerOut: "Gavi", injury: false });
    expect(sub.team.name).toBe("Barcelona");
  });

  it("reads the last booking", () => {
    const card = bookingFromEvent(d, lastEvent(d, ["yellow", "red"])!)!;
    expect(card).toMatchObject({ player: "Ivan Lepinjica", color: "yellow", minute: "69'" });
    expect(card.team.name).toBe("Sabah FK");
  });

  it("builds the match timeline with goals, cards and subs", () => {
    const t = timelineFrom(d);
    expect(t.score).toBe("1-4");
    expect(t.status).toBe("FINAL");
    expect(t.events.filter((e) => e.type === "goal").map((e) => e.minute)).toEqual([31, 51, 55, 60, 63]);
    expect(t.events.some((e) => e.type === "yellow" && e.player === "Ivan Lepinjica")).toBe(true);
    expect(t.end).toBeGreaterThanOrEqual(90);
  });

  it("compares two players only with numbers both have", () => {
    const duel = duelFrom(playerA as PlayerInsight, playerB as PlayerInsight);
    expect(duel.a.name).toBe("Anthony Gordon");
    expect(duel.rows.find((r) => r.label === "Goles")).toEqual({ label: "Goles", a: 2, b: 2, suffix: undefined });
    expect(duel.rows.find((r) => r.label === "Precisión de remate")).toMatchObject({ a: 56, b: 44, suffix: "%" });
  });

  it("picks attackers, not goalkeepers, for a duel by default", () => {
    expect(duelDefault([{ id: "1", name: "Arquero", starter: true, position: "G" }, { id: "2", name: "Central", starter: true, position: "CD" }, { id: "3", name: "9", starter: true, position: "F" }])).toBe("3");
    expect(duelDefault([{ id: "1", name: "Arquero", starter: true, position: "G" }, { id: "2", name: "Central", starter: true, position: "CD" }])).toBe("2");
  });

  it("computes the debate result with the winner", () => {
    const r = pollResult({ question: "¿Quién gana?", kind: "poll", options: [{ label: "Local", votes: 30 }, { label: "Empate", votes: 10 }, { label: "Visita", votes: 60 }] });
    expect(r.total).toBe(100);
    expect(r.options.find((o) => o.winner)?.label).toBe("Visita");
    expect(r.options.map((o) => o.pct)).toEqual([30, 10, 60]);
    expect(pollResult({ question: "x", kind: "poll", options: [{ label: "a", votes: 0 }] }).options[0].winner).toBe(false);
  });

  it("builds the final result with scorers and the featured player only from real goals", () => {
    const r = resultFrom(d, "FINAL");
    expect(r.score).toEqual({ home: 1, away: 4 });
    expect(r.scorers.away).toEqual(["Gordon 31'", "Gordon 51'", "Adeyemi 55'", "Jesus 60'"]);
    expect(featuredPlayerId(d)).toMatchObject({ name: "Anthony Gordon", goals: 2, team: "away" });
    expect(featuredPlayerId({ ...d, events: [] })).toBeNull();
    const card = playerCardFrom(playerA as PlayerInsight & { facts?: string[] }, "Figura del partido");
    expect(card.rows.find((x) => x.label === "Goles")?.value).toBe("2");
    expect(card.facts).toHaveLength(2);
  });
});
