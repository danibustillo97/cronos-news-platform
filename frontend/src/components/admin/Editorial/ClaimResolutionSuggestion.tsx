"use client";

// Revisión 2.0 sections 1/2/4 -- the real "Resolver con IA" for a claim.
// Re-examines it against the SAME real source material Artifact
// generated from (POST /{artifactId}/claims/{claimId}/resolve, see
// backend ProposeClaimResolution) -- never a web search, no such real
// infrastructure exists here. Returns a PROPOSAL only; accepting it
// reuses the existing POST .../review (MarkClaimReviewed), never a
// parallel write path.

import { useState } from "react";
import { AlertCircle, Check, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { apiUrl } from "@/studio/lab/api-client";

interface Proposal {
  claimId: string;
  label: string;
  reason: string;
  sourceUrls: string[];
  provider: string;
  model: string | null;
}

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; proposal: Proposal }
  | { kind: "error"; message: string };

export const CLAIM_LABEL_DISPLAY: Record<string, string> = {
  SOURCE_FACT: "Hecho verificado",
  VERIFIED_CONTEXT: "Contexto verificado",
  INFERENCE: "Inferencia",
  CREATIVE_FRAMING: "Encuadre editorial",
  UNVERIFIED: "Sin verificar",
  SOURCE_AVAILABILITY_CLAIM: "Info no disponible en la fuente",
};

export default function ClaimResolutionSuggestion({
  artifactId, claimId, onAccept,
}: {
  artifactId: string;
  claimId: string;
  onAccept: (label: string, sourceUrls: string[]) => void;
}) {
  const [state, setState] = useState<State>({ kind: "idle" });

  const requestResolution = async () => {
    setState({ kind: "loading" });
    try {
      const res = await fetch(apiUrl(`/api/artifacts/${artifactId}/claims/${claimId}/resolve`), { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail || body?.message || `HTTP ${res.status}`);
      }
      const proposal: Proposal = await res.json();
      setState({ kind: "ready", proposal });
    } catch (err) {
      setState({ kind: "error", message: err instanceof Error ? err.message : "No se pudo resolver automáticamente" });
    }
  };

  if (state.kind === "idle") {
    return (
      <button onClick={requestResolution} className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-blue-300 hover:text-blue-200">
        <Sparkles size={11} /> Resolver con IA
      </button>
    );
  }

  if (state.kind === "loading") {
    return (
      <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-neutral-400">
        <Sparkles size={11} className="animate-pulse" /> Investigando contra la fuente real...
      </div>
    );
  }

  if (state.kind === "error") {
    // Honest, not invented: no real search infrastructure exists here --
    // when the re-check itself fails, this genuinely needs a human.
    return (
      <div className="mt-1.5 space-y-1">
        <div className="flex items-center gap-1.5 text-[11px] text-red-400"><AlertCircle size={11} /> {state.message}</div>
        <p className="text-[10.5px] text-neutral-500">Requiere revisión manual -- no se pudo resolver automáticamente.</p>
      </div>
    );
  }

  const { proposal } = state;
  return (
    <div className="mt-1.5 rounded-lg border border-blue-500/20 bg-blue-500/[0.06] p-2 space-y-1.5">
      <div className="text-[9.5px] font-semibold text-blue-300 uppercase tracking-wide">Propuesta IA</div>
      <div className="text-[11.5px] font-medium text-white">{CLAIM_LABEL_DISPLAY[proposal.label] ?? proposal.label}</div>
      {proposal.reason && <p className="text-[11px] text-neutral-400">{proposal.reason}</p>}
      <div className="flex items-center gap-1.5 pt-0.5">
        <button
          onClick={() => { onAccept(proposal.label, proposal.sourceUrls); setState({ kind: "idle" }); toast.success("Resolución aplicada"); }}
          className="flex-1 flex items-center justify-center gap-1 text-[11px] font-semibold px-2 py-1.5 rounded-md bg-blue-500/20 text-blue-200 hover:bg-blue-500/30"
        >
          <Check size={11} /> Aceptar
        </button>
        <button onClick={() => setState({ kind: "idle" })} className="flex items-center justify-center gap-1 text-[11px] text-neutral-400 hover:text-white px-2 py-1.5">
          <X size={11} /> Descartar
        </button>
      </div>
    </div>
  );
}
