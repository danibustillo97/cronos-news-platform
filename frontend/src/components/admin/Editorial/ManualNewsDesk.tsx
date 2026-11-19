"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, Check, ChevronDown, Clock3, ExternalLink, FilePlus2, ImagePlus,
  LoaderCircle, Pencil, Plus, Search, Send, Trash2, X,
} from "lucide-react";
import { toast } from "sonner";
import { apiUrl } from "@/studio/lab/api-client";
import { supabase } from "@/lib/supabaseClient";
import EditorialComposer from "./EditorialComposer";

type NewsStatus = "draft" | "published" | "archived" | "enhanced";
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

const EMPTY_DRAFT: NewsDraft = {
  title: "", subtitle: "", slug: "", content: "", excerpt: "", summary: "",
  imageUrl: "", category: "", tags: "", seoTitle: "", seoDescription: "", featured: false,
};

const STATUS_LABEL: Record<NewsStatus, string> = {
  draft: "Borrador",
  published: "Publicada",
  archived: "Archivada",
  enhanced: "Mejorada",
};

function isPublishedStatus(status: NewsStatus): boolean {
  return status === "published" || status === "enhanced";
}

function toSlug(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

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

async function uploadNewsImage(file: File, folder: "news-covers" | "news-inline"): Promise<string> {
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

export default function ManualNewsDesk() {
  const [articles, setArticles] = useState<NewsRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | NewsStatus>("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [search, setSearch] = useState("");
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

  const loadArticles = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const { data, error } = await supabase
      .from("news")
      .select("*")
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(200);
    if (error) {
      setLoadError(error.message);
    } else {
      setArticles((data ?? []) as NewsRecord[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadArticles();
    let cancelled = false;
    fetch(apiUrl("/api/categories"))
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
  }, [loadArticles]);

  const editorialArticles = useMemo(() => articles.filter((article) => {
    // External source imports are raw material, not editorial drafts. Keep
    // their rows intact, but only expose them here after publication.
    return isPublishedStatus(article.status) || (!article.source_url && !article.source);
  }), [articles]);

  const categories = useMemo(
    () => [...new Set(editorialArticles.map((article) => article.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es")),
    [editorialArticles],
  );

  const visibleArticles = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("es");
    return editorialArticles
      .filter((article) => {
        const matchesStatus = filter === "all"
          || article.status === filter
          || (filter === "published" && isPublishedStatus(article.status));
        const matchesSearch = !term || `${article.title} ${article.subtitle ?? ""} ${article.category} ${article.slug} ${(article.tags ?? []).join(" ")}`.toLocaleLowerCase("es").includes(term);
        const matchesCategory = categoryFilter === "all" || article.category === categoryFilter;
        return matchesStatus && matchesSearch && matchesCategory;
      })
      .sort((a, b) => {
        const dateA = new Date(a.published_at ?? a.updated_at ?? a.created_at ?? 0).getTime();
        const dateB = new Date(b.published_at ?? b.updated_at ?? b.created_at ?? 0).getTime();
        return dateB - dateA;
      });
  }, [editorialArticles, filter, categoryFilter, search]);

  const updateDraft = (patch: Partial<NewsDraft>) => setDraft((current) => ({ ...current, ...patch }));

  const startNew = useCallback(() => {
    setEditing(null);
    setDraft(EMPTY_DRAFT);
    setSlugTouched(false);
    setIsEditorOpen(true);
  }, []);

  const startEditing = (article: NewsRecord) => {
    setEditing(article);
    setDraft(toDraft(article));
    setSlugTouched(true);
    setIsEditorOpen(true);
  };

  const closeEditor = useCallback(() => {
    if (saving || uploading) return;
    setIsEditorOpen(false);
    setEditing(null);
  }, [saving, uploading]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (isEditorOpen) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
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
  }, [isEditorOpen, startNew]);

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

  const save = async (publish: boolean) => {
    const title = draft.title.trim();
    const slug = toSlug(draft.slug || title);
    if (!title) {
      toast.error("Escribe el titular de la noticia");
      return;
    }
    if (!slug) {
      toast.error("Añade un slug válido para la noticia");
      return;
    }
    if (!draft.category.trim()) {
      toast.error("Selecciona o escribe una categoría");
      return;
    }
    if (draft.imageUrl.trim()) {
      try {
        const imageUrl = new URL(draft.imageUrl.trim());
        if (imageUrl.protocol !== "https:" || imageUrl.username || imageUrl.password) throw new Error();
      } catch {
        toast.error("La imagen de portada debe usar una URL HTTPS válida");
        return;
      }
    }
    const bodyText = draft.content.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").trim();
    if (publish && !bodyText) {
      toast.error("Añade el contenido de la noticia antes de publicarla");
      return;
    }
    setSaving(true);
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      const now = new Date().toISOString();
      const payload = {
        title,
        subtitle: draft.subtitle.trim() || null,
        slug,
        content: draft.content,
        excerpt: draft.excerpt.trim(),
        summary: draft.summary.trim() || draft.excerpt.trim(),
        image_url: draft.imageUrl.trim() || null,
        category: draft.category.trim(),
        tags: draft.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
        seo_title: draft.seoTitle.trim() || title,
        seo_description: draft.seoDescription.trim() || draft.excerpt.trim(),
        status: publish ? "published" : editing?.status ?? "draft",
        published_at: publish ? (editing?.published_at ?? now) : editing?.published_at ?? null,
        updated_at: now,
        author_id: userData.user?.id ?? editing?.author_id ?? null,
        author: userData.user?.email ?? editing?.author ?? "Nexus News",
        author_name: userData.user?.email ?? editing?.author_name ?? "Nexus News",
        featured: draft.featured,
      };

      const result = editing
        ? await supabase.from("news").update(payload).eq("id", editing.id).select("*").single()
        : await supabase.from("news").insert(payload).select("*").single();
      if (result.error) throw result.error;
      const saved = result.data as NewsRecord;
      setArticles((current) => [saved, ...current.filter((article) => article.id !== saved.id)]);
      setEditing(saved);
      setDraft(toDraft(saved));
      setSlugTouched(true);
      toast.success(publish ? "Noticia publicada" : editing?.status === "published" ? "Cambios guardados" : "Borrador guardado");
      if (publish) setIsEditorOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar la noticia");
    } finally {
      setSaving(false);
    }
  };

  const removeArticle = async (article: NewsRecord) => {
    if (!window.confirm(`¿Eliminar “${article.title}”? Esta acción no se puede deshacer.`)) return;
    setDeleting(article.id);
    const { error } = await supabase.from("news").delete().eq("id", article.id);
    if (error) {
      toast.error(error.message);
    } else {
      setArticles((current) => current.filter((item) => item.id !== article.id));
      toast.success("Noticia eliminada");
    }
    setDeleting(null);
  };

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
      toast.error(error instanceof Error ? error.message : "No se pudo publicar la noticia");
    } finally {
      setSaving(false);
    }
  };

  if (isEditorOpen) {
    return (
      <div className="flex h-full min-h-0 flex-col bg-[#080809]">
        <div className="flex flex-shrink-0 flex-wrap items-center gap-2 border-b border-white/[0.07] px-4 py-2.5 sm:px-6">
          <button type="button" onClick={closeEditor} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] text-neutral-400 hover:bg-white/[0.05] hover:text-white">
            <ArrowLeft size={14} /> Noticias
          </button>
          <span className="text-neutral-700">/</span>
          <span className="truncate text-[11px] font-medium text-neutral-200">{editing ? "Editar noticia" : "Nueva noticia"}</span>
          <span className="ml-auto inline-flex items-center gap-1.5 text-[10px] text-neutral-500">
            {saving ? <LoaderCircle size={12} className="animate-spin" /> : <Check size={12} className="text-emerald-500" />}
            {saving ? "Guardando…" : editing ? STATUS_LABEL[editing.status] : "Sin guardar"}
          </span>
          {editing?.status === "published" ? (
            <button type="button" onClick={() => save(false)} disabled={saving || uploading} className="inline-flex items-center gap-1.5 rounded-lg bg-red-500/90 px-3 py-1.5 text-[10px] font-semibold text-white hover:bg-red-400 disabled:opacity-50">
              <Check size={12} /> Guardar cambios
            </button>
          ) : (
            <>
              <button type="button" onClick={() => save(false)} disabled={saving || uploading} className="rounded-lg border border-white/10 px-3 py-1.5 text-[10px] font-medium text-neutral-300 hover:bg-white/[0.05] disabled:opacity-50">
                Guardar borrador
              </button>
              <button type="button" onClick={() => save(true)} disabled={saving || uploading} className="inline-flex items-center gap-1.5 rounded-lg bg-red-500/90 px-3 py-1.5 text-[10px] font-semibold text-white hover:bg-red-400 disabled:opacity-50">
                <Send size={12} /> Publicar
              </button>
            </>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
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
                <p className="mt-1.5 truncate text-[9px] text-neutral-600">Se genera desde el titular; puedes editarlo.</p>
              </section>

              {editing?.status === "published" && (
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

  const counts = {
    all: editorialArticles.length,
    draft: editorialArticles.filter((article) => article.status === "draft").length,
    published: editorialArticles.filter((article) => isPublishedStatus(article.status)).length,
    archived: editorialArticles.filter((article) => article.status === "archived").length,
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#080809]">
      <div className="flex flex-shrink-0 flex-wrap items-center gap-2 border-b border-white/[0.07] px-4 py-2.5 sm:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <h2 className="text-[13px] font-semibold text-neutral-100">Noticias</h2>
          <span className="text-[9px] text-neutral-600">{loading ? "Cargando…" : `${editorialArticles.length} artículos`}</span>
        </div>
        <label className="relative min-w-[150px] flex-1 sm:max-w-[260px]">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-600" />
        <input ref={searchInput} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar título, categoría, etiqueta…" className="w-full rounded-lg border border-white/[0.08] bg-black/20 py-1.5 pl-8 pr-8 text-[10px] text-neutral-200 outline-none placeholder:text-neutral-600 focus:border-white/20" />
        {search ? (
          <button type="button" onClick={() => { setSearch(""); searchInput.current?.focus(); }} aria-label="Limpiar búsqueda" className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-600 hover:text-white"><X size={12} /></button>
        ) : (
          <kbd className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded border border-white/[0.07] px-1 text-[8px] text-neutral-700 sm:block">Ctrl K</kbd>
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
            {label}<span className="ml-1.5 tabular-nums text-neutral-600">{counts[id]}</span>
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
                    <span className={`flex-shrink-0 rounded-full px-1.5 py-0.5 text-[8px] ${article.status === "published" ? "bg-emerald-500/10 text-emerald-300" : article.status === "archived" ? "bg-white/[0.06] text-neutral-500" : "bg-amber-500/10 text-amber-300"}`}>
                      {STATUS_LABEL[article.status] ?? article.status}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-[9px] text-neutral-600">{article.category || "Sin categoría"}{article.subtitle && <> <span className="px-1">·</span> {article.subtitle}</>} <span className="px-1">·</span> {readableDate(article.published_at ?? article.updated_at ?? article.created_at)}</p>
                </div>
                <div className="flex flex-shrink-0 items-center gap-1">
                  {article.status === "draft" && <button type="button" onClick={() => void publishArticle(article)} disabled={saving} aria-label={`Publicar ${article.title}`} title="Publicar ahora" className="rounded-md p-2 text-neutral-500 hover:bg-emerald-500/10 hover:text-emerald-300 disabled:opacity-50"><Send size={13} /></button>}
                  <button type="button" onClick={() => startEditing(article)} aria-label={`Editar ${article.title}`} title="Editar noticia" className="rounded-md p-2 text-neutral-500 hover:bg-white/[0.06] hover:text-white"><Pencil size={13} /></button>
                  {isPublishedStatus(article.status) && <a href={`/noticia/${article.slug}`} target="_blank" rel="noreferrer" aria-label={`Ver ${article.title}`} className="rounded-md p-2 text-neutral-500 hover:bg-white/[0.06] hover:text-white"><ExternalLink size={13} /></a>}
                  <button type="button" onClick={() => void removeArticle(article)} disabled={deleting === article.id} aria-label={`Eliminar ${article.title}`} className="rounded-md p-2 text-neutral-600 hover:bg-red-500/10 hover:text-red-300 disabled:opacity-50">{deleting === article.id ? <LoaderCircle size={13} className="animate-spin" /> : <Trash2 size={13} />}</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
