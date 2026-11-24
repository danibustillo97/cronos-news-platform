import { describe, expect, it } from "vitest";
import { matchScore, normalizeText, rankMatches } from "./paletteSearch";

describe("palette search", () => {
  it("ignores accents, case and extra spaces", () => {
    expect(normalizeText("  Selección   Colombia ")).toBe("seleccion colombia");
    expect(matchScore("Selección Colombia gana", "seleccion")).toBeGreaterThan(0);
  });

  it("requires every word of the query", () => {
    expect(matchScore("Millonarios golea a Santa Fe", "millonarios santa")).toBeGreaterThan(0);
    expect(matchScore("Millonarios golea a Santa Fe", "millonarios nacional")).toBe(0);
  });

  it("ranks prefix and word-start matches first, then keeps the original order", () => {
    const items = ["La final de la Copa", "Copa América: sorteo", "Recopa en juego", "Copa del Rey"];
    expect(rankMatches(items, "copa", (item) => item)).toEqual(["Copa América: sorteo", "Copa del Rey", "La final de la Copa", "Recopa en juego"]);
  });

  it("returns everything (up to the limit) for an empty query", () => {
    expect(rankMatches(["a", "b", "c"], "", (item) => item, 2)).toEqual(["a", "b"]);
  });
});
