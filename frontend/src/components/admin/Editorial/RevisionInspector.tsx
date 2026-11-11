"use client";

// Section 16-18 -- the right column, real state only: the Artifact job
// that produced this content, real validation warnings (translated,
// never a raw technical string), real evidence, editable real SEO
// fields, a real multimedia summary, and only the actions that actually
// exist. "Aprobar revisión" is disabled -- with a real reason shown --
// unless the backend's own VALIDATED gate is satisfied (never a
// client-side approximation of that rule).

import { useEffect, useState } from "react";
import {
  AlertOctagon, AlertTriangle, Check, CheckCircle2, ChevronDown, ImageIcon, Info,
  RotateCcw, Settings2, Sliders, Sparkles, ThumbsUp, Trash2,
} from "lucide-react";
import StatusPill from "./StatusPill";
import ClaimCard, { type Claim } from "./ClaimCard";
import { CLAIM_LABEL_DISPLAY } from "./ClaimResolutionSuggestion";
import SeoFixSuggestion from "./SeoFixSuggestion";
import SeoFixProposalCard from "./SeoFixProposalCard";
import { useSeoFixProposal } from "./useSeoFixProposal";
import { ARTIFACT_JOB_STATUS, ARTIFACT_STATUS } from "./statusMeta";
import { friendlyWarning } from "./warningMessages";
import type { MediaRequirement } from "./MediaRequirementBlock";

// The three real length-guideline WARNING checks validate_artifact
// produces (see backend/app/domain/artifact/validation.py) -- "Corregir
// con IA" fixes a real length problem, never an empty/missing field
// (that needs real new content, not a shortened rewrite).
const AI_FIXABLE_CHECKS = new Set(["title", "seo_title", "seo_description"]);

interface ValidationIssue { check: string; detail: string; severity?: "BLOCKING" | "WARNING"; }

interface ArtifactJob {
  id: string;
  status: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED" | "REVIEW_REQUIRED";
  provider: string | null;
  model: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
  validationOk?: boolean | null;
  validationIssueCount?: number | null;
}

export interface SeoDraft {
  seoTitle: string;
  seoDescription: string;
  slug: string;
  canonicalUrl: string;
}

const PROVIDER_LABELS: Record<string, string> = { anthropic: "Anthropic", claude_code: "Claude Code" };
const CONTEXT_LABELS = new Set(["VERIFIED_CONTEXT"]);
const SETTLED_LABELS = new Set(["SOURCE_FACT", "INFERENCE", "CREATIVE_FRAMING", "SOURCE_AVAILABILITY_CLAIM"]);

function duration(startedAt: string | null, finishedAt: string | null): string | null {
  if (!startedAt || !finishedAt) return null;
  const seconds = Math.max(0, Math.round((new Date(finishedAt).getTime() - new Date(startedAt).getTime()) / 1000));
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

type Tab = "inspector" | "historial";

export default function RevisionInspector({
  artifactId, status, job, jobHistory, validationIssues, claims, seoDraft, onSeoChange, mediaRequirements,
  onMarkClaimReviewed, onResolveClaim, onApprove, approving, onRetry, onChooseProvider, onArchive, archiving, onApplySeoFix,
}: {
  artifactId: string;
  status: string;
  job: ArtifactJob | null;
  jobHistory?: ArtifactJob[];
  validationIssues: ValidationIssue[];
  claims: Claim[];
  seoDraft: SeoDraft;
  onSeoChange: (patch: Partial<SeoDraft>) => void;
  mediaRequirements: MediaRequirement[];
  onMarkClaimReviewed: (claimId: string, reviewed: boolean) => void;
  onResolveClaim: (claimId: string, label: string, sourceUrls: string[]) => void;
  onApprove: () => void;
  approving: boolean;
  onRetry: () => void;
  onChooseProvider: () => void;
  onArchive: () => void;
  archiving: boolean;
  onApplySeoFix: (field: "title" | "seoTitle" | "seoDescription", value: string) => void;
}) {
  const [tab, setTab] = useState<Tab>("inspector");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [seoExpanded, setSeoExpanded] = useState(false);
  const [settledExpanded, setSettledExpanded] = useState(false);
  const [contextExpanded, setContextExpanded] = useState(false);

  const canApprove = status === "VALIDATED";
  const statusMeta = ARTIFACT_STATUS[status] ?? { label: status, tone: "neutral" as const };
  const blockingCount = validationIssues.filter((i) => (i.severity ?? "BLOCKING") === "BLOCKING").length;
  const warningCount = validationIssues.length - blockingCount;
  const priorAttempts = (jobHistory ?? []).filter((j) => j.id !== job?.id);
  const showStatusBanner = status === "REVIEW_REQUIRED" || status === "VALIDATED";

  const issueFor = (check: string) => validationIssues.find((i) => i.check === check) ?? null;
  const seoTitleIssue = issueFor("seo_title");
  const seoDescriptionIssue = issueFor("seo_description");
  const slugIssue = issueFor("slug");
  const seoChecklist = [
    { label: "Título SEO", ok: !seoTitleIssue },
    { label: "Meta description", ok: !seoDescriptionIssue },
    { label: "Slug", ok: !slugIssue },
    { label: "Canonical", ok: true }, // genuinely optional -- no real backend check exists for it, never invent one
  ];
  const seoAllOk = seoChecklist.every((c) => c.ok);

  const unresolvedClaims = claims.filter((c) => c.label === "UNVERIFIED" && !c.reviewed);
  const settledClaims = claims.filter((c) => SETTLED_LABELS.has(c.label) || (c.label === "UNVERIFIED" && c.reviewed));
  const contextClaims = claims.filter((c) => CONTEXT_LABELS.has(c.label));

  const featuredImage = mediaRequirements.find((m) => m.kind === "FEATURE_IMAGE") ?? null;
  const bodyMedia = mediaRequirements.filter((m) => m.kind === "BODY_IMAGE" || m.kind === "VIDEO");
  const bodyMediaPending = bodyMedia.filter((m) => !m.assetId).length;

  return (
    <div className="flex flex-col h-full text-[13px]">
      {/* TABS */}
      <div className="flex-shrink-0 flex items-center border-b border-white/10 px-2">
        {([
          { id: "inspector" as const, label: "Inspector" },
          { id: "historial" as const, label: "Historial" },
        ]).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-2.5 text-[12px] font-medium border-b-2 -mb-px transition-colors ${
              tab === t.id ? "border-red-500 text-white" : "border-transparent text-neutral-500 hover:text-neutral-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "historial" && (
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          <div className="text-[10.5px] font-semibold text-neutral-500 uppercase tracking-wide mb-1">Historial de intentos</div>
          {(jobHistory ?? []).length === 0 ? (
            <p className="text-[12px] text-neutral-600">Sin intentos registrados todavía.</p>
          ) : (
            [...(jobHistory ?? [])].sort((a, b) => (b.startedAt ?? "").localeCompare(a.startedAt ?? "")).map((j) => {
              const meta = ARTIFACT_JOB_STATUS[j.status] ?? { label: j.status, tone: "neutral" as const };
              return (
                <div key={j.id} className="rounded-lg border border-white/5 bg-white/[0.02] px-2.5 py-2 space-y-1">
                  <div className="flex items-center justify-between">
                    <StatusPill meta={meta} />
                    <span className="text-[11px] text-neutral-500">{duration(j.startedAt, j.finishedAt) ?? "—"}</span>
                  </div>
                  <div className="text-[11.5px] text-neutral-400">{j.provider ? PROVIDER_LABELS[j.provider] ?? j.provider : "—"}{j.model ? ` · ${j.model}` : ""}</div>
                  {j.validationIssueCount != null && (
                    <div className={`text-[11px] ${j.validationOk ? "text-neutral-500" : "text-amber-500/80"}`}>
                      {j.validationIssueCount} issue{j.validationIssueCount === 1 ? "" : "s"}
                    </div>
                  )}
                  {j.error && <div className="text-[11px] text-red-400 truncate">{j.error}</div>}
                </div>
              );
            })
          )}
        </div>
      )}

      {tab === "inspector" && (
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Section 15: answer "¿qué tengo que hacer?" at a glance -- a
              recommendation is never a reason to withhold approval. */}
          {showStatusBanner && (
            blockingCount === 0 ? (
              <div className="flex items-center gap-1.5 text-[12.5px] font-medium text-green-400 bg-green-500/10 rounded-lg px-2.5 py-2">
                <CheckCircle2 size={13} className="flex-shrink-0" />
                Listo para aprobar
                {warningCount > 0 && (
                  <span className="text-neutral-400 font-normal">· {warningCount} recomendación{warningCount === 1 ? "" : "es"} (no bloquea)</span>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-[12.5px] font-medium text-red-400 bg-red-500/10 rounded-lg px-2.5 py-2">
                <AlertOctagon size={13} className="flex-shrink-0" />
                {blockingCount} bloqueo{blockingCount === 1 ? "" : "s"} real{blockingCount === 1 ? "" : "es"}
              </div>
            )
          )}

          {/* ARTIFACT */}
          <section>
            <div className="text-[10.5px] font-semibold text-neutral-500 uppercase tracking-wide mb-2">Artifact</div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between"><span className="text-neutral-500">Estado</span><StatusPill meta={statusMeta} /></div>
              {job && (
                <>
                  <div className="flex items-center justify-between"><span className="text-neutral-500">Proveedor</span><span className="text-white">{job.provider ? PROVIDER_LABELS[job.provider] ?? job.provider : "—"}</span></div>
                  {job.model && <div className="flex items-center justify-between"><span className="text-neutral-500">Modelo</span><span className="text-neutral-300 truncate max-w-[140px]">{job.model}</span></div>}
                  <div className="flex items-center justify-between"><span className="text-neutral-500">Duración</span><span className="text-neutral-300">{duration(job.startedAt, job.finishedAt) ?? "—"}</span></div>
                </>
              )}
              {priorAttempts.length > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-neutral-500">Intentos</span>
                  <button onClick={() => setTab("historial")} className="text-blue-300 hover:text-blue-200">{priorAttempts.length + 1} · ver historial</button>
                </div>
              )}
            </div>
          </section>

          {/* VALIDACIÓN EDITORIAL */}
          <section>
            <div className="text-[10.5px] font-semibold text-neutral-500 uppercase tracking-wide mb-2">Validación editorial</div>
            <div className="space-y-1.5">
              {validationIssues.length === 0 && claims.length === 0 && (
                <div className="flex items-center gap-1.5 text-green-400 text-[12.5px]"><CheckCircle2 size={13} /> Todo en orden</div>
              )}

              {validationIssues.map((issue, idx) => {
                const w = friendlyWarning(issue.check, issue.detail);
                const blocking = (issue.severity ?? "BLOCKING") === "BLOCKING";
                const isEvidence = issue.check === "evidence" && unresolvedClaims.length > 0;
                return (
                  <div key={idx} className={`rounded-lg px-2.5 py-2 ${blocking ? "bg-red-500/10" : "bg-amber-500/10"}`}>
                    <div className="flex items-start gap-1.5 text-[12px]">
                      {blocking ? (
                        <AlertOctagon size={12} className="text-red-400 mt-0.5 flex-shrink-0" />
                      ) : (
                        <AlertTriangle size={12} className="text-amber-400 mt-0.5 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div>
                          <span className={blocking ? "text-red-300 font-medium" : "text-amber-300 font-medium"}>{w.title}</span>
                          {!blocking && <span className="text-[9.5px] text-neutral-500 ml-1.5">no bloquea aprobación</span>}
                        </div>
                        <p className="text-neutral-400 mt-0.5">{w.description}</p>
                        {!blocking && !isEvidence && AI_FIXABLE_CHECKS.has(issue.check) && (
                          <SeoFixSuggestion artifactId={artifactId} field={issue.check as "title" | "seo_title" | "seo_description"} onApply={onApplySeoFix} />
                        )}
                      </div>
                    </div>
                    {isEvidence && (
                      <div className="mt-2 space-y-1.5 pl-[19px]">
                        {unresolvedClaims.map((c) => (
                          <ClaimCard key={c.id} claim={c} artifactId={artifactId} onMarkReviewed={onMarkClaimReviewed} onResolveClaim={onResolveClaim} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {settledClaims.length > 0 && (
                <button onClick={() => setSettledExpanded((v) => !v)} className="w-full flex items-center gap-1.5 text-[12px] text-green-400 px-1 py-1">
                  <CheckCircle2 size={12} /> {settledClaims.length} verificado{settledClaims.length === 1 ? "" : "s"}
                  <ChevronDown size={12} className={`ml-auto text-neutral-600 transition-transform ${settledExpanded ? "rotate-180" : ""}`} />
                </button>
              )}
              {settledExpanded && (
                <div className="space-y-1 pl-1">
                  {settledClaims.map((c) => (
                    <div key={c.id} className="text-[11.5px] text-neutral-400 border-l border-white/10 pl-2">
                      <span className="text-neutral-600">{CLAIM_LABEL_DISPLAY[c.label] ?? c.label}: </span>&quot;{c.text}&quot;
                    </div>
                  ))}
                </div>
              )}

              {contextClaims.length > 0 && (
                <button onClick={() => setContextExpanded((v) => !v)} className="w-full flex items-center gap-1.5 text-[12px] text-blue-300 px-1 py-1">
                  <Info size={12} /> {contextClaims.length} contexto
                  <ChevronDown size={12} className={`ml-auto text-neutral-600 transition-transform ${contextExpanded ? "rotate-180" : ""}`} />
                </button>
              )}
              {contextExpanded && (
                <div className="space-y-1 pl-1">
                  {contextClaims.map((c) => (
                    <div key={c.id} className="text-[11.5px] text-neutral-400 border-l border-white/10 pl-2">&quot;{c.text}&quot;</div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* SEO Y METADATOS */}
          <section className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="text-[10.5px] font-semibold text-neutral-500 uppercase tracking-wide">SEO y metadatos</div>
              <button onClick={() => setSeoExpanded((v) => !v)} className="flex items-center gap-1 text-[11px] font-medium text-blue-300 hover:text-blue-200">
                <Settings2 size={11} /> Gestionar
              </button>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-neutral-400">Título SEO</span>
                <span className={`flex items-center gap-1 ${seoTitleIssue ? "text-amber-400" : "text-green-400"}`}>
                  {seoDraft.seoTitle.length} / 60 {seoTitleIssue ? <AlertTriangle size={10} /> : <Check size={10} />}
                </span>
              </div>
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-neutral-400">Meta descripción</span>
                <span className={`flex items-center gap-1 ${seoDescriptionIssue ? "text-amber-400" : "text-green-400"}`}>
                  {seoDraft.seoDescription.length} / 160 {seoDescriptionIssue ? <AlertTriangle size={10} /> : <Check size={10} />}
                </span>
              </div>
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-neutral-400">Slug</span>
                <span className={slugIssue ? "text-red-400" : "text-green-400"}>{slugIssue ? "Pendiente" : "✓"}</span>
              </div>
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-neutral-400">URL canónica</span>
                <span className="text-neutral-500">{seoDraft.canonicalUrl ? "✓" : "Opcional"}</span>
              </div>
            </div>

            {seoExpanded && (
              <div className="space-y-2.5 pt-2 border-t border-white/5">
                <div>
                  <input value={seoDraft.seoTitle} onChange={(e) => onSeoChange({ seoTitle: e.target.value })} placeholder="Título SEO"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-[12px] text-white" />
                  {seoTitleIssue && <SeoFixSuggestion artifactId={artifactId} field="seo_title" onApply={onApplySeoFix} />}
                </div>
                <div>
                  <textarea value={seoDraft.seoDescription} onChange={(e) => onSeoChange({ seoDescription: e.target.value })} rows={3} placeholder="Meta descripción"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-[12px] text-white resize-none" />
                  {seoDescriptionIssue && <SeoFixSuggestion artifactId={artifactId} field="seo_description" onApply={onApplySeoFix} />}
                </div>
                <input value={seoDraft.slug} onChange={(e) => onSeoChange({ slug: e.target.value })} placeholder="slug"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-[12px] text-white font-mono" />
                <input value={seoDraft.canonicalUrl} onChange={(e) => onSeoChange({ canonicalUrl: e.target.value })} placeholder="URL canónica (opcional)"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-[12px] text-white" />
              </div>
            )}

            {!seoAllOk && (
              <SeoOptimizeAll
                artifactId={artifactId}
                field={seoTitleIssue ? "seo_title" : "seo_description"}
                onApplySeoFix={onApplySeoFix}
              />
            )}
          </section>

          {/* MULTIMEDIA -- section 9/10: Featured vs Body are different
              real placements (MediaRequirement.kind), never one ambiguous
              count. */}
          <section className="space-y-2">
            <div className="text-[10.5px] font-semibold text-neutral-500 uppercase tracking-wide">Multimedia</div>
            <div className="flex items-center justify-between text-[12.5px]">
              <span className="flex items-center gap-1.5 text-neutral-400"><ImageIcon size={12} /> Imagen destacada</span>
              {featuredImage ? (
                featuredImage.assetId ? (
                  <span className="text-green-400">Configurada</span>
                ) : (
                  <span className="text-amber-400">Pendiente</span>
                )
              ) : (
                <span className="text-neutral-600">No declarada</span>
              )}
            </div>
            <div className="flex items-center justify-between text-[12.5px]">
              <span className="flex items-center gap-1.5 text-neutral-400"><ImageIcon size={12} /> Imágenes en el cuerpo</span>
              <span className={bodyMediaPending > 0 ? "text-amber-400" : "text-neutral-300"}>
                {bodyMedia.filter((m) => m.assetId).length}/{bodyMedia.length || 0}
              </span>
            </div>
          </section>

          {/* ACCIONES */}
          <section className="space-y-2 pt-2 border-t border-white/10">
            <div className="text-[10.5px] font-semibold text-neutral-500 uppercase tracking-wide mb-1">Acciones</div>
            <div className="flex items-center gap-1.5">
              <button onClick={onRetry}
                className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-white/5 text-neutral-300 hover:bg-white/10">
                <RotateCcw size={13} /> Reintentar Artifact
              </button>
              <button onClick={onChooseProvider} title="Elegir proveedor"
                className="flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-white/5 text-neutral-300 hover:bg-white/10">
                <Sliders size={13} />
              </button>
              {confirmingDelete ? (
                <>
                  <button
                    onClick={() => { setConfirmingDelete(false); onArchive(); }}
                    disabled={archiving}
                    className="flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/30 disabled:opacity-50"
                  >
                    <Trash2 size={13} /> Confirmar
                  </button>
                  <button onClick={() => setConfirmingDelete(false)} className="text-xs font-semibold px-2 py-2 rounded-lg bg-white/5 text-neutral-300 hover:bg-white/10">
                    Cancelar
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setConfirmingDelete(true)}
                  disabled={archiving}
                  className="flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-white/5 text-neutral-400 hover:text-red-300 hover:bg-red-500/10 disabled:opacity-50"
                >
                  <Trash2 size={13} /> Archivar
                </button>
              )}
            </div>

            <button
              onClick={onApprove}
              disabled={!canApprove || approving}
              title={canApprove ? undefined : "Corregí los bloqueos reales para poder aprobar"}
              className={`w-full flex flex-col items-center justify-center gap-0.5 text-sm font-bold px-4 py-2.5 rounded-lg transition-colors disabled:cursor-not-allowed ${
                canApprove ? "bg-white text-black hover:bg-neutral-200" : "bg-red-600/90 text-white opacity-90 disabled:opacity-90"
              }`}
            >
              <span className="flex items-center gap-2"><ThumbsUp size={14} /> Aprobar revisión</span>
              {!canApprove && <span className="text-[10.5px] font-normal opacity-90">{blockingCount} bloqueo{blockingCount === 1 ? "" : "s"} por corregir</span>}
            </button>
          </section>
        </div>
      )}
    </div>
  );
}

// "Optimizar SEO con IA" -- real, single Provider Control Plane call
// (same useSeoFixProposal hook as Título/SeoFixSuggestion, never a
// second mechanism) for whichever real SEO field currently has a
// WARNING (seo_title first, else seo_description).
function SeoOptimizeAll({
  artifactId, field, onApplySeoFix,
}: {
  artifactId: string;
  field: "seo_title" | "seo_description";
  onApplySeoFix: (field: "title" | "seoTitle" | "seoDescription", value: string) => void;
}) {
  const { state, request, reset } = useSeoFixProposal(artifactId, field);
  const [edited, setEdited] = useState("");

  useEffect(() => {
    if (state.kind === "ready") setEdited(state.proposal.value);
  }, [state]);

  if (state.kind === "idle") {
    return (
      <button
        onClick={() => request()}
        className="w-full flex items-center justify-center gap-1.5 text-[12px] font-bold px-3 py-2.5 rounded-lg bg-purple-500/20 text-purple-200 hover:bg-purple-500/30"
      >
        <Sparkles size={13} /> Optimizar SEO con IA
      </button>
    );
  }
  if (state.kind === "loading") {
    return (
      <div className="w-full flex items-center justify-center gap-1.5 text-[12px] text-neutral-400 px-3 py-2.5">
        <Sparkles size={13} className="animate-pulse" /> Generando propuesta...
      </div>
    );
  }
  if (state.kind === "error") {
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-1.5 text-[11px] text-red-400"><AlertTriangle size={11} /> {state.message}</div>
        <button onClick={() => request()} className="text-[11px] font-medium text-purple-300 hover:text-purple-200">Reintentar</button>
      </div>
    );
  }
  return (
    <SeoFixProposalCard
      proposal={state.proposal} edited={edited} onEditedChange={setEdited}
      onApply={() => { onApplySeoFix(field === "seo_title" ? "seoTitle" : "seoDescription", edited); reset(); setEdited(""); }}
      onDiscard={() => { reset(); setEdited(""); }}
    />
  );
}
