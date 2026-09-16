"use client";

// Discovery -- the FIRST PHASE of the Editorial flow (DISCOVERY ->
// ARTIFACT -> READY -> PUBLISH), not a module of its own. Consumes
// GET/POST /api/discovery/* directly: no scraping, no classification, no
// scoring happens in this component -- see backend/app/domain/discovery/
// for where that real work happens.

import { useCallback, useEffect, useRef, useState } from "react";
import { Compass, RefreshCw, Clock, Tag, Image as ImageIcon, ExternalLink, Check, X, Archive, ArrowRight, Eye } from "lucide-react";
import { toast } from "sonner";
import { apiUrl } from "@/studio/lab/api-client";
import ProviderPickerModal from "./ProviderPickerModal";
import ArtifactDrawer from "./ArtifactDrawer";

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

interface DiscoveryItem {
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
}

interface DiscoveryJob {
  id: string;
  status: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED";
  params: Record<string, unknown>;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  itemsFound: number | null;
  error: string | null;
}

interface Category {
  id: string;
  name: string;
}

interface CategoryGroup {
  id: string;
  name: string;
  categories: Category[];
}

const TIME_RANGES = [
  { label: "Todo", hours: null },
  { label: "Últimas 2 horas", hours: 2 },
  { label: "Últimas 6 horas", hours: 6 },
  { label: "Últimas 12 horas", hours: 12 },
  { label: "Últimas 24 horas", hours: 24 },
  { label: "Últimos 3 días", hours: 72 },
];

const SORT_OPTIONS = [
  { value: "discovered_at", label: "Más reciente" },
  { value: "freshness_score", label: "Más fresco" },
  { value: "impact_score", label: "Mayor impacto" },
  { value: "relevance_score", label: "Mayor relevancia" },
];

// "SENT_TO_EDITORIAL" is the real backend status name (kept as-is, tests
// already cover it) -- labeled "En Artifact" here since, inside this
// single Editorial space, that's what actually happens next: it becomes
// the seed of a Story that Artifact processes for real (see
// POST /api/artifacts/jobs, triggered right after this decision below).
const STATUS_LABEL: Record<string, string> = {
  DISCOVERED: "Descubierto", SELECTED: "Seleccionado", IGNORED: "Ignorado",
  ARCHIVED: "Archivado", SENT_TO_EDITORIAL: "En Artifact",
};

function ageLabel(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const hours = ms / 3_600_000;
  if (hours < 1) return `${Math.round(ms / 60_000)} min`;
  if (hours < 24) return `${hours.toFixed(1)} h`;
  return `${(hours / 24).toFixed(1)} d`;
}

function ScoreBadge({ label, value }: { label: string; value: number | null }) {
  if (value === null) {
    return <span className="text-[10px] text-neutral-600 px-2 py-0.5 rounded bg-white/5">{label}: N/A</span>;
  }
  const pct = Math.round(value * 100);
  const color = pct >= 66 ? "text-green-400 bg-green-500/10" : pct >= 33 ? "text-yellow-400 bg-yellow-500/10" : "text-red-400 bg-red-500/10";
  return <span className={`text-[10px] px-2 py-0.5 rounded ${color}`}>{label}: {pct}%</span>;
}

export default function DiscoveryPanel({ onAdvance }: { onAdvance?: () => void }) {
  const [items, setItems] = useState<DiscoveryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [categoryGroups, setCategoryGroups] = useState<CategoryGroup[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("DISCOVERED");
  const [sortBy, setSortBy] = useState<string>("discovered_at");
  const [timeRangeHours, setTimeRangeHours] = useState<number | null>(24);

  const [job, setJob] = useState<DiscoveryJob | null>(null);
  const [triggering, setTriggering] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [pickerForItem, setPickerForItem] = useState<string | null>(null);
  const [retryStoryId, setRetryStoryId] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<{ storyId: string; title: string } | null>(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ sort_by: sortBy, sort_dir: "desc", limit: "50" });
      if (categoryFilter) params.set("category_id", categoryFilter);
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(apiUrl(`/api/discovery/items?${params.toString()}`));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      let fetched: DiscoveryItem[] = data.items ?? [];
      if (timeRangeHours !== null) {
        const cutoff = Date.now() - timeRangeHours * 3_600_000;
        fetched = fetched.filter((i) => new Date(i.discoveredAt).getTime() >= cutoff);
      }
      setItems(fetched);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar Discovery");
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, statusFilter, sortBy, timeRangeHours]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(apiUrl("/api/categories"));
        if (res.ok) setCategoryGroups((await res.json()).groups ?? []);
      } catch {
        // Category filter just stays empty -- not fatal for the rest of the page.
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

  const handleDiscoveryUp = async () => {
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
      toast.success("Discovery Up -- Automation está buscando contenido real");

      pollRef.current = setInterval(async () => {
        const r = await fetch(apiUrl(`/api/discovery/jobs/${created.id}`));
        if (!r.ok) return;
        const updated: DiscoveryJob = await r.json();
        setJob(updated);
        if (updated.status === "COMPLETED" || updated.status === "FAILED") {
          stopPolling();
          setTriggering(false);
          if (updated.status === "COMPLETED") {
            toast.success(`Discovery completado -- ${updated.itemsFound ?? 0} items nuevos`);
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
      setItems((prev) => prev.filter((i) => i.id !== itemId)); // moved out of the current status filter
      toast.success("Actualizado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo actualizar el item");
    }
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
      setItems((prev) => prev.filter((i) => i.id !== itemId));

      if (updated.storyId) {
        // Artifact runs as a real async job (LLM call, 10-60+s) --
        // trigger it now with the explicitly chosen provider.
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
      onAdvance?.();
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

  return (
    <div className="space-y-6">
      {/* Header / Discovery Up */}
      <div className="bg-white/5 p-6 rounded-3xl border border-white/10 backdrop-blur-md flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-red-500/10 text-red-500 rounded-xl border border-red-500/20">
            <Compass size={24} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Discovery</h3>
            <p className="text-sm text-neutral-400">Buscar → Descubrir → Evaluar → Seleccionar</p>
          </div>
        </div>
        <button
          onClick={handleDiscoveryUp}
          disabled={triggering}
          className="flex items-center gap-2 bg-white text-black px-6 py-3 rounded-xl font-bold hover:bg-neutral-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {triggering ? <RefreshCw className="animate-spin" size={18} /> : <Compass size={18} />}
          {triggering ? `Discovery ${job?.status ?? "..."}` : "Discovery Up"}
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white/5 p-4 rounded-2xl border border-white/10 flex flex-wrap gap-3 items-center">
        <select value={timeRangeHours ?? ""} onChange={(e) => setTimeRangeHours(e.target.value ? Number(e.target.value) : null)}
          className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white">
          {TIME_RANGES.map((r) => <option key={r.label} value={r.hours ?? ""}>{r.label}</option>)}
        </select>
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
          className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white">
          <option value="">Todas las categorías</option>
          {allTopics.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white">
          {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}
          className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white">
          {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <button onClick={fetchItems} className="ml-auto flex items-center gap-2 text-sm text-neutral-400 hover:text-white px-3 py-2">
          <RefreshCw size={14} /> Refrescar
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center gap-3 text-neutral-400 py-12 justify-center">
          <RefreshCw className="animate-spin" size={20} /> Cargando Discovery...
        </div>
      ) : error ? (
        <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl p-4">{error}</div>
      ) : items.length === 0 ? (
        <div className="text-neutral-500 text-sm text-center py-12">
          No hay items en este filtro. Probá &quot;Discovery Up&quot; o ajustá los filtros.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="bg-white/5 p-5 rounded-2xl border border-white/10 hover:border-white/20 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/10 text-neutral-300">
                      {STATUS_LABEL[item.status]}
                    </span>
                    <span className="text-[11px] text-neutral-500 flex items-center gap-1"><Clock size={11} /> {ageLabel(item.discoveredAt)}</span>
                    <span className="text-[11px] text-neutral-500">{item.sourceDomain}</span>
                  </div>
                  <h4 className="text-white font-semibold truncate">{item.originalTitle}</h4>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    {item.topics.map((t) => (
                      <span key={t} className="text-[10px] px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 flex items-center gap-1">
                        <Tag size={9} /> {t}
                      </span>
                    ))}
                    {item.materials.length > 0 ? (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 flex items-center gap-1">
                        <ImageIcon size={9} /> {item.materials.length} material{item.materials.length > 1 ? "es" : ""}
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-yellow-500/10 text-yellow-300">IMAGE REQUIRED</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <ScoreBadge label="Frescura" value={item.scores.freshnessScore} />
                    <ScoreBadge label="Completitud" value={item.scores.completenessScore} />
                    <ScoreBadge label="Material" value={item.scores.materialScore} />
                    <ScoreBadge label="Relevancia" value={item.scores.relevanceScore} />
                    <ScoreBadge label="Impacto" value={item.scores.impactScore} />
                  </div>
                </div>
                <a href={item.originalUrl} target="_blank" rel="noreferrer" className="text-neutral-500 hover:text-white flex-shrink-0">
                  <ExternalLink size={16} />
                </a>
              </div>

              {(item.status === "DISCOVERED" || item.status === "SELECTED") && (
                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-white/5">
                  {item.status === "DISCOVERED" && (
                    <button onClick={() => decide(item.id, "SELECT")}
                      className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20">
                      <Check size={13} /> Select
                    </button>
                  )}
                  {item.status === "SELECTED" && (
                    <button onClick={() => setPickerForItem(item.id)}
                      className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20">
                      <ArrowRight size={13} /> Procesar en Artifact
                    </button>
                  )}
                  <button onClick={() => decide(item.id, "IGNORE")}
                    className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-white/5 text-neutral-400 hover:bg-white/10">
                    <X size={13} /> Ignore
                  </button>
                  <button onClick={() => decide(item.id, "ARCHIVE")}
                    className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-white/5 text-neutral-400 hover:bg-white/10">
                    <Archive size={13} /> Archive
                  </button>
                </div>
              )}
              {item.status === "SENT_TO_EDITORIAL" && item.storyId && (
                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-white/5">
                  <button
                    onClick={() => setDrawer({ storyId: item.storyId!, title: item.originalTitle })}
                    className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-white/5 text-neutral-300 hover:bg-white/10"
                  >
                    <Eye size={13} /> Ver progreso de Artifact
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {pickerForItem && (
        <ProviderPickerModal
          onCancel={() => setPickerForItem(null)}
          onConfirm={(providerId) => confirmSendToEditorial(pickerForItem, providerId)}
        />
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
