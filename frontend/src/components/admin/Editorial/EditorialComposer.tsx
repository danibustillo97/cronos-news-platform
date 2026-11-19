"use client";

import type { ReactNode } from "react";
import TiptapEditor from "@/components/news/TiptapEditor";
import type { MediaRequirement } from "./MediaRequirementBlock";

export type EditorialTextField = "title" | "subtitle" | "excerpt";

export default function EditorialComposer({
  title,
  subtitle,
  excerpt,
  body,
  onFieldChange,
  onBodyChange,
  titleActions,
  titleSupplement,
  metadata,
  leadMedia,
  bodyAfter,
  titleMaxLength = 120,
  titleInputMaxLength,
  subtitleMaxLength,
  excerptMaxLength,
  titlePlaceholder = "Escribe el titular",
  excerptPlaceholder = "La idea principal en una o dos frases",
  className = "",
  artifactId,
  mediaRequirements,
  onMediaChanged,
  onUploadImage,
}: {
  title: string;
  subtitle: string;
  excerpt: string;
  body: string;
  onFieldChange: (field: EditorialTextField, value: string) => void;
  onBodyChange: (value: string) => void;
  titleActions?: ReactNode;
  titleSupplement?: ReactNode;
  metadata?: ReactNode;
  leadMedia?: ReactNode;
  bodyAfter?: ReactNode;
  titleMaxLength?: number;
  titleInputMaxLength?: number;
  subtitleMaxLength?: number;
  excerptMaxLength?: number;
  titlePlaceholder?: string;
  excerptPlaceholder?: string;
  className?: string;
  artifactId?: string;
  mediaRequirements?: MediaRequirement[];
  onMediaChanged?: () => void;
  onUploadImage?: (file: File) => Promise<string>;
}) {
  const bodyText = body.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").trim();
  const wordCount = bodyText ? bodyText.split(/\s+/).length : 0;
  const titleOverLimit = title.length > titleMaxLength;

  return (
    <div className={`space-y-4 ${className}`}>
      {leadMedia}

      <section className="space-y-3">
        <div>
          <div className="mb-1.5 flex items-center gap-2">
            <label htmlFor="editorial-title" className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
              Titular
            </label>
            {titleActions}
            <span className={`ml-auto text-[10px] tabular-nums ${titleOverLimit ? "text-amber-400" : "text-neutral-600"}`}>
              {title.length}/{titleMaxLength}
            </span>
          </div>
          <input
            id="editorial-title"
            value={title}
            onChange={(event) => onFieldChange("title", event.target.value)}
            maxLength={titleInputMaxLength}
            className="w-full border-0 border-b border-white/10 bg-transparent pb-2.5 text-2xl font-semibold leading-tight tracking-tight text-white outline-none transition placeholder:text-neutral-700 focus:border-white/30 sm:text-3xl"
            placeholder={titlePlaceholder}
          />
          <input
            value={subtitle}
            onChange={(event) => onFieldChange("subtitle", event.target.value)}
            maxLength={subtitleMaxLength}
            className="mt-2 w-full border-0 bg-transparent text-base leading-relaxed text-neutral-400 outline-none placeholder:text-neutral-700 focus:text-neutral-200"
            placeholder="Subtítulo (opcional)"
            aria-label="Subtítulo"
          />
          {titleSupplement}
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.025] px-3.5 py-3">
          <label htmlFor="editorial-excerpt" className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
            Bajada
          </label>
          <textarea
            id="editorial-excerpt"
            value={excerpt}
            onChange={(event) => onFieldChange("excerpt", event.target.value)}
            maxLength={excerptMaxLength}
            rows={2}
            className="w-full resize-y bg-transparent text-sm leading-relaxed text-neutral-200 outline-none placeholder:text-neutral-700"
            placeholder={excerptPlaceholder}
          />
        </div>
      </section>

      {metadata}

      <section>
        <div className="mb-2 flex items-center justify-between">
          <div>
            <h3 className="text-xs font-semibold text-neutral-200">Cuerpo de la noticia</h3>
            <p className="mt-0.5 text-[10px] text-neutral-600">Formato, enlaces, citas, tablas, imágenes y video</p>
          </div>
          <span className="text-[10px] tabular-nums text-neutral-500">{wordCount} palabras</span>
        </div>
        <div className="min-h-[380px] overflow-hidden rounded-xl border border-white/10 bg-[#0d0d0d] px-3 py-2 sm:px-4">
          <TiptapEditor
            value={body}
            onChange={onBodyChange}
            className="min-h-[360px]"
            artifactId={artifactId}
            mediaRequirements={mediaRequirements}
            onMediaChanged={onMediaChanged}
            onUploadImage={onUploadImage}
          />
        </div>
      </section>

      {bodyAfter}
    </div>
  );
}
