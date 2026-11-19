"use client";

// Shared real state machine behind every "Corregir con IA"/"Optimizar
// con IA"/"+ Más impacto"/"+ Más corto"/"+ Alternativas" trigger --
// ONE real backend call (POST /{artifactId}/seo/suggest-fix, see
// backend ProposeSeoFix), never a separate mechanism per button.

import { useState } from "react";
import { apiUrl } from "@/studio/lab/api-client";

export interface SeoFixProposal {
  field: string;
  value: string;
  reason: string;
  characterCount: number;
  minLength: number | null;
  maxLength: number;
  provider: string;
  model: string | null;
}

export type SeoFixState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; proposal: SeoFixProposal }
  | { kind: "error"; message: string };

export function useSeoFixProposal(artifactId: string, field: "title" | "seo_title" | "seo_description") {
  const [state, setState] = useState<SeoFixState>({ kind: "idle" });

  const request = async (instruction?: string) => {
    setState({ kind: "loading" });
    try {
      const res = await fetch(apiUrl(`/api/artifacts/${artifactId}/seo/suggest-fix`), {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field, ...(instruction ? { instruction } : {}) }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail || body?.message || `HTTP ${res.status}`);
      }
      const proposal: SeoFixProposal = await res.json();
      setState({ kind: "ready", proposal });
    } catch (err) {
      setState({ kind: "error", message: err instanceof Error ? err.message : "No se pudo generar una propuesta" });
    }
  };

  const reset = () => setState({ kind: "idle" });

  return { state, request, reset };
}
