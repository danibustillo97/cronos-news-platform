"use client";

// Discovery -- the FIRST PHASE of the Editorial flow (DISCOVERY ->
// ARTIFACT -> READY -> PUBLISH), not a module of its own. Consumes
// GET/POST /api/discovery/* directly: no scraping, no classification, no
// scoring happens in this component -- see backend/app/domain/discovery/
// for where that real work happens.
//
// UX: four internal TABS (Buscar/Descubrir/Seleccionado/Artifact), not a
// stepper -- each is real navigation over real data:
//   Buscar      -- real job history (the trigger action itself lives in
//                  the persistent toolbar to its right, always reachable
//                  no matter which internal tab is active)
//   Descubrir   -- status=DISCOVERED, chronological (the raw feed)
//   Seleccionado -- status=SELECTED, the actionable "send to Artifact" queue
//   Artifact    -- status=SENT_TO_EDITORIAL, already handed off -- its own
//                  space instead of a strip tucked under Seleccionado
// There is deliberately no status dropdown anywhere in this panel --
// the tabs ARE the navigation between phases.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Search, Compass, CheckSquare, Sparkles, RefreshCw, Square, CheckCircle2, FileEdit, UserRound,
  MoreHorizontal, Archive, X,
} from "lucide-react";
import { toast } from "sonner";
import { apiUrl } from "@/studio/lab/api-client";
import ProviderPickerModal from "./ProviderPickerModal";
import ArtifactDrawer from "./ArtifactDrawer";
import JobHistoryList from "./JobHistoryList";
import DiscoveryQueueList from "./DiscoveryQueueList";
import DiscoveryRow, { type DiscoveryItem } from "./DiscoveryRow";
import DiscoveryDetailPanel from "./DiscoveryDetailPanel";

interface DiscoveryJob {
  id: string;
  status: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLING" | "CANCELLED";
  params: Record<string, unknown>;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  itemsFound: number | null;
  error: string | null;
}

interface Category { id: string; name: string; }
interface CategoryGroup { id: string; name: string; categories: Category[]; }

type DiscoveryTab = "descubrir" | "seleccionado" | "artifact";

async function responseError(response: Response): Promise<Error> {
  const body = await response.json().catch(() => null);
  return new Error(body?.message || body?.detail || `HTTP ${response.status}`);
}

const TABS: { id: DiscoveryTab; label: string; icon: typeof Search }[] = [
  { id: "descubrir", label: "Nuevas", icon: Compass },
  { id: "seleccionado", label: "Seleccionadas", icon: CheckSquare },
  { id: "artifact", label: "En edición", icon: Sparkles },
];

export default function DiscoveryPanel({
  onEditManually,
}: {
  onEditManually: (itemIds: string[]) => void;
}) {
  const [tab, setTab] = useState<DiscoveryTab>("descubrir");

  const [discovered, setDiscovered] = useState<DiscoveryItem[]>([]);
  const [selected, setSelected] = useState<DiscoveryItem[]>([]);
  const [inArtifact, setInArtifact] = useState<DiscoveryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [categoryGroups, setCategoryGroups] = useState<CategoryGroup[]>([]);
  const [groupFilter, setGroupFilter] = useState<string | null>(null);
  const [timeRangeHours, setTimeRangeHours] = useState<number | null>(24);

  const [job, setJob] = useState<DiscoveryJob | null>(null);
  const [triggering, setTriggering] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [pickerForItem, setPickerForItem] = useState<string | null>(null);
  const [retryStoryId, setRetryStoryId] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<{ storyId: string; title: string } | null>(null);
  const [seleccionadoPreviewId, setSeleccionadoPreviewId] = useState<string | null>(null);
  const [artifactPreviewId, setArtifactPreviewId] = useState<string | null>(null);
  const [bulkEditMode, setBulkEditMode] = useState(false);
  const [bulkEditIds, setBulkEditIds] = useState<Set<string>>(new Set());
  const [bulkMoreOpen, setBulkMoreOpen] = useState(false);
  const [assignmentTargets, setAssignmentTargets] = useState<string[] | null>(null);
  const [assignmentDraft, setAssignmentDraft] = useState("");
  const [assignmentBusy, setAssignmentBusy] = useState(false);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [discoveredRes, selectedRes, artifactRes] = await Promise.all([
        fetch(apiUrl("/api/discovery/items?status=DISCOVERED&sort_by=discovered_at&sort_dir=desc&limit=100")),
        fetch(apiUrl("/api/discovery/items?status=SELECTED&sort_by=discovered_at&sort_dir=desc&limit=50")),
        fetch(apiUrl("/api/discovery/items?status=SENT_TO_EDITORIAL&sort_by=discovered_at&sort_dir=desc&limit=20")),
      ]);
      if (!discoveredRes.ok) throw await responseError(discoveredRes);
      if (!selectedRes.ok) throw await responseError(selectedRes);
      if (!artifactRes.ok) throw await responseError(artifactRes);

      const [discoveredData, selectedData, artifactData] = await Promise.all([
        discoveredRes.json(), selectedRes.json(), artifactRes.json(),
      ]);
      setDiscovered(discoveredData.items ?? []);
      setSelected(selectedData.items ?? []);
      setInArtifact(artifactData.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar Discovery");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(apiUrl("/api/categories"));
        if (res.ok) setCategoryGroups((await res.json()).groups ?? []);
      } catch {
        // Category chips just stay empty -- not fatal for the rest of the page.
      }
    })();
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  const handleTrigger = async () => {
    setTriggering(true);
    try {
      const res = await fetch(apiUrl("/api/discovery/jobs"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message || `HTTP ${res.status}`);
      }
      const created: DiscoveryJob = await res.json();
      setJob(created);
      toast.success("Buscando noticias -- Automation está corriendo un pase real");

      pollRef.current = setInterval(async () => {
        const r = await fetch(apiUrl(`/api/discovery/jobs/${created.id}`));
        if (!r.ok) return;
        const updated: DiscoveryJob = await r.json();
        setJob(updated);
        if (updated.status === "COMPLETED" || updated.status === "FAILED" || updated.status === "CANCELLED") {
          stopPolling();
          setTriggering(false);
          setStopping(false);
          setHistoryRefreshKey((k) => k + 1);
          if (updated.status === "COMPLETED") {
            toast.success(`Discovery completado -- ${updated.itemsFound ?? 0} items nuevos`);
            fetchItems();
          } else if (updated.status === "CANCELLED") {
            toast.success(`Discovery detenido -- ${updated.itemsFound ?? 0} items nuevos`);
            fetchItems();
          } else {
            toast.error(`Discovery falló: ${updated.error}`);
          }
        }
      }, 3000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo iniciar Discovery");
      setTriggering(false);
    }
  };

  const handleStop = async () => {
    if (!job) return;
    setStopping(true);
    try {
      const res = await fetch(apiUrl(`/api/discovery/jobs/${job.id}/stop`), { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message || `HTTP ${res.status}`);
      }
      const updated: DiscoveryJob = await res.json();
      setJob(updated);
      toast.success("Deteniendo Discovery -- terminará el ítem en curso");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo detener Discovery");
      setStopping(false);
    }
  };

  const decide = async (itemId: string, decision: string) => {
    try {
      const res = await fetch(apiUrl(`/api/discovery/items/${itemId}/decide`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message || `HTTP ${res.status}`);
      }
      const updated: DiscoveryItem = await res.json();
      if (updated.status === "SELECTED") {
        setDiscovered((prev) => prev.filter((i) => i.id !== itemId));
        setSelected((prev) => [updated, ...prev]);
        toast.success("Seleccionado", {
          action: { label: "Ver en Seleccionado", onClick: () => setTab("seleccionado") },
        });
      } else {
        setDiscovered((prev) => prev.filter((i) => i.id !== itemId));
        toast.success(decision === "IGNORE" ? "Ignorado" : "Archivado");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo actualizar el item");
    }
  };

  const decideSelected = async (itemId: string, decision: string): Promise<boolean> => {
    try {
      const res = await fetch(apiUrl(`/api/discovery/items/${itemId}/decide`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message || `HTTP ${res.status}`);
      }
      setSelected((prev) => prev.filter((i) => i.id !== itemId));
      setSeleccionadoPreviewId((cur) => (cur === itemId ? null : cur));
      setBulkEditIds((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
      toast.success(decision === "IGNORE" ? "Ignorado" : "Archivado");
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo actualizar el item");
      return false;
    }
  };

  const assignItems = async () => {
    if (!assignmentTargets?.length || assignmentBusy) return;
    setAssignmentBusy(true);
    try {
      for (const id of assignmentTargets) {
        const res = await fetch(apiUrl(`/api/discovery/items/${id}/assignment`), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assignee: assignmentDraft.trim() || null }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.message || `HTTP ${res.status}`);
        }
        const updated: DiscoveryItem = await res.json();
        setSelected((prev) => prev.map((item) => item.id === id ? updated : item));
        setInArtifact((prev) => prev.map((item) => item.id === id ? updated : item));
      }
      toast.success(assignmentDraft.trim() ? "Asignación guardada" : "Asignación quitada");
      setAssignmentTargets(null);
      setAssignmentDraft("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar la asignación");
    } finally {
      setAssignmentBusy(false);
    }
  };

  const editManually = (itemIds: string[]) => {
    if (itemIds.length === 0) return;
    onEditManually(itemIds);
    setBulkEditIds(new Set());
    setBulkEditMode(false);
  };

  const openAssignment = (itemIds: string[]) => {
    const assigned = selected.find((item) => itemIds.includes(item.id))?.assignedTo ?? "";
    setAssignmentDraft(assigned);
    setAssignmentTargets(itemIds);
  };

  const runBulkDecision = async (decision: "IGNORE" | "ARCHIVE") => {
    for (const id of bulkEditIds) {
      if (!await decideSelected(id, decision)) return;
    }
    setBulkMoreOpen(false);
  };

  const confirmSendToEditorial = async (itemId: string, providerId: string) => {
    setPickerForItem(null);
    try {
      const res = await fetch(apiUrl(`/api/discovery/items/${itemId}/decide`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: "SEND_TO_EDITORIAL" }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message || `HTTP ${res.status}`);
      }
      const updated: DiscoveryItem = await res.json();
      setSelected((prev) => prev.filter((i) => i.id !== itemId));
      setInArtifact((prev) => [updated, ...prev]);
      setSeleccionadoPreviewId((cur) => (cur === itemId ? null : cur));

      if (updated.storyId) {
        try {
          const jobRes = await fetch(apiUrl("/api/artifacts/jobs"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ storyId: updated.storyId, provider: providerId }),
          });
          if (!jobRes.ok) {
            const jobBody = await jobRes.json().catch(() => null);
            throw new Error(jobBody?.message || `HTTP ${jobRes.status}`);
          }
          toast.success("Story creada -- Artifact generando el editorial");
        } catch (err) {
          toast.error(err instanceof Error ? `Artifact no se pudo iniciar: ${err.message}` : "Artifact no se pudo iniciar");
        }
      } else {
        toast.success("Story creada -- lista para Artifact");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo actualizar el item");
    }
  };

  const confirmRetry = async (storyId: string, providerId: string) => {
    setRetryStoryId(null);
    try {
      const res = await fetch(apiUrl("/api/artifacts/jobs"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyId, provider: providerId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message || `HTTP ${res.status}`);
      }
      toast.success("Reintentando Artifact");
      setDrawer({ storyId, title: drawer?.title ?? "" });
    } catch (err) {
      toast.error(err instanceof Error ? `No se pudo reintentar: ${err.message}` : "No se pudo reintentar");
    }
  };

  const allTopics = categoryGroups.flatMap((g) => g.categories);
  const categoryNameById = useMemo(
    () => Object.fromEntries(allTopics.map((c) => [c.id, c.name])),
    [allTopics],
  );
  const groupNameByCategoryId = useMemo(() => {
    const map: Record<string, string> = {};
    for (const g of categoryGroups) for (const c of g.categories) map[c.id] = g.name;
    return map;
  }, [categoryGroups]);

  const jobActive = triggering && (job?.status === "QUEUED" || job?.status === "RUNNING" || job?.status === "CANCELLING");
  const seleccionadoPreview = seleccionadoPreviewId ? selected.find((i) => i.id === seleccionadoPreviewId) ?? null : null;
  const artifactPreview = artifactPreviewId ? inArtifact.find((i) => i.id === artifactPreviewId) ?? null : null;

  return (
    <div className="space-y-3 pb-16 sm:pb-0">
      {/* State navigation; search history stays available below the feed. */}
      <div className="flex items-center justify-between gap-3 border-b border-white/10 flex-wrap">
        <div className="flex items-center gap-5 overflow-x-auto scrollbar-hide">
          {TABS.map(({ id, label, icon: Icon }) => {
            const count = id === "descubrir" ? discovered.length
              : id === "seleccionado" ? selected.length
              : inArtifact.length;
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`relative flex items-center gap-1.5 pb-2.5 -mb-px border-b-2 text-[13.5px] font-semibold transition-colors flex-shrink-0 whitespace-nowrap ${
                  tab === id ? "text-white border-red-500" : "text-neutral-500 hover:text-neutral-300 border-transparent"
                }`}
              >
                <Icon size={14} />
                {label}
                {id === "descubrir" && jobActive && <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />}
                {!loading && <span className="text-[10px] font-normal text-neutral-600">{count}</span>}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 pb-2.5 flex-shrink-0">
          {!triggering ? (
            <button
              onClick={handleTrigger}
              className="flex items-center gap-1.5 bg-white text-black px-3.5 py-1.5 rounded-lg text-xs font-bold hover:bg-neutral-200 transition-colors"
            >
              <Search size={13} /> Buscar noticias
            </button>
          ) : (
            <>
              <span className="flex items-center gap-1.5 bg-white/10 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold">
                <RefreshCw className="animate-spin" size={13} />
                {job?.status === "CANCELLING" ? "Deteniendo..." : "Descubriendo..."}
              </span>
              {(job?.status === "QUEUED" || job?.status === "RUNNING") && (
                <button
                  onClick={handleStop}
                  disabled={stopping}
                  title="Detener -- termina el ítem en curso y conserva lo ya encontrado"
                  className="flex items-center gap-1.5 bg-white/5 text-neutral-300 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-red-500/20 hover:text-red-400 transition-colors disabled:opacity-50"
                >
                  <Square size={11} className={stopping ? "animate-pulse" : ""} />
                  {stopping ? "Deteniendo..." : "Detener"}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {tab === "descubrir" && (
        <>
          <DiscoveryQueueList
            items={discovered}
            categoryGroups={categoryGroups}
            categoryNameById={categoryNameById}
            groupFilter={groupFilter}
            onGroupFilterChange={setGroupFilter}
            timeRangeHours={timeRangeHours}
            onTimeRangeChange={setTimeRangeHours}
            defaultSort="discovered_at"
            loading={loading}
            error={error}
            onRefresh={fetchItems}
            onSelect={(id) => decide(id, "SELECT")}
            onIgnore={(id) => decide(id, "IGNORE")}
            onArchive={(id) => decide(id, "ARCHIVE")}
            onProcess={(id) => setPickerForItem(id)}
            onViewArtifact={(storyId, title) => setDrawer({ storyId, title })}
            emptyHint="No hay noticias nuevas en este filtro."
          />
          <details className="mt-4 border-t border-white/10 pt-3">
            <summary className="cursor-pointer text-xs font-medium text-neutral-500 hover:text-neutral-300">
              Historial de búsquedas
            </summary>
            <div className="pt-3">
              <JobHistoryList refreshKey={historyRefreshKey} />
            </div>
          </details>
        </>
      )}

      {tab === "seleccionado" && (
        <div>
          <div className="flex flex-wrap items-center gap-2 pb-3 border-b border-white/10">
            <button
              onClick={() => {
                setBulkEditMode((enabled) => !enabled);
                setBulkEditIds(new Set());
                setBulkMoreOpen(false);
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold ${
                bulkEditMode ? "bg-white/10 text-white" : "text-neutral-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <CheckSquare size={13} /> {bulkEditMode ? "Cancelar selección" : "Seleccionar varios"}
            </button>
            {bulkEditMode && bulkEditIds.size > 0 && (
              <>
                <span className="text-xs text-neutral-500">{bulkEditIds.size} seleccionados</span>
                <button
                  onClick={() => editManually([...bulkEditIds])}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white text-black text-xs font-bold hover:bg-neutral-200"
                >
                  <FileEdit size={13} /> Editar en cola
                </button>
                <button
                  onClick={() => openAssignment([...bulkEditIds])}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 text-neutral-300 text-xs font-semibold hover:bg-white/10"
                >
                  <UserRound size={13} /> Asignar
                </button>
                <div className="relative">
                  <button
                    onClick={() => setBulkMoreOpen((open) => !open)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 text-neutral-300 text-xs font-semibold hover:bg-white/10"
                  >
                    <MoreHorizontal size={13} /> Más acciones
                  </button>
                  {bulkMoreOpen && (
                    <div className="absolute right-0 top-full z-20 mt-1 w-40 rounded-lg border border-white/10 bg-neutral-900 p-1 shadow-xl">
                      <button onClick={() => runBulkDecision("IGNORE")}
                        className="w-full flex items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-neutral-300 hover:bg-white/10">
                        <X size={12} /> Ignorar
                      </button>
                      <button onClick={() => runBulkDecision("ARCHIVE")}
                        className="w-full flex items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-neutral-300 hover:bg-white/10">
                        <Archive size={12} /> Archivar
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
          {loading ? (
            <div className="flex items-center gap-3 text-neutral-400 py-12 justify-center text-sm">Cargando...</div>
          ) : selected.length === 0 ? (
            <div className="text-neutral-500 text-sm text-center py-12 flex flex-col items-center gap-2">
              <CheckCircle2 size={20} className="text-neutral-700" />
              Todavía no seleccionaste noticias. Hazlo desde &quot;Nuevas&quot;.
            </div>
          ) : (
            <div className="flex items-start gap-4">
              <div className="flex-1 min-w-0 divide-y divide-white/5">
                {selected.map((item) => (
                  <DiscoveryRow
                    key={item.id}
                    item={item}
                    categoryName={item.categoryId ? categoryNameById[item.categoryId] ?? null : null}
                    groupName={item.categoryId ? groupNameByCategoryId[item.categoryId] ?? null : null}
                    onOpen={(i) => setSeleccionadoPreviewId(i.id)}
                    onIgnore={(id) => { void decideSelected(id, "IGNORE"); }}
                    onProcess={(id) => setPickerForItem(id)}
                    onManualEdit={(id) => editManually([id])}
                    onAssign={(id) => openAssignment([id])}
                    selectable={bulkEditMode}
                    checked={bulkEditIds.has(item.id)}
                    onToggleCheck={(id) => setBulkEditIds((prev) => {
                      const next = new Set(prev);
                      next.has(id) ? next.delete(id) : next.add(id);
                      return next;
                    })}
                  />
                ))}
              </div>
              {seleccionadoPreview && (
                <DiscoveryDetailPanel
                  item={seleccionadoPreview}
                  categoryName={seleccionadoPreview.categoryId ? categoryNameById[seleccionadoPreview.categoryId] ?? null : null}
                  groupName={seleccionadoPreview.categoryId ? groupNameByCategoryId[seleccionadoPreview.categoryId] ?? null : null}
                  onClose={() => setSeleccionadoPreviewId(null)}
                  onIgnore={(id) => { void decideSelected(id, "IGNORE"); }}
                  onArchive={(id) => { void decideSelected(id, "ARCHIVE"); }}
                  onProcess={(id) => setPickerForItem(id)}
                  onManualEdit={(id) => editManually([id])}
                  onAssign={(id) => openAssignment([id])}
                />
              )}
            </div>
          )}
        </div>
      )}

      {tab === "artifact" && (
        <div>
          {loading ? (
            <div className="flex items-center gap-3 text-neutral-400 py-12 justify-center text-sm">Cargando...</div>
          ) : inArtifact.length === 0 ? (
            <div className="text-neutral-500 text-sm text-center py-12 flex flex-col items-center gap-2">
              <Sparkles size={20} className="text-neutral-700" />
              Nada procesándose en Artifact todavía. Procesá un item en &quot;Seleccionado&quot;.
            </div>
          ) : (
            <div className="flex items-start gap-4">
              <div className="flex-1 min-w-0 divide-y divide-white/5">
                {inArtifact.map((item) => (
                  <DiscoveryRow
                    key={item.id}
                    item={item}
                    categoryName={item.categoryId ? categoryNameById[item.categoryId] ?? null : null}
                    groupName={item.categoryId ? groupNameByCategoryId[item.categoryId] ?? null : null}
                    onOpen={(i) => setArtifactPreviewId(i.id)}
                    onViewArtifact={(storyId, title) => setDrawer({ storyId, title })}
                    onManualEdit={(id) => editManually([id])}
                  />
                ))}
              </div>
              {artifactPreview && (
                <DiscoveryDetailPanel
                  item={artifactPreview}
                  categoryName={artifactPreview.categoryId ? categoryNameById[artifactPreview.categoryId] ?? null : null}
                  groupName={artifactPreview.categoryId ? groupNameByCategoryId[artifactPreview.categoryId] ?? null : null}
                  onClose={() => setArtifactPreviewId(null)}
                  onViewArtifact={(storyId, title) => setDrawer({ storyId, title })}
                  onManualEdit={(id) => editManually([id])}
                />
              )}
            </div>
          )}
        </div>
      )}

      {pickerForItem && (
        <ProviderPickerModal
          onCancel={() => setPickerForItem(null)}
          onConfirm={(providerId) => confirmSendToEditorial(pickerForItem, providerId)}
        />
      )}

      {assignmentTargets && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-xl border border-white/10 bg-neutral-950 p-5 shadow-2xl">
            <h3 className="text-sm font-bold text-white">Asignar noticias</h3>
            <p className="mt-1 text-xs text-neutral-500">
              Responsable (nombre o email). Dejá vacío para quitar la asignación.
            </p>
            <input
              autoFocus
              value={assignmentDraft}
              onChange={(event) => setAssignmentDraft(event.target.value)}
              onKeyDown={(event) => { if (event.key === "Enter") void assignItems(); }}
              placeholder="editor@ejemplo.com"
              className="mt-4 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/30"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setAssignmentTargets(null)} disabled={assignmentBusy}
                className="rounded-lg px-3 py-2 text-xs text-neutral-400 hover:bg-white/5 disabled:opacity-50">
                Cancelar
              </button>
              <button onClick={assignItems} disabled={assignmentBusy}
                className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-black hover:bg-neutral-200 disabled:opacity-50">
                {assignmentBusy ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {retryStoryId && (
        <ProviderPickerModal
          onCancel={() => setRetryStoryId(null)}
          onConfirm={(providerId) => confirmRetry(retryStoryId, providerId)}
        />
      )}

      {drawer && (
        <ArtifactDrawer
          storyId={drawer.storyId}
          title={drawer.title}
          onClose={() => setDrawer(null)}
          onRetry={() => {
            setRetryStoryId(drawer.storyId);
            setDrawer(null);
          }}
        />
      )}
    </div>
  );
}
