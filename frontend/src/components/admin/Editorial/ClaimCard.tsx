"use client";

// Section 11 -- one real claim (Artifact.claims, see backend
// app/domain/artifact/entities.py::Claim), shown as an actionable
// editorial unit, never a raw JSON dump. "Marcar como revisado" is a
// real, persisted per-claim flag (POST /claims/{id}/review) -- it does
// NOT change the claim's evidence label; only a real source upgrade or a
// new Artifact run does that.

import { useState } from "react";
import { AlertTriangle, Check, ExternalLink, Info } from "lucide-react";
import ClaimResolutionSuggestion from "./ClaimResolutionSuggestion";

export interface Claim {
  id: string;
  text: string;
  label: "SOURCE_FACT" | "VERIFIED_CONTEXT" | "INFERENCE" | "CREATIVE_FRAMING" | "UNVERIFIED" | "SOURCE_AVAILABILITY_CLAIM";
  sourceUrls: string[];
  reviewed: boolean;
}

const LABEL_META: Record<Claim["label"], { text: string; tone: string }> = {
  SOURCE_FACT: { text: "Hecho verificado", tone: "text-green-300 bg-green-500/10" },
  VERIFIED_CONTEXT: { text: "Contexto verificado", tone: "text-blue-300 bg-blue-500/10" },
  INFERENCE: { text: "Inferencia", tone: "text-neutral-300 bg-white/5" },
  CREATIVE_FRAMING: { text: "Encuadre editorial", tone: "text-purple-300 bg-purple-500/10" },
  UNVERIFIED: { text: "Sin verificar", tone: "text-amber-300 bg-amber-500/10" },
  // Revisión 2.0 section 2: an honest statement that the source doesn't
  // specify something -- NOT an unconfirmed fact, so it gets its own
  // neutral/informational treatment, never lumped in with "sin verificar".
  SOURCE_AVAILABILITY_CLAIM: { text: "Info no disponible en fuente", tone: "text-neutral-300 bg-blue-500/10" },
};

export default function ClaimCard({
  claim, artifactId, onMarkReviewed, onResolveClaim,
}: {
  claim: Claim;
  artifactId: string;
  onMarkReviewed: (claimId: string, reviewed: boolean) => void;
  onResolveClaim: (claimId: string, label: string, sourceUrls: string[]) => void;
}) {
  const [busy, setBusy] = useState(false);
  const meta = LABEL_META[claim.label];
  const needsAttention = claim.label === "UNVERIFIED" && !claim.reviewed;
  const isAvailabilityNote = claim.label === "SOURCE_AVAILABILITY_CLAIM";

  return (
    <div className={`rounded-lg p-2.5 border ${needsAttention ? "border-amber-500/30 bg-amber-500/[0.04]" : "border-white/5 bg-white/[0.02]"}`}>
      <div className="flex items-center gap-1.5 mb-1.5">
        {needsAttention && <AlertTriangle size={11} className="text-amber-400 flex-shrink-0" />}
        {isAvailabilityNote && <Info size={11} className="text-blue-300 flex-shrink-0" />}
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${meta.tone}`}>{meta.text}</span>
        {claim.reviewed && <span className="text-[10px] text-green-400 flex items-center gap-0.5"><Check size={10} /> Revisado</span>}
      </div>
      <p className="text-[12.5px] text-neutral-300 leading-snug">&quot;{claim.text}&quot;</p>
      {claim.sourceUrls.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-1.5">
          {claim.sourceUrls.map((url) => (
            <a key={url} href={url} target="_blank" rel="noreferrer"
              className="text-[10.5px] text-blue-400 hover:underline flex items-center gap-0.5 truncate max-w-[160px]">
              {new URL(url).hostname.replace(/^www\./, "")} <ExternalLink size={9} />
            </a>
          ))}
        </div>
      )}
      {/* SOURCE_AVAILABILITY_CLAIM is already a settled, accurate note --
          nothing to review or resolve (section 2). Only a genuinely
          UNVERIFIED claim gets manual/AI actions. */}
      {needsAttention && (
        <>
          <button
            disabled={busy}
            onClick={async () => { setBusy(true); await onMarkReviewed(claim.id, true); setBusy(false); }}
            className="mt-2 flex items-center gap-1 text-[11px] font-medium text-neutral-400 hover:text-white disabled:opacity-50"
          >
            <Check size={11} /> Marcar como revisado
          </button>
          <ClaimResolutionSuggestion
            artifactId={artifactId} claimId={claim.id}
            onAccept={(label, sourceUrls) => onResolveClaim(claim.id, label, sourceUrls)}
          />
        </>
      )}
    </div>
  );
}
