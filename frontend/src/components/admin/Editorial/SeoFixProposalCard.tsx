"use client";

// Shared preview card for a real SeoFixProposal -- used both by
// SeoFixSuggestion (a single "Corregir con IA" trigger) and by the
// Título section's "+ Más impacto/+ Más corto/+ Alternativas" chips
// (multiple triggers, one shared preview). One real UI, never
// duplicated per caller.

import { Check, X } from "lucide-react";
import type { SeoFixProposal } from "./useSeoFixProposal";

export default function SeoFixProposalCard({
  proposal, edited, onEditedChange, onApply, onDiscard,
}: {
  proposal: SeoFixProposal;
  edited: string;
  onEditedChange: (value: string) => void;
  onApply: () => void;
  onDiscard: () => void;
}) {
  const length = edited.length;
  const withinBounds = length <= proposal.maxLength && (proposal.minLength == null || length >= proposal.minLength);

  return (
    <div className="mt-1.5 rounded-lg border border-blue-500/20 bg-blue-500/[0.06] p-2 space-y-1.5">
      <div className="text-[9.5px] font-semibold text-blue-300 uppercase tracking-wide">Propuesta IA</div>
      <textarea
        value={edited} onChange={(e) => onEditedChange(e.target.value)} rows={2}
        className="w-full bg-black/20 border border-white/10 rounded-md px-2 py-1 text-[12px] text-white resize-none"
      />
      <div className={`text-[10px] ${withinBounds ? "text-neutral-500" : "text-amber-400"}`}>
        {length} {proposal.minLength != null ? `/ ${proposal.minLength}-${proposal.maxLength}` : `/ ${proposal.maxLength}`} caracteres
      </div>
      {proposal.reason && <p className="text-[11px] text-neutral-400">{proposal.reason}</p>}
      <div className="flex items-center gap-1.5 pt-0.5">
        <button
          onClick={onApply}
          className="flex-1 flex items-center justify-center gap-1 text-[11px] font-semibold px-2 py-1.5 rounded-md bg-blue-500/20 text-blue-200 hover:bg-blue-500/30"
        >
          <Check size={11} /> Aplicar propuesta
        </button>
        <button onClick={onDiscard} className="flex items-center justify-center gap-1 text-[11px] text-neutral-400 hover:text-white px-2 py-1.5">
          <X size={11} /> Descartar
        </button>
      </div>
    </div>
  );
}
