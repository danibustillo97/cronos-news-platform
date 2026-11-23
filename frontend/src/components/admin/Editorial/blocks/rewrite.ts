// Partial rewrite: send ONLY the problem sentences to ChatGPT and put each
// answer back exactly where its original sentence was -- inside its own
// paragraph, leaving every other block untouched.

import { cleanInline, isTextBlock, plainText, type Block } from "./blockModel";

export interface RewriteTarget {
  text: string;       // the original sentence as it appears in the article
  source?: string;    // which outlet it matches (for the prompt)
}

export interface RewriteProposal {
  index: number;      // 1-based, as numbered in the prompt
  original: string;
  replacement: string;
  found: boolean;     // the original sentence was located in the article
}

/** Plain text of the article exactly as the plagiarism check reads it. */
export function articlePlainText(title: string, excerpt: string, blocks: Block[]): string {
  const parts = [title, excerpt];
  for (const block of blocks) {
    if (!isTextBlock(block)) continue;
    if (block.type === "list") {
      for (const m of block.html.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)) parts.push(plainText(m[1]));
    } else {
      parts.push(plainText(block.html));
    }
  }
  return parts.map((p) => p.trim()).filter(Boolean).join("\n\n");
}

export function buildRewritePrompt(targets: RewriteTarget[], ctx: { keyword: string; title: string }): string {
  const list = targets.map((t, i) => `[${i + 1}] ${t.text}`).join("\n\n");
  return `Eres editor senior de una redacción deportiva digital. Estas ${targets.length} frase(s) de la noticia «${ctx.title}» son casi idénticas a lo que publicó otro medio y hay que reescribirlas para que sean 100% originales.

REGLAS
- Mismo dato y mismo sentido: no agregues ni quites hechos, cifras, nombres ni fechas.
- Otras palabras y otra estructura: nunca repitas más de 4 palabras seguidas de la frase original.
- Largo parecido al original, español neutro, estilo periodístico, voz activa.${ctx.keyword ? `\n- Si la frase menciona «${ctx.keyword}», mantenlo (es la palabra clave SEO).` : ""}
- Si algo no se puede reescribir sin cambiar el sentido, deja la frase igual.

FORMATO DE RESPUESTA (exacto, una por línea, sin comentarios)
[1] frase reescrita
[2] frase reescrita

FRASES
${list}`;
}

/** Reads "[1] text" / "1. text" / "1) text" lines from the AI answer. */
export function parseRewrites(answer: string): Map<number, string> {
  const out = new Map<number, string>();
  let current: number | null = null;
  for (const raw of answer.replace(/\r/g, "").split("\n")) {
    const line = raw.trim().replace(/^\*\*|\*\*$/g, "");
    const m = line.match(/^\[?(\d{1,2})[\].):-]\s*(.+)$/);
    if (m) {
      current = Number(m[1]);
      out.set(current, cleanQuote(m[2]));
    } else if (current !== null && line && !/^(frases|formato|reglas)/i.test(line)) {
      out.set(current, `${out.get(current)} ${cleanQuote(line)}`.trim()); // answer wrapped onto the next line
    } else if (!line) {
      current = null;
    }
  }
  return out;
}

function cleanQuote(text: string): string {
  return text.replace(/\*\*/g, "").replace(/^["«“]+|["»”]+$/g, "").trim();
}

const norm = (s: string) => s.replace(/\s+/g, " ").trim();

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Replaces one sentence inside an inline-HTML fragment. Tries the literal
 * HTML first (keeps bold/links around it); if inline tags cross the
 * sentence, rebuilds that fragment as plain text with the replacement.
 */
function replaceInHtml(html: string, original: string, replacement: string): string | null {
  const plain = norm(plainText(html));
  const target = norm(original);
  if (!target || !plain.includes(target)) return null;
  const literal = escapeHtml(target);
  const flat = html.replace(/\s+/g, " ");
  if (flat.includes(literal)) return cleanInline(flat.replace(literal, escapeHtml(replacement)));
  return cleanInline(escapeHtml(plain.replace(target, replacement)));
}

export function planRewrites(blocks: Block[], targets: RewriteTarget[], answers: Map<number, string>): RewriteProposal[] {
  return targets.map((t, i) => {
    const replacement = answers.get(i + 1) ?? "";
    const found = blocks.some((b) => isTextBlock(b) && norm(plainText(b.type === "list" ? b.html.replace(/<\/li>/gi, " </li>") : b.html)).includes(norm(t.text)));
    return { index: i + 1, original: t.text, replacement, found };
  });
}

/** Applies accepted proposals; every other block is returned untouched (same object). */
export function applyRewrites(blocks: Block[], proposals: RewriteProposal[]): { blocks: Block[]; applied: number } {
  let applied = 0;
  let next = blocks;
  for (const p of proposals) {
    if (!p.replacement || norm(p.replacement) === norm(p.original)) continue;
    let done = false;
    next = next.map((block) => {
      if (done || !isTextBlock(block)) return block;
      if (block.type === "list") {
        const items = block.html.replace(/<li([^>]*)>([\s\S]*?)<\/li>/gi, (whole, attrs, inner) => {
          if (done) return whole;
          const replaced = replaceInHtml(inner, p.original, p.replacement);
          if (replaced === null) return whole;
          done = true;
          return `<li${attrs}>${replaced}</li>`;
        });
        return done ? { ...block, html: items } : block;
      }
      const replaced = replaceInHtml(block.html, p.original, p.replacement);
      if (replaced === null) return block;
      done = true;
      return { ...block, html: replaced } as Block;
    });
    if (done) applied += 1;
  }
  return { blocks: next, applied };
}
