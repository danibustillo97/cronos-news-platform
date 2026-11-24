// Contrato compartido entre el portal público (lector) y el editor
// "Portada" del admin + backend (escritor) -- GET /api/portal/layout.
// Si el endpoint no existe o falla, el portal usa DEFAULT_LAYOUT y el
// comportamiento de siempre (destacada = la publicada más reciente).
// Validación/normalización del payload: lib/portalLayout.ts.

export type StageMode = "news" | "video" | "radio";
export interface PortalLayout {
  stage: {
    mode: StageMode;
    video?: { url: string; title: string; poster?: string | null };
    radio?: { url: string; title: string; logo?: string | null };
  };
  pinned: string[];   // news ids, in order; pinned[0] is the featured story on the stage
  hidden: string[];   // news ids the editor removed from the homepage
  updatedAt?: string | null;
}
export const DEFAULT_LAYOUT: PortalLayout = { stage: { mode: "news" }, pinned: [], hidden: [] };

// Mensajes postMessage del modo preview (?preview=1, dentro del iframe del admin).
export type PortalScrollTarget = "stage" | "feed" | "sports";
export const PORTAL_MSG_LAYOUT = "nexus:portal-layout";
export const PORTAL_MSG_READY = "nexus:portal-ready";
export const PORTAL_MSG_SCROLL = "nexus:portal-scroll-to";
