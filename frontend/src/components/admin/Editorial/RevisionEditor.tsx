"use client";

import { useEffect, useMemo, useState } from "react";
import type { Editor } from "@tiptap/react";
import { ChevronDown, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import Select, { type SelectGroup } from "@/components/ui/Select";
import MediaRequirementBlock, { type MediaRequirement } from "./MediaRequirementBlock";
import FeaturedImageHero from "./FeaturedImageHero";
import EditorialComposer from "./EditorialComposer";
import SeoFixProposalCard from "./SeoFixProposalCard";
import { useSeoFixProposal } from "./useSeoFixProposal";
import { stripArticleWrapper, wrapArticle } from "./articleHtml";

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

export { stripArticleWrapper, wrapArticle };

const TITLE_MAX = 70;

export default function RevisionEditor({
  draft, onFieldChange, categoryGroups, mediaRequirements, artifactId, onMediaChanged, onEditorReady,
}: {
  onEditorReady?: (editor: Editor | null) => void;
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

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-5 sm:px-6 lg:px-8">
      <EditorialComposer
        title={draft.title}
        subtitle={draft.subtitle}
        excerpt={draft.excerpt}
        body={bodyForEditor}
        onFieldChange={(field, value) => onFieldChange({ [field]: value })}
        onBodyChange={(html) => onFieldChange({ contentHtml: wrapArticle(html) })}
        className="mx-auto max-w-3xl"
        titleMaxLength={TITLE_MAX}
        titleActions={(
          <button
            type="button"
            onClick={() => titleFix.request()}
            title="Sugerir un titular con IA (opcional)"
            className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2 py-1 text-[10px] font-medium text-neutral-400 transition hover:border-purple-400/30 hover:text-purple-200"
          >
            <Sparkles size={11} /> Sugerir
          </button>
        )}
        titleSupplement={(
          <>
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
          </>
        )}
        leadMedia={featureImage && (
          <div className="mx-auto max-w-3xl">
            <FeaturedImageHero artifactId={artifactId} requirement={featureImage} onChanged={onMediaChanged} />
          </div>
        )}
        metadata={(
          <details className="group rounded-xl border border-white/10 bg-white/[0.02]">
            <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-xs font-medium text-neutral-300 marker:hidden">
              <ChevronDown size={14} className="text-neutral-500 transition group-open:rotate-180" />
              Datos y metadatos
              <span className="ml-auto text-[10px] font-normal text-neutral-600">Categoría, etiquetas y resumen</span>
            </summary>
            <div className="space-y-4 border-t border-white/10 px-4 py-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Categoría</label>
                  <Select
                    value={draft.categoryId}
                    onChange={(value) => onFieldChange({ categoryId: value })}
                    options={categoryOptions}
                    placeholder="Sin categoría"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Etiquetas</label>
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
                <label htmlFor="editorial-summary" className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
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
        )}
        bodyAfter={videos.map((media) => (
          <MediaRequirementBlock
            key={media.placeholderId}
            artifactId={artifactId}
            requirement={media}
            onChanged={onMediaChanged}
          />
        ))}
        artifactId={artifactId}
        mediaRequirements={mediaRequirements}
        onMediaChanged={onMediaChanged}
        onEditorReady={onEditorReady}
      />
    </div>
  );
}
