// Shared rules for every prompt the editor copies to ChatGPT (or runs through
// the automatic AI): the answer must come back inside ONE code block, so the
// editor copies it with ChatGPT's "Copiar código" button instead of selecting
// text by hand -- and Markdown symbols (#, **, >) survive the copy intact.

export const COPY_PASTE_DELIVERY = `ENTREGA (obligatorio)
- Responde con UN SOLO bloque de código que empiece con \`\`\`text y termine con \`\`\`.
- Dentro del bloque va únicamente la respuesta, en el formato pedido.
- Nada antes ni después del bloque: sin saludo, explicación, notas, opciones extra ni preguntas.
- No uses negritas ni viñetas que no estén en el formato.`;

/** Appends the copy-paste delivery rule to a prompt (idempotent). */
export function withCopyPaste(prompt: string): string {
  const body = prompt.trimEnd();
  return body.includes("ENTREGA (obligatorio)") ? body : `${body}\n\n${COPY_PASTE_DELIVERY}`;
}

/**
 * Normalises a pasted/returned answer: if it contains a fenced code block,
 * returns the content of the first one; otherwise the text itself.
 * Accepts both "the whole ChatGPT message" and "just the copied block".
 */
export function unwrapAnswer(text: string): string {
  const clean = text.replace(/\r/g, "");
  const fenced = clean.match(/```[\w-]*[^\S\n]*\n([\s\S]*?)\n?[^\S\n]*```/);
  if (fenced) return fenced[1].trim();
  return clean.replace(/^\s*```[\w-]*\s*\n?/, "").replace(/\n?```\s*$/, "").trim();
}
