"use client";

// One real discovery item, rendered close to a real newsroom feed row:
// big real thumbnail (never fabricated), category/topic/time, title as
// the dominant element, a short real excerpt, source + materials, and
// three real score bars. Click anywhere on the row to open the detail
// panel; the inline button is the fast path for power users.
//
// Mobile: the action buttons and score bars collapse -- tap the row to
// act from the detail panel (bottom sheet) instead of cramming buttons
// into a narrow row.

import { Check, X, Archive, ArrowRight, Eye, Image as ImageIcon, FileImage, FileEdit, UserRound } from "lucide-react";
import SourceBadge from "./SourceBadge";
import RowMenu from "./RowMenu";
import { CATEGORY_GROUP_CLASSES, CATEGORY_GROUP_FALLBACK } from "./statusMeta";

interface MaterialReference {
  kind: string;
  url: string;
  usableAsFinalAsset: boolean | null;
  editorialPrompt: string | null;
}

interface DiscoveryScores {
  freshnessScore: number | null;
  relevanceScore: number | null;
  impactScore: number | null;
  sourceQualityScore: number | null;
  completenessScore: number | null;
  materialScore: number | null;
  duplicateOf: string | null;
}

export interface DiscoveryItem {
  id: string;
  sourceUrl: string;
  originalUrl: string;
  originalTitle: string;
  rawText: string;
  sourceName: string | null;
  sourceDomain: string;
  author: string | null;
  language: string | null;
  categoryId: string | null;
  topics: string[];
  publishedAt: string | null;
  discoveredAt: string;
  materials: MaterialReference[];
  scores: DiscoveryScores;
  status: "DISCOVERED" | "SELECTED" | "IGNORED" | "ARCHIVED" | "SENT_TO_EDITORIAL";
  storyId: string | null;
  assignedTo?: string | null;
}

// Some scraped items have a URL (not a clean name) in sourceName --
// real, messy source data; fall back to the domain rather than show it.
export function sourceLabel(name: string | null, domain: string): string {
  return name && !name.includes("://") ? name : domain;
}

export function ageLabel(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const hours = ms / 3_600_000;
  if (hours < 1) return `${Math.max(1, Math.round(ms / 60_000))} min`;
  if (hours < 24) return `${hours.toFixed(1)} h`;
  return `${(hours / 24).toFixed(1)} d`;
}

// A real, un-embellished excerpt of the scraped body -- never a
// fabricated summary (there is no summary field on DiscoveryItem).
export function excerpt(rawText: string, max = 150): string {
  const clean = rawText.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max).trimEnd()}…` : clean;
}

export default function DiscoveryRow({
  item, categoryName, groupName, onOpen, onSelect, onIgnore, onArchive, onProcess, onViewArtifact,
  onManualEdit, onAssign,
  selectable, checked, onToggleCheck,
}: {
  item: DiscoveryItem;
  categoryName: string | null;
  groupName: string | null;
  onOpen?: (item: DiscoveryItem) => void;
  onSelect?: (id: string) => void;
  onIgnore?: (id: string) => void;
  onArchive?: (id: string) => void;
  onProcess?: (id: string) => void;
  onManualEdit?: (id: string) => void;
  onAssign?: (id: string) => void;
  onViewArtifact?: (storyId: string, title: string) => void;
  selectable?: boolean;
  checked?: boolean;
  onToggleCheck?: (id: string) => void;
}) {
  const thumbnail = item.materials.find((m) => m.kind === "IMAGE" && m.url)?.url ?? null;
  const pillClass = groupName ? (CATEGORY_GROUP_CLASSES[groupName] ?? CATEGORY_GROUP_FALLBACK) : CATEGORY_GROUP_FALLBACK;

  return (
    <article
      onClick={() => (selectable ? onToggleCheck?.(item.id) : onOpen?.(item))}
      className={`group -mx-3 flex min-w-0 flex-wrap items-center gap-3 border-b px-3 py-2.5 transition-colors sm:flex-nowrap sm:gap-3.5 ${
        checked
          ? "border-red-500/20 bg-red-500/[0.05]"
          : "border-white/[0.06] hover:bg-white/[0.025]"
      }`}
    >
      {selectable && (
        <div className="flex-shrink-0 flex items-center pt-1" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={!!checked}
            onChange={() => onToggleCheck?.(item.id)}
            className="h-4 w-4 cursor-pointer accent-red-500"
          />
        </div>
      )}

      <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-md bg-white/[0.04]">
        {thumbnail ? (
          <img src={thumbnail} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center"><FileImage size={18} className="text-neutral-600" /></div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2 text-[11px]">
          {groupName && (
            <span className={`truncate rounded px-1.5 py-0.5 font-semibold uppercase tracking-wide ${pillClass}`}>{groupName}</span>
          )}
          <span className="text-neutral-500 truncate hidden sm:inline">{categoryName}</span>
          <span className="ml-auto flex-shrink-0 text-neutral-500">hace {ageLabel(item.discoveredAt)}</span>
        </div>

        <h4 className="mt-1 line-clamp-2 text-sm font-semibold leading-snug text-white">
          {item.originalTitle}
        </h4>

        <div className="mt-1.5 flex min-w-0 items-center gap-2 text-[11px] text-neutral-500">
          <SourceBadge name={sourceLabel(item.sourceName, item.sourceDomain)} domain={item.sourceDomain} />
          <span className="truncate">{sourceLabel(item.sourceName, item.sourceDomain)}</span>
          {item.materials.length > 0 && (
            <span className="flex flex-shrink-0 items-center gap-1 text-neutral-500">
              <ImageIcon size={11} /> {item.materials.length}
            </span>
          )}
        </div>
      </div>

      {(!selectable || item.status !== "DISCOVERED") && (
        <div className="flex w-full flex-shrink-0 items-center justify-end gap-1 border-t border-white/[0.06] pt-2 sm:w-auto sm:border-0 sm:pt-0" onClick={(e) => e.stopPropagation()}>
          {item.status === "DISCOVERED" && !selectable && (
            <>
              <button onClick={() => onIgnore?.(item.id)} title="Ignorar noticia" aria-label="Ignorar noticia"
                className="rounded-md p-1.5 text-neutral-500 transition-colors hover:bg-white/[0.08] hover:text-white">
                <X size={13} />
              </button>
              <button onClick={() => onArchive?.(item.id)} title="Archivar noticia" aria-label="Archivar noticia"
                className="rounded-md p-1.5 text-neutral-500 transition-colors hover:bg-white/[0.08] hover:text-white">
                <Archive size={13} />
              </button>
              <button onClick={() => onSelect?.(item.id)}
                className="flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-[11px] font-semibold text-black transition-colors hover:bg-neutral-200">
                <Check size={12} /> Seleccionar
              </button>
            </>
          )}
          {item.status === "SELECTED" && (
            <>
              <button onClick={() => onIgnore?.(item.id)} title="Ignorar"
                className="rounded-md p-1.5 text-neutral-500 transition-colors hover:bg-white/[0.08] hover:text-white">
                <X size={13} />
              </button>
              <button onClick={() => onProcess?.(item.id)}
                className="flex items-center gap-1.5 rounded-lg bg-red-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-red-300 transition-colors hover:bg-red-500/20">
                <ArrowRight size={12} /> Procesar con IA
              </button>
              <button onClick={() => onManualEdit?.(item.id)}
                className="flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-white/15">
                <FileEdit size={12} /> Editar manualmente
              </button>
              <button onClick={() => onAssign?.(item.id)} title="Asignar"
                className="rounded-md p-1.5 text-neutral-500 hover:bg-white/10 hover:text-white">
                <UserRound size={13} />
              </button>
            </>
          )}
          {item.status === "SENT_TO_EDITORIAL" && item.storyId && (
            <>
              <button onClick={() => onManualEdit?.(item.id)}
                className="flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-white/15">
                <FileEdit size={12} /> Editar
              </button>
              <button onClick={() => onViewArtifact?.(item.storyId!, item.originalTitle)}
                className="flex items-center gap-1.5 rounded-lg bg-white/5 px-2.5 py-1.5 text-[11px] font-semibold text-neutral-300 hover:bg-white/10">
                <Eye size={12} /> Ver Artifact
              </button>
            </>
          )}
          {!selectable && <RowMenu url={item.originalUrl} />}
        </div>
      )}
    </article>
  );
}
