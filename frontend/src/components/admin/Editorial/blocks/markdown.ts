// Copy / replace the whole article as plain "markdown-ish" text, so it can be
// sent to ChatGPT (or any AI) and pasted back in one go. Media blocks travel
// as [IMAGEN n] / [VIDEO n] markers and are restored as the SAME blocks, so a
// round-trip through an AI never loses photos or videos.

import { cleanInline, newId, plainText, type Block } from "./blockModel";

const MEDIA_TYPES = new Set<Block["type"]>(["image", "embed", "placeholder", "divider", "raw"]);

export interface PromptContext {
  title: string;
  excerpt: string;
  blocks: Block[];
  sources: { name: string; url: string }[];
  keyword: string;
  category: string | null;
  contentLabel: string; // e.g. "fútbol (Colombia, Europa y Sudamérica)"
  today: string;        // e.g. "lunes 23 de noviembre de 2026"
}

export const SEO_DELIMITER = "=== SEO ===";

/**
 * Brief for ChatGPT written the way a senior sports editor (15–20 years in a
 * digital newsroom) briefs a writer. The output format is strict so that
 * "Pegar y reemplazar" maps EVERYTHING back automatically: body blocks,
 * title, lead, SEO fields and tags.
 */
export function buildAiPrompt(ctx: PromptContext): string {
  const sources = ctx.sources.length
    ? ctx.sources.map((s, i) => `${i + 1}. ${s.name}${s.url ? ` — ${s.url}` : ""}`).join("\n")
    : "(sin fuente registrada: trabaja solo con los datos del texto)";
  return `Actúa como editor jefe de deportes con 20 años en redacciones digitales de referencia (Marca, AS, ESPN, El Tiempo), especialista en SEO para Google News y Google Discover. Hoy es ${ctx.today}. El medio publica ${ctx.contentLabel} para lectores de Colombia y Latinoamérica.

TAREA
Convierte el material de abajo en una noticia lista para publicar: precisa, original, bien posicionable y monetizable.

REGLAS DE PERIODISMO (innegociables)
1. Cero invención. Usa solo hechos del material. Si un dato es dudoso o falta (cifra, fecha, cargo, resultado), escríbelo y añade [VERIFICAR] justo después.
2. Originalidad total. El material puede ser la nota de otro medio: NO copies frases; nunca repitas más de 6 palabras seguidas del original. Reescribe con estructura y enfoque propios.
3. Atribuye: «según ${ctx.sources[0]?.name ?? "la fuente"}», «confirmó el club», «informó…». Las declaraciones van textuales, entre comillas y con quién las dijo.
4. Pirámide invertida: el primer párrafo (máximo 40 palabras) responde qué, quién, cuándo y dónde, e incluye la palabra clave.
5. Contexto que suma valor: antecedentes, cifras y estadísticas, rachas, tabla, y cierra con «qué viene» (próximo partido, fecha, rival).
6. Estilo: español neutro, frases de 15–20 palabras, párrafos de 2–4 frases, voz activa, cero relleno y cero clickbait.

REGLAS SEO
- Palabra clave principal: «${ctx.keyword || "elige la más buscada del tema"}» (ajústala si hay una mejor; debe ser lo que la gente busca en Google).
- Titular de 50–65 caracteres, informativo, con la palabra clave al inicio. Sin mayúsculas sostenidas ni signos repetidos.
- Un subtítulo (##) cada 250–350 palabras; al menos uno con la palabra clave o una variante.
- Extensión: 600–900 palabras si el material lo permite. Sin inflar: si no hay más datos, más corto y exacto.
- Usa variaciones naturales de la palabra clave (nombre completo, apodo del club, competición). Densidad natural, nunca forzada.

FORMATO DE RESPUESTA (exacto, sin comentarios antes ni después)
# Titular
**Entradilla:** una o dos frases (100–200 caracteres) con el hecho y por qué importa.

Párrafos separados por una línea en blanco.

## Subtítulo

Deja cada marca [IMAGEN n] o [VIDEO n] en su lugar, sin modificarla.
Para citas destacadas usa una línea que empiece con "> ".

${SEO_DELIMITER}
Palabra clave: ...
Título SEO: ... (40–60 caracteres)
Meta descripción: ... (120–155 caracteres, con la palabra clave)
Slug: ... (minúsculas, guiones, máximo 6 palabras)
Etiquetas: equipo, jugador, competición (3 a 6)

FUENTES DEL MATERIAL
${sources}
${ctx.category ? `
SECCIÓN: ${ctx.category}` : ""}

MATERIAL
---
${toMarkdown(ctx.title, ctx.excerpt, ctx.blocks).trim()}
---`;
}

function inlineToMarkdown(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<(strong|b)>([\s\S]*?)<\/\1>/gi, "**$2**")
    .replace(/<(em|i)>([\s\S]*?)<\/\1>/gi, "*$2*")
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, "[$2]($1)")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function mediaLabel(block: Block, n: number): string {
  if (block.type === "embed") return `[VIDEO ${n}]`;
  if (block.type === "image" && plainText(block.caption)) return `[IMAGEN ${n}: ${plainText(block.caption)}]`;
  return `[IMAGEN ${n}]`;
}

/** Whole article -> text. Media blocks become numbered markers. */
export function toMarkdown(title: string, excerpt: string, blocks: Block[]): string {
  const out: string[] = [];
  if (title.trim()) out.push(`# ${title.trim()}`);
  if (excerpt.trim()) out.push(`**Entradilla:** ${excerpt.trim()}`);
  let media = 0;
  for (const block of blocks) {
    if (MEDIA_TYPES.has(block.type)) {
      if (block.type === "divider") { out.push("---"); continue; }
      media += 1;
      out.push(mediaLabel(block, media));
      continue;
    }
    if (block.type === "paragraph") out.push(inlineToMarkdown(block.html));
    if (block.type === "heading") out.push(`${block.level === 2 ? "##" : "###"} ${inlineToMarkdown(block.html)}`);
    if (block.type === "quote") out.push(`> ${inlineToMarkdown(block.html)}`);
    if (block.type === "list") {
      const items = Array.from(block.html.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)).map((m) => inlineToMarkdown(m[1])).filter(Boolean);
      out.push(items.map((item, i) => (block.ordered ? `${i + 1}. ${item}` : `- ${item}`)).join("\n"));
    }
  }
  return out.filter((line) => line.trim()).join("\n\n") + "\n";
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Inline markdown -> the inline HTML text blocks accept. */
export function markdownInline(text: string): string {
  const html = escapeHtml(text.trim())
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_]+)__/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\s][^*]*?)\*(?!\*)/g, "$1<em>$2</em>")
    .replace(/(^|[\s(])_([^_\s][^_]*?)_(?=[\s).,;:!?]|$)/g, "$1<em>$2</em>");
  return cleanInline(html);
}

export type ParsedSeo = {
  keyword?: string;
  seoTitle?: string;
  seoDescription?: string;
  slug?: string;
  tags?: string[];
};

export type ParsedArticle = {
  title: string | null;
  excerpt: string | null;
  blocks: Block[];
  restoredMedia: number;
  droppedMedia: number;
  seo: ParsedSeo;
};

function slugify(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/https?:\/\/[^/]+\/(noticia\/)?/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 90);
}

/** Splits off and parses the "=== SEO ===" block (key: value lines). */
function extractSeo(text: string): { body: string; seo: ParsedSeo } {
  const lines = text.split("\n");
  const at = lines.findIndex((l) => /^\s*(={2,}|-{2,}|#{1,3})?\s*\**\s*(SEO|DATOS SEO|PAQUETE SEO)\s*\**\s*(={2,}|-{2,})?\s*:?\s*$/i.test(l));
  if (at === -1) return { body: text, seo: {} };
  const seo: ParsedSeo = {};
  for (const raw of lines.slice(at + 1)) {
    const m = raw.replace(/\*\*|__/g, "").replace(/^\s*[-*•]\s+/, "").match(/^\s*([^:]{3,30}):\s*(.+?)\s*$/);
    if (!m) continue;
    const key = m[1].normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    const value = m[2].replace(/^["«“]|["»”]$/g, "").replace(/\s*\((\d+[–-]\d+|\d+)\s*caracteres\)\s*$/i, "").trim();
    if (!value || value === "...") continue;
    if (/^(palabra clave|keyword|focus keyword|palabra clave principal)$/.test(key)) seo.keyword = value;
    else if (/^(titulo seo|seo title|meta title|titulo)$/.test(key)) seo.seoTitle = value;
    else if (/^(meta descripcion|meta description|descripcion|descripcion seo)$/.test(key)) seo.seoDescription = value;
    else if (/^(slug|url)$/.test(key)) seo.slug = slugify(value);
    else if (/^(etiquetas|tags|palabras clave secundarias)$/.test(key)) {
      seo.tags = value.split(/[,;|]/).map((t) => t.trim().replace(/^#/, "")).filter(Boolean).slice(0, 10);
    }
  }
  return { body: lines.slice(0, at).join("\n"), seo };
}

const MEDIA_MARKER = /^\[(IMAGEN|IMAGE|VIDEO|FOTO)\s*(\d+)[^\]]*\]$/i;
const EXCERPT_LINE = /^(\*\*|__)?\s*(entradilla|lead|bajada|sumario)\s*:?\s*(\*\*|__)?\s*:?\s*/i;

/**
 * Text (from ChatGPT, Word, anywhere) -> blocks. `previous` are the current
 * blocks: [IMAGEN n]/[VIDEO n] markers bring back the n-th media block from
 * them; media the text no longer mentions is appended at the end, never lost.
 */
export function fromMarkdown(input: string, previous: Block[] = []): ParsedArticle {
  const { body: text, seo } = extractSeo(input.replace(/\r/g, ""));
  const media = previous.filter((b) => MEDIA_TYPES.has(b.type) && b.type !== "divider");
  const used = new Set<number>();
  let title: string | null = null;
  let excerpt: string | null = null;
  const blocks: Block[] = [];

  const lines = text.replace(/\r/g, "").replace(/^\s*```[a-z]*\n|\n```\s*$/g, "").split("\n");
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flushParagraph = () => {
    const joined = paragraph.join(" ").trim();
    paragraph = [];
    if (!joined) return;
    if (excerpt === null && blocks.length === 0 && EXCERPT_LINE.test(joined)) {
      excerpt = plainText(markdownInline(joined.replace(EXCERPT_LINE, "")));
      return;
    }
    blocks.push({ id: newId(), type: "paragraph", html: markdownInline(joined) });
  };
  const flushList = () => {
    if (list && list.items.length) {
      blocks.push({ id: newId(), type: "list", ordered: list.ordered, html: list.items.map((i) => `<li>${markdownInline(i)}</li>`).join("") });
    }
    list = null;
  };
  const flush = () => { flushParagraph(); flushList(); };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { flush(); continue; }

    const marker = line.match(MEDIA_MARKER);
    if (marker) {
      flush();
      const index = Number(marker[2]) - 1;
      const original = media[index];
      if (original && !used.has(index)) {
        used.add(index);
        blocks.push(original);
      }
      continue;
    }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) { flush(); blocks.push({ id: newId(), type: "divider" }); continue; }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flush();
      const level = heading[1].length;
      const content = heading[2].replace(/\s*#+\s*$/, "");
      if (level === 1 && title === null && blocks.length === 0) { title = plainText(markdownInline(content)); continue; }
      blocks.push({ id: newId(), type: "heading", level: level <= 2 ? 2 : 3, html: markdownInline(content) });
      continue;
    }
    if (line.startsWith(">")) {
      flush();
      blocks.push({ id: newId(), type: "quote", html: markdownInline(line.replace(/^>\s?/, "")) });
      continue;
    }
    const bullet = line.match(/^([-*•]|\d+[.)])\s+(.*)$/);
    if (bullet) {
      flushParagraph();
      const ordered = /\d/.test(bullet[1]);
      if (!list || list.ordered !== ordered) { flushList(); list = { ordered, items: [] }; }
      list.items.push(bullet[2]);
      continue;
    }
    if (excerpt === null && blocks.length === 0 && EXCERPT_LINE.test(line)) {
      flush();
      excerpt = plainText(markdownInline(line.replace(EXCERPT_LINE, "")));
      continue;
    }
    flushList();
    paragraph.push(line);
  }
  flush();

  // Media the new text didn't mention is kept at the end -- never silently lost.
  const leftover = media.filter((_, i) => !used.has(i));
  return { title, excerpt, blocks: [...blocks, ...leftover], restoredMedia: used.size, droppedMedia: leftover.length, seo };
}

/** Heuristic: does pasted text carry structure worth converting (headings, lists, markers)? */
export function looksStructured(text: string): boolean {
  return /^(#{1,6}\s|>\s|[-*•]\s|\d+[.)]\s|\[(IMAGEN|VIDEO)\s*\d+)/im.test(text);
}
