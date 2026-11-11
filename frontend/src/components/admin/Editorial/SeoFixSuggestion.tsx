"use client";

// Section 5's real "Corregir con IA" -- a real, single Provider Control
// Plane call (POST /{artifactId}/seo/suggest-fix, see backend
// ProposeSeoFix) that returns a PROPOSAL only. Nothing is persisted here:
// the editor reviews it, can edit the text before applying, and only
// [Aplicar propuesta] actually saves (via the parent's existing autosave
// path -- see RevisionWorkspace.onApplySeoFix) and re-validates. Never a
// second AI infrastructure, never an auto-applied "fix".

import { useEffect, useState } from "react";
import { AlertCircle, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useSeoFixProposal } from "./useSeoFixProposal";
import SeoFixProposalCard from "./SeoFixProposalCard";

type SeoFixField = "title" | "seo_title" | "seo_description";

const FIELD_TO_DRAFT_KEY: Record<SeoFixField, "title" | "seoTitle" | "seoDescription"> = {
  title: "title",
  seo_title: "seoTitle",
  seo_description: "seoDescription",
};

export default function SeoFixSuggestion({
  artifactId, field, onApply, triggerLabel = "Corregir con IA",
}: {
  artifactId: string;
  field: SeoFixField;
  onApply: (field: "title" | "seoTitle" | "seoDescription", value: string) => void;
  triggerLabel?: string;
}) {
  const { state, request, reset } = useSeoFixProposal(artifactId, field);
  const [edited, setEdited] = useState("");

  useEffect(() => {
    if (state.kind === "ready") setEdited(state.proposal.value);
  }, [state]);

  if (state.kind === "idle") {
    return (
      <button onClick={() => request()} className="mt-1 flex items-center gap-1 text-[11px] font-medium text-blue-300 hover:text-blue-200">
        <Sparkles size={11} /> {triggerLabel}
      </button>
    );
  }

  if (state.kind === "loading") {
    return (
      <div className="mt-1 flex items-center gap-1.5 text-[11px] text-neutral-400">
        <Sparkles size={11} className="animate-pulse" /> Generando propuesta...
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div className="mt-1.5 space-y-1">
        <div className="flex items-center gap-1.5 text-[11px] text-red-400"><AlertCircle size={11} /> {state.message}</div>
        <button onClick={() => request()} className="text-[11px] font-medium text-blue-300 hover:text-blue-200">Reintentar</button>
      </div>
    );
  }

  return (
    <SeoFixProposalCard
      proposal={state.proposal} edited={edited} onEditedChange={setEdited}
      onApply={() => { onApply(FIELD_TO_DRAFT_KEY[field], edited); reset(); toast.success("Propuesta aplicada"); }}
      onDiscard={reset}
    />
  );
}
