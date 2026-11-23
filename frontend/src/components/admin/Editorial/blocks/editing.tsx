"use client";

// Low-level editing helpers: an uncontrolled contentEditable that never
// fights the caret, caret utilities, and image upload with in-browser
// resizing (keeps requests far below Vercel's 4.5 MB body limit).

import { createElement, forwardRef, useImperativeHandle, useLayoutEffect, useRef, type KeyboardEvent, type ClipboardEvent } from "react";
import { apiFetch } from "@/studio/lab/api-client";

type EditableProps = {
  tag: "p" | "h1" | "h2" | "h3" | "blockquote" | "ul" | "ol" | "figcaption" | "div";
  html: string;
  onChange: (html: string) => void;
  onKeyDown?: (event: KeyboardEvent<HTMLElement>) => void;
  onPaste?: (event: ClipboardEvent<HTMLElement>) => void;
  onFocus?: () => void;
  placeholder?: string;
  className?: string;
  /** Plain-text fields (title, excerpt): formatting is never kept. */
  plain?: boolean;
  readOnly?: boolean;
};

export const Editable = forwardRef<HTMLElement | null, EditableProps>(function Editable(
  { tag, html, onChange, onKeyDown, onPaste, onFocus, placeholder, className, plain, readOnly }, ref,
) {
  const el = useRef<HTMLElement | null>(null);
  useImperativeHandle(ref, () => el.current as HTMLElement);

  // Write the DOM only when the value changed from OUTSIDE (never while the
  // user is typing in this element) -- that's what keeps the caret stable.
  useLayoutEffect(() => {
    const node = el.current;
    if (!node) return;
    const current = plain ? node.innerText : node.innerHTML;
    if (current !== html && document.activeElement !== node) {
      if (plain) node.innerText = html;
      else node.innerHTML = html;
    }
  }, [html, plain]);

  return createElement(tag, {
    ref: (node: HTMLElement | null) => { el.current = node; },
    contentEditable: !readOnly,
    suppressContentEditableWarning: true,
    spellCheck: true,
    className: `${className ?? ""} outline-none`,
    "data-placeholder": placeholder,
    "data-plain": plain ? "true" : undefined,
    onInput: (event: { currentTarget: HTMLElement }) => {
      const node = event.currentTarget;
      if (!node.textContent && !node.querySelector("img,li")) node.innerHTML = ""; // keep :empty placeholder working
      onChange(plain ? node.innerText.replace(/\n+/g, " ") : node.innerHTML);
    },
    onKeyDown,
    onFocus,
    onPaste: onPaste ?? (plain ? pastePlain : undefined),
  });
});

export function pastePlain(event: ClipboardEvent<HTMLElement>) {
  event.preventDefault();
  const text = event.clipboardData.getData("text/plain").replace(/\s+/g, " ");
  document.execCommand("insertText", false, text);
}

// ── Caret ──────────────────────────────────────────────────────────────────

function rangeTo(el: HTMLElement, fromStart: boolean): Range | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  const caret = selection.getRangeAt(0);
  if (!el.contains(caret.startContainer)) return null;
  const range = document.createRange();
  range.selectNodeContents(el);
  if (fromStart) range.setEnd(caret.startContainer, caret.startOffset);
  else range.setStart(caret.endContainer, caret.endOffset);
  return range;
}

export function caretAtStart(el: HTMLElement): boolean {
  const selection = window.getSelection();
  if (!selection?.isCollapsed) return false;
  const range = rangeTo(el, true);
  return Boolean(range) && range!.toString().length === 0 && !range!.cloneContents().querySelector("img,br");
}

export function caretAtEnd(el: HTMLElement): boolean {
  const selection = window.getSelection();
  if (!selection?.isCollapsed) return false;
  const range = rangeTo(el, false);
  return Boolean(range) && range!.toString().length === 0;
}

/** Splits the element at the caret; returns the HTML that moves to a new block. */
export function splitAtCaret(el: HTMLElement): { before: string; after: string } {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return { before: el.innerHTML, after: "" };
  selection.getRangeAt(0).deleteContents();
  const range = rangeTo(el, false);
  if (!range) return { before: el.innerHTML, after: "" };
  const holder = document.createElement("div");
  holder.appendChild(range.extractContents());
  return { before: el.innerHTML, after: holder.innerHTML };
}

/** Places the caret at a character offset (or "end"). */
export function placeCaret(el: HTMLElement, at: number | "end" | "start") {
  el.focus();
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  if (at === "end" || at === "start") {
    range.selectNodeContents(el);
    range.collapse(at === "start");
  } else {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let remaining = at;
    let node = walker.nextNode();
    let placed = false;
    while (node) {
      const length = node.textContent?.length ?? 0;
      if (remaining <= length) {
        range.setStart(node, remaining);
        range.collapse(true);
        placed = true;
        break;
      }
      remaining -= length;
      node = walker.nextNode();
    }
    if (!placed) {
      range.selectNodeContents(el);
      range.collapse(false);
    }
  }
  selection.removeAllRanges();
  selection.addRange(range);
}

// ── Images ─────────────────────────────────────────────────────────────────

const MAX_SIDE = 1920;

/** Resizes to at most 1920px and re-encodes (JPEG 85%, PNG kept for transparency). */
export async function prepareImage(file: File): Promise<Blob> {
  if (file.type === "image/gif" || !file.type.startsWith("image/")) return file;
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size < 1.5 * 1024 * 1024) return file;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const type = file.type === "image/png" ? "image/png" : "image/jpeg";
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob ?? file), type, 0.85));
}

export async function uploadImage(artifactId: string, file: File): Promise<string> {
  const blob = await prepareImage(file);
  if (blob.size > 4 * 1024 * 1024) throw new Error("La imagen sigue pesando más de 4 MB después de reducirla; usa una más liviana.");
  const form = new FormData();
  const ext = blob.type === "image/png" ? "png" : blob.type === "image/gif" ? "gif" : "jpg";
  form.append("file", blob, `imagen.${ext}`);
  const response = await apiFetch(`/api/editorial/articles/${encodeURIComponent(artifactId)}/images`, { method: "POST", body: form });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.detail || body?.message || `No se pudo subir la imagen (HTTP ${response.status})`);
  return body.url as string;
}
