"use client";

// Block editor that IS the portal page. Same markup and classes as
// components/news/ArticleContent.tsx (header grid, 3:2 cover, body grid
// with share rail + sidebar, `.article-content` typography, drop cap), so
// what you type is exactly what readers will see. Content is still saved
// as the HTML the portal renders (blockModel.serialize).

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ClipboardEvent, type DragEvent, type KeyboardEvent } from "react";
import {
  ArrowDown, ArrowUp, Bold, Calendar, Copy, GripVertical, Heading2, Heading3, ImageIcon, Italic, Link2, List,
  ClipboardCopy, ClipboardPaste, ListOrdered, Loader2, Minus, Pilcrow, Plus, Quote, Trash2, Unlink, Upload, X, Youtube,
} from "lucide-react";
import { toast } from "sonner";
import DOMPurify from "isomorphic-dompurify";
import { apiFetch } from "@/studio/lab/api-client";
import type { MediaRequirement } from "../MediaRequirementBlock";
import type { RevisionDraft } from "../revisionDraft";
import {
  convertBlock, emptyBlock, isTextBlock, newId, parseHtml, plainText, serialize, wordCount, youtubeId,
  type Block,
} from "./blockModel";
import { Editable, caretAtEnd, caretAtStart, placeCaret, splitAtCaret, uploadImage } from "./editing";
import { buildAiPrompt, fromMarkdown, looksStructured, toMarkdown } from "./markdown";
import { analyzeSeo } from "./seo";
import SeoPanel, { type OriginalityResult, type SeoFields } from "./SeoPanel";
import { applyRewrites, articlePlainText, buildRewritePrompt, parseRewrites, planRewrites, type RewriteProposal } from "./rewrite";
import { buildImagePrompt, type ImageModel } from "./imagePrompt";
import { aiFixableCount, autoFixes, buildFixPrompt, parseFixAnswer, type FixContext, type FixPatch, type FixPromptPlan } from "./seoFixes";
import type { SeoReport } from "./seo";
import { BottomSheet, MobileBlockToolbar, useKeyboardInset, useTouchLayout } from "./mobile";

/** Lets the cover and image blocks copy an AI image prompt built from the whole article. */
type ImagePromptFn = (opts: { purpose: "cover" | "body"; suggestion?: string; model: ImageModel }) => Promise<{ alt: string; caption: string } | null>;
const ImagePromptContext = createContext<ImagePromptFn | null>(null);

interface Category { id: string; name: string }
interface CategoryGroup { id: string; name: string; categories: Category[] }

const TITLE_MAX = 70;
const DROP_CAP = "first-letter:text-7xl first-letter:font-black first-letter:text-yellow-400 first-letter:mr-4 first-letter:float-left first-letter:leading-[0.8]";

type InsertOption = { key: string; label: string; hint: string; icon: typeof Pilcrow; make: () => Block };
const INSERT_OPTIONS: InsertOption[] = [
  { key: "p", label: "Párrafo", hint: "Texto normal", icon: Pilcrow, make: () => emptyBlock("paragraph") },
  { key: "h2", label: "Subtítulo", hint: "Divide la noticia en secciones", icon: Heading2, make: () => ({ ...emptyBlock("heading"), level: 2 } as Block) },
  { key: "h3", label: "Subtítulo pequeño", hint: "Dentro de una sección", icon: Heading3, make: () => ({ ...emptyBlock("heading"), level: 3 } as Block) },
  { key: "quote", label: "Cita", hint: "Declaraciones destacadas", icon: Quote, make: () => emptyBlock("quote") },
  { key: "ul", label: "Lista", hint: "Con viñetas", icon: List, make: () => emptyBlock("list") },
  { key: "ol", label: "Lista numerada", hint: "Pasos o ranking", icon: ListOrdered, make: () => ({ ...emptyBlock("list"), ordered: true } as Block) },
  { key: "img", label: "Imagen", hint: "Subir foto o pegar enlace", icon: ImageIcon, make: () => emptyBlock("image") },
  { key: "yt", label: "Video de YouTube", hint: "Goles, ruedas de prensa", icon: Youtube, make: () => emptyBlock("embed") },
  { key: "hr", label: "Separador", hint: "Línea divisoria", icon: Minus, make: () => emptyBlock("divider") },
];

export default function PortalBlockEditor({
  draft, onFieldChange, categoryGroups, mediaRequirements, artifactId, onMediaChanged, readOnly = false, publishedAt,
  seo = null, onSeoChange, sources = [], status, onPublish, publishing = false, blockingIssues = [],
}: {
  draft: RevisionDraft;
  onFieldChange: (patch: Partial<RevisionDraft>) => void;
  categoryGroups: CategoryGroup[];
  mediaRequirements: MediaRequirement[];
  artifactId: string;
  onMediaChanged: () => void;
  readOnly?: boolean;
  publishedAt?: string | null;
  seo?: SeoFields | null;
  onSeoChange?: (patch: Partial<SeoFields>) => void;
  sources?: { sourceName: string | null; sourceDomain: string; sourceUrl: string }[];
  status?: string;
  /** One-click publish (save → submit → approve → publish/schedule); resolves true on success. */
  onPublish?: (when?: Date) => Promise<boolean>;
  publishing?: boolean;
  blockingIssues?: string[];
}) {
  // Blocks are parsed once per article; afterwards the editor owns them.
  const [blocks, setBlocks] = useState<Block[]>(() => {
    const parsed = parseHtml(draft.contentHtml);
    return parsed.length ? parsed : [emptyBlock("paragraph")];
  });
  const refs = useRef(new Map<string, HTMLElement | null>());
  const [menu, setMenu] = useState<{ index: number; replace: boolean; top: number; left: number } | null>(null);
  const [blockMenu, setBlockMenu] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Touch layout: the block being edited drives the toolbar docked above the keyboard.
  const touch = useTouchLayout();
  const [activeId, setActiveId] = useState<string | null>(null);
  const blocksRootRef = useRef<HTMLDivElement>(null);
  const toolbarBottom = useKeyboardInset(touch && activeId !== null);
  useEffect(() => {
    if (!touch) return;
    // Focus moving to the header, SEO panel, a dialog… ends block editing.
    const onFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target?.closest("[data-block-id]") && !blocksRootRef.current?.contains(target)) setActiveId(null);
    };
    document.addEventListener("focusin", onFocusIn);
    return () => document.removeEventListener("focusin", onFocusIn);
  }, [touch]);

  const commit = useCallback((next: Block[]) => {
    setBlocks(next);
    onFieldChange({ contentHtml: serialize(next) });
  }, [onFieldChange]);

  const blocksRef = useRef(blocks);
  blocksRef.current = blocks;

  const focusBlock = (id: string, at: number | "end" | "start" = "end") => {
    requestAnimationFrame(() => {
      const el = refs.current.get(id);
      if (el) placeCaret(el, at);
    });
  };

  const update = (id: string, patch: Partial<Block>) => {
    commit(blocksRef.current.map((b) => (b.id === id ? ({ ...b, ...patch } as Block) : b)));
  };

  const insertAt = (index: number, block: Block, replace = false) => {
    const list = [...blocksRef.current];
    list.splice(index, replace ? 1 : 0, block);
    commit(list);
    if (isTextBlock(block)) focusBlock(block.id, "start");
  };

  const removeWithUndo = (id: string) => {
    const before = blocksRef.current;
    remove(id, false);
    setActiveId(null);
    toast.success("Bloque eliminado", { action: { label: "Deshacer", onClick: () => commit(before) }, duration: 8000 });
  };

  const remove = (id: string, focusPrevious = true) => {
    const list = blocksRef.current;
    const index = list.findIndex((b) => b.id === id);
    const next = list.filter((b) => b.id !== id);
    commit(next.length ? next : [emptyBlock("paragraph")]);
    const previous = next[Math.max(0, index - 1)];
    if (focusPrevious && previous && isTextBlock(previous)) focusBlock(previous.id, "end");
  };

  const move = (id: string, delta: -1 | 1) => {
    const list = [...blocksRef.current];
    const index = list.findIndex((b) => b.id === id);
    const target = index + delta;
    if (target < 0 || target >= list.length) return;
    [list[index], list[target]] = [list[target], list[index]];
    commit(list);
  };

  const openInsertMenu = (index: number, replace: boolean, anchor: HTMLElement | null) => {
    const canvas = canvasRef.current?.getBoundingClientRect();
    const rect = anchor?.getBoundingClientRect();
    setMenu({
      index, replace,
      top: rect && canvas ? rect.bottom - canvas.top + 6 : 0,
      left: rect && canvas ? Math.max(0, rect.left - canvas.left) : 0,
    });
  };

  // ── Keyboard behaviour inside text blocks ────────────────────────────────
  const onTextKeyDown = (block: Block, index: number) => (event: KeyboardEvent<HTMLElement>) => {
    const el = event.currentTarget;
    const list = blocksRef.current;

    if (event.key === "/" && block.type === "paragraph" && !plainText(el.innerHTML)) {
      event.preventDefault();
      openInsertMenu(index, true, el);
      return;
    }
    if (event.key === "Escape") setMenu(null);

    if (block.type === "list") {
      // Native <li> behaviour, except: Enter on an empty last item exits the list.
      if (event.key === "Enter" && !event.shiftKey) {
        const items = el.querySelectorAll("li");
        const last = items[items.length - 1];
        if (last && !plainText(last.innerHTML) && el.contains(window.getSelection()?.anchorNode ?? null)) {
          event.preventDefault();
          last.remove();
          update(block.id, { html: el.innerHTML || "<li></li>" });
          insertAt(index + 1, emptyBlock("paragraph"));
        }
      }
      if (event.key === "Backspace" && !plainText(el.innerHTML) && el.querySelectorAll("li").length <= 1) {
        event.preventDefault();
        const paragraph = convertBlock(block, "paragraph");
        commit(list.map((b) => (b.id === block.id ? paragraph : b)));
        focusBlock(block.id, "start");
      }
      return;
    }

    if (event.key === "Enter" && event.shiftKey) {
      event.preventDefault();
      document.execCommand("insertLineBreak");
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const { before, after } = splitAtCaret(el);
      const next: Block = { ...emptyBlock("paragraph"), html: after } as Block;
      const updated = [...list];
      updated[index] = { ...block, html: before } as Block;
      updated.splice(index + 1, 0, next);
      commit(updated);
      focusBlock(next.id, "start");
      return;
    }
    if (event.key === "Backspace" && caretAtStart(el)) {
      if (block.type !== "paragraph") {
        event.preventDefault();
        const paragraph = convertBlock(block, "paragraph");
        commit(list.map((b) => (b.id === block.id ? paragraph : b)));
        focusBlock(block.id, "start");
        return;
      }
      const previous = list[index - 1];
      if (!plainText(el.innerHTML)) {
        event.preventDefault();
        if (index > 0) remove(block.id);
        return;
      }
      if (previous && isTextBlock(previous) && previous.type !== "list") {
        event.preventDefault();
        const joinAt = plainText(previous.html).length;
        commit(list.filter((b) => b.id !== block.id).map((b) => (b.id === previous.id ? ({ ...b, html: previous.html + el.innerHTML } as Block) : b)));
        focusBlock(previous.id, joinAt);
      }
      return;
    }
    if (event.key === "ArrowUp" && caretAtStart(el) && index > 0) {
      const previous = list[index - 1];
      if (isTextBlock(previous)) { event.preventDefault(); focusBlock(previous.id, "end"); }
    }
    if (event.key === "ArrowDown" && caretAtEnd(el) && index < list.length - 1) {
      const next = list[index + 1];
      if (isTextBlock(next)) { event.preventDefault(); focusBlock(next.id, "start"); }
    }
  };

  // Multi-paragraph paste becomes several blocks; formatting from Word/web is dropped.
  const onTextPaste = (block: Block, index: number) => (event: ClipboardEvent<HTMLElement>) => {
    event.preventDefault();
    const text = event.clipboardData.getData("text/plain").replace(/\r/g, "");
    if (block.type !== "list" && looksStructured(text)) {
      // Pasted text with headings/lists/quotes (e.g. from ChatGPT) -> real blocks.
      const { blocks: pasted } = fromMarkdown(text);
      if (pasted.length) {
        const el = refs.current.get(block.id);
        const currentEmpty = !plainText(el?.innerHTML ?? "");
        const list = [...blocksRef.current];
        list.splice(currentEmpty ? index : index + 1, currentEmpty ? 1 : 0, ...pasted);
        commit(list);
        const last = pasted[pasted.length - 1];
        if (isTextBlock(last)) focusBlock(last.id, "end");
        return;
      }
    }
    const parts = text.split(/\n\s*\n/).map((t) => t.trim()).filter(Boolean);
    if (parts.length <= 1 || block.type === "list") {
      document.execCommand("insertText", false, text.replace(/\n/g, " "));
      return;
    }
    document.execCommand("insertText", false, parts[0]);
    const el = refs.current.get(block.id);
    const extra = parts.slice(1).map((t) => ({ ...emptyBlock("paragraph"), html: escapeHtml(t) } as Block));
    const list = blocksRef.current.map((b) => (b.id === block.id && el ? ({ ...b, html: el.innerHTML } as Block) : b));
    list.splice(index + 1, 0, ...extra);
    commit(list);
    focusBlock(extra[extra.length - 1].id, "end");
  };

  // ── Drag to reorder ──────────────────────────────────────────────────────
  const onDrop = (targetId: string) => (event: DragEvent) => {
    event.preventDefault();
    if (!dragId || dragId === targetId) return setDragId(null);
    const list = [...blocksRef.current];
    const from = list.findIndex((b) => b.id === dragId);
    const [moved] = list.splice(from, 1);
    list.splice(list.findIndex((b) => b.id === targetId), 0, moved);
    commit(list);
    setDragId(null);
  };

  // ── Whole article: copy for AI / paste & replace ─────────────────────────
  const [copyOpen, setCopyOpen] = useState(false);
  const [replaceOpen, setReplaceOpen] = useState(false);

  // ── SEO + originality (live) ─────────────────────────────────────────────
  const keywordKey = `cronos.seo.keyword.${artifactId}`;
  const [keyword, setKeywordState] = useState(() => {
    try { return window.localStorage.getItem(keywordKey) ?? ""; } catch { return ""; }
  });
  const setKeyword = (value: string) => {
    setKeywordState(value);
    try { window.localStorage.setItem(keywordKey, value); } catch { /* private mode: session only */ }
  };
  const [originality, setOriginality] = useState<OriginalityResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [seoOpen, setSeoOpen] = useState(false);
  const analyzedContent = useRef<string | null>(null);
  const categoryName = useMemo(
    () => categoryGroups.flatMap((g) => g.categories).find((c) => c.id === draft.categoryId)?.name ?? null,
    [categoryGroups, draft.categoryId],
  );
  const coverUrl = mediaRequirements.find((m) => m.kind === "FEATURE_IMAGE")?.assetUrl ?? null;
  const contentKey = useMemo(() => `${draft.title}\n${draft.excerpt}\n${serialize(blocks)}`, [draft.title, draft.excerpt, blocks]);
  const originalityNow = originality ? { ...originality, stale: analyzedContent.current !== null && analyzedContent.current !== contentKey } : null;
  const report = useMemo(() => analyzeSeo({
    title: draft.title, excerpt: draft.excerpt, blocks, seoTitle: seo?.seoTitle ?? "", seoDescription: seo?.seoDescription ?? "",
    slug: seo?.slug ?? "", tags: draft.tags, categoryId: draft.categoryId, coverUrl, keyword,
    originality: originality?.originality ?? null,
  }), [draft.title, draft.excerpt, draft.tags, draft.categoryId, blocks, seo, coverUrl, keyword, originality]);

  const contentKeyRef = useRef(contentKey);
  contentKeyRef.current = contentKey;
  const headerRef = useRef({ title: draft.title, excerpt: draft.excerpt });
  headerRef.current = { title: draft.title, excerpt: draft.excerpt };

  const analyzeOriginality = async () => {
    setAnalyzing(true);
    try {
      // Plain text, exactly what partial rewrites will search for.
      const text = articlePlainText(headerRef.current.title, headerRef.current.excerpt, blocksRef.current);
      const response = await apiFetch(`/api/editorial/articles/${encodeURIComponent(artifactId)}/originality`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.detail || body?.message || `HTTP ${response.status}`);
      analyzedContent.current = contentKeyRef.current;
      setOriginality(body as OriginalityResult);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo analizar la originalidad");
    } finally {
      setAnalyzing(false);
    }
  };

  // ── Partial rewrite of copied sentences (plagiarism) ─────────────────────
  const [rewriteOpen, setRewriteOpen] = useState(false);
  const rewriteTargets = useMemo(() => (originality?.copied ?? []).map((c) => ({ text: c.text, source: c.source })), [originality]);

  const copyRewrite = async () => {
    if (!rewriteTargets.length) return;
    try {
      await navigator.clipboard.writeText(buildRewritePrompt(rewriteTargets, { keyword: keyword || report.keyword, title: draft.title }));
      toast.success(`${rewriteTargets.length} frase(s) copiadas con instrucciones. Pégalas en ChatGPT, copia su bloque con «Copiar código» y usa «Pegar correcciones».`);
    } catch {
      toast.error("El navegador no dejó copiar. Prueba de nuevo con la pestaña activa.");
    }
  };

  const applyRewriteProposals = (accepted: RewriteProposal[]) => {
    const before = blocksRef.current;
    const { blocks: next, applied } = applyRewrites(before, accepted);
    setRewriteOpen(false);
    if (!applied) {
      toast.error("No se aplicó ninguna corrección (las frases ya no coinciden con el texto).");
      return;
    }
    commit(next);
    toast.success(`${applied} frase(s) reescritas. Volviendo a analizar…`, {
      action: { label: "Deshacer", onClick: () => commit(before) },
      duration: 10000,
    });
    requestAnimationFrame(() => void analyzeOriginality()); // blocksRef already holds the new blocks
  };

  // ── Fixing SEO warnings (automatic + one ChatGPT prompt) ─────────────────
  const fixContext = (): FixContext => ({
    title: draft.title, excerpt: draft.excerpt, blocks: blocksRef.current, keyword: keyword || report.keyword, tags: draft.tags,
    seoTitle: seo?.seoTitle ?? "", seoDescription: seo?.seoDescription ?? "", slug: seo?.slug ?? "",
  });
  const autos = useMemo(() => autoFixes(report, {
    title: draft.title, excerpt: draft.excerpt, blocks, keyword: keyword || report.keyword, tags: draft.tags,
    seoTitle: seo?.seoTitle ?? "", seoDescription: seo?.seoDescription ?? "", slug: seo?.slug ?? "",
  }), [report, draft.title, draft.excerpt, draft.tags, blocks, keyword, seo]);
  const autoFixLabels = useMemo(() => Object.fromEntries(Object.entries(autos).map(([id, f]) => [id, f.label])), [autos]);

  const applyPatch = (patch: FixPatch, message: string) => {
    const before = { blocks: blocksRef.current, title: draft.title, excerpt: draft.excerpt, tags: draft.tags, seo: seo ? { ...seo } : null };
    if (patch.blocks) commit(patch.blocks);
    const header: Partial<RevisionDraft> = {};
    if (patch.title !== undefined) header.title = patch.title;
    if (patch.excerpt !== undefined) header.excerpt = patch.excerpt;
    if (patch.tags !== undefined) header.tags = patch.tags;
    if (Object.keys(header).length) onFieldChange(header);
    const seoPatch: Partial<SeoFields> = {};
    if (patch.seoTitle !== undefined) seoPatch.seoTitle = patch.seoTitle;
    if (patch.seoDescription !== undefined) seoPatch.seoDescription = patch.seoDescription;
    if (patch.slug !== undefined) seoPatch.slug = patch.slug;
    if (Object.keys(seoPatch).length) onSeoChange?.(seoPatch);
    toast.success(message, {
      action: {
        label: "Deshacer",
        onClick: () => {
          commit(before.blocks);
          onFieldChange({ title: before.title, excerpt: before.excerpt, tags: before.tags });
          if (before.seo) onSeoChange?.(before.seo);
        },
      },
      duration: 10000,
    });
  };

  const runAutoFix = (id: string) => {
    const fix = autos[id];
    if (fix) applyPatch(fix.patch, `Arreglado: ${fix.label}`);
  };
  const runAllAutoFixes = () => {
    // Apply sequentially on top of each other (each fix only touches its own field/blocks).
    let ctx = fixContext();
    const merged: FixPatch = {};
    for (const id of Object.keys(autos)) {
      const fresh = autoFixes(report, ctx)[id];
      if (!fresh) continue;
      Object.assign(merged, fresh.patch);
      if (fresh.patch.blocks) ctx = { ...ctx, blocks: fresh.patch.blocks };
    }
    applyPatch(merged, `${Object.keys(autos).length} aviso(s) arreglados automáticamente`);
  };

  const fixPlan = useRef<{ plan: FixPromptPlan; ctx: FixContext } | null>(null);
  const [fixOpen, setFixOpen] = useState(false);
  const copyFixPrompt = async () => {
    const ctx = fixContext();
    const plan = buildFixPrompt(report, ctx);
    if (!plan) { toast.success("No hay avisos de redacción pendientes."); return; }
    fixPlan.current = { plan, ctx };
    try {
      await navigator.clipboard.writeText(plan.prompt);
      toast.success("Prompt de corrección copiado. Pégalo en ChatGPT, copia su bloque con «Copiar código» y usa «Pegar respuesta».");
    } catch {
      toast.error("El navegador no dejó copiar. Prueba de nuevo con la pestaña activa.");
    }
  };

  // ── Publish ──────────────────────────────────────────────────────────────
  const [publishOpen, setPublishOpen] = useState(false);

  // ── AI image prompt (cover + body images) ────────────────────────────────
  const copyImagePrompt: ImagePromptFn = async ({ purpose, suggestion, model }) => {
    const result = buildImagePrompt({
      title: headerRef.current.title, excerpt: headerRef.current.excerpt, blocks: blocksRef.current,
      tags: draft.tags, category: categoryName, suggestion, purpose,
    }, model);
    try {
      await navigator.clipboard.writeText(result.prompt);
      toast.success(model === "chatgpt" ? "Prompt copiado: pégalo en ChatGPT y sube aquí la imagen que genere." : "Prompt en inglés copiado para Midjourney / Leonardo.", {
        description: "Al subirla se pondrá el pie «Imagen ilustrativa generada con IA» y su texto alternativo.",
      });
      return { alt: result.alt, caption: result.caption };
    } catch {
      toast.error("El navegador no dejó copiar. Prueba de nuevo con la pestaña activa.");
      return null;
    }
  };

  const contentLabel = useRef<string | null>(null);
  const loadContentLabel = async (): Promise<string> => {
    if (contentLabel.current) return contentLabel.current;
    try {
      const response = await apiFetch("/api/settings/content-profile");
      const profile = response.ok ? await response.json() : null;
      if (profile?.mode === "football") {
        const names = (profile.catalog?.competitions ?? []).filter((c: { id: string }) => profile.competitions.includes(c.id)).map((c: { name: string }) => c.name);
        contentLabel.current = `noticias de fútbol${names.length ? ` (${names.slice(0, 6).join(", ")})` : ""}`;
      } else {
        contentLabel.current = "noticias generales";
      }
    } catch {
      contentLabel.current = "noticias deportivas";
    }
    return contentLabel.current;
  };

  const copyAll = async (withInstructions: boolean) => {
    setCopyOpen(false);
    const text = withInstructions
      ? buildAiPrompt({
        title: draft.title, excerpt: draft.excerpt, blocks: blocksRef.current, keyword: keyword || report.keyword,
        category: categoryName, contentLabel: await loadContentLabel(),
        today: new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date()),
        sources: sources.map((s) => ({ name: s.sourceName || s.sourceDomain, url: s.sourceUrl })),
      })
      : toMarkdown(draft.title, draft.excerpt, blocksRef.current);
    try {
      await navigator.clipboard.writeText(text);
      toast.success(withInstructions
        ? "Copiado con instrucciones: pégalo en ChatGPT, copia su bloque con «Copiar código» y usa «Pegar y reemplazar»."
        : `Noticia copiada (${wordCount(blocksRef.current)} palabras).`);
    } catch {
      toast.error("El navegador no dejó copiar. Prueba de nuevo con la pestaña activa.");
    }
  };

  const replaceAll = (text: string, useHeader: boolean) => {
    const before = {
      blocks: blocksRef.current, title: draft.title, excerpt: draft.excerpt, tags: draft.tags, keyword,
      seo: seo ? { ...seo } : null,
    };
    const parsed = fromMarkdown(text, blocksRef.current);
    if (!parsed.blocks.length && !parsed.title) {
      toast.error("No encontré contenido en el texto pegado.");
      return;
    }
    commit(parsed.blocks.length ? parsed.blocks : [emptyBlock("paragraph")]);
    const header: Partial<RevisionDraft> = {};
    if (useHeader && parsed.title) header.title = parsed.title;
    if (useHeader && parsed.excerpt) header.excerpt = parsed.excerpt;
    if (parsed.seo.tags?.length) header.tags = parsed.seo.tags;
    if (Object.keys(header).length) onFieldChange(header);
    // SEO package from the AI lands in its fields automatically.
    const seoPatch: Partial<SeoFields> = {};
    if (parsed.seo.seoTitle) seoPatch.seoTitle = parsed.seo.seoTitle;
    if (parsed.seo.seoDescription) seoPatch.seoDescription = parsed.seo.seoDescription;
    if (parsed.seo.slug) seoPatch.slug = parsed.seo.slug;
    if (Object.keys(seoPatch).length) onSeoChange?.(seoPatch);
    if (parsed.seo.keyword) setKeyword(parsed.seo.keyword);
    setReplaceOpen(false);
    const filled = [parsed.seo.seoTitle && "título SEO", parsed.seo.seoDescription && "meta descripción", parsed.seo.slug && "slug",
      parsed.seo.tags?.length && "etiquetas", parsed.seo.keyword && "palabra clave"].filter(Boolean);
    toast.success("Contenido reemplazado", {
      description: [
        filled.length ? `También se llenó: ${filled.join(", ")}.` : "",
        parsed.droppedMedia ? `${parsed.droppedMedia} imagen(es) que el texto no mencionaba quedaron al final.` : "",
      ].filter(Boolean).join(" ") || undefined,
      action: {
        label: "Deshacer",
        onClick: () => {
          commit(before.blocks);
          onFieldChange({ title: before.title, excerpt: before.excerpt, tags: before.tags });
          if (before.seo) onSeoChange?.(before.seo);
          setKeyword(before.keyword);
        },
      },
      duration: 10000,
    });
  };

  const firstParagraphId = blocks.find((b) => b.type === "paragraph")?.id;
  const activeIndex = activeId ? blocks.findIndex((b) => b.id === activeId) : -1;
  const activeBlock = activeIndex >= 0 ? { block: blocks[activeIndex], index: activeIndex } : null;
  const words = wordCount(blocks);
  const minutes = Math.max(1, Math.round(words / 200));

  return (
    <ImagePromptContext.Provider value={copyImagePrompt}>
    <div className="touch-safe-inputs min-h-full bg-white text-neutral-900">
      <div className="sticky top-0 z-20 flex items-center gap-2 border-b border-neutral-200 bg-white/95 px-3 py-1.5 text-[11px] text-neutral-500 backdrop-blur sm:gap-3 sm:px-4">
        <span className="hidden font-semibold uppercase tracking-wide text-neutral-400 md:inline">Vista exacta del portal</span>
        <span className="whitespace-nowrap">
          <span className="sm:hidden">{words} pal.</span>
          <span className="hidden sm:inline">{words} palabras · {minutes} min de lectura</span>
        </span>
        <span className={`whitespace-nowrap ${draft.title.length > TITLE_MAX ? "text-red-500" : "hidden sm:inline"}`}>Titular {draft.title.length}/{TITLE_MAX}</span>
        <button
          type="button" onClick={() => setSeoOpen(true)} title="Ver análisis SEO y antiplagio"
          className={`whitespace-nowrap rounded-full px-2 py-1 font-bold lg:pointer-events-none lg:py-0.5 ${report.score >= 85 ? "bg-emerald-50 text-emerald-700" : report.score >= 70 ? "bg-lime-50 text-lime-700" : report.score >= 50 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"}`}
        >
          SEO {report.score}
        </button>
        {originalityNow && (
          <span className={`whitespace-nowrap rounded-full px-2 py-0.5 font-bold ${originalityNow.originality >= 80 ? "bg-emerald-50 text-emerald-700" : originalityNow.originality >= 60 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"}`}>
            {Math.round(originalityNow.originality)}%<span className="hidden sm:inline"> original</span>{originalityNow.stale ? " *" : ""}
          </span>
        )}
        {readOnly && <span className="ml-auto hidden rounded bg-neutral-100 px-2 py-0.5 text-neutral-600 sm:inline">Publicada · solo lectura</span>}
        {!readOnly && <span className="ml-auto hidden xl:pointer-fine:inline">Escribe <kbd className="rounded border px-1">/</kbd> en un párrafo vacío para insertar bloques</span>}
        <div className={`${readOnly ? "" : "xl:ml-3"} ml-auto flex items-center gap-1.5`}>
          <div className="relative">
            <button
              type="button" onClick={() => setCopyOpen((o) => !o)} aria-label="Copiar para IA" aria-expanded={copyOpen}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-neutral-200 px-2.5 font-medium text-neutral-700 hover:bg-neutral-50 sm:h-auto sm:py-1"
            >
              <ClipboardCopy size={14} /> <span className="hidden sm:inline">Copiar para IA</span><span className="sm:hidden">IA</span>
            </button>
            {copyOpen && (
              <>
                <button type="button" aria-label="Cerrar menú" className="fixed inset-0 z-20 cursor-default" onClick={() => setCopyOpen(false)} />
                <div className="absolute right-0 top-full z-30 mt-1 w-[min(18rem,calc(100vw-1.5rem))] rounded-xl border border-neutral-200 bg-white p-1 shadow-xl">
                  <button type="button" onClick={() => void copyAll(true)} className="block w-full rounded-lg px-3 py-2.5 text-left hover:bg-neutral-50">
                    <span className="block text-[12.5px] font-medium text-neutral-900">Copiar con instrucciones para ChatGPT</span>
                    <span className="block text-[11px] text-neutral-500">Le pide mejorarla y mantener el formato y las fotos</span>
                  </button>
                  <button type="button" onClick={() => void copyAll(false)} className="block w-full rounded-lg px-3 py-2.5 text-left hover:bg-neutral-50">
                    <span className="block text-[12.5px] font-medium text-neutral-900">Copiar solo el texto</span>
                    <span className="block text-[11px] text-neutral-500">Titular, entradilla y cuerpo con formato simple</span>
                  </button>
                  {!readOnly && (
                    <button type="button" onClick={() => { setCopyOpen(false); setReplaceOpen(true); }} className="block w-full rounded-lg px-3 py-2.5 text-left hover:bg-neutral-50 sm:hidden">
                      <span className="block text-[12.5px] font-medium text-neutral-900">Pegar y reemplazar</span>
                      <span className="block text-[11px] text-neutral-500">Trae la respuesta de ChatGPT a la noticia</span>
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
          {!readOnly && (
            <button
              type="button" onClick={() => setReplaceOpen(true)}
              className="hidden items-center gap-1.5 rounded-md bg-neutral-900 px-2.5 py-1 font-semibold text-white hover:bg-neutral-700 sm:inline-flex"
            >
              <ClipboardPaste size={13} /> Pegar y reemplazar
            </button>
          )}
          {!readOnly && onPublish && status !== "SCHEDULED" && (
            <button type="button" onClick={() => setPublishOpen(true)} disabled={publishing}
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-emerald-500 px-3 font-bold text-black hover:bg-emerald-400 disabled:opacity-50 sm:h-auto sm:py-1">
              {publishing && <Loader2 size={13} className="animate-spin" />} Publicar
            </button>
          )}
        </div>
      </div>
      {replaceOpen && (
        <ReplaceDialog current={blocks} onCancel={() => setReplaceOpen(false)} onApply={replaceAll} />
      )}
      {fixOpen && fixPlan.current && (
        <FixDialog plan={fixPlan.current.plan} ctx={fixPlan.current.ctx} onCancel={() => setFixOpen(false)}
          onApply={(patch) => { setFixOpen(false); applyPatch(patch, "Correcciones aplicadas"); }} />
      )}
      {publishOpen && onPublish && (
        <PublishDialog report={report} originality={originalityNow} blockingIssues={status === "REVIEW_REQUIRED" ? blockingIssues : []}
          publishing={publishing} onCancel={() => setPublishOpen(false)}
          onPublish={async (when) => { if (await onPublish(when)) setPublishOpen(false); }} />
      )}
      {rewriteOpen && (
        <RewriteDialog blocks={blocks} targets={rewriteTargets} onCancel={() => setRewriteOpen(false)} onApply={applyRewriteProposals} />
      )}
      {seoOpen && (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/40 lg:hidden" onClick={() => setSeoOpen(false)}>
          <div className="h-full w-full overflow-y-auto overscroll-contain bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl sm:max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 z-10 -mx-4 mb-3 flex items-center justify-between border-b border-neutral-100 bg-white px-4 py-3">
              <p className="text-sm font-semibold text-neutral-900">SEO y antiplagio</p>
              <button type="button" onClick={() => setSeoOpen(false)} aria-label="Cerrar" className="-mr-2 rounded-full p-2 text-neutral-400 hover:text-neutral-900"><X size={18} /></button>
            </div>
            <SeoPanel
              report={report} keyword={keyword} onKeywordChange={setKeyword} fields={seo} title={draft.title}
              onFieldsChange={(patch) => onSeoChange?.(patch)} readOnly={readOnly}
              originality={originalityNow} analyzing={analyzing} onAnalyze={() => void analyzeOriginality()}
              onCopyRewrite={() => void copyRewrite()} onPasteRewrite={() => setRewriteOpen(true)}
              autoFixLabels={autoFixLabels} onAutoFix={runAutoFix} onAutoFixAll={runAllAutoFixes}
              aiFixCount={aiFixableCount(report)} onCopyFix={() => void copyFixPrompt()}
              onPasteFix={() => { if (!fixPlan.current) { toast.error("Primero pulsa «Copiar prompt»."); return; } setFixOpen(true); }}
            />
          </div>
        </div>
      )}

      <div ref={canvasRef} className={`relative w-full max-w-7xl mx-auto px-4 md:px-6 pt-5 md:pt-10 ${touch && !readOnly ? "pb-44" : "pb-24"}`}>
        <ArticleHeader
          draft={draft} onFieldChange={onFieldChange} categoryGroups={categoryGroups} readOnly={readOnly}
          artifactId={artifactId} feature={mediaRequirements.find((m) => m.kind === "FEATURE_IMAGE") ?? null}
          onMediaChanged={onMediaChanged} minutes={minutes} publishedAt={publishedAt}
          onTitleEnter={() => { const first = blocks.find(isTextBlock); if (first) focusBlock(first.id, "start"); }}
        />

        <div className="mb-10" />

        <div className="lg:grid lg:grid-cols-[56px_minmax(0,1fr)_300px] lg:gap-8">
          <aside className="hidden lg:block" aria-hidden />

          <div className="min-w-0">
            <div ref={blocksRootRef} className="article-content max-w-none">
              {blocks.map((block, index) => (
                <div
                  key={block.id}
                  data-block-id={block.id}
                  className={`group/block relative ${dragId === block.id ? "opacity-40" : ""} ${touch && !readOnly && activeId === block.id ? "rounded-md ring-2 ring-yellow-400/60 ring-offset-4 ring-offset-white" : ""}`}
                  onDragOver={(e) => { if (dragId) e.preventDefault(); }}
                  onDrop={onDrop(block.id)}
                  onFocusCapture={() => { if (touch && !readOnly) setActiveId(block.id); }}
                  onPointerDownCapture={() => { if (touch && !readOnly) setActiveId(block.id); }}
                >
                  {!readOnly && (
                    <div className="absolute -left-14 top-1 hidden h-8 items-center gap-0.5 opacity-0 transition-opacity group-hover/block:opacity-100 group-focus-within/block:opacity-100 lg:pointer-fine:flex">
                      <button
                        type="button" aria-label="Insertar bloque debajo" title="Insertar bloque debajo"
                        onClick={(e) => openInsertMenu(index + 1, false, e.currentTarget)}
                        className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-800"
                      >
                        <Plus size={16} />
                      </button>
                      <button
                        type="button" aria-label="Opciones del bloque" title="Arrastra para mover · clic para opciones"
                        draggable onDragStart={() => setDragId(block.id)} onDragEnd={() => setDragId(null)}
                        onClick={() => setBlockMenu(blockMenu === block.id ? null : block.id)}
                        className="cursor-grab rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-800"
                      >
                        <GripVertical size={16} />
                      </button>
                    </div>
                  )}
                  {blockMenu === block.id && (
                    <BlockOptions
                      block={block} isFirst={index === 0} isLast={index === blocks.length - 1}
                      onClose={() => setBlockMenu(null)}
                      onMove={(d) => { move(block.id, d); setBlockMenu(null); }}
                      onDuplicate={() => { insertAt(index + 1, { ...block, id: newId() } as Block); setBlockMenu(null); }}
                      onDelete={() => { remove(block.id, false); setBlockMenu(null); }}
                      onConvert={(to) => { commit(blocksRef.current.map((b) => (b.id === block.id ? convertBlock(b, to) : b))); setBlockMenu(null); focusBlock(block.id); }}
                    />
                  )}

                  <BlockView
                    block={block} readOnly={readOnly} artifactId={artifactId}
                    dropCap={block.id === firstParagraphId}
                    placeholderPrompt={block.type === "placeholder" ? mediaRequirements.find((m) => m.placeholderId === block.placeholderId)?.prompt : undefined}
                    registerRef={(el) => refs.current.set(block.id, el)}
                    onChange={(patch) => update(block.id, patch)}
                    onReplace={(next) => commit(blocksRef.current.map((b) => (b.id === block.id ? next : b)))}
                    onRemove={() => remove(block.id, false)}
                    onKeyDown={onTextKeyDown(block, index)}
                    onPaste={onTextPaste(block, index)}
                  />
                </div>
              ))}
            </div>

            {!readOnly && (
              <button
                type="button" onClick={(e) => openInsertMenu(blocks.length, false, e.currentTarget)}
                className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-neutral-300 px-3 py-3 text-xs font-medium text-neutral-500 hover:border-neutral-400 hover:text-neutral-800 sm:w-auto sm:py-2"
              >
                <Plus size={14} /> Agregar bloque
              </button>
            )}
          </div>

          {/* Same 300px column the portal uses for its sidebar -> identical
              line length; in the editor it holds the live SEO/plagiarism panel. */}
          <aside className="hidden lg:block">
            <div className="sticky top-12 max-h-[calc(100vh-7rem)] overflow-y-auto pb-6 pr-1">
              <SeoPanel
                report={report} keyword={keyword} onKeywordChange={setKeyword} fields={seo} title={draft.title}
                onFieldsChange={(patch) => onSeoChange?.(patch)} readOnly={readOnly}
                originality={originalityNow} analyzing={analyzing} onAnalyze={() => void analyzeOriginality()}
              onCopyRewrite={() => void copyRewrite()} onPasteRewrite={() => setRewriteOpen(true)}
              autoFixLabels={autoFixLabels} onAutoFix={runAutoFix} onAutoFixAll={runAllAutoFixes}
              aiFixCount={aiFixableCount(report)} onCopyFix={() => void copyFixPrompt()}
              onPasteFix={() => { if (!fixPlan.current) { toast.error("Primero pulsa «Copiar prompt»."); return; } setFixOpen(true); }}
              />
            </div>
          </aside>
        </div>

        {menu && (touch ? (
          <BottomSheet title="Insertar bloque" onClose={() => setMenu(null)}>
            <div className="grid grid-cols-3 gap-2 pb-1">
              {INSERT_OPTIONS.map((option) => {
                const Icon = option.icon;
                return (
                  <button key={option.key} type="button"
                    onClick={() => { insertAt(menu.index, option.make(), menu.replace); setMenu(null); }}
                    className="flex flex-col items-center gap-1.5 rounded-xl border border-neutral-200 px-1 py-3 text-center active:bg-neutral-100">
                    <Icon size={20} className="text-neutral-700" />
                    <span className="text-[11.5px] font-medium leading-tight text-neutral-800">{option.label}</span>
                  </button>
                );
              })}
            </div>
          </BottomSheet>
        ) : (
          <InsertMenu
            top={menu.top} left={menu.left}
            onClose={() => setMenu(null)}
            onPick={(option) => {
              const block = option.make();
              insertAt(menu.index, block, menu.replace);
              setMenu(null);
            }}
          />
        ))}
        {!readOnly && !touch && <InlineToolbar container={canvasRef} />}
      </div>
      {!readOnly && touch && activeBlock && !menu && (
        <MobileBlockToolbar
          block={activeBlock.block} isFirst={activeBlock.index === 0} isLast={activeBlock.index === blocks.length - 1}
          bottom={toolbarBottom}
          onInsert={() => setMenu({ index: activeBlock.index + 1, replace: false, top: 0, left: 0 })}
          onConvert={(to) => {
            const id = activeBlock.block.id;
            commit(blocksRef.current.map((b) => (b.id === id ? convertBlock(b, to) : b)));
            focusBlock(id);
          }}
          onMove={(d) => {
            move(activeBlock.block.id, d);
            const id = activeBlock.block.id;
            requestAnimationFrame(() => blocksRootRef.current?.querySelector(`[data-block-id="${id}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" }));
          }}
          onDuplicate={() => insertAt(activeBlock.index + 1, { ...activeBlock.block, id: newId() } as Block)}
          onDelete={() => removeWithUndo(activeBlock.block.id)}
          onDone={() => { (document.activeElement as HTMLElement | null)?.blur(); setActiveId(null); }}
        />
      )}
    </div>
    </ImagePromptContext.Provider>
  );
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ── Paste & replace dialog ─────────────────────────────────────────────────

function ReplaceDialog({
  current, onCancel, onApply,
}: { current: Block[]; onCancel: () => void; onApply: (text: string, useHeader: boolean) => void }) {
  const [text, setText] = useState("");
  const [useHeader, setUseHeader] = useState(true);
  const preview = useMemo(() => (text.trim() ? fromMarkdown(text, current) : null), [text, current]);
  const counts = useMemo(() => {
    const c = { paragraph: 0, heading: 0, list: 0, quote: 0 };
    for (const b of preview?.blocks ?? []) if (b.type in c) c[b.type as keyof typeof c] += 1;
    return c;
  }, [preview]);

  const pasteFromClipboard = async () => {
    try { setText(await navigator.clipboard.readText()); } catch { toast.error("Pega con Ctrl+V dentro del recuadro."); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 font-sans sm:items-center sm:p-4" onClick={onCancel}>
      <div className="flex max-h-[92dvh] w-full max-w-2xl flex-col rounded-t-2xl bg-white pb-[env(safe-area-inset-bottom)] shadow-2xl sm:max-h-[90vh] sm:rounded-2xl sm:pb-0" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-neutral-200 px-5 py-4">
          <h3 className="text-base font-semibold text-neutral-900">Pegar y reemplazar todo el contenido</h3>
          <p className="mt-1 text-[12.5px] leading-relaxed text-neutral-500">
            Pega aquí la respuesta de ChatGPT (o cualquier texto). Se convierte en bloques: <code># titular</code>, <code>**Entradilla:**</code>,
            {" "}<code>## subtítulos</code>, listas y citas. Las marcas <code>[IMAGEN 1]</code> recuperan tus mismas fotos.
          </p>
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
          <textarea
            autoFocus value={text} onChange={(e) => setText(e.target.value)} rows={12}
            placeholder={"# Titular\n\n**Entradilla:** La idea principal…\n\nPrimer párrafo…\n\n## Subtítulo\n\n[IMAGEN 1]"}
            className="w-full resize-y rounded-xl border border-neutral-300 p-3 font-mono text-[12.5px] leading-relaxed text-neutral-900 outline-none focus:border-neutral-600"
          />
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => void pasteFromClipboard()} className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50">
              <ClipboardPaste size={13} /> Pegar desde el portapapeles
            </button>
            <label className="flex items-center gap-2 text-xs text-neutral-600">
              <input type="checkbox" checked={useHeader} onChange={(e) => setUseHeader(e.target.checked)} />
              Usar también el titular y la entradilla del texto
            </label>
          </div>
          {preview && (
            <div className="rounded-xl bg-neutral-50 p-3 text-[12px] text-neutral-600">
              <p className="font-semibold text-neutral-800">Se va a crear:</p>
              <ul className="mt-1 space-y-0.5">
                {preview.title && <li>Titular: <span className="text-neutral-900">{preview.title}</span>{useHeader ? "" : " (no se usará)"}</li>}
                {preview.excerpt && <li>Entradilla: {useHeader ? "sí" : "no se usará"}</li>}
                <li>{counts.paragraph} párrafos · {counts.heading} subtítulos · {counts.list} listas · {counts.quote} citas</li>
                {Object.keys(preview.seo).length > 0 && (
                  <li className="text-emerald-700">
                    Paquete SEO: {[preview.seo.seoTitle && "título SEO", preview.seo.seoDescription && "meta descripción", preview.seo.slug && "slug",
                      preview.seo.keyword && "palabra clave", preview.seo.tags?.length && `${preview.seo.tags.length} etiquetas`].filter(Boolean).join(", ")}
                  </li>
                )}
                {preview.restoredMedia > 0 && <li className="text-emerald-700">{preview.restoredMedia} foto(s)/video(s) vuelven a su lugar</li>}
                {preview.droppedMedia > 0 && <li className="text-amber-700">{preview.droppedMedia} foto(s) sin marca en el texto: se conservan al final</li>}
              </ul>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-neutral-200 px-5 py-3">
          <button type="button" onClick={onCancel} className="rounded-md px-3 py-2.5 text-xs text-neutral-500 sm:py-1.5 hover:text-neutral-900">Cancelar</button>
          <button
            type="button" disabled={!preview} onClick={() => onApply(text, useHeader)}
            className="rounded-md bg-neutral-900 px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-40 sm:py-1.5"
          >
            Reemplazar contenido
          </button>
        </div>
      </div>
    </div>
  );
}

// ── SEO fix dialog (answers to the combined prompt) ────────────────────────

function FixDialog({ plan, ctx, onCancel, onApply }: {
  plan: FixPromptPlan; ctx: FixContext; onCancel: () => void; onApply: (patch: FixPatch) => void;
}) {
  const [text, setText] = useState("");
  const [rejected, setRejected] = useState<Set<string>>(new Set());
  const parsed = useMemo(() => parseFixAnswer(text, plan, ctx), [text, plan, ctx]);
  const accepted = new Set(parsed.proposals.map((p) => p.key).filter((k) => !rejected.has(k)));
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 font-sans sm:items-center sm:p-4" onClick={onCancel}>
      <div className="flex max-h-[92dvh] w-full max-w-2xl flex-col rounded-t-2xl bg-white pb-[env(safe-area-inset-bottom)] shadow-2xl sm:max-h-[90vh] sm:rounded-2xl sm:pb-0" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-neutral-200 px-5 py-4">
          <h3 className="text-base font-semibold text-neutral-900">Pegar correcciones de ChatGPT</h3>
          <p className="mt-1 text-[12.5px] text-neutral-500">Cada cambio va a su lugar exacto. Desmarca lo que no quieras.</p>
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
          <textarea autoFocus value={text} onChange={(e) => setText(e.target.value)} rows={6}
            className="w-full rounded-xl border border-neutral-300 p-3 font-mono text-[12.5px] text-neutral-900 outline-none focus:border-neutral-600" />
          {parsed.proposals.map((p) => (
            <label key={p.key} className="flex gap-2 rounded-xl border border-neutral-200 p-3 text-[12.5px]">
              <input type="checkbox" checked={!rejected.has(p.key)} className="mt-1"
                onChange={() => setRejected((prev) => { const n = new Set(prev); if (n.has(p.key)) n.delete(p.key); else n.add(p.key); return n; })} />
              <span className="min-w-0">
                <span className="block text-[11px] font-semibold uppercase text-neutral-400">{p.label}</span>
                {p.before && <span className="block text-red-700 line-through decoration-red-300">{p.before}</span>}
                <span className="block text-emerald-800">{p.after}</span>
              </span>
            </label>
          ))}
        </div>
        <div className="flex justify-end gap-2 border-t border-neutral-200 px-5 py-3">
          <button type="button" onClick={onCancel} className="rounded-md px-3 py-2.5 text-xs text-neutral-500 sm:py-1.5">Cancelar</button>
          <button type="button" disabled={!accepted.size} onClick={() => onApply(parsed.apply(accepted))}
            className="rounded-md bg-neutral-900 px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-40 sm:py-1.5">Aplicar {accepted.size || ""}</button>
        </div>
      </div>
    </div>
  );
}

// ── Pre-publish check ──────────────────────────────────────────────────────

function PublishDialog({ report, originality, blockingIssues, publishing, onCancel, onPublish }: {
  report: SeoReport; originality: OriginalityResult | null; blockingIssues: string[]; publishing: boolean;
  onCancel: () => void; onPublish: (when?: Date) => void;
}) {
  const [when, setWhen] = useState("");
  const [accept, setAccept] = useState(false);
  const hard = [...blockingIssues, ...(report.verifyMarks ? [`${report.verifyMarks} dato(s) marcados [VERIFICAR]`] : [])];
  const soft = [
    ...(originality && originality.originality < 60 ? [`Originalidad baja: ${Math.round(originality.originality)}%`] : []),
    ...(!originality ? ["No analizaste la originalidad"] : []),
    ...(report.score < 70 ? [`SEO ${report.score}/100`] : []),
  ];
  const canPublish = !hard.length && (!soft.length || accept) && !publishing;
  const date = when ? new Date(when) : null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 font-sans sm:items-center sm:p-4" onClick={onCancel}>
      <div className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-semibold text-neutral-900">Publicar noticia</h3>
        <p className="mt-1 text-[12.5px] text-neutral-500">SEO {report.score}/100{originality ? ` · ${Math.round(originality.originality)}% original` : ""}</p>
        {hard.length > 0 && (
          <div className="mt-3 rounded-lg bg-red-50 p-3 text-[12px] text-red-700">
            <ul className="space-y-1">{hard.map((h) => <li key={h}>✕ {h}</li>)}</ul>
            {report.verifySnippets.length > 0 && (
              <ul className="mt-2 space-y-1 border-l-2 border-red-200 pl-2 text-[11.5px] text-red-600">
                {report.verifySnippets.map((s, i) => <li key={i}>«{s}»</li>)}
              </ul>
            )}
            <p className="mt-2 text-[11.5px] text-red-600">Corrígelo en el editor para poder publicar: confirma cada dato con la fuente y borra la marca.</p>
          </div>
        )}
        {soft.length > 0 && (
          <div className="mt-3 rounded-lg bg-amber-50 p-3 text-[12px] text-amber-800">
            <ul className="space-y-1">{soft.map((s) => <li key={s}>⚠ {s}</li>)}</ul>
            {/* Overriding only makes sense for warnings; hard blockers can't be skipped. */}
            {!hard.length && (
              <label className="mt-2 flex items-center gap-2"><input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} /> Publicar igualmente</label>
            )}
          </div>
        )}
        <label className="mt-4 block text-[12px] text-neutral-600">Programar (opcional)
          <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="mt-1 w-full rounded-lg border border-neutral-300 px-2 py-1.5 text-sm" />
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded-md px-3 py-2.5 text-xs text-neutral-500 sm:py-1.5">Cancelar</button>
          <button type="button" disabled={!canPublish || (date !== null && date.getTime() <= Date.now())}
            onClick={() => onPublish(date ?? undefined)}
            className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500 px-4 py-2.5 text-xs font-bold text-black disabled:opacity-40 sm:py-1.5">
            {publishing && <Loader2 size={12} className="animate-spin" />} {date ? "Programar" : "Publicar ahora"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Partial rewrite dialog (only the copied sentences) ─────────────────────

function RewriteDialog({
  blocks, targets, onCancel, onApply,
}: {
  blocks: Block[];
  targets: { text: string; source?: string }[];
  onCancel: () => void;
  onApply: (accepted: RewriteProposal[]) => void;
}) {
  const [text, setText] = useState("");
  const [rejected, setRejected] = useState<Set<number>>(new Set());
  const proposals = useMemo(() => planRewrites(blocks, targets, parseRewrites(text)), [blocks, targets, text]);
  const ready = proposals.filter((p) => p.replacement && p.found && p.replacement.trim() !== p.original.trim());
  const accepted = ready.filter((p) => !rejected.has(p.index));

  const pasteFromClipboard = async () => {
    try { setText(await navigator.clipboard.readText()); } catch { toast.error("Pega con Ctrl+V dentro del recuadro."); }
  };
  const toggle = (index: number) => setRejected((prev) => {
    const next = new Set(prev);
    if (next.has(index)) next.delete(index); else next.add(index);
    return next;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 font-sans sm:items-center sm:p-4" onClick={onCancel}>
      <div className="flex max-h-[92dvh] w-full max-w-2xl flex-col rounded-t-2xl bg-white pb-[env(safe-area-inset-bottom)] shadow-2xl sm:max-h-[90vh] sm:rounded-2xl sm:pb-0" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-neutral-200 px-5 py-4">
          <h3 className="text-base font-semibold text-neutral-900">Pegar correcciones de ChatGPT</h3>
          <p className="mt-1 text-[12.5px] text-neutral-500">Pega la respuesta (líneas <code>[1] …</code>, <code>[2] …</code>). Cada frase nueva reemplaza solo la suya.</p>
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
          <textarea
            autoFocus value={text} onChange={(e) => setText(e.target.value)} rows={5} placeholder={"[1] Frase reescrita…\n[2] Frase reescrita…"}
            className="w-full resize-y rounded-xl border border-neutral-300 p-3 font-mono text-[12.5px] text-neutral-900 outline-none focus:border-neutral-600"
          />
          <button type="button" onClick={() => void pasteFromClipboard()} className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50">
            <ClipboardPaste size={13} /> Pegar desde el portapapeles
          </button>
          {text.trim() && (
            <ul className="space-y-2">
              {proposals.map((p) => {
                const usable = ready.includes(p);
                return (
                  <li key={p.index} className={`rounded-xl border p-3 ${usable ? "border-neutral-200" : "border-dashed border-neutral-200 opacity-60"}`}>
                    <label className="flex gap-2">
                      <input type="checkbox" disabled={!usable} checked={usable && !rejected.has(p.index)} onChange={() => toggle(p.index)} className="mt-1" />
                      <span className="min-w-0 text-[12.5px] leading-relaxed">
                        <span className="block text-red-700 line-through decoration-red-300">{p.original}</span>
                        {p.replacement
                          ? <span className="mt-1 block text-emerald-800">{p.replacement}</span>
                          : <span className="mt-1 block text-neutral-400">Sin respuesta para [{p.index}]</span>}
                        {!p.found && <span className="mt-1 block text-[11px] text-amber-700">Esta frase ya no está en la nota (la editaste después del análisis).</span>}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-neutral-200 px-5 py-3">
          <span className="text-[11.5px] text-neutral-500">{text.trim() ? `${accepted.length} de ${proposals.length} se aplicarán` : ""}</span>
          <div className="flex gap-2">
            <button type="button" onClick={onCancel} className="rounded-md px-3 py-2.5 text-xs text-neutral-500 sm:py-1.5 hover:text-neutral-900">Cancelar</button>
            <button type="button" disabled={!accepted.length} onClick={() => onApply(accepted)}
              className="rounded-md bg-neutral-900 px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-40 sm:py-1.5">
              Aplicar {accepted.length || ""} corrección(es)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Header (category, title, excerpt, author, tags, cover) ─────────────────

function ArticleHeader({
  draft, onFieldChange, categoryGroups, readOnly, artifactId, feature, onMediaChanged, minutes, publishedAt, onTitleEnter,
}: {
  draft: RevisionDraft;
  onFieldChange: (patch: Partial<RevisionDraft>) => void;
  categoryGroups: CategoryGroup[];
  readOnly: boolean;
  artifactId: string;
  feature: MediaRequirement | null;
  onMediaChanged: () => void;
  minutes: number;
  publishedAt?: string | null;
  onTitleEnter: () => void;
}) {
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [tagDraft, setTagDraft] = useState("");
  const excerptRef = useRef<HTMLElement | null>(null);
  const categoryName = useMemo(
    () => categoryGroups.flatMap((g) => g.categories).find((c) => c.id === draft.categoryId)?.name ?? null,
    [categoryGroups, draft.categoryId],
  );

  const addTag = () => {
    const tag = tagDraft.trim();
    if (tag && !draft.tags.includes(tag)) onFieldChange({ tags: [...draft.tags, tag] });
    setTagDraft("");
  };

  return (
    <div className="lg:grid lg:grid-cols-2 lg:gap-12 lg:items-start mb-8">
      <div>
        <div className="relative flex items-center gap-3 mb-3">
          <button
            type="button" disabled={readOnly} onClick={() => setCategoryOpen((o) => !o)}
            className={`font-bold text-xs uppercase tracking-[0.2em] ${categoryName ? "text-yellow-400" : "text-neutral-400 underline decoration-dashed underline-offset-4"}`}
          >
            {categoryName ?? "Elegir categoría"}
          </button>
          <span className="h-px w-8 bg-yellow-400" />
          {categoryOpen && (
            <div className="absolute left-0 top-full z-30 mt-2 max-h-[60dvh] w-[min(16rem,calc(100vw-2rem))] overflow-y-auto rounded-xl border border-neutral-200 bg-white p-1 shadow-xl">
              {categoryGroups.map((group) => (
                <div key={group.id} className="py-1">
                  <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">{group.name}</p>
                  {group.categories.map((c) => (
                    <button
                      key={c.id} type="button"
                      onClick={() => { onFieldChange({ categoryId: c.id }); setCategoryOpen(false); }}
                      className={`block w-full rounded-md px-2 py-2.5 text-left text-sm hover:bg-neutral-100 sm:py-1.5 ${c.id === draft.categoryId ? "font-semibold text-neutral-900" : "text-neutral-700"}`}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        <Editable
          tag="h1" plain readOnly={readOnly} html={draft.title} placeholder="Escribe el titular"
          onChange={(title) => onFieldChange({ title })}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); excerptRef.current?.focus(); } }}
          className="text-3xl md:text-4xl lg:text-[2.75rem] font-black text-neutral-900 leading-[1.08] mb-4 block-editor-field"
        />

        <Editable
          ref={excerptRef} tag="p" plain readOnly={readOnly} html={draft.excerpt}
          placeholder="Entradilla: la idea principal en una o dos frases"
          onChange={(excerpt) => onFieldChange({ excerpt })}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onTitleEnter(); } }}
          className="text-lg text-neutral-600 leading-relaxed mb-6 block-editor-field"
        />

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-yellow-400 text-black font-black flex items-center justify-center flex-shrink-0">N</div>
          <div className="flex flex-col">
            <span className="font-bold text-neutral-900 text-sm">Nexus News</span>
            <span className="text-neutral-500 text-xs flex items-center gap-1.5">
              <Calendar size={12} />
              {publishedAt ? new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(publishedAt)) : "Fecha al publicar"}
              {" · "}{minutes} min de lectura
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {draft.tags.map((tag) => (
            <span key={tag} className="group/tag inline-flex items-center gap-1 px-3 py-1 rounded-full border border-neutral-200 text-neutral-600 text-xs font-medium">
              {tag}
              {!readOnly && (
                <button type="button" aria-label={`Quitar ${tag}`} onClick={() => onFieldChange({ tags: draft.tags.filter((t) => t !== tag) })}
                  className="text-neutral-400 hover:text-neutral-900">
                  <X size={11} />
                </button>
              )}
            </span>
          ))}
          {!readOnly && (
            <input
              value={tagDraft} onChange={(e) => setTagDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(); } }}
              onBlur={addTag} placeholder="+ etiqueta"
              className="w-28 rounded-full border border-dashed border-neutral-300 px-3 py-1 text-xs text-neutral-700 outline-none placeholder:text-neutral-400 focus:border-neutral-500"
            />
          )}
        </div>
      </div>

      <CoverImage artifactId={artifactId} feature={feature} title={draft.title} readOnly={readOnly} onChanged={onMediaChanged} />
    </div>
  );
}

function CoverImage({
  artifactId, feature, title, readOnly, onChanged,
}: {
  artifactId: string; feature: MediaRequirement | null; title: string; readOnly: boolean; onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [promptMenu, setPromptMenu] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const aiMeta = useRef<{ alt: string; caption: string } | null>(null);
  const copyImagePrompt = useContext(ImagePromptContext);
  const url = feature?.assetUrl ?? null;

  const setCover = async (next: string | null) => {
    // An image uploaded right after copying an AI prompt gets its alt text and
    // the "generated with AI" caption automatically.
    const meta = next ? aiMeta.current : null;
    const response = await apiFetch(`/api/editorial/articles/${encodeURIComponent(artifactId)}/feature-image`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: next, ...(meta ? { altText: meta.alt, caption: meta.caption } : {}) }),
    });
    if (meta && response.ok) aiMeta.current = null;
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(body?.detail || body?.message || `HTTP ${response.status}`);
    }
    onChanged();
  };

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try { await action(); } catch (err) { toast.error(err instanceof Error ? err.message : "No se pudo cambiar la portada"); } finally { setBusy(false); }
  };

  return (
    <div className="relative aspect-[3/2] w-full bg-neutral-950 rounded-2xl overflow-hidden mt-6 lg:mt-0 group/cover">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={title} className="absolute inset-0 h-full w-full object-contain" />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-neutral-800 to-neutral-950">
          <span className="text-yellow-400 font-black text-2xl tracking-tight">Nexus News</span>
        </div>
      )}
      {!readOnly && (
        <div className={`absolute inset-x-0 bottom-0 flex flex-wrap justify-center gap-2 bg-gradient-to-t from-black/70 to-transparent p-3 transition-opacity ${url ? "pointer-fine:opacity-0 pointer-fine:group-hover/cover:opacity-100 pointer-fine:focus-within:opacity-100" : ""}`}>
          <input
            ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden"
            onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ""; if (file) void run(async () => setCover(await uploadImage(artifactId, file))); }}
          />
          <button type="button" disabled={busy} onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-black hover:bg-neutral-200 disabled:opacity-60">
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />} {url ? "Cambiar portada" : "Subir portada"}
          </button>
          <button type="button" disabled={busy}
            onClick={() => { const link = window.prompt("Enlace de la imagen (https://…)"); if (link) void run(() => setCover(link.trim())); }}
            className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur hover:bg-white/25">
            <Link2 size={13} /> Pegar enlace
          </button>
          {copyImagePrompt && (
            <div className="relative">
              <button type="button" onClick={() => setPromptMenu((o) => !o)}
                className="inline-flex items-center gap-1.5 rounded-full bg-yellow-400 px-3 py-1.5 text-xs font-semibold text-black hover:bg-yellow-300">
                <ImageIcon size={13} /> Prompt para IA
              </button>
              {promptMenu && (
                <div className="absolute bottom-full right-0 z-30 mb-2 w-[min(16rem,calc(100vw-2rem))] rounded-xl border border-neutral-200 bg-white p-1 text-left font-sans shadow-xl">
                  {([["chatgpt", "Para ChatGPT", "En español, listo para pegar"], ["midjourney", "Para Midjourney / Leonardo", "En inglés, con --ar 3:2"]] as const).map(([model, label, hint]) => (
                    <button key={model} type="button"
                      onClick={async () => { setPromptMenu(false); aiMeta.current = await copyImagePrompt({ purpose: "cover", model }); }}
                      className="block w-full rounded-lg px-3 py-2 text-left hover:bg-neutral-50">
                      <span className="block text-[12.5px] font-medium text-neutral-900">{label}</span>
                      <span className="block text-[11px] text-neutral-500">{hint}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {url && (
            <button type="button" disabled={busy} onClick={() => void run(() => setCover(null))}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur hover:bg-white/25">
              <Trash2 size={13} /> Quitar
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── One block ──────────────────────────────────────────────────────────────

function BlockView({
  block, readOnly, artifactId, dropCap, placeholderPrompt, registerRef, onChange, onReplace, onRemove, onKeyDown, onPaste,
}: {
  block: Block;
  readOnly: boolean;
  artifactId: string;
  dropCap: boolean;
  placeholderPrompt?: string;
  registerRef: (el: HTMLElement | null) => void;
  onChange: (patch: Partial<Block>) => void;
  onReplace: (block: Block) => void;
  onRemove: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  onPaste: (event: ClipboardEvent<HTMLElement>) => void;
}) {
  const common = { ref: registerRef, readOnly, onKeyDown, onPaste, onChange: (html: string) => onChange({ html } as Partial<Block>) };

  switch (block.type) {
    case "paragraph":
      return <Editable {...common} tag="p" html={block.html} placeholder="Escribe o pulsa / para insertar…" className={`block-editor-field ${dropCap ? DROP_CAP : ""}`} />;
    case "heading":
      return <Editable {...common} tag={block.level === 2 ? "h2" : "h3"} html={block.html} placeholder="Subtítulo" className="block-editor-field" />;
    case "quote":
      return <Editable {...common} tag="blockquote" html={block.html} placeholder="Cita o declaración" className="block-editor-field" />;
    case "list":
      return <Editable {...common} tag={block.ordered ? "ol" : "ul"} html={block.html} className={block.ordered ? "list-decimal" : "list-disc"} />;
    case "image":
      return <ImageBlock block={block} artifactId={artifactId} readOnly={readOnly} onChange={onChange} onRemove={onRemove} />;
    case "placeholder":
      return (
        <ImageBlock
          block={{ id: block.id, type: "image", src: "", caption: "", alt: "" }} artifactId={artifactId} readOnly={readOnly}
          suggestion={placeholderPrompt} onRemove={onRemove}
          onChange={(patch) => onReplace({ id: block.id, type: "image", src: "", caption: "", alt: "", ...(patch as object) } as Block)}
        />
      );
    case "embed":
      return <EmbedBlock block={block} readOnly={readOnly} onChange={onChange} onRemove={onRemove} />;
    case "divider":
      return <hr />;
    case "raw":
      return (
        <div className="relative rounded-lg ring-1 ring-dashed ring-neutral-300">
          <span className="absolute -top-2.5 left-3 bg-white px-1 text-[10px] text-neutral-400">Contenido especial (se publica tal cual)</span>
          <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(block.html, { USE_PROFILES: { html: true } }) }} />
        </div>
      );
  }
}

function ImageBlock({
  block, artifactId, readOnly, onChange, onRemove, suggestion,
}: {
  block: Extract<Block, { type: "image" }>;
  artifactId: string;
  readOnly: boolean;
  onChange: (patch: Partial<Block>) => void;
  onRemove: () => void;
  suggestion?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const copyImagePrompt = useContext(ImagePromptContext);
  const aiMeta = useRef<{ alt: string; caption: string } | null>(null);

  const upload = async (file: File) => {
    setBusy(true);
    try {
      const src = await uploadImage(artifactId, file);
      const meta = aiMeta.current;
      aiMeta.current = null;
      onChange((meta
        ? { src, alt: block.alt || meta.alt, caption: block.caption || meta.caption } // AI image: disclosed in its caption
        : { src, alt: block.alt || file.name.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ") }) as Partial<Block>);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo subir la imagen");
    } finally {
      setBusy(false);
    }
  };

  if (!block.src) {
    if (readOnly) return null;
    return (
      <figure
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); const file = e.dataTransfer.files?.[0]; if (file) void upload(file); }}
        className={`not-prose flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-8 text-center ${dragOver ? "border-yellow-400 bg-yellow-50" : suggestion ? "border-amber-300 bg-amber-50/60" : "border-neutral-300 bg-neutral-50"}`}
      >
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden"
          onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ""; if (file) void upload(file); }} />
        {suggestion && <span className="block max-w-md font-sans text-xs text-amber-800">La redacción sugiere aquí: <em>{suggestion}</em></span>}
        <div className="flex flex-wrap justify-center gap-2 font-sans">
          <button type="button" disabled={busy} onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-full bg-neutral-900 px-4 py-2 text-xs font-semibold text-white hover:bg-neutral-700 disabled:opacity-60">
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />} Subir imagen
          </button>
          <button type="button" disabled={busy}
            onClick={() => { const link = window.prompt("Enlace de la imagen (https://…)"); if (link?.trim().startsWith("http")) onChange({ src: link.trim() } as Partial<Block>); }}
            className="inline-flex items-center gap-1.5 rounded-full border border-neutral-300 bg-white px-4 py-2 text-xs font-semibold text-neutral-700 hover:border-neutral-500">
            <Link2 size={13} /> Pegar enlace
          </button>
          {copyImagePrompt && (
            <button type="button"
              onClick={async () => { aiMeta.current = await copyImagePrompt({ purpose: "body", suggestion, model: "chatgpt" }); }}
              title="Copia un prompt para generar esta imagen en ChatGPT"
              className="inline-flex items-center gap-1.5 rounded-full bg-yellow-400 px-4 py-2 text-xs font-semibold text-black hover:bg-yellow-300">
              <ImageIcon size={13} /> Prompt para IA
            </button>
          )}
          <button type="button" onClick={onRemove} className="rounded-full px-3 py-2 text-xs text-neutral-500 hover:text-neutral-900">Quitar</button>
        </div>
        <span className="block font-sans text-[11px] text-neutral-400">o arrastra una foto aquí · JPG, PNG, WebP</span>
      </figure>
    );
  }

  return (
    <figure className="group/img relative">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={block.src} alt={block.alt} />
      {!readOnly && (
        <div className="absolute right-2 top-2 flex flex-wrap justify-end gap-1.5 font-sans transition-opacity pointer-fine:opacity-0 pointer-fine:group-hover/img:opacity-100 pointer-fine:focus-within:opacity-100 sm:right-3 sm:top-3">
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden"
            onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ""; if (file) void upload(file); }} />
          <button type="button" onClick={() => fileRef.current?.click()} className="rounded-full bg-black/60 px-3 py-1.5 text-[11px] font-semibold text-white backdrop-blur hover:bg-black/80">
            {busy ? <Loader2 size={12} className="animate-spin" /> : "Reemplazar"}
          </button>
          <button type="button" title="Describe la imagen para buscadores y lectores de pantalla"
            onClick={() => { const alt = window.prompt("Texto alternativo (qué se ve en la foto)", block.alt); if (alt !== null) onChange({ alt } as Partial<Block>); }}
            className="rounded-full bg-black/60 px-3 py-1.5 text-[11px] font-semibold text-white backdrop-blur hover:bg-black/80">
            Texto alt{block.alt ? " ✓" : ""}
          </button>
          <button type="button" onClick={onRemove} aria-label="Quitar imagen" className="rounded-full bg-black/60 p-1.5 text-white backdrop-blur hover:bg-black/80"><Trash2 size={13} /></button>
        </div>
      )}
      <Editable
        tag="figcaption" readOnly={readOnly} html={block.caption} placeholder={readOnly ? "" : "Pie de foto (opcional) · Foto: autor/agencia"}
        onChange={(caption) => onChange({ caption } as Partial<Block>)} className="block-editor-field"
      />
    </figure>
  );
}

function EmbedBlock({
  block, readOnly, onChange, onRemove,
}: {
  block: Extract<Block, { type: "embed" }>; readOnly: boolean; onChange: (patch: Partial<Block>) => void; onRemove: () => void;
}) {
  const [value, setValue] = useState("");
  if (!block.videoId) {
    if (readOnly) return null;
    return (
      <figure className="flex flex-col gap-2 rounded-2xl border-2 border-dashed border-neutral-300 bg-neutral-50 p-5 font-sans">
        <label className="text-xs font-semibold text-neutral-600">Enlace del video de YouTube</label>
        <div className="flex flex-wrap gap-2">
          <input
            autoFocus value={value} onChange={(e) => setValue(e.target.value)} placeholder="https://www.youtube.com/watch?v=…"
            onKeyDown={(e) => { if (e.key === "Enter") { const id = youtubeId(value); if (id) onChange({ videoId: id } as Partial<Block>); else toast.error("No es un enlace de YouTube válido"); } }}
            className="min-w-0 flex-1 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-600"
          />
          <button type="button" onClick={() => { const id = youtubeId(value); if (id) onChange({ videoId: id } as Partial<Block>); else toast.error("No es un enlace de YouTube válido"); }}
            className="rounded-lg bg-neutral-900 px-4 py-2.5 text-xs font-semibold text-white">Insertar</button>
          <button type="button" onClick={onRemove} className="px-2 text-xs text-neutral-500 hover:text-neutral-900">Quitar</button>
        </div>
      </figure>
    );
  }
  return (
    <figure className="group/embed relative">
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${block.videoId}`} title="Video de YouTube" width={560} height={315}
        className="aspect-video" loading="lazy" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen
      />
      {!readOnly && (
        <button type="button" onClick={onRemove} aria-label="Quitar video"
          className="absolute right-3 top-3 rounded-full bg-black/60 p-2 text-white backdrop-blur transition-opacity pointer-fine:p-1.5 pointer-fine:opacity-0 pointer-fine:group-hover/embed:opacity-100 pointer-fine:focus-visible:opacity-100">
          <Trash2 size={13} />
        </button>
      )}
    </figure>
  );
}

// ── Menus ──────────────────────────────────────────────────────────────────

function InsertMenu({ top, left, onPick, onClose }: { top: number; left: number; onPick: (o: InsertOption) => void; onClose: () => void }) {
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => (a + 1) % INSERT_OPTIONS.length); }
      if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => (a - 1 + INSERT_OPTIONS.length) % INSERT_OPTIONS.length); }
      if (e.key === "Enter") { e.preventDefault(); onPick(INSERT_OPTIONS[active]); }
      if (e.key === "Escape") onClose();
    };
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    window.addEventListener("keydown", onKey, true);
    document.addEventListener("mousedown", onClick);
    return () => { window.removeEventListener("keydown", onKey, true); document.removeEventListener("mousedown", onClick); };
  }, [active, onClose, onPick]);

  return (
    <div ref={ref} style={{ top, left }} className="absolute z-40 w-72 rounded-xl border border-neutral-200 bg-white p-1.5 font-sans shadow-2xl">
      <span className="block px-2 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">Insertar bloque</span>
      {INSERT_OPTIONS.map((option, index) => {
        const Icon = option.icon;
        return (
          <button
            key={option.key} type="button" onMouseEnter={() => setActive(index)} onClick={() => onPick(option)}
            className={`flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left ${index === active ? "bg-neutral-100" : ""}`}
          >
            <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md border border-neutral-200 bg-white text-neutral-700"><Icon size={16} /></span>
            <span>
              <span className="block text-sm font-medium text-neutral-900">{option.label}</span>
              <span className="block text-[11px] text-neutral-500">{option.hint}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function BlockOptions({
  block, isFirst, isLast, onMove, onDuplicate, onDelete, onConvert, onClose,
}: {
  block: Block; isFirst: boolean; isLast: boolean;
  onMove: (d: -1 | 1) => void; onDuplicate: () => void; onDelete: () => void;
  onConvert: (to: "paragraph" | "heading2" | "heading3" | "quote" | "list" | "olist") => void; onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [onClose]);

  const item = "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-neutral-700 hover:bg-neutral-100 disabled:opacity-40";
  return (
    <div ref={ref} className="absolute -left-14 top-9 z-40 w-52 rounded-xl border border-neutral-200 bg-white p-1 font-sans shadow-2xl">
      {isTextBlock(block) && (
        <>
          <span className="block px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">Convertir en</span>
          <div className="grid grid-cols-3 gap-1 px-1 pb-1">
            {([["paragraph", Pilcrow, "Párrafo"], ["heading2", Heading2, "Subtítulo"], ["heading3", Heading3, "Subtítulo pequeño"],
              ["quote", Quote, "Cita"], ["list", List, "Lista"], ["olist", ListOrdered, "Lista numerada"]] as const).map(([to, Icon, label]) => (
              <button key={to} type="button" title={label} onClick={() => onConvert(to)}
                className="flex items-center justify-center rounded-md border border-neutral-200 py-1.5 text-neutral-600 hover:bg-neutral-100">
                <Icon size={15} />
              </button>
            ))}
          </div>
          <div className="my-1 h-px bg-neutral-100" />
        </>
      )}
      <button type="button" className={item} disabled={isFirst} onClick={() => onMove(-1)}><ArrowUp size={14} /> Subir</button>
      <button type="button" className={item} disabled={isLast} onClick={() => onMove(1)}><ArrowDown size={14} /> Bajar</button>
      <button type="button" className={item} onClick={onDuplicate}><Copy size={14} /> Duplicar</button>
      <button type="button" className={`${item} text-red-600 hover:bg-red-50`} onClick={onDelete}><Trash2 size={14} /> Eliminar</button>
    </div>
  );
}

/** Floating bold/italic/link toolbar over a text selection. */
function InlineToolbar({ container }: { container: React.RefObject<HTMLDivElement | null> }) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    const onSelection = () => {
      const selection = window.getSelection();
      const root = container.current;
      if (!selection || selection.isCollapsed || !root || selection.rangeCount === 0) return setPos(null);
      const anchor = selection.anchorNode instanceof Element ? selection.anchorNode : selection.anchorNode?.parentElement;
      const editable = anchor?.closest("[contenteditable=true]");
      if (!editable || !root.contains(editable) || editable.getAttribute("data-plain") === "true") return setPos(null);
      const rect = selection.getRangeAt(0).getBoundingClientRect();
      const base = root.getBoundingClientRect();
      setPos({ top: rect.top - base.top - 44, left: rect.left - base.left + rect.width / 2 - 80 });
    };
    document.addEventListener("selectionchange", onSelection);
    return () => document.removeEventListener("selectionchange", onSelection);
  }, [container]);

  if (!pos) return null;
  const run = (command: string, value?: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    document.execCommand(command, false, value);
  };
  const btn = "rounded p-1.5 text-white hover:bg-white/15";
  return (
    <div style={{ top: pos.top, left: Math.max(0, pos.left) }} className="absolute z-40 flex items-center gap-0.5 rounded-lg bg-neutral-900 px-1 py-1 shadow-xl" onMouseDown={(e) => e.preventDefault()}>
      <button type="button" className={btn} onMouseDown={run("bold")} aria-label="Negrita"><Bold size={14} /></button>
      <button type="button" className={btn} onMouseDown={run("italic")} aria-label="Cursiva"><Italic size={14} /></button>
      <button type="button" className={btn} aria-label="Enlace"
        onMouseDown={(e) => { e.preventDefault(); const url = window.prompt("Enlace (https://…)"); if (url && /^https?:\/\//i.test(url.trim())) document.execCommand("createLink", false, url.trim()); }}>
        <Link2 size={14} />
      </button>
      <button type="button" className={btn} onMouseDown={run("unlink")} aria-label="Quitar enlace"><Unlink size={14} /></button>
    </div>
  );
}
