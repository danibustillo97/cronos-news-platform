// Block model for the portal-identical editor.
//
// The article body is still stored and published as plain HTML (the exact
// HTML the portal renders in ArticleContent.tsx). Blocks are only the
// editing representation: parse(HTML) -> blocks -> serialize() -> HTML.
// Round-tripping keeps anything the editor doesn't understand as a `raw`
// block, so no content is ever silently dropped.

import DOMPurify from "isomorphic-dompurify";

export type Block =
  | { id: string; type: "paragraph"; html: string }
  | { id: string; type: "heading"; level: 2 | 3; html: string }
  | { id: string; type: "quote"; html: string }
  | { id: string; type: "list"; ordered: boolean; html: string }
  | { id: string; type: "image"; src: string; caption: string; alt: string }
  | { id: string; type: "embed"; videoId: string }
  | { id: string; type: "divider" }
  | { id: string; type: "placeholder"; placeholderId: string }
  | { id: string; type: "raw"; html: string };

export type BlockType = Block["type"];
export type TextBlock = Extract<Block, { html: string }>;

let counter = 0;
export function newId(): string {
  counter += 1;
  return `b${Date.now().toString(36)}${counter.toString(36)}`;
}

export function isTextBlock(block: Block): block is TextBlock {
  return block.type === "paragraph" || block.type === "heading" || block.type === "quote" || block.type === "list";
}

const INLINE = { ALLOWED_TAGS: ["b", "strong", "i", "em", "u", "s", "a", "br", "code", "sup", "sub"], ALLOWED_ATTR: ["href", "target", "rel"] };
const LIST = { ALLOWED_TAGS: [...INLINE.ALLOWED_TAGS, "li"], ALLOWED_ATTR: INLINE.ALLOWED_ATTR };

/** Inline-only HTML for text blocks (what contentEditable is allowed to keep). */
export function cleanInline(html: string): string {
  return DOMPurify.sanitize(html, INLINE).replace(/(<br\s*\/?>\s*)+$/i, "").trim();
}

export function cleanList(html: string): string {
  const cleaned = DOMPurify.sanitize(html, LIST).trim();
  return /<li\b/i.test(cleaned) ? cleaned : `<li>${cleaned}</li>`;
}

export function plainText(html: string): string {
  return html.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

export function youtubeId(url: string): string | null {
  const value = url.trim();
  const patterns = [
    /youtu\.be\/([\w-]{11})/, /[?&]v=([\w-]{11})/, /\/embed\/([\w-]{11})/, /\/shorts\/([\w-]{11})/, /\/live\/([\w-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (match) return match[1];
  }
  return /^[\w-]{11}$/.test(value) ? value : null;
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ── HTML -> blocks ─────────────────────────────────────────────────────────

export function parseHtml(html: string): Block[] {
  const source = (html || "").replace(/^\s*<article[^>]*>/i, "").replace(/<\/article>\s*$/i, "");
  if (typeof DOMParser === "undefined") return source.trim() ? [{ id: newId(), type: "raw", html: source }] : [];
  const doc = new DOMParser().parseFromString(`<body>${source}</body>`, "text/html");
  const blocks: Block[] = [];
  doc.body.childNodes.forEach((node) => collect(node, blocks));
  return blocks;
}

function collect(node: ChildNode, out: Block[]): void {
  if (node.nodeType === 3) {
    const text = (node.textContent || "").trim();
    if (text) out.push({ id: newId(), type: "paragraph", html: cleanInline(escapeAttr(text)) });
    return;
  }
  if (node.nodeType !== 1) return;
  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();

  if (tag === "p") {
    const onlyImg = el.children.length === 1 && el.children[0].tagName === "IMG" && !plainText(el.innerHTML);
    if (onlyImg) return collect(el.children[0] as ChildNode, out);
    const html = cleanInline(el.innerHTML);
    if (plainText(html)) out.push({ id: newId(), type: "paragraph", html });
    return;
  }
  if (/^h[1-6]$/.test(tag)) {
    out.push({ id: newId(), type: "heading", level: tag === "h1" || tag === "h2" ? 2 : 3, html: cleanInline(el.innerHTML) });
    return;
  }
  if (tag === "blockquote") {
    const inner = el.querySelectorAll("p").length
      ? Array.from(el.querySelectorAll("p")).map((p) => p.innerHTML).join("<br>")
      : el.innerHTML;
    out.push({ id: newId(), type: "quote", html: cleanInline(inner) });
    return;
  }
  if (tag === "ul" || tag === "ol") {
    out.push({ id: newId(), type: "list", ordered: tag === "ol", html: cleanList(el.innerHTML) });
    return;
  }
  if (tag === "hr") {
    out.push({ id: newId(), type: "divider" });
    return;
  }
  if (tag === "figure" && el.getAttribute("data-placeholder-id")) {
    out.push({ id: newId(), type: "placeholder", placeholderId: el.getAttribute("data-placeholder-id")! });
    return;
  }
  const iframe = tag === "iframe" ? el : el.querySelector("iframe");
  if (iframe && (tag === "iframe" || tag === "figure" || tag === "div")) {
    const id = youtubeId(iframe.getAttribute("src") || "");
    out.push(id ? { id: newId(), type: "embed", videoId: id } : { id: newId(), type: "raw", html: el.outerHTML });
    return;
  }
  const img = tag === "img" ? el : tag === "figure" ? el.querySelector("img") : null;
  if (img) {
    out.push({
      id: newId(), type: "image", src: img.getAttribute("src") || "", alt: img.getAttribute("alt") || "",
      caption: tag === "figure" ? cleanInline(el.querySelector("figcaption")?.innerHTML || "") : "",
    });
    return;
  }
  if (tag === "div" || tag === "section" || tag === "main" || tag === "header" || tag === "span") {
    // Wrappers: flatten. A wrapper holding only inline content is a paragraph.
    const hasBlockChild = Array.from(el.children).some((c) => /^(P|H[1-6]|UL|OL|BLOCKQUOTE|FIGURE|IMG|HR|DIV|SECTION|IFRAME|TABLE)$/.test(c.tagName));
    if (!hasBlockChild) {
      const html = cleanInline(el.innerHTML);
      if (plainText(html)) out.push({ id: newId(), type: "paragraph", html });
      return;
    }
    el.childNodes.forEach((child) => collect(child, out));
    return;
  }
  if (tag === "br") return;
  if (["b", "strong", "i", "em", "a", "u", "s", "code"].includes(tag)) {
    const html = cleanInline(el.outerHTML);
    if (plainText(html)) out.push({ id: newId(), type: "paragraph", html });
    return;
  }
  out.push({ id: newId(), type: "raw", html: el.outerHTML }); // tables, embeds we don't edit, etc.
}

// ── blocks -> HTML (exactly what the portal renders) ──────────────────────

export function serializeBlock(block: Block): string {
  switch (block.type) {
    case "paragraph": {
      const html = cleanInline(block.html);
      return plainText(html) ? `<p>${html}</p>` : "";
    }
    case "heading": {
      const html = cleanInline(block.html);
      return plainText(html) ? `<h${block.level}>${html}</h${block.level}>` : "";
    }
    case "quote": {
      const html = cleanInline(block.html);
      return plainText(html) ? `<blockquote><p>${html}</p></blockquote>` : "";
    }
    case "list": {
      const items = cleanList(block.html);
      return plainText(items) ? `<${block.ordered ? "ol" : "ul"}>${items}</${block.ordered ? "ol" : "ul"}>` : "";
    }
    case "image": {
      if (!block.src) return "";
      const caption = cleanInline(block.caption);
      return `<figure><img src="${escapeAttr(block.src)}" alt="${escapeAttr(block.alt)}" />${plainText(caption) ? `<figcaption>${caption}</figcaption>` : ""}</figure>`;
    }
    case "embed":
      return `<figure><iframe src="https://www.youtube-nocookie.com/embed/${block.videoId}" title="Video de YouTube" width="560" height="315" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe></figure>`;
    case "divider":
      return "<hr />";
    case "placeholder":
      return `<figure data-placeholder-id="${escapeAttr(block.placeholderId)}"></figure>`;
    case "raw":
      return block.html;
  }
}

export function serialize(blocks: Block[]): string {
  return `<article>${blocks.map(serializeBlock).filter(Boolean).join("")}</article>`;
}

export function emptyBlock(type: BlockType): Block {
  const id = newId();
  switch (type) {
    case "heading": return { id, type, level: 2, html: "" };
    case "quote": return { id, type, html: "" };
    case "list": return { id, type, ordered: false, html: "<li></li>" };
    case "image": return { id, type, src: "", caption: "", alt: "" };
    case "embed": return { id, type, videoId: "" };
    case "divider": return { id, type };
    case "placeholder": return { id, type, placeholderId: "" };
    case "raw": return { id, type, html: "" };
    default: return { id, type: "paragraph", html: "" };
  }
}

/** Convert a text block to another text type, keeping its words. */
export function convertBlock(block: Block, to: "paragraph" | "heading2" | "heading3" | "quote" | "list" | "olist"): Block {
  const text = isTextBlock(block)
    ? block.type === "list" ? block.html.replace(/<\/li>\s*<li[^>]*>/gi, "<br>").replace(/<\/?li[^>]*>/gi, "") : block.html
    : "";
  switch (to) {
    case "heading2": return { id: block.id, type: "heading", level: 2, html: plainText(text) ? cleanInline(text) : "" };
    case "heading3": return { id: block.id, type: "heading", level: 3, html: plainText(text) ? cleanInline(text) : "" };
    case "quote": return { id: block.id, type: "quote", html: text };
    case "list":
    case "olist": {
      const items = text.split(/<br\s*\/?>/i).map((t) => t.trim()).filter(Boolean);
      return { id: block.id, type: "list", ordered: to === "olist", html: (items.length ? items : [""]).map((t) => `<li>${t}</li>`).join("") };
    }
    default: return { id: block.id, type: "paragraph", html: text };
  }
}

export function wordCount(blocks: Block[]): number {
  return blocks.reduce((sum, b) => sum + (isTextBlock(b) ? plainText(b.html).split(" ").filter(Boolean).length : 0), 0);
}
