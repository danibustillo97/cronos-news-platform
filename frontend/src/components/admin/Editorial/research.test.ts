import { describe, expect, it } from "vitest";
import { internalLink, snippetAround, sourceQuote } from "./research";

describe("research panel content", () => {
  it("returns short texts whole and long ones around the searched word", () => {
    expect(snippetAround("Texto corto.", "corto")).toBe("Texto corto.");
    const long = `${"Contexto previo del partido. ".repeat(20)}El delantero marcó el gol decisivo en el minuto 90. ${"Más texto después. ".repeat(20)}`;
    const snippet = snippetAround(long, "delantero", 120);
    expect(snippet).toContain("delantero");
    expect(snippet.startsWith("…")).toBe(true);
    expect(snippet.length).toBeLessThanOrEqual(124);
  });

  it("falls back to the beginning when the word is not in the text", () => {
    expect(snippetAround("a ".repeat(300), "zzz", 50).endsWith("…")).toBe(true);
  });

  it("links to other articles of the site", () => {
    expect(internalLink("Final de Copa", "final-de-copa")[0]).toEqual({
      type: "text", text: "Final de Copa", marks: [{ type: "link", attrs: { href: "/noticia/final-de-copa" } }],
    });
  });

  it("quotes a source and only links web URLs", () => {
    const quoted = sourceQuote("Frase citada", "AS", "https://as.com/nota");
    expect(quoted.type).toBe("blockquote");
    expect(JSON.stringify(quoted)).toContain("https://as.com/nota");
    expect(JSON.stringify(sourceQuote("x", "Fuente", "javascript:alert(1)"))).not.toContain("javascript:");
  });
});
