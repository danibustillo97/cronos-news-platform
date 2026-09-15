"use client";

// PUBLISH -- the final stage (READY -> PUBLISH -> público). Consumes
// GET /api/artifacts?status=APPROVED|PUBLISHED and
// POST /api/artifacts/{id}/publish directly: no HTML generation, no
// writing to the public `news` table happens here -- see
// backend/app/infrastructure/publishing/legacy_news_publisher.py for
// where that real work happens. A published card's link is the real
// public URL (nexusnews.info/noticia/<slug>), not a placeholder.

import { useCallback, useEffect, useState } from "react";
import { Rocket, RefreshCw, ExternalLink, Send } from "lucide-react";
import { toast } from "sonner";
import { apiUrl } from "@/studio/lab/api-client";

interface SeoMetadata {
  seoTitle: string;
  seoDescription: string;
  slug: string;
}

interface Artifact {
  id: string;
  storyId: string;
  version: number;
  status: "APPROVED" | "PUBLISHED" | string;
  title: string;
  subtitle: string | null;
  excerpt: string;
  seo: SeoMetadata;
  publishedNewsId: string | null;
}

const STATUS_OPTIONS = [
  { value: "APPROVED", label: "Aprobados -- listos para publicar" },
  { value: "PUBLISHED", label: "Publicados" },
];

export default function PublishPanel() {
  const [statusFilter, setStatusFilter] = useState("APPROVED");
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

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

  return (
    <div className="space-y-6">
      <div className="bg-white/5 p-6 rounded-3xl border border-white/10 backdrop-blur-md flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-500/10 text-blue-500 rounded-xl border border-blue-500/20">
            <Rocket size={24} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Publish</h3>
            <p className="text-sm text-neutral-400">Ready → Aprobación humana → Publicación real</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
          >
            {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <button onClick={fetchArtifacts} className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white px-3 py-2">
            <RefreshCw size={14} /> Refrescar
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-3 text-neutral-400 py-12 justify-center">
          <RefreshCw className="animate-spin" size={20} /> Cargando Publish...
        </div>
      ) : error ? (
        <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl p-4">{error}</div>
      ) : artifacts.length === 0 ? (
        <div className="text-neutral-500 text-sm text-center py-12">
          No hay artifacts en estado &quot;{statusFilter}&quot;. {statusFilter === "APPROVED" && "Aprobá uno en Ready primero."}
        </div>
      ) : (
        <div className="space-y-3">
          {artifacts.map((a) => (
            <div key={a.id} className="bg-white/5 p-5 rounded-2xl border border-white/10 hover:border-white/20 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/10 text-neutral-300">
                    v{a.version} · {a.status}
                  </span>
                  <h4 className="text-white font-semibold mt-1">{a.title}</h4>
                  {a.subtitle && <p className="text-sm text-neutral-400 mt-0.5">{a.subtitle}</p>}
                  <p className="text-sm text-neutral-500 mt-2 line-clamp-2">{a.excerpt}</p>
                  {a.status === "PUBLISHED" && (
                    <a
                      href={`https://www.nexusnews.info/noticia/${a.seo.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 text-xs text-blue-400 hover:underline mt-3"
                    >
                      Ver en nexusnews.info <ExternalLink size={12} />
                    </a>
                  )}
                </div>
                {a.status === "APPROVED" && (
                  <button
                    onClick={() => publish(a.id)}
                    disabled={busy === a.id}
                    className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 disabled:opacity-50 flex-shrink-0"
                  >
                    {busy === a.id ? <RefreshCw className="animate-spin" size={13} /> : <Send size={13} />}
                    Publicar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
