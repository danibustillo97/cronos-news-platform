"use client";

// Evolución del Artifact section 6/7: the ONE real bridge between a
// <figure data-placeholder-id="..."> position marker inside content_html
// (the single source of truth for WHERE a body image sits in the
// document) and the real MediaRequirement data (prompt/asset/caption/
// alt) that describes it -- content_html never re-stores that data
// itself, so there is exactly one place each fact lives, never two.

import { createContext, useContext } from "react";
import type { MediaRequirement } from "./MediaRequirementBlock";

export interface EditorialImageContextValue {
  artifactId: string;
  mediaRequirements: MediaRequirement[];
  onMediaChanged: () => void;
}

export const EditorialImageContext = createContext<EditorialImageContextValue | null>(null);

export function useEditorialImageContext() {
  return useContext(EditorialImageContext);
}
