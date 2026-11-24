// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { parseHtml, serialize, type Block } from "./blockModel";
import { fromMarkdown, looksStructured, markdownInline, toMarkdown } from "./markdown";

const article = parseHtml(`<article><p>Primer <strong>párrafo</strong> con <a href="https://x.test">enlace</a>.</p>
<h2>Las claves</h2><figure><img src="https://cdn/a.jpg" alt="Gol"><figcaption>Foto: AP</figcaption></figure>
<ul><li>uno</li><li>dos</li></ul><blockquote><p>Una cita</p></blockquote>
<figure><iframe src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"></iframe></figure><p>Cierre.</p></article>`);

describe("copy / replace whole article", () => {
  it("exports a clean, AI-friendly text with media markers", () => {
    const md = toMarkdown("Millonarios gana", "La idea principal.", article);
    expect(md).toBe([
      "# Millonarios gana", "**Entradilla:** La idea principal.",
      "Primer **párrafo** con [enlace](https://x.test).", "## Las claves", "[IMAGEN 1: Foto: AP]",
      "- uno\n- dos", "> Una cita", "[VIDEO 2]", "Cierre.",
    ].join("\n\n") + "\n");
  });

  it("round-trips without losing a single block", () => {
    const md = toMarkdown("T", "E", article);
    const parsed = fromMarkdown(md, article);
    expect(parsed.title).toBe("T");
    expect(parsed.excerpt).toBe("E");
    expect(serialize(parsed.blocks)).toBe(serialize(article));
    expect(parsed.restoredMedia).toBe(2);
  });

  it("restores the SAME photo/video blocks where the AI kept the markers", () => {
    const aiText = `# Titular nuevo\n\n**Entradilla:** Resumen nuevo\n\n[VIDEO 2]\n\nTexto reescrito por la IA.\n\n## Subtítulo\n\n[IMAGEN 1]`;
    const parsed = fromMarkdown(aiText, article);
    const media = parsed.blocks.filter((b) => b.type === "image" || b.type === "embed");
    expect(parsed.blocks[0].type).toBe("embed");
    expect(media.map((b) => b.id)).toEqual([article[5].id, article[2].id]);
  });

  it("never loses media the AI dropped: appended at the end", () => {
    const parsed = fromMarkdown("Solo texto nuevo.", article);
    expect(parsed.droppedMedia).toBe(2);
    expect(parsed.blocks.slice(-2).map((b) => b.type)).toEqual(["image", "embed"]);
  });

  it("parses ChatGPT-style output: headings, lists, quotes, bold, numbered lists", () => {
    const parsed = fromMarkdown("## Claves\n\n1. Uno\n2. Dos\n\n* a\n* b\n\n> \"Estoy feliz\", dijo.\n\nTexto con **negrita** y _cursiva_.\nSigue el mismo párrafo.");
    const types = parsed.blocks.map((b: Block) => b.type);
    expect(types).toEqual(["heading", "list", "list", "quote", "paragraph"]);
    expect(parsed.blocks[1]).toMatchObject({ ordered: true, html: "<li>Uno</li><li>Dos</li>" });
    expect(parsed.blocks[4]).toMatchObject({ html: "Texto con <strong>negrita</strong> y <em>cursiva</em>. Sigue el mismo párrafo." });
  });

  it("strips code fences and dangerous HTML from pasted text", () => {
    const parsed = fromMarkdown("```markdown\nHola <script>alert(1)</script> mundo\n```");
    expect(serialize(parsed.blocks)).toBe("<article><p>Hola &lt;script&gt;alert(1)&lt;/script&gt; mundo</p></article>");
  });

  it("keeps links but only http(s)", () => {
    expect(markdownInline("[ok](https://a.test) [bad](javascript:alert(1))")).toBe('<a href="https://a.test">ok</a> [bad](javascript:alert(1))');
  });

  it("detects structured paste", () => {
    expect(looksStructured("## Sub\ntexto")).toBe(true);
    expect(looksStructured("solo un texto normal\ncon dos líneas")).toBe(false);
  });
});

describe("ChatGPT round-trip contract", () => {
  const ctx = {
    title: "Millonarios gana", excerpt: "Resumen", blocks: article, keyword: "Millonarios", category: "Fútbol colombiano",
    contentLabel: "noticias de fútbol (Liga BetPlay)", today: "lunes 23 de noviembre de 2026",
    sources: [{ name: "AS Colombia", url: "https://as.test/1" }],
  };

  it("briefs like a senior editor and embeds everything the AI needs", async () => {
    const { buildAiPrompt, SEO_DELIMITER } = await import("./markdown");
    const prompt = buildAiPrompt(ctx);
    for (const piece of ["20 años", "Google News", "[VERIFICAR]", "6 palabras seguidas", "Pirámide invertida",
      "«Millonarios»", SEO_DELIMITER, "Meta descripción:", "AS Colombia — https://as.test/1", "lunes 23 de noviembre",
      "SECCIÓN: Fútbol colombiano", "[IMAGEN 1: Foto: AP]", "# Millonarios gana"]) {
      expect(prompt).toContain(piece);
    }
  });

  it("maps a typical ChatGPT answer back: body, header, SEO fields, tags and photos", async () => {
    const { fromMarkdown: parse } = await import("./markdown");
    const answer = [
      "# Millonarios vence a Santa Fe y es líder de la Liga BetPlay",
      "", "**Entradilla:** El equipo azul ganó 2-1 el clásico y depende de sí mismo.", "",
      "Millonarios venció 2-1 a Santa Fe en El Campín, según confirmó el club.", "", "[IMAGEN 1]", "",
      "## Qué viene para Millonarios", "", "El próximo partido es el domingo [VERIFICAR].", "", "[VIDEO 2]", "",
      "=== SEO ===",
      "**Palabra clave:** Millonarios Santa Fe",
      "Título SEO: Millonarios vence a Santa Fe y es líder (52 caracteres)",
      "Meta descripción: «Millonarios ganó 2-1 el clásico ante Santa Fe en El Campín y llega líder a la última fecha de los cuadrangulares.»",
      "Slug: Millonarios Vence a Santa Fe Líder",
      "Etiquetas: Millonarios, Santa Fe, Liga BetPlay, #Clásico",
    ].join("\n");
    const parsed = parse(answer, article);
    expect(parsed.title).toBe("Millonarios vence a Santa Fe y es líder de la Liga BetPlay");
    expect(parsed.excerpt).toBe("El equipo azul ganó 2-1 el clásico y depende de sí mismo.");
    expect(parsed.seo).toEqual({
      keyword: "Millonarios Santa Fe",
      seoTitle: "Millonarios vence a Santa Fe y es líder",
      seoDescription: "Millonarios ganó 2-1 el clásico ante Santa Fe en El Campín y llega líder a la última fecha de los cuadrangulares.",
      slug: "millonarios-vence-a-santa-fe-lider",
      tags: ["Millonarios", "Santa Fe", "Liga BetPlay", "Clásico"],
    });
    expect(parsed.blocks.map((b) => b.type)).toEqual(["paragraph", "image", "heading", "paragraph", "embed"]);
    expect(serialize(parsed.blocks)).not.toContain("SEO");   // the SEO package never leaks into the body
    expect(parsed.droppedMedia).toBe(0);
  });
});
