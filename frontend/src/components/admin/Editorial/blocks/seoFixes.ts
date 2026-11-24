// Fixing SEO warnings: mechanical ones are fixed automatically; writing ones
// go to ChatGPT in ONE prompt with labelled sections, and each answer is put
// back exactly where it belongs (subheadings between the right paragraphs,
// long sentences replaced one by one, header/SEO fields into their fields).

import { unwrapAnswer, withCopyPaste } from "@/lib/chatgpt";
import { cleanInline, emptyBlock, isTextBlock, newId, plainText, type Block } from "./blockModel";
import { fold, sentences, type SeoReport } from "./seo";

export interface FixContext {
  title: string;
  excerpt: string;
  blocks: Block[];
  keyword: string;
  tags: string[];
  seoTitle: string;
  seoDescription: string;
  slug: string;
}

export interface FixPatch {
  title?: string;
  excerpt?: string;
  tags?: string[];
  seoTitle?: string;
  seoDescription?: string;
  slug?: string;
  blocks?: Block[];
}

const SLUG_STOP = new Set("a al ante con contra de del desde el en entre es la las le lo los para por que se sin su sus un una uno unos unas y o e ya mas más su tras como cómo".split(" "));

function slugWords(text: string): string[] {
  return fold(text).replace(/[^a-z0-9\s-]/g, " ").split(/[\s-]+/).filter((w) => w && !SLUG_STOP.has(w));
}

/** Short, keyword-first slug: keyword words + the title's key words, ≤ 60 chars. */
export function shortSlug(keyword: string, title: string): string {
  const words: string[] = [];
  for (const w of [...slugWords(keyword), ...slugWords(title)]) {
    if (words.includes(w)) continue;
    if ([...words, w].join("-").length > 60) break;
    words.push(w);
    if (words.length >= 8) break;
  }
  return words.join("-");
}

function cutAtWord(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max + 1);
  const at = cut.lastIndexOf(" ");
  return `${cut.slice(0, at > max * 0.6 ? at : max).replace(/[,;:\s]+$/, "")}`;
}

function cutAtSentence(text: string, max: number): string {
  const ss = sentences(text);
  let out = "";
  for (const s of ss) {
    if ((out ? `${out} ${s}` : s).length > max) break;
    out = out ? `${out} ${s}` : s;
  }
  return out || cutAtWord(text, max);
}

/** Splits a paragraph at the sentence boundary closest to its middle. */
export function splitParagraph(html: string): [string, string] | null {
  const text = plainText(html);
  const ss = sentences(text);
  if (ss.length < 2) return null;
  let best = 1;
  let bestGap = Infinity;
  let acc = 0;
  for (let i = 0; i < ss.length - 1; i += 1) {
    acc += ss[i].length + 1;
    const gap = Math.abs(acc - text.length / 2);
    if (gap < bestGap) { bestGap = gap; best = i + 1; }
  }
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return [cleanInline(esc(ss.slice(0, best).join(" "))), cleanInline(esc(ss.slice(best).join(" ")))];
}

/** Automatic fixes available for the current report, keyed by check id. */
export function autoFixes(report: SeoReport, ctx: FixContext): Record<string, { label: string; patch: FixPatch }> {
  const failing = new Set(report.checks.filter((c) => c.status !== "pass").map((c) => c.id));
  const out: Record<string, { label: string; patch: FixPatch }> = {};
  const keyword = ctx.keyword || report.keyword;

  if (failing.has("slug")) {
    const slug = shortSlug(keyword, ctx.title);
    if (slug && slug !== ctx.slug) out.slug = { label: `Acortar a /${slug}`, patch: { slug } };
  }
  if (failing.has("tags") && ctx.tags.length > 8) out.tags = { label: "Dejar las 8 primeras", patch: { tags: ctx.tags.slice(0, 8) } };
  if (failing.has("excerpt") && ctx.excerpt.length > 240) {
    out.excerpt = { label: "Recortar a la primera frase", patch: { excerpt: cutAtSentence(ctx.excerpt, 220) } };
  }
  if (failing.has("seo-title") && (!ctx.seoTitle || ctx.seoTitle.length > 60) && ctx.title) {
    out["seo-title"] = { label: "Generar desde el titular", patch: { seoTitle: cutAtWord(ctx.title, 60) } };
  }
  if (failing.has("meta-description") && !ctx.seoDescription) {
    const lead = ctx.blocks.find((b) => b.type === "paragraph");
    const base = ctx.excerpt || (lead && lead.type === "paragraph" ? plainText(lead.html) : "");
    if (base) out["meta-description"] = { label: "Generar desde la entradilla", patch: { seoDescription: cutAtWord(base, 155) } };
  }
  if (failing.has("paragraphs")) {
    let changed = false;
    const next: Block[] = [];
    for (const b of ctx.blocks) {
      if (b.type === "paragraph" && plainText(b.html).split(/\s+/).length > 110) {
        const parts = splitParagraph(b.html);
        if (parts) {
          next.push({ ...b, html: parts[0] }, { id: newId(), type: "paragraph", html: parts[1] });
          changed = true;
          continue;
        }
      }
      next.push(b);
    }
    if (changed) out.paragraphs = { label: "Dividir los párrafos largos", patch: { blocks: next } };
  }
  if (failing.has("body-media")) {
    const paragraphs = ctx.blocks.map((b, i) => (b.type === "paragraph" ? i : -1)).filter((i) => i >= 0);
    const after = paragraphs[Math.floor(paragraphs.length / 2)] ?? ctx.blocks.length - 1;
    const next = [...ctx.blocks];
    next.splice(after + 1, 0, emptyBlock("image"));
    out["body-media"] = { label: "Insertar un hueco de imagen a mitad de nota", patch: { blocks: next } };
  }
  return out;
}

// ── One combined ChatGPT prompt for the writing fixes ─────────────────────

export interface FixPromptPlan {
  prompt: string;
  paragraphIds: string[];               // [P1] -> block id
  longSentences: { id: string; text: string }[]; // [F1] -> where it lives
  wants: Set<string>;
}

const WRITING_CHECKS = ["title-length", "title-keyword", "title-clickbait", "excerpt", "seo-title", "meta-description",
  "headings", "heading-keyword", "sentences", "lead-length", "lead-keyword", "density"] as const;

export function aiFixableCount(report: SeoReport): number {
  return report.checks.filter((c) => c.status !== "pass" && (WRITING_CHECKS as readonly string[]).includes(c.id)).length;
}

export function buildFixPrompt(report: SeoReport, ctx: FixContext): FixPromptPlan | null {
  const failing = new Set(report.checks.filter((c) => c.status !== "pass").map((c) => c.id));
  const keyword = ctx.keyword || report.keyword;
  const wants = new Set<string>();
  const tasks: string[] = [];
  const format: string[] = [];

  if (failing.has("title-length") || failing.has("title-keyword") || failing.has("title-clickbait")) {
    wants.add("title");
    tasks.push(`- TITULAR: reescríbelo en 50–65 caracteres, informativo, con «${keyword}» en la primera mitad, sin mayúsculas sostenidas ni signos repetidos.`);
    format.push("TITULAR: …");
  }
  if (failing.has("excerpt")) {
    wants.add("excerpt");
    tasks.push("- ENTRADILLA: una o dos frases, 100–200 caracteres, con el hecho y por qué importa.");
    format.push("ENTRADILLA: …");
  }
  if (failing.has("seo-title")) {
    wants.add("seoTitle");
    tasks.push(`- TÍTULO SEO: 40–60 caracteres, empieza con «${keyword}».`);
    format.push("TÍTULO SEO: …");
  }
  if (failing.has("meta-description")) {
    wants.add("seoDescription");
    tasks.push(`- META DESCRIPCIÓN: 120–155 caracteres, resume el hecho e incluye «${keyword}».`);
    format.push("META DESCRIPCIÓN: …");
  }
  if (failing.has("lead-length") || failing.has("lead-keyword") || failing.has("density")) {
    wants.add("lead");
    tasks.push(`- PRIMER PÁRRAFO: reescríbelo en máximo 40 palabras respondiendo qué, quién, cuándo y dónde, con «${keyword}». Mismos datos.`);
    format.push("PRIMER PÁRRAFO: …");
  }

  const paragraphBlocks = ctx.blocks.filter((b) => b.type === "paragraph");
  const paragraphIds = paragraphBlocks.map((b) => b.id);
  if (failing.has("headings") || failing.has("heading-keyword")) {
    wants.add("headings");
    const needed = Math.max(1, Math.round(plainText(paragraphBlocks.map((b) => (b.type === "paragraph" ? b.html : "")).join(" ")).split(/\s+/).length / 300));
    tasks.push(`- SUBTÍTULOS: propón ${needed} subtítulo(s) (máximo 70 caracteres, al menos uno con «${keyword}» o una variante) e indica ANTES de qué párrafo va cada uno.`);
    format.push("SUBTÍTULO ANTES DE [P4]: …");
  }

  const longSentences: { id: string; text: string }[] = [];
  if (failing.has("sentences")) {
    for (const b of ctx.blocks) {
      if (b.type !== "paragraph") continue;
      for (const s of sentences(plainText(b.html))) {
        if (s.split(/\s+/).length > 35) longSentences.push({ id: b.id, text: s });
      }
    }
    if (longSentences.length) {
      wants.add("sentences");
      tasks.push("- FRASES LARGAS: parte cada frase [F] en dos o tres frases cortas, sin cambiar ningún dato.");
      format.push("[F1] …");
    }
  }

  if (!tasks.length) return null;

  const numbered = wants.has("headings") || wants.has("lead")
    ? `\n\nNOTICIA (párrafos numerados)\n${paragraphBlocks.map((b, i) => `[P${i + 1}] ${plainText(b.type === "paragraph" ? b.html : "")}`).join("\n\n")}`
    : "";
  const frases = longSentences.length ? `\n\nFRASES LARGAS\n${longSentences.map((s, i) => `[F${i + 1}] ${s.text}`).join("\n\n")}` : "";

  const prompt = withCopyPaste(`Actúa como editor jefe de deportes y especialista SEO (20 años en medios digitales). Corrige SOLO lo que te pido de esta noticia; no reescribas nada más.

TITULAR ACTUAL: ${ctx.title}
ENTRADILLA ACTUAL: ${ctx.excerpt || "(vacía)"}
PALABRA CLAVE: ${keyword}

QUÉ CORREGIR
${tasks.join("\n")}

REGLAS
- Cero invención: los mismos hechos, cifras, nombres y fechas del texto.
- Español neutro, estilo periodístico, voz activa, sin clickbait.

FORMATO DE RESPUESTA (exacto, una línea por elemento, sin comentarios)
${format.join("\n")}${numbered}${frases}`);

  return { prompt, paragraphIds, longSentences, wants };
}

export interface FixProposal {
  key: string;
  label: string;
  before: string;
  after: string;
}

function labelValue(answer: string, labels: string[]): string | null {
  for (const raw of answer.replace(/\r/g, "").split("\n")) {
    const line = raw.replace(/\*\*/g, "").trim();
    for (const label of labels) {
      const m = fold(line).match(new RegExp(`^${label}\\s*:\\s*`));
      if (m) return line.slice(m[0].length).replace(/^["«“]|["»”]$/g, "").trim() || null;
    }
  }
  return null;
}

/** Reads the AI answer into concrete proposals + the patch that applies the accepted ones. */
export function parseFixAnswer(answer: string, plan: FixPromptPlan, ctx: FixContext): {
  proposals: FixProposal[];
  apply: (acceptedKeys: Set<string>) => FixPatch;
} {
  answer = unwrapAnswer(answer);
  const proposals: FixProposal[] = [];
  const title = plan.wants.has("title") ? labelValue(answer, ["titular"]) : null;
  const excerpt = plan.wants.has("excerpt") ? labelValue(answer, ["entradilla"]) : null;
  const seoTitle = plan.wants.has("seoTitle") ? labelValue(answer, ["titulo seo", "title seo", "seo title"]) : null;
  const seoDescription = plan.wants.has("seoDescription") ? labelValue(answer, ["meta descripcion", "meta description", "meta"]) : null;
  const lead = plan.wants.has("lead") ? labelValue(answer, ["primer parrafo", "primer párrafo", "entrada"]) : null;

  if (title) proposals.push({ key: "title", label: "Titular", before: ctx.title, after: title });
  if (excerpt) proposals.push({ key: "excerpt", label: "Entradilla", before: ctx.excerpt, after: excerpt });
  if (seoTitle) proposals.push({ key: "seoTitle", label: "Título SEO", before: ctx.seoTitle, after: seoTitle });
  if (seoDescription) proposals.push({ key: "seoDescription", label: "Meta descripción", before: ctx.seoDescription, after: seoDescription });
  const firstParagraph = ctx.blocks.find((b) => b.type === "paragraph");
  if (lead && firstParagraph) proposals.push({ key: "lead", label: "Primer párrafo", before: plainText(firstParagraph.type === "paragraph" ? firstParagraph.html : ""), after: lead });

  const headings: { beforeId: string; text: string; key: string }[] = [];
  if (plan.wants.has("headings")) {
    for (const raw of answer.replace(/\r/g, "").split("\n")) {
      const line = raw.replace(/\*\*/g, "").trim();
      const m = fold(line).match(/^subtitulo\s+(antes\s+de\s+)?\[?p(\d+)\]?\s*:\s*/);
      if (!m) continue;
      const n = Number(m[2]);
      const beforeId = plan.paragraphIds[n - 1];
      const text = line.slice(m[0].length).replace(/^#+\s*/, "").trim();
      if (beforeId && text) {
        const key = `h${n}`;
        headings.push({ beforeId, text, key });
        proposals.push({ key, label: `Subtítulo antes del párrafo ${n}`, before: "", after: text });
      }
    }
  }

  const sentenceFixes: { id: string; original: string; text: string; key: string }[] = [];
  if (plan.wants.has("sentences")) {
    for (const raw of answer.replace(/\r/g, "").split("\n")) {
      const m = raw.replace(/\*\*/g, "").trim().match(/^\[?F(\d+)\]?[).:-]?\s*(.+)$/i);
      if (!m) continue;
      const target = plan.longSentences[Number(m[1]) - 1];
      if (target) {
        const key = `f${m[1]}`;
        sentenceFixes.push({ id: target.id, original: target.text, text: m[2].trim(), key });
        proposals.push({ key, label: `Frase larga ${m[1]}`, before: target.text, after: m[2].trim() });
      }
    }
  }

  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const apply = (accepted: Set<string>): FixPatch => {
    const patch: FixPatch = {};
    if (title && accepted.has("title")) patch.title = title;
    if (excerpt && accepted.has("excerpt")) patch.excerpt = excerpt;
    if (seoTitle && accepted.has("seoTitle")) patch.seoTitle = seoTitle;
    if (seoDescription && accepted.has("seoDescription")) patch.seoDescription = seoDescription;

    let blocks = ctx.blocks;
    let touched = false;
    if (lead && firstParagraph && accepted.has("lead")) {
      blocks = blocks.map((b) => (b.id === firstParagraph.id ? { ...b, html: cleanInline(esc(lead)) } as Block : b));
      touched = true;
    }
    for (const fix of sentenceFixes) {
      if (!accepted.has(fix.key)) continue;
      blocks = blocks.map((b) => {
        if (b.id !== fix.id || !isTextBlock(b)) return b;
        const text = plainText(b.html);
        if (!text.includes(fix.original)) return b;
        touched = true;
        return { ...b, html: cleanInline(esc(text.replace(fix.original, fix.text))) } as Block;
      });
    }
    const chosen = headings.filter((h) => accepted.has(h.key));
    if (chosen.length) {
      const next: Block[] = [];
      for (const b of blocks) {
        for (const h of chosen.filter((x) => x.beforeId === b.id)) next.push({ id: newId(), type: "heading", level: 2, html: cleanInline(esc(h.text)) });
        next.push(b);
      }
      blocks = next;
      touched = true;
    }
    if (touched) patch.blocks = blocks;
    return patch;
  };

  return { proposals, apply };
}
