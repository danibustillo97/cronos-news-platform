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
import MetricBar from "./MetricBar";
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

function pct(value: number | null): string {
  return value === null ? "N/A" : `${Math.round(value * 100)}%`;
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
      className={`group flex gap-3 py-3 -mx-2 px-2 rounded-lg transition-colors cursor-pointer ${
        checked ? "bg-red-500/[0.06] ring-1 ring-red-500/40" : "hover:bg-white/[0.03]"
      }`}
    >
      {selectable && (
        <div className="flex-shrink-0 flex items-center pt-1" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={!!checked}
            onChange={() => onToggleCheck?.(item.id)}
            className="w-4 h-4 rounded accent-red-500 cursor-pointer"
          />
        </div>
      )}

      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg overflow-hidden flex-shrink-0 bg-white/5 flex items-center justify-center">
        {thumbnail ? (
          <img src={thumbnail} alt="" className="w-full h-full object-cover" />
        ) : (
          <FileImage size={18} className="text-neutral-700" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-[11px]">
          {groupName && (
            <span className={`font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${pillClass}`}>{groupName}</span>
          )}
          <span className="text-neutral-500 truncate hidden sm:inline">{categoryName}</span>
          <span className="ml-auto flex-shrink-0 text-neutral-600">hace {ageLabel(item.discoveredAt)}</span>
        </div>

        <h4 className="text-[13.5px] sm:text-[14.5px] font-semibold text-white leading-snug mt-1 line-clamp-2">
          {item.originalTitle}
        </h4>

        <p className="text-[12px] text-neutral-500 mt-1 line-clamp-1 hidden sm:block">{excerpt(item.rawText)}</p>

        <div className="flex items-center gap-2 text-[11px] text-neutral-500 mt-1.5 flex-wrap">
          <SourceBadge name={sourceLabel(item.sourceName, item.sourceDomain)} domain={item.sourceDomain} />
          <span className="truncate">{sourceLabel(item.sourceName, item.sourceDomain)}</span>
          {item.materials.length > 0 && (
            <span className="flex items-center gap-1 text-neutral-600">
              <ImageIcon size={10} /> {item.materials.length}
            </span>
          )}
          {/* Mobile: plain percentages instead of bars -- same real scores, denser */}
          <span className="flex items-center gap-2 text-neutral-600 sm:hidden">
            <span>{pct(item.scores.freshnessScore)}</span>
            <span>{pct(item.scores.completenessScore)}</span>
            <span>{pct(item.scores.materialScore)}</span>
          </span>
        </div>
      </div>

      <div className="hidden sm:flex items-center gap-4 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
        <div className="w-28 space-y-1 hidden md:block">
          <MetricBar label="Frescura" value={item.scores.freshnessScore} color="green" />
          <MetricBar label="Completitud" value={item.scores.completenessScore} color="blue" />
          <MetricBar label="Material" value={item.scores.materialScore} color="violet" />
        </div>

        <div className="flex items-center gap-1">
          {item.status === "DISCOVERED" && !selectable && (
            <>
              <button onClick={() => onIgnore?.(item.id)} title="Ignorar"
                className="p-1.5 rounded-md text-neutral-600 opacity-70 hover:opacity-100 hover:text-white hover:bg-white/10">
                <X size={13} />
              </button>
              <button onClick={() => onArchive?.(item.id)} title="Archivar"
                className="p-1.5 rounded-md text-neutral-600 opacity-70 hover:opacity-100 hover:text-white hover:bg-white/10">
                <Archive size={13} />
              </button>
              <button onClick={() => onSelect?.(item.id)}
                className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-white text-black hover:bg-neutral-200">
                <Check size={12} /> Seleccionar
              </button>
            </>
          )}
          {item.status === "SELECTED" && (
            <>
              <button onClick={() => onIgnore?.(item.id)} title="Ignorar"
                className="p-1.5 rounded-md text-neutral-600 opacity-70 hover:opacity-100 hover:text-white hover:bg-white/10">
                <X size={13} />
              </button>
              <button onClick={() => onProcess?.(item.id)}
                className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20">
                <ArrowRight size={12} /> Procesar con IA
              </button>
              <button onClick={() => onManualEdit?.(item.id)}
                className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-white/10 text-white hover:bg-white/15">
                <FileEdit size={12} /> Editar manualmente
              </button>
              <button onClick={() => onAssign?.(item.id)} title="Asignar"
                className="p-1.5 rounded-md text-neutral-500 hover:text-white hover:bg-white/10">
                <UserRound size={13} />
              </button>
            </>
          )}
          {item.status === "SENT_TO_EDITORIAL" && item.storyId && (
            <>
              <button onClick={() => onManualEdit?.(item.id)}
                className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-white/10 text-white hover:bg-white/15">
                <FileEdit size={12} /> Editar
              </button>
              <button onClick={() => onViewArtifact?.(item.storyId!, item.originalTitle)}
                className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-white/5 text-neutral-300 hover:bg-white/10">
                <Eye size={12} /> Ver Artifact
              </button>
            </>
          )}
          {!selectable && <RowMenu url={item.originalUrl} />}
        </div>
      </div>
    </article>
  );
}
