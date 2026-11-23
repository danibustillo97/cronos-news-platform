"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Archive, ArchiveRestore, ArrowLeft, Check, ChevronDown, Clock3, ExternalLink, EyeOff, FilePlus2, ImagePlus,
  LoaderCircle, Pencil, Plus, Search, Send, Trash2, X,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/studio/lab/api-client";
import { supabase } from "@/lib/supabaseClient";
import EditorialComposer from "./EditorialComposer";
import ResearchPanel from "./ResearchPanel";
import type { Editor } from "@tiptap/react";
import { applyNewsFilters, type NewsFilter } from "./newsQuery";
import { clearBackup, readBackup, sameDraft, writeBackup, type DraftBackup } from "./draftBackup";
import { createAutosave, type Autosave } from "./autosave";
import { EditConflictError, isPublic, nextFreeSlug, saveErrorMessage, STATUS_LABEL, toSlug, type NewsStatus } from "./newsRules";
import { resolveByline } from "@/lib/byline";
import { compressImage } from "@/lib/imageCompression";

type NewsRecord = {
  id: string;
  title: string;
  subtitle?: string | null;
  slug: string;
  content?: string | null;
  excerpt?: string | null;
  summary?: string | null;
  image_url?: string | null;
  category: string;
  subcategory?: string | null;
  tags?: string[] | null;
  seo_title?: string | null;
  seo_description?: string | null;
  status: NewsStatus;
  published_at?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
  source?: string | null;
  source_url?: string | null;
  artifact_id?: string | null;
  author_id?: string | null;
  author?: string | null;
  author_name?: string | null;
  featured?: boolean | null;
};

type NewsDraft = {
  title: string;
  subtitle: string;
  slug: string;
  content: string;
  excerpt: string;
  summary: string;
  imageUrl: string;
  category: string;
  tags: string;
  seoTitle: string;
  seoDescription: string;
  featured: boolean;
};

type CategoryGroup = { categories?: { name: string }[] };

const PAGE_SIZE = 50;
const DRAFT_AUTOSAVE_MS = 3000;
const FILTERS: NewsFilter[] = ["all", "draft", "published", "archived"];

const EMPTY_DRAFT: NewsDraft = {
  title: "", subtitle: "", slug: "", content: "", excerpt: "", summary: "",
  imageUrl: "", category: "", tags: "", seoTitle: "", seoDescription: "", featured: false,
};

function toDraft(news: NewsRecord): NewsDraft {
  return {
    title: news.title ?? "",
    subtitle: news.subtitle ?? "",
    slug: news.slug ?? "",
    content: news.content ?? "",
    excerpt: news.excerpt ?? "",
    summary: news.summary ?? news.excerpt ?? "",
    imageUrl: news.image_url ?? "",
    category: news.category ?? "",
    tags: (news.tags ?? []).join(", "),
    seoTitle: news.seo_title ?? "",
    seoDescription: news.seo_description ?? "",
    featured: Boolean(news.featured),
  };
}

function readableDate(value?: string | null): string {
  if (!value) return "Sin publicar";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Sin publicar"
    : new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

async function uploadNewsImage(original: File, folder: "news-covers" | "news-inline"): Promise<string> {
  // Phone photos are downscaled and re-encoded first: faster upload, lighter article page.
  const file = await compressImage(original);
  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${folder}/${crypto.randomUUID()}.${extension}`;
  const { data, error } = await supabase.storage.from("media").upload(path, file, {
    cacheControl: "3600",
    contentType: file.type,
    upsert: false,
  });
  if (error) throw error;
  return supabase.storage.from("media").getPublicUrl(data.path).data.publicUrl;
}

function Field({
  label, value, onChange, placeholder, maxLength, multiline = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  multiline?: boolean;
}) {
  const className = "w-full rounded-lg border border-white/[0.09] bg-[#09090b] px-3 py-2 text-[12px] text-neutral-200 outline-none transition placeholder:text-neutral-600 focus:border-white/25";
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 flex items-center justify-between text-[10px] font-medium text-neutral-400">
        {label}
        {maxLength && <span className="text-neutral-600">{value.length}/{maxLength}</span>}
      </span>
      {multiline ? (
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          rows={3}
          className={`${className} resize-y leading-relaxed`}
        />
      ) : (
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          className={className}
        />
      )}
    </label>
  );
}

/** Open an article (or a blank one) from outside the desk, e.g. the Ctrl/⌘+K palette. */
export type NewsDeskRequest = { kind: "open"; id: string; nonce: number } | { kind: "new"; nonce: number };

export default function ManualNewsDesk({ active = true, request = null }: { active?: boolean; request?: NewsDeskRequest | null }) {
  const [articles, setArticles] = useState<NewsRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<NewsFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [counts, setCounts] = useState<Record<NewsFilter, number | null>>({ all: null, draft: null, published: null, archived: null });
  const requestRef = useRef(0);
  // What the open article looked like when loaded or last saved; differences are unsaved work.
  const [baseline, setBaseline] = useState<NewsDraft>(EMPTY_DRAFT);
  const [restoreOffer, setRestoreOffer] = useState<DraftBackup<NewsDraft> | null>(null);
  const [bodyEditor, setBodyEditor] = useState<Editor | null>(null);
  const openStateRef = useRef({ isEditorOpen: false, draft: EMPTY_DRAFT, baseline: EMPTY_DRAFT, editing: null as NewsRecord | null });
  const draftAutosaveRef = useRef<Autosave<{ article: NewsRecord; draft: NewsDraft }> | null>(null);
  const [editing, setEditing] = useState<NewsRecord | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [draft, setDraft] = useState<NewsDraft>(EMPTY_DRAFT);
  const [slugTouched, setSlugTouched] = useState(false);
  const [categoryNames, setCategoryNames] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const coverInput = useRef<HTMLInputElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  // Filtering, search and paging run in the database, so no article is ever out of reach.
  const loadArticles = useCallback(async (offset = 0) => {
    const requestId = ++requestRef.current;
    const input = { filter, category: categoryFilter, search: debouncedSearch };
    if (offset === 0) setLoading(true); else setLoadingMore(true);
    setLoadError(null);
    const { data, error } = await applyNewsFilters(supabase.from("news").select("*"), input)
      .order("updated_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);
    if (requestId !== requestRef.current) return; // a newer filter or search already answered
    if (error) {
      setLoadError(error.message);
    } else {
      const rows = (data ?? []) as NewsRecord[];
      setArticles((current) => {
        if (offset === 0) return rows;
        const seen = new Set(current.map((article) => article.id));
        return [...current, ...rows.filter((article) => !seen.has(article.id))];
      });
      setHasMore(rows.length === PAGE_SIZE);
    }
    setLoading(false);
    setLoadingMore(false);
    // Tab counters follow the category and search, one cheap head-only count per status.
    const totals = await Promise.all(FILTERS.map((status) => applyNewsFilters(
      supabase.from("news").select("id", { count: "exact", head: true }),
      { ...input, filter: status },
    )));
    if (requestId !== requestRef.current) return;
    setCounts(Object.fromEntries(FILTERS.map((status, index) => [status, totals[index].count ?? null])) as Record<NewsFilter, number | null>);
  }, [filter, categoryFilter, debouncedSearch]);

  useEffect(() => {
    if (active) void loadArticles(0);
  }, [active, loadArticles]);

  useEffect(() => {
    let cancelled = false;
    apiFetch("/api/categories")
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<{ groups?: CategoryGroup[] }>;
      })
      .then((data) => {
        if (!cancelled) {
          setCategoryNames((data.groups ?? []).flatMap((group) => (group.categories ?? []).map((category) => category.name)));
        }
      })
      .catch(() => {
        if (!cancelled) setCategoryNames([]);
      });
    return () => { cancelled = true; };
  }, []);

  const categories = useMemo(
    () => [...new Set([...categoryNames, ...articles.map((article) => article.category)].filter(Boolean))].sort((a, b) => a.localeCompare(b, "es")),
    [articles, categoryNames],
  );

  const visibleArticles = useMemo(() => [...articles].sort((a, b) => {
    const dateA = new Date(a.published_at ?? a.updated_at ?? a.created_at ?? 0).getTime();
    const dateB = new Date(b.published_at ?? b.updated_at ?? b.created_at ?? 0).getTime();
    return dateB - dateA;
  }), [articles]);

  const updateDraft = (patch: Partial<NewsDraft>) => setDraft((current) => ({ ...current, ...patch }));

  // Opening an article offers the browser copy when it holds edits that never reached the database.
  const openEditor = useCallback((article: NewsRecord | null) => {
    const open = openStateRef.current;
    if (open.isEditorOpen && !sameDraft(open.draft, open.baseline)) writeBackup(open.editing?.id ?? null, open.draft);
    const loaded = article ? toDraft(article) : EMPTY_DRAFT;
    const backup = readBackup<NewsDraft>(article?.id ?? null);
    draftAutosaveRef.current?.reset();
    setEditing(article);
    setDraft(loaded);
    setBaseline(loaded);
    setSlugTouched(Boolean(article));
    setRestoreOffer(backup && !sameDraft(backup.draft, loaded) ? backup : null);
    setIsEditorOpen(true);
  }, []);

  const startNew = useCallback(() => openEditor(null), [openEditor]);

  useEffect(() => {
    if (!request) return;
    if (request.kind === "new") { startNew(); return; }
    let cancelled = false;
    void supabase.from("news").select("*").eq("id", request.id).single().then(({ data, error }) => {
      if (cancelled) return;
      if (error || !data) toast.error("No se pudo abrir la noticia");
      else openEditor(data as NewsRecord);
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request?.nonce]);
  const startEditing = (article: NewsRecord) => openEditor(article);

  const dirty = isEditorOpen && !sameDraft(draft, baseline);
  openStateRef.current = { isEditorOpen, draft, baseline, editing };

  // Live check of the permanent link: `news.slug` is unique, so a taken slug is flagged with a
  // free alternative before saving instead of failing with a database error.
  const [slugSuggestion, setSlugSuggestion] = useState<string | null>(null);
  const effectiveSlug = toSlug(draft.slug || draft.title);
  useEffect(() => {
    if (!isEditorOpen || !effectiveSlug) { setSlugSuggestion(null); return; }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const { data } = await supabase.from("news").select("id,slug").like("slug", `${effectiveSlug}%`).limit(200);
      if (cancelled) return;
      const taken = (data ?? []).filter((row) => row.id !== editing?.id).map((row) => row.slug as string);
      const free = nextFreeSlug(effectiveSlug, taken);
      setSlugSuggestion(free === effectiveSlug ? null : free);
    }, 400);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [effectiveSlug, editing?.id, isEditorOpen]);

  const closeEditor = useCallback(async () => {
    if (saving || uploading) return;
    if (draftAutosaveRef.current?.isDirty()) await draftAutosaveRef.current.flush();
    if (dirty && !draftAutosaveRef.current?.isDirty() && !window.confirm("Hay cambios sin guardar. Se conservan en este navegador y podrás recuperarlos al volver a abrir la noticia. ¿Salir del editor?")) return;
    setIsEditorOpen(false);
    setEditing(null);
    setRestoreOffer(null);
  }, [dirty, saving, uploading]);

  // Every change is mirrored to the browser copy; it disappears once the article is saved.
  useEffect(() => {
    if (!isEditorOpen) return;
    const articleId = editing?.id ?? null;
    const timer = window.setTimeout(() => {
      if (sameDraft(draft, baseline)) clearBackup(articleId);
      else writeBackup(articleId, draft);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [draft, baseline, editing?.id, isEditorOpen]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (!active || isEditorOpen) return;
      const target = event.target;
      const typing = target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
      if (event.key === "/" && !typing) {
        event.preventDefault();
        searchInput.current?.focus();
      } else if (!event.ctrlKey && !event.metaKey && event.key.toLowerCase() === "n") {
        const target = event.target;
        if (target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return;
        event.preventDefault();
        startNew();
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [active, isEditorOpen, startNew]);

  const uploadCover = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Selecciona un archivo de imagen");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("La imagen debe pesar menos de 10 MB");
      return;
    }
    setUploading(true);
    try {
      updateDraft({ imageUrl: await uploadNewsImage(file, "news-covers") });
      toast.success("Imagen de portada cargada");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo subir la imagen");
    } finally {
      setUploading(false);
    }
  };

  const uploadInlineImage = async (file: File): Promise<string> => {
    setUploading(true);
    try {
      return await uploadNewsImage(file, "news-inline");
    } finally {
      setUploading(false);
    }
  };

  const validate = (current: NewsDraft, publish: boolean): string | null => {
    const title = current.title.trim();
    if (!title) return "Escribe el titular de la noticia";
    if (!toSlug(current.slug || title)) return "Añade un slug válido para la noticia";
    if (!current.category.trim()) return "Selecciona o escribe una categoría";
    if (current.imageUrl.trim()) {
      try {
        const imageUrl = new URL(current.imageUrl.trim());
        if (imageUrl.protocol !== "https:" || imageUrl.username || imageUrl.password) throw new Error();
      } catch {
        return "La imagen de portada debe usar una URL HTTPS válida";
      }
    }
    const bodyText = current.content.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").trim();
    if (publish && !bodyText) return "Añade el contenido de la noticia antes de publicarla";
    return null;
  };

  // Writes the draft to `news` and returns the stored row (no toasts: callers decide what to say).
  const persist = async (current: NewsDraft, publish: boolean, article: NewsRecord | null, overwrite = false): Promise<NewsRecord> => {
    const title = current.title.trim();
    const slug = toSlug(current.slug || title);
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    const now = new Date().toISOString();
    const payload = {
      title,
      subtitle: current.subtitle.trim() || null,
      slug,
      content: current.content,
      excerpt: current.excerpt.trim(),
      summary: current.summary.trim() || current.excerpt.trim(),
      image_url: current.imageUrl.trim() || null,
      category: current.category.trim(),
      tags: current.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
      seo_title: current.seoTitle.trim() || title,
      seo_description: current.seoDescription.trim() || current.excerpt.trim(),
      status: publish ? "published" : article?.status ?? "draft",
      published_at: publish ? (article?.published_at ?? now) : article?.published_at ?? null,
      updated_at: now,
      // The original author keeps the byline when someone else edits; emails are never stored as one.
      author_id: article?.author_id ?? userData.user?.id ?? null,
      author: resolveByline(article?.author, userData.user),
      author_name: resolveByline(article?.author_name ?? article?.author, userData.user),
      featured: current.featured,
    };
    if (!article) {
      const result = await supabase.from("news").insert(payload).select("*").single();
      if (result.error) throw result.error;
      return result.data as NewsRecord;
    }
    // Only overwrite the version that was opened: if someone saved in between, nothing
    // matches and the editor decides (unless `overwrite` was confirmed).
    let update = supabase.from("news").update(payload).eq("id", article.id);
    if (article.updated_at && !overwrite) update = update.eq("updated_at", article.updated_at);
    const result = await update.select("*").maybeSingle();
    if (result.error) throw result.error;
    if (!result.data) throw new EditConflictError();
    return result.data as NewsRecord;
  };

  const markSaved = (saved: NewsRecord, savedDraft: NewsDraft) => {
    setArticles((current) => [saved, ...current.filter((article) => article.id !== saved.id)]);
    setEditing(saved);
    setBaseline(savedDraft);
    clearBackup(saved.id);
    clearBackup(null);
    setRestoreOffer(null);
  };

  // Drafts that already exist save themselves; published articles never change live without
  // an explicit "Guardar cambios" (their edits stay in the browser copy until then).
  if (!draftAutosaveRef.current) {
    draftAutosaveRef.current = createAutosave({
      delayMs: DRAFT_AUTOSAVE_MS,
      save: async ({ article, draft: snapshot }) => {
        const saved = await persist(snapshot, false, article);
        markSaved(saved, snapshot);
      },
      onError: () => toast.error("No se pudo autoguardar el borrador; sigue a salvo en este navegador", { id: "news-autosave" }),
    });
  }
  useEffect(() => {
    const autosave = draftAutosaveRef.current;
    if (!autosave || !isEditorOpen || !editing || editing.status !== "draft" || !dirty) return;
    if (validate(draft, false)) return; // incomplete drafts wait for the editor (still backed up locally)
    autosave.schedule({ article: editing, draft });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, dirty, isEditorOpen, editing?.id, editing?.status]);

  const save = async (publish: boolean) => {
    const problem = validate(draft, publish) ?? (slugSuggestion ? `El enlace /${effectiveSlug} ya lo usa otra noticia: usa /${slugSuggestion} u otro` : null);
    if (problem) {
      toast.error(problem);
      return;
    }
    setSaving(true);
    try {
      draftAutosaveRef.current?.reset();
      const snapshot = draft;
      let saved: NewsRecord;
      try {
        saved = await persist(snapshot, publish, editing);
      } catch (error) {
        if (!(error instanceof EditConflictError)) throw error;
        // Keep the local copy either way; overwrite only on an explicit yes.
        if (!window.confirm(`${error.message}. ¿Guardar tu versión encima de la suya? (Cancelar conserva tus cambios en este navegador para revisarlos)`)) {
          toast.info("No se sobrescribió nada. Tus cambios siguen en este navegador.");
          return;
        }
        saved = await persist(snapshot, publish, editing, true);
      }
      markSaved(saved, toDraft(saved));
      setDraft(toDraft(saved));
      setSlugTouched(true);
      toast.success(publish ? "Noticia publicada" : editing?.status === "published" ? "Cambios guardados" : "Borrador guardado");
      if (publish) setIsEditorOpen(false);
      void loadArticles(0);
    } catch (error) {
      toast.error(saveErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  // Editor shortcuts: Ctrl/⌘+S saves, Ctrl/⌘+Enter publishes (or saves a published article).
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    if (!active || !isEditorOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      if (event.key.toLowerCase() === "s") {
        event.preventDefault();
        void saveRef.current(false);
      } else if (event.key === "Enter") {
        event.preventDefault();
        const live = editing && isPublic(editing.status);
        if (live) void saveRef.current(false);
        else if (window.confirm("¿Publicar esta noticia ahora?")) void saveRef.current(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, isEditorOpen, editing]);

  const removeArticle = async (article: NewsRecord) => {
    // A live article is never hard-deleted from the list: archive it (reversible) instead.
    if (isPublic(article.status)) {
      toast.error("Una noticia publicada no se elimina: archívala o despublícala primero");
      return;
    }
    if (!window.confirm(`¿Eliminar definitivamente “${article.title}”? Esta acción no se puede deshacer.`)) return;
    setDeleting(article.id);
    const { error } = await supabase.from("news").delete().eq("id", article.id);
    if (error) {
      toast.error(error.message);
    } else {
      setArticles((current) => current.filter((item) => item.id !== article.id));
      clearBackup(article.id);
      toast.success("Noticia eliminada");
      void loadArticles(0);
    }
    setDeleting(null);
  };

  const changeStatus = async (article: NewsRecord, status: NewsStatus, question: string | null, done: string) => {
    if (question && !window.confirm(question)) return;
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("news")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", article.id)
        .select("*")
        .single();
      if (error) throw error;
      const updated = data as NewsRecord;
      setArticles((current) => current.map((item) => item.id === updated.id ? updated : item));
      if (editing?.id === updated.id) setEditing(updated);
      toast.success(done);
      void loadArticles(0);
    } catch (error) {
      toast.error(saveErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };
  const unpublishArticle = (article: NewsRecord) => changeStatus(article, "draft", `¿Despublicar “${article.title}”? Dejará de verse en el sitio y volverá a borradores.`, "Noticia despublicada");
  const archiveArticle = (article: NewsRecord) => changeStatus(article, "archived", `¿Archivar “${article.title}”?${isPublic(article.status) ? " Dejará de verse en el sitio." : ""}`, "Noticia archivada");
  const restoreArticle = (article: NewsRecord) => changeStatus(article, "draft", null, "Noticia restaurada como borrador");

  const publishArticle = async (article: NewsRecord) => {
    if (!article.title.trim() || !article.category.trim() || !article.content?.replace(/<[^>]*>/g, " ").trim()) {
      toast.error("Completa titular, categoría y contenido antes de publicar");
      startEditing(article);
      return;
    }
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("news")
        .update({ status: "published", published_at: article.published_at ?? now, updated_at: now })
        .eq("id", article.id)
        .select("*")
        .single();
      if (error) throw error;
      const published = data as NewsRecord;
      setArticles((current) => current.map((item) => item.id === published.id ? published : item));
      toast.success("Noticia publicada");
    } catch (error) {
      toast.error(saveErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  if (isEditorOpen) {
    return (
      <div className="flex h-full min-h-0 flex-col bg-[#080809]">
        <div className="flex flex-shrink-0 flex-wrap items-center gap-2 border-b border-white/[0.07] px-4 py-2.5 sm:px-6">
          <button type="button" onClick={() => void closeEditor()} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] text-neutral-400 hover:bg-white/[0.05] hover:text-white">
            <ArrowLeft size={14} /> Noticias
          </button>
          <span className="text-neutral-700">/</span>
          <span className="truncate text-[11px] font-medium text-neutral-200">{editing ? "Editar noticia" : "Nueva noticia"}</span>
          <span className="ml-auto inline-flex items-center gap-1.5 text-[10px] text-neutral-500">
            {saving ? <LoaderCircle size={12} className="animate-spin" /> : <Check size={12} className="text-emerald-500" />}
            {saving ? "Guardando…" : dirty ? "Cambios sin guardar" : editing ? STATUS_LABEL[editing.status] : "Sin guardar"}
          </span>
          {editing && isPublic(editing.status) && (
            <button type="button" onClick={() => void unpublishArticle(editing)} disabled={saving || uploading} className="rounded-lg border border-white/10 px-3 py-1.5 text-[10px] font-medium text-neutral-300 hover:bg-white/[0.05] disabled:opacity-50">
              Despublicar
            </button>
          )}
          {editing && isPublic(editing.status) ? (
            <button type="button" onClick={() => save(false)} disabled={saving || uploading} className="inline-flex items-center gap-1.5 rounded-lg bg-red-500/90 px-3 py-1.5 text-[10px] font-semibold text-white hover:bg-red-400 disabled:opacity-50">
              <Check size={12} /> Guardar cambios <kbd className="ml-1 hidden rounded bg-black/15 px-1 text-[8px] font-normal sm:inline">Ctrl S</kbd>
            </button>
          ) : (
            <>
              <button type="button" onClick={() => save(false)} disabled={saving || uploading} className="rounded-lg border border-white/10 px-3 py-1.5 text-[10px] font-medium text-neutral-300 hover:bg-white/[0.05] disabled:opacity-50">
                Guardar borrador <kbd className="ml-1 hidden rounded bg-white/10 px-1 text-[8px] sm:inline">Ctrl S</kbd>
              </button>
              <button type="button" onClick={() => save(true)} disabled={saving || uploading} className="inline-flex items-center gap-1.5 rounded-lg bg-red-500/90 px-3 py-1.5 text-[10px] font-semibold text-white hover:bg-red-400 disabled:opacity-50">
                <Send size={12} /> Publicar <kbd className="ml-1 hidden rounded bg-black/15 px-1 text-[8px] font-normal sm:inline">Ctrl ↵</kbd>
              </button>
            </>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {restoreOffer && (
            <div role="status" className="mx-auto mt-4 flex max-w-[1440px] flex-wrap items-center gap-2 rounded-lg border border-amber-400/25 bg-amber-400/[0.06] px-4 py-2.5 text-[11px] text-amber-100 sm:mx-6">
              <Clock3 size={13} className="text-amber-300" />
              <span className="min-w-0 flex-1">Hay cambios sin guardar de {readableDate(new Date(restoreOffer.savedAt).toISOString())} en este navegador.</span>
              <button type="button" onClick={() => { setDraft(restoreOffer.draft); setRestoreOffer(null); }} className="rounded-md bg-amber-300 px-2.5 py-1 text-[10px] font-semibold text-black hover:bg-amber-200">Restaurar</button>
              <button type="button" onClick={() => { clearBackup(editing?.id ?? null); setRestoreOffer(null); }} className="rounded-md px-2 py-1 text-[10px] text-amber-200/80 hover:text-white">Descartar</button>
            </div>
          )}
          <div className="mx-auto grid max-w-[1440px] gap-5 p-4 sm:p-6 xl:grid-cols-[minmax(0,1fr)_300px]">
            <EditorialComposer
              title={draft.title}
              subtitle={draft.subtitle}
              excerpt={draft.excerpt}
              body={draft.content}
              onFieldChange={(field, value) => updateDraft({
                [field]: value,
                ...(field === "title" && !slugTouched ? { slug: toSlug(value) } : {}),
              })}
              onBodyChange={(content) => updateDraft({ content })}
              onUploadImage={uploadInlineImage}
              onEditorReady={setBodyEditor}
              className="min-w-0"
              titleMaxLength={120}
              titleInputMaxLength={120}
              subtitleMaxLength={180}
              excerptMaxLength={300}
              titlePlaceholder="Escribe un titular claro y preciso"
              excerptPlaceholder="Resumen breve para portada y resultados de búsqueda"
              metadata={(
                <details className="group rounded-xl border border-white/[0.07] bg-[#0b0b0d]">
                <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-[11px] font-medium text-neutral-300">
                  <ChevronDown size={14} className="text-neutral-500 transition group-open:rotate-180" />
                  SEO y resumen
                  <span className="ml-auto text-[9px] font-normal text-neutral-600">Metadatos para buscadores</span>
                </summary>
                <div className="grid gap-3 border-t border-white/[0.07] p-4 sm:grid-cols-2">
                  <Field label="Título SEO" value={draft.seoTitle} onChange={(seoTitle) => updateDraft({ seoTitle })} placeholder="Título para Google" maxLength={70} />
                  <Field label="Descripción SEO" value={draft.seoDescription} onChange={(seoDescription) => updateDraft({ seoDescription })} placeholder="Descripción en resultados de búsqueda" maxLength={180} multiline />
                  <div className="sm:col-span-2">
                    <Field label="Resumen editorial" value={draft.summary} onChange={(summary) => updateDraft({ summary })} placeholder="Contexto adicional para la noticia" multiline />
                  </div>
                </div>
                </details>
              )}
            />

            <aside className="space-y-3">
              <section className="rounded-xl border border-white/[0.07] bg-[#0b0b0d] p-3.5">
                <h3 className="mb-3 text-[11px] font-semibold text-neutral-200">Publicación</h3>
                <label className="block">
                  <span className="mb-1.5 block text-[10px] text-neutral-500">Categoría</span>
                  <input
                    list="news-category-options"
                    value={draft.category}
                    onChange={(event) => updateDraft({ category: event.target.value })}
                    placeholder="Elige o escribe"
                    className="w-full rounded-lg border border-white/[0.09] bg-[#09090b] px-3 py-2 text-[11px] text-neutral-200 outline-none focus:border-white/25"
                  />
                  <datalist id="news-category-options">
                    {categoryNames.map((name) => <option key={name} value={name} />)}
                  </datalist>
                </label>
                <div className="mt-3">
                  <Field label="Etiquetas" value={draft.tags} onChange={(tags) => updateDraft({ tags })} placeholder="fútbol, selección, liga (separadas por coma)" multiline />
                </div>
                <label className="mt-3 flex cursor-pointer items-center gap-2 text-[10px] text-neutral-400">
                  <input type="checkbox" checked={draft.featured} onChange={(event) => updateDraft({ featured: event.target.checked })} className="accent-red-500" />
                  Destacar en portada
                </label>
                {editing?.published_at && (
                  <p className="mt-3 flex items-center gap-1.5 border-t border-white/[0.06] pt-3 text-[9px] text-neutral-600">
                    <Clock3 size={11} /> Publicada {readableDate(editing.published_at)}
                  </p>
                )}
              </section>

              <section className="rounded-xl border border-white/[0.07] bg-[#0b0b0d] p-3.5">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-[11px] font-semibold text-neutral-200">Imagen de portada</h3>
                  <button type="button" onClick={() => coverInput.current?.click()} disabled={uploading} className="inline-flex items-center gap-1 rounded-md bg-white/[0.06] px-2 py-1 text-[9px] text-neutral-300 hover:bg-white/10 disabled:opacity-50">
                    {uploading ? <LoaderCircle size={11} className="animate-spin" /> : <ImagePlus size={11} />}
                    {uploading ? "Subiendo" : "Subir"}
                  </button>
                </div>
                {draft.imageUrl ? (
                  <div className="relative overflow-hidden rounded-lg border border-white/[0.06] bg-black/30">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={draft.imageUrl} alt="Vista previa de portada" className="aspect-video w-full object-cover" />
                    <button type="button" onClick={() => updateDraft({ imageUrl: "" })} className="absolute right-2 top-2 rounded-md bg-black/70 px-2 py-1 text-[9px] text-white hover:bg-black">Quitar</button>
                  </div>
                ) : (
                  <button type="button" onClick={() => coverInput.current?.click()} className="flex aspect-video w-full flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-white/10 text-neutral-600 transition hover:border-white/20 hover:text-neutral-400">
                    <ImagePlus size={18} />
                    <span className="text-[9px]">Subir imagen JPG, PNG o WebP · máx. 10 MB</span>
                  </button>
                )}
                <input ref={coverInput} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void uploadCover(file);
                  event.target.value = "";
                }} />
                <div className="mt-2">
                  <Field label="O pega una URL HTTPS" value={draft.imageUrl} onChange={(imageUrl) => updateDraft({ imageUrl })} placeholder="https://…" />
                </div>
              </section>

              <section className="rounded-xl border border-white/[0.07] bg-[#0b0b0d] p-3.5">
                <h3 className="mb-2 text-[11px] font-semibold text-neutral-200">Enlace permanente</h3>
                <div className="flex items-center overflow-hidden rounded-lg border border-white/[0.09] bg-[#09090b]">
                  <span className="truncate pl-2.5 text-[9px] text-neutral-600">/noticia/</span>
                  <input
                    value={draft.slug}
                    onChange={(event) => { setSlugTouched(true); updateDraft({ slug: toSlug(event.target.value) }); }}
                    placeholder="slug-de-la-noticia"
                    className="min-w-0 flex-1 bg-transparent px-1 py-2 text-[10px] text-neutral-300 outline-none"
                  />
                </div>
                {slugSuggestion ? (
                  <p role="alert" className="mt-1.5 text-[9px] text-amber-300">
                    Otra noticia ya usa este enlace.{" "}
                    <button type="button" onClick={() => { setSlugTouched(true); updateDraft({ slug: slugSuggestion }); }} className="underline hover:text-white">Usar /{slugSuggestion}</button>
                  </p>
                ) : (
                  <p className="mt-1.5 truncate text-[9px] text-neutral-600">Se genera desde el titular; puedes editarlo.</p>
                )}
              </section>

              <ResearchPanel key={editing?.id ?? "new"} editor={bodyEditor} excludeId={editing?.id} />

              {editing && isPublic(editing.status) && (
                <a href={`/noticia/${editing.slug}`} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-1.5 rounded-lg border border-white/[0.08] py-2 text-[10px] text-neutral-400 hover:bg-white/[0.04] hover:text-white">
                  Ver noticia publicada <ExternalLink size={11} />
                </a>
              )}
            </aside>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#080809]">
      <div className="flex flex-shrink-0 flex-wrap items-center gap-2 border-b border-white/[0.07] px-4 py-2.5 sm:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <h2 className="text-[13px] font-semibold text-neutral-100">Noticias</h2>
          <span className="text-[9px] text-neutral-600">{loading ? "Cargando…" : counts.all !== null ? `${counts.all} artículos` : `${articles.length} artículos`}</span>
        </div>
        <label className="relative min-w-[150px] flex-1 sm:max-w-[260px]">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-600" />
        <input ref={searchInput} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar título, categoría, etiqueta…" className="w-full rounded-lg border border-white/[0.08] bg-black/20 py-1.5 pl-8 pr-8 text-[10px] text-neutral-200 outline-none placeholder:text-neutral-600 focus:border-white/20" />
        {search ? (
          <button type="button" onClick={() => { setSearch(""); searchInput.current?.focus(); }} aria-label="Limpiar búsqueda" className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-600 hover:text-white"><X size={12} /></button>
        ) : (
          <kbd className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded border border-white/[0.07] px-1 text-[8px] text-neutral-700 sm:block">/</kbd>
        )}
        </label>
        <button type="button" onClick={startNew} className="inline-flex items-center gap-1.5 rounded-lg bg-red-500/90 px-3 py-1.5 text-[10px] font-semibold text-white transition hover:bg-red-400" title="Atajo: N">
        <Plus size={13} /> Nueva <kbd className="ml-0.5 hidden rounded bg-black/15 px-1 py-0.5 text-[8px] font-normal sm:inline">N</kbd>
        </button>
      </div>

      <div className="flex flex-shrink-0 items-center gap-1 overflow-x-auto border-b border-white/[0.06] px-4 py-2 sm:px-6">
        {([
          ["all", "Todas"],
          ["draft", "Borradores"],
          ["published", "Publicadas"],
          ["archived", "Archivadas"],
        ] as const).map(([id, label]) => (
          <button key={id} type="button" onClick={() => setFilter(id)} className={`flex-shrink-0 rounded-md px-2.5 py-1 text-[9px] transition ${filter === id ? "bg-white/[0.09] text-white" : "text-neutral-500 hover:bg-white/[0.04] hover:text-neutral-300"}`}>
            {label}<span className="ml-1.5 tabular-nums text-neutral-600">{counts[id] ?? "·"}</span>
          </button>
        ))}
        <label className="ml-auto flex flex-shrink-0 items-center gap-2 text-[9px] text-neutral-500">
          Categoría
          <select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            aria-label="Filtrar por categoría"
            className="max-w-[150px] rounded-md border border-white/[0.08] bg-[#0b0b0d] px-2 py-1 text-[9px] text-neutral-300 outline-none focus:border-white/20"
          >
            <option value="all">Todas</option>
            {categories.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
        </label>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-2 sm:px-6">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-14 text-[11px] text-neutral-500"><LoaderCircle size={14} className="animate-spin" /> Cargando noticias…</div>
        ) : loadError ? (
          <div role="alert" className="m-2 rounded-lg border border-red-500/20 bg-red-500/[0.06] p-3 text-[11px] text-red-300">No se pudieron cargar las noticias: {loadError}</div>
        ) : visibleArticles.length === 0 ? (
          <div className="flex min-h-[220px] flex-col items-center justify-center text-center">
            <FilePlus2 size={22} className="text-neutral-700" />
            <p className="mt-2 text-[11px] text-neutral-300">{search || filter !== "all" ? "No hay resultados" : "Aún no hay noticias manuales"}</p>
            <p className="mt-1 text-[9px] text-neutral-600">{search || filter !== "all" ? "Prueba otra búsqueda o estado." : "Crea una noticia, guárdala como borrador o publícala cuando esté lista."}</p>
            {!search && filter === "all" && <button type="button" onClick={startNew} className="mt-3 inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-1.5 text-[10px] text-neutral-300 hover:bg-white/[0.05]"><Plus size={12} /> Crear primera noticia</button>}
          </div>
        ) : (
          <div className="divide-y divide-white/[0.055]">
            {visibleArticles.map((article) => (
              <article key={article.id} className="group flex min-w-0 items-center gap-3 py-2.5">
                <div className="h-12 w-[72px] flex-shrink-0 overflow-hidden rounded-md border border-white/[0.06] bg-white/[0.025]">
                  {article.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={article.image_url} alt="" className="h-full w-full object-cover" />
                  ) : <div className="flex h-full items-center justify-center text-neutral-700"><ImagePlus size={15} /></div>}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <button type="button" onClick={() => startEditing(article)} className="truncate text-left text-[11px] font-medium text-neutral-200 hover:text-white hover:underline hover:decoration-white/30 hover:underline-offset-2">{article.title || "Sin título"}</button>
                    <span className={`flex-shrink-0 rounded-full px-1.5 py-0.5 text-[8px] ${isPublic(article.status) ? "bg-emerald-500/10 text-emerald-300" : article.status === "archived" ? "bg-white/[0.06] text-neutral-500" : "bg-amber-500/10 text-amber-300"}`}>
                      {STATUS_LABEL[article.status] ?? article.status}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-[9px] text-neutral-600">{article.category || "Sin categoría"}{article.subtitle && <> <span className="px-1">·</span> {article.subtitle}</>} <span className="px-1">·</span> {readableDate(article.published_at ?? article.updated_at ?? article.created_at)}</p>
                </div>
                <div className="flex flex-shrink-0 items-center gap-1">
                  {(article.status === "draft" || article.status === "enhanced") && <button type="button" onClick={() => void publishArticle(article)} disabled={saving} aria-label={`Publicar ${article.title}`} title="Publicar ahora" className="rounded-md p-2 text-neutral-500 hover:bg-emerald-500/10 hover:text-emerald-300 disabled:opacity-50"><Send size={13} /></button>}
                  {isPublic(article.status) && <button type="button" onClick={() => void unpublishArticle(article)} disabled={saving} aria-label={`Despublicar ${article.title}`} title="Despublicar (vuelve a borradores)" className="rounded-md p-2 text-neutral-500 hover:bg-amber-500/10 hover:text-amber-300 disabled:opacity-50"><EyeOff size={13} /></button>}
                  {article.status === "archived"
                    ? <button type="button" onClick={() => void restoreArticle(article)} disabled={saving} aria-label={`Restaurar ${article.title}`} title="Restaurar como borrador" className="rounded-md p-2 text-neutral-500 hover:bg-white/[0.06] hover:text-white disabled:opacity-50"><ArchiveRestore size={13} /></button>
                    : <button type="button" onClick={() => void archiveArticle(article)} disabled={saving} aria-label={`Archivar ${article.title}`} title="Archivar" className="rounded-md p-2 text-neutral-500 hover:bg-white/[0.06] hover:text-white disabled:opacity-50"><Archive size={13} /></button>}
                  <button type="button" onClick={() => startEditing(article)} aria-label={`Editar ${article.title}`} title="Editar noticia" className="rounded-md p-2 text-neutral-500 hover:bg-white/[0.06] hover:text-white"><Pencil size={13} /></button>
                  {isPublic(article.status) && <a href={`/noticia/${article.slug}`} target="_blank" rel="noreferrer" aria-label={`Ver ${article.title}`} className="rounded-md p-2 text-neutral-500 hover:bg-white/[0.06] hover:text-white"><ExternalLink size={13} /></a>}
                  <button type="button" onClick={() => void removeArticle(article)} disabled={deleting === article.id || isPublic(article.status)} aria-label={`Eliminar ${article.title}`} title={isPublic(article.status) ? "Archívala o despublícala para poder eliminarla" : "Eliminar definitivamente"} className="rounded-md p-2 text-neutral-600 hover:bg-red-500/10 hover:text-red-300 disabled:opacity-50">{deleting === article.id ? <LoaderCircle size={13} className="animate-spin" /> : <Trash2 size={13} />}</button>
                </div>
              </article>
            ))}
            {hasMore && (
              <div className="flex justify-center py-4">
                <button type="button" onClick={() => void loadArticles(articles.length)} disabled={loadingMore} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-[10px] text-neutral-300 hover:bg-white/[0.05] disabled:opacity-50">
                  {loadingMore && <LoaderCircle size={12} className="animate-spin" />} Cargar más
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
