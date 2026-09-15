"use client";

// READY -- editorial content that Artifact (Phase 4) actually produced
// and that passed (or failed) real automated validation. Consumes
// GET/POST /api/artifacts/* directly: no generation, no validation logic
// lives here -- see backend/app/domain/artifact/ for where that happens.
// APPROVE here is the real, one-way human decision that makes an
// Artifact (and its Story) genuinely READY (Story.mark_produced()).

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, RefreshCw, AlertTriangle, ThumbsUp, ThumbsDown, ExternalLink, ImagePlus } from "lucide-react";
import { toast } from "sonner";
import { apiUrl } from "@/studio/lab/api-client";

interface SeoMetadata {
  seoTitle: string;
  seoDescription: string;
  slug: string;
  canonicalUrl: string | null;
}

interface SourceReference {
  sourceUrl: string;
  sourceName: string | null;
  sourceDomain: string;
}

interface ValidationIssue {
  check: string;
  detail: string;
}

interface MediaRequirement {
  placeholderId: string;
  kind: "FEATURE_IMAGE" | "BODY_IMAGE" | "VIDEO";
  prompt: string;
  assetId: string | null;
  assetUrl: string | null;
}

interface Artifact {
  id: string;
  storyId: string;
  version: number;
  status: "DRAFT" | "REVIEW_REQUIRED" | "VALIDATED" | "APPROVED" | "REJECTED";
  title: string;
  subtitle: string | null;
  excerpt: string;
  summary: string;
  contentHtml: string;
  categoryId: string | null;
  tags: string[];
  entities: string[];
  seo: SeoMetadata;
  sources: SourceReference[];
  mediaRequirements: MediaRequirement[];
  validationIssues: ValidationIssue[];
  editorialNotes: string | null;
  createdAt: string;
}

interface MediaGenerationJob {
  id: string;
  status: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED";
  error: string | null;
}

const STATUS_OPTIONS = [
  { value: "VALIDATED", label: "Validado -- listo para aprobar" },
  { value: "REVIEW_REQUIRED", label: "Requiere revisión" },
  { value: "APPROVED", label: "Aprobado (READY)" },
  { value: "REJECTED", label: "Rechazado" },
];

export default function ReadyPanel({ onAdvance }: { onAdvance?: () => void }) {
  const [statusFilter, setStatusFilter] = useState("VALIDATED");
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [generating, setGenerating] = useState<Record<string, boolean>>({});
  const pollRefs = useRef<Record<string, ReturnType<typeof setInterval>>>({});

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
      setError(err instanceof Error ? err.message : "No se pudo cargar Ready");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchArtifacts();
  }, [fetchArtifacts]);

  useEffect(() => {
    const refs = pollRefs.current;
    return () => {
      Object.values(refs).forEach(clearInterval);
    };
  }, []);

  const generateMedia = async (artifactId: string, placeholderId: string) => {
    const key = `${artifactId}:${placeholderId}`;
    setGenerating((prev) => ({ ...prev, [key]: true }));
    try {
      const res = await fetch(apiUrl(`/api/artifacts/${artifactId}/media/${placeholderId}/generate`), {
        method: "POST",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message || `HTTP ${res.status}`);
      }
      const job: MediaGenerationJob = await res.json();
      toast.success("Generando imagen real -- puede tardar unos segundos");

      pollRefs.current[key] = setInterval(async () => {
        const r = await fetch(apiUrl(`/api/artifacts/media/jobs/${job.id}`));
        if (!r.ok) return;
        const updated: MediaGenerationJob = await r.json();
        if (updated.status === "COMPLETED" || updated.status === "FAILED") {
          clearInterval(pollRefs.current[key]);
          delete pollRefs.current[key];
          setGenerating((prev) => ({ ...prev, [key]: false }));
          if (updated.status === "COMPLETED") {
            toast.success("Imagen generada");
            fetchArtifacts();
          } else {
            toast.error(`Generación falló: ${updated.error}`);
          }
        }
      }, 3000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo iniciar la generación");
      setGenerating((prev) => ({ ...prev, [key]: false }));
    }
  };

  const review = async (artifactId: string, decision: "APPROVE" | "REJECT") => {
    const reason = rejectReason[artifactId]?.trim();
    if (decision === "REJECT" && !reason) {
      toast.error("Indicá un motivo de rechazo");
      return;
    }
    setBusy(artifactId);
    try {
      const res = await fetch(apiUrl(`/api/artifacts/${artifactId}/review`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, reason: decision === "REJECT" ? reason : undefined }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message || `HTTP ${res.status}`);
      }
      setArtifacts((prev) => prev.filter((a) => a.id !== artifactId));
      if (decision === "APPROVE") {
        toast.success("Artifact aprobado -- Story marcada READY");
        onAdvance?.();
      } else {
        toast.success("Artifact rechazado");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo procesar la decisión");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white/5 p-6 rounded-3xl border border-white/10 backdrop-blur-md flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-green-500/10 text-green-500 rounded-xl border border-green-500/20">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Ready</h3>
            <p className="text-sm text-neutral-400">Artifact → Validación real → Aprobación humana</p>
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
          <RefreshCw className="animate-spin" size={20} /> Cargando Ready...
        </div>
      ) : error ? (
        <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl p-4">{error}</div>
      ) : artifacts.length === 0 ? (
        <div className="text-neutral-500 text-sm text-center py-12">
          No hay artifacts en estado &quot;{statusFilter}&quot;. Procesá un item en Discovery para generar uno nuevo.
        </div>
      ) : (
        <div className="space-y-3">
          {artifacts.map((a) => (
            <div key={a.id} className="bg-white/5 p-5 rounded-2xl border border-white/10 hover:border-white/20 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/10 text-neutral-300">
                      v{a.version} · {a.status}
                    </span>
                    {a.categoryId && (
                      <span className="text-[11px] text-neutral-500">categoría: {a.categoryId}</span>
                    )}
                  </div>
                  <h4 className="text-white font-semibold">{a.title}</h4>
                  {a.subtitle && <p className="text-sm text-neutral-400 mt-0.5">{a.subtitle}</p>}
                  <p className="text-sm text-neutral-500 mt-2 line-clamp-2">{a.excerpt}</p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {a.tags.map((t) => (
                      <span key={t} className="text-[10px] px-2 py-0.5 rounded bg-purple-500/10 text-purple-300">{t}</span>
                    ))}
                  </div>
                  {a.validationIssues.length > 0 && (
                    <div className="mt-3 space-y-1">
                      {a.validationIssues.map((i, idx) => (
                        <div key={idx} className="flex items-start gap-1.5 text-[11px] text-yellow-400 bg-yellow-500/10 rounded px-2 py-1">
                          <AlertTriangle size={11} className="mt-0.5 flex-shrink-0" />
                          <span><strong>{i.check}:</strong> {i.detail}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={() => setExpanded(expanded === a.id ? null : a.id)}
                    className="text-xs text-neutral-500 hover:text-white mt-3"
                  >
                    {expanded === a.id ? "Ocultar contenido" : "Ver contenido completo"}
                  </button>
                  {expanded === a.id && (
                    <div className="mt-3 space-y-3">
                      <div
                        className="prose prose-invert prose-sm max-w-none bg-black/30 rounded-xl p-4 border border-white/5"
                        dangerouslySetInnerHTML={{ __html: a.contentHtml }}
                      />
                      <div className="text-[11px] text-neutral-500 space-y-1">
                        <div><strong>SEO:</strong> {a.seo.seoTitle} -- {a.seo.seoDescription} ({a.seo.slug})</div>
                        <div className="flex flex-wrap gap-2">
                          <strong>Fuentes:</strong>
                          {a.sources.map((s) => (
                            <a key={s.sourceUrl} href={s.sourceUrl} target="_blank" rel="noreferrer"
                              className="flex items-center gap-1 text-blue-400 hover:underline">
                              {s.sourceName || s.sourceDomain} <ExternalLink size={10} />
                            </a>
                          ))}
                        </div>
                      </div>
                      {a.mediaRequirements.length > 0 && (
                        <div className="space-y-2">
                          <div className="text-[11px] text-neutral-500 font-semibold">Multimedia</div>
                          {a.mediaRequirements.map((m) => {
                            const key = `${a.id}:${m.placeholderId}`;
                            return (
                              <div key={m.placeholderId} className="flex items-center gap-3 bg-black/30 rounded-xl p-3 border border-white/5">
                                {m.assetUrl ? (
                                  <img src={m.assetUrl} alt={m.placeholderId} className="w-20 h-20 object-cover rounded-lg flex-shrink-0" />
                                ) : (
                                  <div className="w-20 h-20 rounded-lg bg-white/5 flex items-center justify-center text-neutral-600 flex-shrink-0">
                                    <ImagePlus size={20} />
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <div className="text-[10px] uppercase tracking-wider text-neutral-500">{m.kind} -- {m.placeholderId}</div>
                                  <p className="text-xs text-neutral-400 line-clamp-2">{m.prompt}</p>
                                </div>
                                {!m.assetUrl && m.kind !== "VIDEO" && (
                                  <button
                                    onClick={() => generateMedia(a.id, m.placeholderId)}
                                    disabled={generating[key]}
                                    className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 disabled:opacity-50 flex-shrink-0"
                                  >
                                    {generating[key] ? <RefreshCw className="animate-spin" size={13} /> : <ImagePlus size={13} />}
                                    Generar imagen
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {(a.status === "VALIDATED" || a.status === "REVIEW_REQUIRED") && (
                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-white/5 flex-wrap">
                  {a.status === "VALIDATED" && (
                    <button
                      onClick={() => review(a.id, "APPROVE")}
                      disabled={busy === a.id}
                      className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 disabled:opacity-50"
                    >
                      <ThumbsUp size={13} /> Aprobar (READY)
                    </button>
                  )}
                  <input
                    type="text"
                    placeholder="Motivo de rechazo"
                    value={rejectReason[a.id] ?? ""}
                    onChange={(e) => setRejectReason((prev) => ({ ...prev, [a.id]: e.target.value }))}
                    className="bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white flex-1 min-w-[160px]"
                  />
                  <button
                    onClick={() => review(a.id, "REJECT")}
                    disabled={busy === a.id}
                    className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 disabled:opacity-50"
                  >
                    <ThumbsDown size={13} /> Rechazar
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
