"use client";

// PUBLISH -- the final stage (READY -> PUBLISH -> público). Consumes
// GET /api/artifacts?status=APPROVED|PUBLISHED and
// POST /api/artifacts/{id}/publish directly: no HTML generation, no
// writing to the public `news` table happens here -- see
// backend/app/infrastructure/publishing/legacy_news_publisher.py for
// where that real work happens. A published card's link is the real
// public URL (nexusnews.info/noticia/<slug>), not a placeholder.

import { useCallback, useEffect, useState } from "react";
import { CalendarClock, CalendarX, RefreshCw, ExternalLink, Send, X } from "lucide-react";
import { toast } from "sonner";
import { apiUrl } from "@/studio/lab/api-client";
import ArtifactRow from "./ArtifactRow";
import Select from "@/components/ui/Select";

interface SeoMetadata {
  seoTitle: string;
  seoDescription: string;
  slug: string;
}

interface Artifact {
  id: string;
  storyId: string;
  version: number;
  status: "APPROVED" | "SCHEDULED" | "PUBLISHED" | string;
  title: string;
  subtitle: string | null;
  excerpt: string;
  seo: SeoMetadata;
  publishedNewsId: string | null;
  scheduledAt: string | null;
}

const STATUS_OPTIONS = [
  { value: "APPROVED", label: "Aprobados -- listos para publicar" },
  { value: "SCHEDULED", label: "Programados" },
  { value: "PUBLISHED", label: "Publicados" },
];

function localDateTimeValue(date: Date): string {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export default function PublishPanel() {
  const [statusFilter, setStatusFilter] = useState("APPROVED");
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [scheduleTarget, setScheduleTarget] = useState<Artifact | null>(null);
  const [scheduleValue, setScheduleValue] = useState("");

  const fetchArtifacts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiUrl(`/api/artifacts?status=${statusFilter}&limit=50`));
      if (!res.ok) {
        if (res.status === 503) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.message || "Tabla de artifacts no aprovisionada todavía");
        }
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      setArtifacts(data.artifacts ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar Publish");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchArtifacts();
  }, [fetchArtifacts]);

  const publish = async (artifactId: string) => {
    setBusy(artifactId);
    try {
      const res = await fetch(apiUrl(`/api/artifacts/${artifactId}/publish`), { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message || `HTTP ${res.status}`);
      }
      setArtifacts((prev) => prev.filter((a) => a.id !== artifactId));
      toast.success("Publicado -- ya está en nexusnews.info");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo publicar");
    } finally {
      setBusy(null);
    }
  };

  const schedule = async () => {
    if (!scheduleTarget) return;
    const timestamp = new Date(scheduleValue);
    if (!scheduleValue || Number.isNaN(timestamp.getTime()) || timestamp.getTime() <= Date.now()) {
      toast.error("Selecciona una fecha y hora futura");
      return;
    }

    setBusy(scheduleTarget.id);
    try {
      const res = await fetch(apiUrl(`/api/artifacts/${scheduleTarget.id}/schedule`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledAt: timestamp.toISOString() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail || body?.message || `HTTP ${res.status}`);
      }
      setArtifacts((prev) => prev.filter((artifact) => artifact.id !== scheduleTarget.id));
      setScheduleTarget(null);
      toast.success("Publicación programada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo programar la publicación");
    } finally {
      setBusy(null);
    }
  };

  const cancelSchedule = async (artifactId: string) => {
    setBusy(artifactId);
    try {
      const res = await fetch(apiUrl(`/api/artifacts/${artifactId}/schedule/cancel`), { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail || body?.message || `HTTP ${res.status}`);
      }
      setArtifacts((prev) => prev.filter((artifact) => artifact.id !== artifactId));
      toast.success("Programación cancelada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo cancelar la programación");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="relative">
      <div className="flex flex-wrap items-center gap-2 text-xs pb-3 border-b border-white/10">
        <Select className="w-[240px]" buttonClassName="!py-1.5 !text-xs" value={statusFilter} onChange={setStatusFilter} options={STATUS_OPTIONS} />
        <span className="text-neutral-600">{loading ? "…" : `${artifacts.length} resultado${artifacts.length === 1 ? "" : "s"}`}</span>
        <button onClick={fetchArtifacts} className="ml-auto flex items-center gap-1.5 text-neutral-500 hover:text-white px-2 py-1.5">
          <RefreshCw size={12} /> Actualizar
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-3 text-neutral-400 py-12 justify-center">
          <RefreshCw className="animate-spin" size={20} /> Cargando...
        </div>
      ) : error ? (
        <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl p-4 mt-3">{error}</div>
      ) : artifacts.length === 0 ? (
        <div className="text-neutral-500 text-sm text-center py-12">
          No hay artifacts en estado &quot;{statusFilter}&quot;. {statusFilter === "APPROVED" && "Aprobá una revisión primero."}
        </div>
      ) : (
        <div className="divide-y divide-white/5">
          {artifacts.map((a) => (
            <ArtifactRow
              key={a.id}
              version={a.version}
              status={a.status}
              title={a.title}
              subtitle={a.subtitle}
              excerpt={a.excerpt}
              rightAction={
                a.status === "APPROVED" ? (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => publish(a.id)}
                      disabled={busy === a.id}
                      className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 disabled:opacity-50"
                    >
                      {busy === a.id ? <RefreshCw className="animate-spin" size={13} /> : <Send size={13} />}
                      Publicar
                    </button>
                    <button
                      onClick={() => {
                        setScheduleTarget(a);
                        setScheduleValue(localDateTimeValue(new Date(Date.now() + 60 * 60 * 1000)));
                      }}
                      disabled={busy === a.id}
                      className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-white/5 text-neutral-300 hover:bg-white/10 disabled:opacity-50"
                    >
                      <CalendarClock size={13} /> Programar
                    </button>
                  </div>
                ) : a.status === "SCHEDULED" ? (
                  <button
                    onClick={() => cancelSchedule(a.id)}
                    disabled={busy === a.id}
                    className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 disabled:opacity-50"
                  >
                    {busy === a.id ? <RefreshCw className="animate-spin" size={13} /> : <CalendarX size={13} />}
                    Cancelar
                  </button>
                ) : a.status === "PUBLISHED" ? (
                  <a
                    href={`https://www.nexusnews.info/noticia/${a.seo.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 text-xs text-blue-400 hover:underline px-2.5 py-1.5"
                  >
                    Ver <ExternalLink size={12} />
                  </a>
                ) : null
              }
            >
              {a.status === "SCHEDULED" && a.scheduledAt && (
                <p className="mt-1 text-[11px] text-amber-300/80">
                  Programado para {new Date(a.scheduledAt).toLocaleString("es-CO")}
                </p>
              )}
            </ArtifactRow>
          ))}
        </div>
      )}

      {scheduleTarget && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-xl border border-white/10 bg-neutral-950 p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-white">Programar publicación</h3>
                <p className="mt-1 text-xs text-neutral-400 line-clamp-2">{scheduleTarget.title}</p>
              </div>
              <button onClick={() => setScheduleTarget(null)} className="text-neutral-500 hover:text-white" aria-label="Cerrar">
                <X size={16} />
              </button>
            </div>
            <label className="mt-4 block text-xs text-neutral-400">
              Fecha y hora local
              <input
                type="datetime-local"
                min={localDateTimeValue(new Date())}
                value={scheduleValue}
                onChange={(event) => setScheduleValue(event.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-neutral-900 px-3 py-2 text-sm text-white outline-none focus:border-blue-400"
              />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setScheduleTarget(null)} className="rounded-lg px-3 py-2 text-xs text-neutral-400 hover:bg-white/5 hover:text-white">
                Volver
              </button>
              <button
                onClick={() => void schedule()}
                disabled={busy === scheduleTarget.id}
                className="flex items-center gap-1.5 rounded-lg bg-blue-500/15 px-3 py-2 text-xs font-semibold text-blue-300 hover:bg-blue-500/25 disabled:opacity-50"
              >
                {busy === scheduleTarget.id && <RefreshCw size={12} className="animate-spin" />}
                Programar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
