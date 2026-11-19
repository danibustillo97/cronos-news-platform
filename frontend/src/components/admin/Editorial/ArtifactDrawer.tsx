"use client";

// The real Artifact drawer -- shows only what the backend actually
// reports (ArtifactJob's real status/timestamps/error, and once it
// exists, the real Artifact's validation results). There is no fake
// stage-by-stage progress animation: Artifact is a single real LLM call,
// not a multi-checkpoint pipeline the backend can report granularly on
// today. What IS real and shown here: the job's own state machine
// (QUEUED/RUNNING/REVIEW_REQUIRED/COMPLETED/FAILED), real timestamps, a
// real computed duration, and the Artifact's real validation issues
// (title/evidence/SEO/etc. checks -- see validate_artifact()) once one
// exists.

import { useEffect, useRef, useState } from "react";
import { X, RefreshCw, Clock, AlertTriangle, RotateCcw, Sliders } from "lucide-react";
import { apiUrl } from "@/studio/lab/api-client";
import StatusPill from "./StatusPill";
import { ARTIFACT_JOB_STATUS } from "./statusMeta";

interface ArtifactJob {
  id: string;
  storyId: string;
  status: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED" | "REVIEW_REQUIRED";
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  artifactId: string | null;
  error: string | null;
  provider: string | null;
  model: string | null;
}

interface ValidationIssue {
  check: string;
  detail: string;
}

interface Artifact {
  id: string;
  title: string;
  status: string;
  validationIssues: ValidationIssue[];
}

const PROVIDER_LABELS: Record<string, string> = { anthropic: "Anthropic", claude_code: "Claude Code" };

function duration(startedAt: string | null, finishedAt: string | null): string | null {
  if (!startedAt) return null;
  const end = finishedAt ? new Date(finishedAt).getTime() : Date.now();
  const seconds = Math.max(0, Math.round((end - new Date(startedAt).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

export default function ArtifactDrawer({
  storyId, title, onClose, onRetry,
}: {
  storyId: string;
  title: string;
  onClose: () => void;
  onRetry: () => void;
}) {
  const [job, setJob] = useState<ArtifactJob | null>(null);
  const [artifact, setArtifact] = useState<Artifact | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchJob = async () => {
      try {
        const res = await fetch(apiUrl(`/api/artifacts/jobs/by-story/${storyId}`));
        if (res.status === 404) {
          if (!cancelled) setNotFound(true);
          return;
        }
        if (!res.ok) return;
        const data: ArtifactJob = await res.json();
        if (cancelled) return;
        setJob(data);
        if (data.artifactId) {
          const artRes = await fetch(apiUrl(`/api/artifacts/${data.artifactId}`));
          if (artRes.ok && !cancelled) setArtifact(await artRes.json());
        }
        if (data.status !== "RUNNING" && data.status !== "QUEUED" && pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchJob();
    pollRef.current = setInterval(fetchJob, 3000);
    return () => {
      cancelled = true;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [storyId]);

  const meta = job ? ARTIFACT_JOB_STATUS[job.status] : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-stretch sm:justify-end bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md max-h-[85vh] sm:max-h-none sm:h-full bg-neutral-950 border-t sm:border-t-0 sm:border-l border-white/10 rounded-t-2xl sm:rounded-none p-5 space-y-5 overflow-y-auto"
      >
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-sm font-semibold text-white leading-snug">{title}</h3>
          <button onClick={onClose} className="text-neutral-500 hover:text-white flex-shrink-0">
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-neutral-400 text-sm py-8 justify-center">
            <RefreshCw className="animate-spin" size={16} /> Cargando...
          </div>
        ) : notFound || !job ? (
          <div className="text-sm text-neutral-500 py-8 text-center">
            No hay ningún job de Artifact todavía para este item.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-white/5 rounded-xl p-4 space-y-2 border border-white/10">
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-500">Proveedor</span>
                <span className="text-white font-medium">{job.provider ? PROVIDER_LABELS[job.provider] ?? job.provider : "—"}</span>
              </div>
              {job.model && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-neutral-500">Modelo</span>
                  <span className="text-neutral-300">{job.model}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-500">Estado</span>
                {meta && (
                  <span className="flex items-center gap-1.5">
                    {job.status === "RUNNING" && <RefreshCw size={10} className="animate-spin text-blue-400" />}
                    <StatusPill meta={meta} />
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-500">Iniciado</span>
                <span className="text-neutral-300">{job.startedAt ? new Date(job.startedAt).toLocaleTimeString() : "—"}</span>
              </div>
              {job.finishedAt && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-neutral-500">Finalizado</span>
                  <span className="text-neutral-300">{new Date(job.finishedAt).toLocaleTimeString()}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-500">Duración</span>
                <span className="text-neutral-300">{duration(job.startedAt, job.finishedAt) ?? "—"}</span>
              </div>
            </div>

            {job.status === "FAILED" && job.error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                <div className="text-[11px] font-semibold text-red-400 mb-1">Error</div>
                <p className="text-xs text-red-300">{job.error}</p>
              </div>
            )}

            {artifact && artifact.validationIssues.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-[11px] text-neutral-500 uppercase tracking-wider">Validación</div>
                {artifact.validationIssues.map((issue, idx) => (
                  <div key={idx} className="flex items-start gap-1.5 text-[11px] text-yellow-400 bg-yellow-500/10 rounded px-2 py-1.5">
                    <AlertTriangle size={11} className="mt-0.5 flex-shrink-0" />
                    <span><strong>{issue.check}:</strong> {issue.detail}</span>
                  </div>
                ))}
              </div>
            )}

            {artifact && job.status === "COMPLETED" && (
              <div className="text-xs text-green-400 bg-green-500/10 border border-green-500/20 rounded-xl p-3">
                Artifact creado -- &quot;{artifact.title}&quot;. Revisalo en la pestaña Revisión.
              </div>
            )}

            {(job.status === "FAILED" || job.status === "REVIEW_REQUIRED") && (
              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={onRetry}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-white/10 text-white hover:bg-white/20"
                >
                  <RotateCcw size={13} /> Reintentar
                </button>
                <button
                  onClick={onRetry}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-white/5 text-neutral-300 hover:bg-white/10"
                >
                  <Sliders size={13} /> Elegir proveedor
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
