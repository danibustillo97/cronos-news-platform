"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import TiptapEditor from "@/components/news/TiptapEditor";
import Select, { type SelectGroup } from "@/components/ui/Select";
import MediaRequirementBlock, { type MediaRequirement } from "./MediaRequirementBlock";
import FeaturedImageHero from "./FeaturedImageHero";
import SeoFixProposalCard from "./SeoFixProposalCard";
import { useSeoFixProposal } from "./useSeoFixProposal";

interface Category { id: string; name: string; }
interface CategoryGroup { id: string; name: string; categories: Category[]; }

export interface RevisionDraft {
  title: string;
  subtitle: string;
  excerpt: string;
  summary: string;
  contentHtml: string;
  categoryId: string | null;
  tags: string[];
}

export function stripArticleWrapper(html: string): string {
  const m = html.match(/<article[^>]*>([\s\S]*)<\/article>/);
  return m ? m[1] : html;
}

export function wrapArticle(html: string): string {
  return `<article>${html}</article>`;
}

const TITLE_MAX = 70;

export default function RevisionEditor({
  draft, onFieldChange, categoryGroups, mediaRequirements, artifactId, onMediaChanged,
}: {
  draft: RevisionDraft;
  onFieldChange: (patch: Partial<RevisionDraft>) => void;
  categoryGroups: CategoryGroup[];
  mediaRequirements: MediaRequirement[];
  artifactId: string;
  onMediaChanged: () => void;
}) {
  const [tagDraft, setTagDraft] = useState("");
  const bodyForEditor = useMemo(() => stripArticleWrapper(draft.contentHtml), [draft.contentHtml]);
  const titleFix = useSeoFixProposal(artifactId, "title");
  const [titleEdited, setTitleEdited] = useState("");

  useEffect(() => {
    if (titleFix.state.kind === "ready") setTitleEdited(titleFix.state.proposal.value);
  }, [titleFix.state]);

  const addTag = () => {
    const tag = tagDraft.trim();
    if (tag && !draft.tags.includes(tag)) onFieldChange({ tags: [...draft.tags, tag] });
    setTagDraft("");
  };

  const categoryOptions: SelectGroup<string>[] = categoryGroups.map((group) => ({
    label: group.name,
    options: group.categories.map((category) => ({ value: category.id, label: category.name })),
  }));
  const featureImage = mediaRequirements.find((media) => media.kind === "FEATURE_IMAGE");
  const videos = mediaRequirements.filter((media) => media.kind === "VIDEO");
  const titleOverLimit = draft.title.length > TITLE_MAX;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      {featureImage && (
        <div className="mx-auto max-w-4xl">
          <FeaturedImageHero artifactId={artifactId} requirement={featureImage} onChanged={onMediaChanged} />
        </div>
      )}

      <section className="mx-auto max-w-3xl space-y-5">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <label htmlFor="editorial-title" className="text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
              Titular
            </label>
            <button
              type="button"
              onClick={() => titleFix.request()}
              title="Sugerir un titular con IA (opcional)"
              className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2 py-1 text-[10px] font-medium text-neutral-400 transition hover:border-purple-400/30 hover:text-purple-200"
            >
              <Sparkles size={11} /> Sugerir
            </button>
            <span className={`ml-auto inline-flex items-center gap-1 text-[11px] ${titleOverLimit ? "text-amber-400" : "text-neutral-600"}`}>
              {draft.title.length}/{TITLE_MAX}
              {!titleOverLimit && <Check size={11} />}
            </span>
          </div>
          <input
            id="editorial-title"
            value={draft.title}
            onChange={(event) => onFieldChange({ title: event.target.value })}
            className="w-full border-0 border-b border-white/10 bg-transparent pb-3 text-3xl font-semibold leading-tight tracking-tight text-white outline-none transition placeholder:text-neutral-700 focus:border-white/30 sm:text-4xl"
            placeholder="Escribe el titular"
          />
          <input
            value={draft.subtitle}
            onChange={(event) => onFieldChange({ subtitle: event.target.value })}
            className="mt-3 w-full border-0 bg-transparent text-lg leading-relaxed text-neutral-400 outline-none placeholder:text-neutral-700 focus:text-neutral-200"
            placeholder="Subtítulo (opcional)"
            aria-label="Subtítulo"
          />
          {titleFix.state.kind === "loading" && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-neutral-400">
              <Sparkles size={12} className="animate-pulse" /> Preparando sugerencia…
            </p>
          )}
          {titleFix.state.kind === "error" && (
            <p role="status" className="mt-2 flex items-center gap-1.5 text-xs text-red-400">
              <X size={12} /> {titleFix.state.message}
            </p>
          )}
          {titleFix.state.kind === "ready" && (
            <SeoFixProposalCard
              proposal={titleFix.state.proposal}
              edited={titleEdited}
              onEditedChange={setTitleEdited}
              onApply={() => {
                onFieldChange({ title: titleEdited });
                titleFix.reset();
                toast.success("Propuesta aplicada");
              }}
              onDiscard={titleFix.reset}
            />
          )}
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.025] px-4 py-3">
          <label htmlFor="editorial-excerpt" className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
            Bajada
          </label>
          <textarea
            id="editorial-excerpt"
            value={draft.excerpt}
            onChange={(event) => onFieldChange({ excerpt: event.target.value })}
            rows={2}
            className="w-full resize-y bg-transparent text-[15px] leading-relaxed text-neutral-200 outline-none placeholder:text-neutral-700"
            placeholder="La idea principal en una o dos frases"
          />
        </div>

        <details className="group rounded-xl border border-white/10 bg-white/[0.02]">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium text-neutral-300 marker:hidden">
            <ChevronDown size={15} className="text-neutral-500 transition group-open:rotate-180" />
            Datos y metadatos
            <span className="ml-auto text-[11px] font-normal text-neutral-600">Categoría, etiquetas y resumen</span>
          </summary>
          <div className="space-y-4 border-t border-white/10 px-4 py-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Categoría</label>
                <Select
                  value={draft.categoryId}
                  onChange={(value) => onFieldChange({ categoryId: value })}
                  options={categoryOptions}
                  placeholder="Sin categoría"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Etiquetas</label>
                <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-lg border border-white/10 bg-black/20 px-2 py-1.5">
                  {draft.tags.map((tag) => (
                    <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-1 text-[11px] text-neutral-200">
                      {tag}
                      <button
                        type="button"
                        aria-label={`Quitar etiqueta ${tag}`}
                        onClick={() => onFieldChange({ tags: draft.tags.filter((item) => item !== tag) })}
                        className="text-neutral-500 hover:text-white"
                      >
                        <X size={11} />
                      </button>
                    </span>
                  ))}
                  <input
                    value={tagDraft}
                    onChange={(event) => setTagDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addTag();
                      }
                    }}
                    onBlur={addTag}
                    placeholder="Añadir etiqueta"
                    className="min-w-24 flex-1 bg-transparent px-1 text-xs text-white outline-none placeholder:text-neutral-600"
                    aria-label="Añadir etiqueta"
                  />
                </div>
              </div>
            </div>
            <div>
              <label htmlFor="editorial-summary" className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                Resumen editorial
              </label>
              <textarea
                id="editorial-summary"
                value={draft.summary}
                onChange={(event) => onFieldChange({ summary: event.target.value })}
                rows={3}
                className="w-full resize-y rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm leading-relaxed text-neutral-200 outline-none placeholder:text-neutral-600 focus:border-white/25"
                placeholder="Contexto ampliado para sistemas y canales que usan el resumen"
              />
            </div>
          </div>
        </details>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-neutral-200">Cuerpo de la noticia</h3>
              <p className="mt-0.5 text-xs text-neutral-600">Escribe y organiza el artículo por bloques.</p>
            </div>
            <span className="text-[11px] text-neutral-600">Guardado automático</span>
          </div>
          <div className="min-h-[480px] overflow-hidden rounded-xl border border-white/10 bg-[#0d0d0d] px-3 py-2 sm:px-5">
            <TiptapEditor
              value={bodyForEditor}
              onChange={(html) => onFieldChange({ contentHtml: wrapArticle(html) })}
              className="min-h-[460px]"
              artifactId={artifactId}
              mediaRequirements={mediaRequirements}
              onMediaChanged={onMediaChanged}
            />
          </div>
        </section>

        {videos.map((media) => (
          <MediaRequirementBlock
            key={media.placeholderId}
            artifactId={artifactId}
            requirement={media}
            onChanged={onMediaChanged}
          />
        ))}
      </section>
    </div>
  );
}
