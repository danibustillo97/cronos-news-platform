// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { parseHtml } from "./blockModel";
import { analyzeSeo, fernandezHuerta, sentences, suggestKeyword, syllables } from "./seo";

const para = (n: number) => Array.from({ length: n }, (_, i) =>
  `<p>Millonarios jugó un partido intenso en la fecha ${i + 1} y el técnico explicó la idea del equipo a la prensa. Según el club, la plantilla llega completa al cierre del torneo.</p>`).join("");

const good = {
  title: "Millonarios gana el clásico y queda líder de la Liga BetPlay",
  excerpt: "Millonarios venció 2-1 a Santa Fe en El Campín y llega como líder a la última fecha de los cuadrangulares.",
  seoTitle: "Millonarios gana el clásico y es líder de la Liga BetPlay",
  seoDescription: "Millonarios venció 2-1 a Santa Fe en El Campín, quedó líder de su grupo y depende de sí mismo para jugar la final de la Liga BetPlay.",
  slug: "millonarios-gana-clasico-lider-liga-betplay",
  tags: ["Millonarios", "Santa Fe", "Liga BetPlay"],
  categoryId: "futbol",
  coverUrl: "https://cdn/x.jpg",
  keyword: "Millonarios",
  originality: 92,
};

describe("seo analyzer", () => {
  it("scores a well-built news article high", () => {
    const blocks = parseHtml(`<p>Millonarios venció 2-1 a Santa Fe y quedó líder, según confirmó el club.</p><h2>Millonarios, a un paso de la final</h2>${para(14)}<blockquote><p>"Estamos muy felices por el triunfo del equipo", dijo el técnico.</p></blockquote><figure><img src="https://cdn/y.jpg" alt="Gol de Millonarios"></figure><h2>Lo que viene</h2>${para(6)}`);
    const report = analyzeSeo({ ...good, blocks });
    expect(report.words).toBeGreaterThan(600);
    expect(report.score).toBeGreaterThanOrEqual(85);
    expect(report.checks.filter((c) => c.status === "fail").map((c) => c.id)).toEqual([]);
  });

  it("flags the real problems of a weak article with concrete fixes", () => {
    const report = analyzeSeo({
      ...good, title: "¡¡INCREÍBLE lo que pasó!!", seoTitle: "", seoDescription: "", slug: "", tags: [], categoryId: null,
      coverUrl: null, keyword: "Millonarios", originality: 35, blocks: parseHtml("<p>Texto corto.</p>"),
    });
    const failed = report.checks.filter((c) => c.status === "fail").map((c) => c.id);
    for (const id of ["title-keyword", "title-clickbait", "meta-description", "slug", "length", "cover", "category", "originality", "attribution"]) {
      expect(failed).toContain(id);
    }
    expect(report.score).toBeLessThan(30);
    expect(report.checks.every((c) => c.status === "pass" || c.fix)).toBe(true);
  });

  it("counts [VERIFICAR] marks left by the AI as blocking", () => {
    const report = analyzeSeo({ ...good, blocks: parseHtml("<p>El fichaje costó 5 millones [VERIFICAR cifra].</p>") });
    expect(report.verifyMarks).toBe(1);
    expect(report.checks.find((c) => c.id === "verify")?.status).toBe("fail");
    expect(report.verifySnippets).toEqual(["El fichaje costó 5 millones [VERIFICAR cifra]."]);
  });

  it("locates every [VERIFICAR] mark so the editor can find it", () => {
    const report = analyzeSeo({ ...good, blocks: parseHtml(
      "<p>Ganó 2-1 [VERIFICAR]. El DT habló.</p><p>Juega el domingo [VERIFICAR fecha] y [VERIFICAR rival].</p>") });
    expect(report.verifyMarks).toBe(3);
    expect(report.verifySnippets).toEqual([
      "Ganó 2-1 [VERIFICAR].",
      "Juega el domingo [VERIFICAR fecha] y [VERIFICAR rival].",
      "Juega el domingo [VERIFICAR fecha] y [VERIFICAR rival].",
    ]);
  });

  it("suggests the focus keyword from the title and body", () => {
    expect(suggestKeyword("Luis Díaz marca doblete con el Bayern en la Bundesliga",
      "Luis Díaz fue la figura. El Bayern celebró. Luis Díaz ya suma ocho goles.")).toBe("Luis Díaz");
  });

  it("Spanish readability behaves", () => {
    expect(syllables("fútbol")).toBe(2);
    expect(syllables("Colombia")).toBe(3);
    expect(sentences("Ganó el equipo. ¿Quién marcó? Fue Díaz.")).toHaveLength(3);
    const easy = fernandezHuerta("El equipo ganó. Fue un gran día. ".repeat(20))!;
    const hard = fernandezHuerta("La administración institucional consideró extraordinariamente significativa la reestructuración organizacional implementada recientemente. ".repeat(6))!;
    expect(easy).toBeGreaterThan(hard);
  });

  it("does not treat common acronyms as clickbait caps", () => {
    const report = analyzeSeo({ ...good, title: "El VAR y la FIFA explican la polémica del clásico de Millonarios", blocks: [] });
    expect(report.checks.find((c) => c.id === "title-clickbait")?.status).toBe("pass");
  });
});
