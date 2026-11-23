// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { parseHtml, serialize } from "./blockModel";
import { analyzeSeo } from "./seo";
import { autoFixes, buildFixPrompt, parseFixAnswer, shortSlug, splitParagraph, type FixContext } from "./seoFixes";

const longSentence = "El mercado de fichajes de invierno llega cargado de nombres propios porque los grandes clubes de Europa buscan reforzar sus plantillas antes de la recta final de la temporada y varios jugadores sudamericanos aparecen en todas las listas de los directores deportivos";
const para = (i: number) => `<p>Párrafo ${i}: el Real Madrid y el Barcelona siguen de cerca a varios jugadores del mercado. ${i === 2 ? longSentence + "." : "Los clubes negocian con sus agentes y esperan cerrar las operaciones antes de que termine el mes. Las directivas analizan el presupuesto disponible para cada fichaje."}</p>`;

const ctx = (): FixContext => ({
  title: "Mercado de fichajes, en directo: rumores, altas y bajas de LaLiga, Premier, Serie A y Bundesliga hoy",
  excerpt: "x".repeat(300),
  blocks: parseHtml(Array.from({ length: 16 }, (_, i) => para(i + 1)).join("")),
  keyword: "mercado de fichajes", tags: Array.from({ length: 9 }, (_, i) => `t${i}`),
  seoTitle: "", seoDescription: "", slug: "mercado-de-fichajes-en-directo-rumores-altas-y-bajas-de-laliga-premier-serie-a",
});

const report = (c: FixContext) => analyzeSeo({ ...c, categoryId: "c", coverUrl: null });

describe("seo fixes", () => {
  it("makes a short keyword-first slug without stop words", () => {
    expect(shortSlug("mercado de fichajes", "Mercado de fichajes, en directo: rumores, altas y bajas de LaLiga"))
      .toBe("mercado-fichajes-directo-rumores-altas-bajas-laliga");
  });

  it("offers automatic fixes for the mechanical warnings", () => {
    const c = ctx();
    const fixes = autoFixes(report(c), c);
    expect(fixes.slug.patch.slug!.length).toBeLessThanOrEqual(60);
    expect(fixes.tags.patch.tags).toHaveLength(8);
    expect(fixes.excerpt.patch.excerpt!.length).toBeLessThanOrEqual(240);
    expect(fixes["seo-title"].patch.seoTitle!.length).toBeLessThanOrEqual(60);
    expect(fixes["body-media"].patch.blocks!.some((b) => b.type === "image")).toBe(true);
  });

  it("splits a long paragraph at the sentence closest to the middle", () => {
    const [a, b] = splitParagraph("Uno dos tres. Cuatro cinco seis. Siete ocho nueve. Diez once doce.")!;
    expect(a).toBe("Uno dos tres. Cuatro cinco seis.");
    expect(b).toBe("Siete ocho nueve. Diez once doce.");
  });

  it("one prompt with only what is wrong; answers land exactly in place", () => {
    const c = ctx();
    const plan = buildFixPrompt(report(c), c)!;
    expect(plan.prompt).toContain("TITULAR:");
    expect(plan.prompt).toContain("SUBTÍTULO ANTES DE [P4]");
    expect(plan.prompt).toContain("[P8] Párrafo 8");
    expect(plan.prompt).toContain("[F1] El mercado de fichajes de invierno");

    const answer = [
      "**TITULAR:** Mercado de fichajes: rumores, altas y bajas de las grandes ligas",
      "ENTRADILLA: Los grandes de Europa preparan movimientos para enero.",
      "TÍTULO SEO: Mercado de fichajes: rumores y altas del día",
      "META DESCRIPCIÓN: «Repaso al mercado de fichajes: rumores, altas y bajas de LaLiga, Premier, Serie A y Bundesliga con los movimientos clave del día.»",
      "SUBTÍTULO ANTES DE [P4]: Los objetivos del mercado de fichajes",
      "SUBTÍTULO ANTES DE P7: Sudamericanos en la mira",
      "[F1] El mercado de invierno llega cargado de nombres. Los grandes de Europa quieren reforzarse y varios sudamericanos están en las listas",
    ].join("\n");
    const parsed = parseFixAnswer(answer, plan, c);
    const keys = parsed.proposals.map((p) => p.key);
    expect(keys).toEqual(expect.arrayContaining(["title", "excerpt", "seoTitle", "seoDescription", "h4", "h7", "f1"]));

    const patch = parsed.apply(new Set(keys.filter((k) => k !== "h7")));  // editor rejects one subheading
    expect(patch.title).toBe("Mercado de fichajes: rumores, altas y bajas de las grandes ligas");
    expect(patch.seoDescription!.startsWith("Repaso")).toBe(true);
    const html = serialize(patch.blocks!);
    expect(html.indexOf("<h2>Los objetivos del mercado de fichajes</h2>")).toBeLessThan(html.indexOf("Párrafo 4"));
    expect(html.indexOf("<h2>Los objetivos del mercado de fichajes</h2>")).toBeGreaterThan(html.indexOf("Párrafo 3"));
    expect(html).not.toContain("Sudamericanos en la mira");
    expect(html).toContain("El mercado de invierno llega cargado de nombres.");
    expect(html).not.toContain("directores deportivos");
    // untouched paragraphs are the very same objects
    expect(patch.blocks!.find((b) => b.id === c.blocks[0].id)).toBe(c.blocks[0]);
  });
});
