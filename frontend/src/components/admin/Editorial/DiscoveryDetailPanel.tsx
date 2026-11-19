"use client";

// The right-side preview panel opened by clicking a Discovery row.
// Desktop: inline column, part of the workspace (no backdrop). Mobile:
// bottom sheet with a backdrop, since there's no room for two columns.
// Shows only real fields -- no invented "país", no fabricated summary.

import { useState } from "react";
import { X, Check, ArrowRight, Trash2, Globe, FileImage, ExternalLink, FileEdit, UserRound, MoreHorizontal } from "lucide-react";
import type { DiscoveryItem } from "./DiscoveryRow";
import { ageLabel, excerpt, sourceLabel } from "./DiscoveryRow";
import { CATEGORY_GROUP_CLASSES, CATEGORY_GROUP_FALLBACK } from "./statusMeta";

function Metric({ label, value, color }: { label: string; value: number | null; color: string }) {
  const pct = value === null ? null : Math.round(value * 100);
  return (
    <div className="flex-1 min-w-0">
      <div className="text-[11px] text-neutral-500 mb-1">{label}</div>
      <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
        {pct !== null && <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />}
      </div>
      <div className="text-sm text-white font-semibold mt-1">{pct === null ? "N/A" : `${pct}%`}</div>
    </div>
  );
}

export default function DiscoveryDetailPanel({
  item, categoryName, groupName, onClose, onSelect, onIgnore, onArchive, onProcess, onManualEdit, onAssign, onViewArtifact,
}: {
  item: DiscoveryItem;
  categoryName: string | null;
  groupName: string | null;
  onClose: () => void;
  onSelect?: (id: string) => void;
  onIgnore?: (id: string) => void;
  onArchive?: (id: string) => void;
  onProcess?: (id: string) => void;
  onManualEdit?: (id: string) => void;
  onAssign?: (id: string) => void;
  onViewArtifact?: (storyId: string, title: string) => void;
}) {
  const [moreActionsOpen, setMoreActionsOpen] = useState(false);
  const thumbnail = item.materials.find((m) => m.kind === "IMAGE" && m.url)?.url ?? null;
  const pillClass = groupName ? (CATEGORY_GROUP_CLASSES[groupName] ?? CATEGORY_GROUP_FALLBACK) : CATEGORY_GROUP_FALLBACK;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 sm:hidden" onClick={onClose} />
      <aside className="fixed inset-x-0 bottom-0 z-40 max-h-[85vh] rounded-t-2xl border-t border-white/10 bg-neutral-950 overflow-y-auto sm:sticky sm:top-3 sm:inset-auto sm:z-auto sm:max-h-[calc(100vh-6rem)] sm:w-[320px] sm:flex-shrink-0 sm:rounded-xl sm:border sm:bg-neutral-950 sm:overflow-y-auto p-4 space-y-4">
        <div className="w-full aspect-video rounded-lg overflow-hidden bg-white/5 flex items-center justify-center relative">
          {thumbnail ? (
            <img src={thumbnail} alt="" className="w-full h-full object-cover" />
          ) : (
            <FileImage size={28} className="text-neutral-700" />
          )}
          <button onClick={onClose} className="absolute top-2 right-2 bg-black/50 text-white rounded-md p-1 hover:bg-black/70">
            <X size={14} />
          </button>
        </div>

        <div>
          <div className="flex items-center gap-2 text-[11px] mb-1.5">
            {groupName && <span className={`font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${pillClass}`}>{groupName}</span>}
            {categoryName && <span className="text-neutral-500">{categoryName}</span>}
          </div>
          <h3 className="text-[16px] font-bold text-white leading-snug">{item.originalTitle}</h3>
        </div>

        <div className="flex items-center gap-2 flex-wrap text-[11px] text-neutral-500">
          <span className="font-medium text-neutral-300">{sourceLabel(item.sourceName, item.sourceDomain)}</span>
          <span>· hace {ageLabel(item.discoveredAt)}</span>
          {item.language && (
            <span className="flex items-center gap-1"><Globe size={10} /> {item.language === "es" ? "Español" : item.language}</span>
          )}
        </div>

        <p className="text-[13px] text-neutral-400 leading-relaxed">{excerpt(item.rawText, 320)}</p>

        {item.topics.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {item.topics.slice(0, 4).map((t) => (
              <span key={t} className="text-[11px] px-2 py-0.5 rounded-full bg-white/5 text-neutral-400">{t}</span>
            ))}
            {item.topics.length > 4 && <span className="text-[11px] text-neutral-600">+{item.topics.length - 4}</span>}
          </div>
        )}

        {item.materials.some((m) => m.kind === "IMAGE") && (
          <div>
            <div className="text-[11px] font-semibold text-neutral-500 mb-2">Materiales</div>
            <div className="flex gap-2">
              {item.materials.filter((m) => m.kind === "IMAGE").slice(0, 3).map((m, i) => (
                <img key={i} src={m.url} alt="" className="w-14 h-14 rounded-lg object-cover border border-white/10" />
              ))}
              {item.materials.length > 3 && (
                <div className="w-14 h-14 rounded-lg bg-white/5 flex items-center justify-center text-xs text-neutral-400 font-medium">
                  +{item.materials.length - 3}
                </div>
              )}
            </div>
          </div>
        )}

        <div>
          <div className="text-[11px] font-semibold text-neutral-500 mb-2">Métricas</div>
          <div className="flex gap-4">
            <Metric label="Frescura" value={item.scores.freshnessScore} color="bg-green-400" />
            <Metric label="Completitud" value={item.scores.completenessScore} color="bg-blue-400" />
            <Metric label="Material" value={item.scores.materialScore} color="bg-violet-400" />
          </div>
        </div>

        <div className="space-y-2 pt-1">
          <div className="text-[11px] font-semibold text-neutral-500 mb-1">Acciones</div>
          {item.status === "DISCOVERED" && (
            <>
              <button onClick={() => onSelect?.(item.id)}
                className="w-full flex items-center justify-center gap-2 text-sm font-bold px-4 py-2.5 rounded-lg bg-white text-black hover:bg-neutral-200">
                <Check size={14} /> Seleccionar
              </button>
              <div className="flex items-center gap-2">
                <button onClick={() => onIgnore?.(item.id)}
                  className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10">
                  <X size={13} /> Ignorar
                </button>
                <button onClick={() => onArchive?.(item.id)}
                  className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10">
                  <Trash2 size={13} /> Archivar
                </button>
              </div>
            </>
          )}
          {item.status === "SELECTED" && (
            <>
              <button onClick={() => onProcess?.(item.id)}
                className="w-full flex items-center justify-center gap-2 text-sm font-bold px-4 py-2.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20">
                <ArrowRight size={14} /> Procesar con IA
              </button>
              <button onClick={() => onManualEdit?.(item.id)}
                className="w-full flex items-center justify-center gap-2 text-sm font-bold px-4 py-2.5 rounded-lg bg-white/10 text-white hover:bg-white/15">
                <FileEdit size={14} /> Editar manualmente
              </button>
              <button onClick={() => onAssign?.(item.id)}
                className="w-full flex items-center justify-center gap-2 text-xs font-medium px-3 py-2 rounded-lg text-neutral-300 hover:text-white hover:bg-white/10">
                <UserRound size={13} /> Asignar{item.assignedTo ? ` · ${item.assignedTo}` : ""}
              </button>
              <button onClick={() => setMoreActionsOpen((open) => !open)}
                className="w-full flex items-center justify-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10">
                <MoreHorizontal size={13} /> Más acciones
              </button>
              {moreActionsOpen && (
                <div className="flex gap-2">
                  <button onClick={() => onIgnore?.(item.id)}
                    className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10">
                    <X size={13} /> Ignorar
                  </button>
                  <button onClick={() => onArchive?.(item.id)}
                    className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10">
                    <Trash2 size={13} /> Archivar
                  </button>
                </div>
              )}
            </>
          )}
          {item.status === "SENT_TO_EDITORIAL" && item.storyId && (
            <>
              <button onClick={() => onManualEdit?.(item.id)}
                className="w-full flex items-center justify-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-lg bg-white/10 text-white hover:bg-white/15">
                <FileEdit size={14} /> Abrir editor
              </button>
              <button onClick={() => onViewArtifact?.(item.storyId!, item.originalTitle)}
                className="w-full flex items-center justify-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-lg bg-white/5 text-neutral-300 hover:bg-white/10">
                Ver progreso de Artifact
              </button>
            </>
          )}
          <a href={item.originalUrl} target="_blank" rel="noreferrer"
            className="w-full flex items-center justify-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg text-neutral-500 hover:text-white hover:bg-white/10">
            <ExternalLink size={13} /> Ver fuente
          </a>
        </div>
      </aside>
    </>
  );
}
