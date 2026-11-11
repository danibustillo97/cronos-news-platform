"use client";

// Renderer for the "Descubrir" internal tab -- status=DISCOVERED,
// real actions only.
//
// Layout: a list column plus an optional detail panel (opened by
// clicking a row) -- inline side-by-side on desktop, a bottom sheet on
// mobile (see DiscoveryDetailPanel). "Seleccionar varios" swaps rows into
// checkbox mode for real bulk actions (each one is still the same
// single-item decide() call, just looped -- no new endpoint).

import { useMemo, useState } from "react";
import { RefreshCw, CheckSquare, Square, X, Archive, Check } from "lucide-react";
import CategoryChips from "./CategoryChips";
import DiscoveryRow, { type DiscoveryItem } from "./DiscoveryRow";
import DiscoveryDetailPanel from "./DiscoveryDetailPanel";
import Select from "@/components/ui/Select";

interface Category { id: string; name: string; }
interface CategoryGroup { id: string; name: string; categories: Category[]; }

// "all" stands in for null (no time filter) -- Select's options are
// string-keyed, so the real number|null value is encoded/decoded at the
// two call sites below, never changing what onTimeRangeChange receives.
const TIME_RANGES = [
  { label: "Todo", hours: null as number | null, key: "all" },
  { label: "2 h", hours: 2, key: "2" },
  { label: "6 h", hours: 6, key: "6" },
  { label: "12 h", hours: 12, key: "12" },
  { label: "24 h", hours: 24, key: "24" },
  { label: "3 días", hours: 72, key: "72" },
];

const SORT_OPTIONS = [
  { value: "discovered_at", label: "Más recientes" },
  { value: "freshness_score", label: "Más frescos" },
  { value: "impact_score", label: "Mayor impacto" },
  { value: "relevance_score", label: "Mayor relevancia" },
];

function scoreValue(item: DiscoveryItem, sortBy: string): number {
  switch (sortBy) {
    case "freshness_score": return item.scores.freshnessScore ?? -1;
    case "impact_score": return item.scores.impactScore ?? -1;
    case "relevance_score": return item.scores.relevanceScore ?? -1;
    default: return new Date(item.discoveredAt).getTime();
  }
}

export default function DiscoveryQueueList({
  items, categoryGroups, categoryNameById, groupFilter, onGroupFilterChange,
  timeRangeHours, onTimeRangeChange, defaultSort, loading, error, onRefresh,
  onSelect, onIgnore, onArchive, onProcess, onViewArtifact, emptyHint,
}: {
  items: DiscoveryItem[];
  categoryGroups: CategoryGroup[];
  categoryNameById: Record<string, string>;
  groupFilter: string | null;
  onGroupFilterChange: (id: string | null) => void;
  timeRangeHours: number | null;
  onTimeRangeChange: (hours: number | null) => void;
  defaultSort: string;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onSelect: (id: string) => void;
  onIgnore: (id: string) => void;
  onArchive: (id: string) => void;
  onProcess: (id: string) => void;
  onViewArtifact: (storyId: string, title: string) => void;
  emptyHint: string;
}) {
  const [sortBy, setSortBy] = useState(defaultSort);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [bulkMode, setBulkMode] = useState(false);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  const groupCategoryIds = useMemo(() => {
    if (!groupFilter) return null;
    const group = categoryGroups.find((g) => g.id === groupFilter);
    return group ? new Set(group.categories.map((c) => c.id)) : new Set<string>();
  }, [groupFilter, categoryGroups]);

  const groupNameByCategoryId = useMemo(() => {
    const map: Record<string, string> = {};
    for (const g of categoryGroups) for (const c of g.categories) map[c.id] = g.name;
    return map;
  }, [categoryGroups]);

  const visible = useMemo(() => {
    let list = groupCategoryIds ? items.filter((i) => i.categoryId && groupCategoryIds.has(i.categoryId)) : items;
    list = [...list].sort((a, b) => scoreValue(b, sortBy) - scoreValue(a, sortBy));
    return list;
  }, [items, groupCategoryIds, sortBy]);

  const previewItem = previewId ? visible.find((i) => i.id === previewId) ?? null : null;

  return (
    <div>
      {/* Toolbar -- one clearly bounded zone, not loose controls */}
      <div className="space-y-2.5 pb-3 border-b border-white/10">
        <CategoryChips groups={categoryGroups} selected={groupFilter} onSelect={onGroupFilterChange} />
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Select
            className="w-[110px]" buttonClassName="!py-1.5 !text-xs"
            value={TIME_RANGES.find((r) => r.hours === timeRangeHours)?.key ?? "all"}
            onChange={(key) => onTimeRangeChange(TIME_RANGES.find((r) => r.key === key)?.hours ?? null)}
            options={TIME_RANGES.map((r) => ({ value: r.key, label: r.label }))}
          />
          <Select
            className="w-[150px]" buttonClassName="!py-1.5 !text-xs"
            value={sortBy}
            onChange={setSortBy}
            options={SORT_OPTIONS}
          />
          <span className="text-neutral-600">{loading ? "…" : `${visible.length} resultado${visible.length === 1 ? "" : "s"}`}</span>
          <button
            onClick={() => { setBulkMode((v) => !v); setCheckedIds(new Set()); }}
            className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md ${bulkMode ? "text-red-400" : "text-neutral-500 hover:text-white"}`}
          >
            {bulkMode ? <CheckSquare size={13} /> : <Square size={13} />} Seleccionar varios
          </button>
          <button onClick={onRefresh} className="ml-auto flex items-center gap-1.5 text-neutral-500 hover:text-white px-2 py-1.5">
            <RefreshCw size={12} /> Actualizar
          </button>
        </div>
      </div>

      {bulkMode && checkedIds.size > 0 && (
        <div className="flex items-center gap-2 py-2.5 border-b border-white/10 text-xs">
          <span className="text-neutral-400 font-medium">{checkedIds.size} seleccionado{checkedIds.size === 1 ? "" : "s"}</span>
          <button
            disabled={bulkBusy}
            onClick={async () => {
              setBulkBusy(true);
              for (const id of checkedIds) await onSelect(id);
              setCheckedIds(new Set());
              setBulkBusy(false);
            }}
            className="flex items-center gap-1.5 font-semibold px-2.5 py-1.5 rounded-lg bg-white text-black hover:bg-neutral-200 disabled:opacity-50"
          >
            <Check size={12} /> Seleccionar
          </button>
          <button
            disabled={bulkBusy}
            onClick={async () => {
              setBulkBusy(true);
              for (const id of checkedIds) await onIgnore(id);
              setCheckedIds(new Set());
              setBulkBusy(false);
            }}
            className="flex items-center gap-1.5 font-medium px-2.5 py-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 disabled:opacity-50"
          >
            <X size={12} /> Ignorar
          </button>
          <button
            disabled={bulkBusy}
            onClick={async () => {
              setBulkBusy(true);
              for (const id of checkedIds) await onArchive(id);
              setCheckedIds(new Set());
              setBulkBusy(false);
            }}
            className="flex items-center gap-1.5 font-medium px-2.5 py-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 disabled:opacity-50"
          >
            <Archive size={12} /> Archivar
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-3 text-neutral-400 py-12 justify-center text-sm">
          <RefreshCw className="animate-spin" size={18} /> Cargando...
        </div>
      ) : error ? (
        <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl p-4 mt-3">{error}</div>
      ) : visible.length === 0 ? (
        <div className="text-neutral-500 text-sm text-center py-12">{emptyHint}</div>
      ) : (
        <div className="flex items-start gap-4 mt-1">
          <div className="flex-1 min-w-0 divide-y divide-white/5">
            {visible.map((item) => (
              <DiscoveryRow
                key={item.id}
                item={item}
                categoryName={item.categoryId ? categoryNameById[item.categoryId] ?? null : null}
                groupName={item.categoryId ? groupNameByCategoryId[item.categoryId] ?? null : null}
                onOpen={(i) => setPreviewId(i.id)}
                onSelect={onSelect}
                onIgnore={onIgnore}
                onArchive={onArchive}
                onProcess={onProcess}
                onViewArtifact={onViewArtifact}
                selectable={bulkMode}
                checked={checkedIds.has(item.id)}
                onToggleCheck={(id) => setCheckedIds((prev) => {
                  const next = new Set(prev);
                  next.has(id) ? next.delete(id) : next.add(id);
                  return next;
                })}
              />
            ))}
          </div>

          {previewItem && (
            <DiscoveryDetailPanel
              item={previewItem}
              categoryName={previewItem.categoryId ? categoryNameById[previewItem.categoryId] ?? null : null}
              groupName={previewItem.categoryId ? groupNameByCategoryId[previewItem.categoryId] ?? null : null}
              onClose={() => setPreviewId(null)}
              onSelect={(id) => { onSelect(id); setPreviewId(null); }}
              onIgnore={(id) => { onIgnore(id); setPreviewId(null); }}
              onArchive={(id) => { onArchive(id); setPreviewId(null); }}
              onProcess={onProcess}
              onViewArtifact={onViewArtifact}
            />
          )}
        </div>
      )}
    </div>
  );
}
