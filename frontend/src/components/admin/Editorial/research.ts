// Pieces of the "Buscar información" panel: what gets inserted into the article.
import type { JSONContent } from "@tiptap/core";
import { normalizeText } from "./paletteSearch";
import { safeHttpUrl } from "./safeLinks";

const SNIPPET_LENGTH = 260;

/** A readable fragment of `text` around the first occurrence of the query's first word. */
export function snippetAround(text: string, query: string, length = SNIPPET_LENGTH): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= length) return clean;
  const word = normalizeText(query).split(" ").find(Boolean) ?? "";
  // normalizeText keeps the length of the string except for removed accents, so map by
  // searching the normalized text and falling back to the start.
  const index = word ? normalizeText(clean).indexOf(word) : -1;
  if (index < 0) return `${clean.slice(0, length).replace(/\s+\S*$/, "")}…`;
  const start = Math.max(0, clean.lastIndexOf(" ", Math.max(0, index - length / 3)) + 1);
  const piece = clean.slice(start, start + length).replace(/\s+\S*$/, "");
  return `${start > 0 ? "…" : ""}${piece}…`;
}

/** Inline link to another article of the site, followed by a space. */
export function internalLink(title: string, slug: string): JSONContent[] {
  return [
    { type: "text", text: title, marks: [{ type: "link", attrs: { href: `/noticia/${slug}` } }] },
    { type: "text", text: " " },
  ];
}

/** A quote from a source with its attribution; the link is only added for web URLs. */
export function sourceQuote(snippet: string, sourceName: string, url: string | null): JSONContent {
  const href = safeHttpUrl(url);
  return {
    type: "blockquote",
    content: [
      { type: "paragraph", content: [{ type: "text", text: snippet }] },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Fuente: " },
          href
            ? { type: "text", text: sourceName, marks: [{ type: "link", attrs: { href } }] }
            : { type: "text", text: sourceName },
        ],
      },
    ],
  };
}
