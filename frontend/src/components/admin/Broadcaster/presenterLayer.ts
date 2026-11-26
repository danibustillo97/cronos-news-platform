// Presenter layer (architecture for Noris, Phase 4 — no model is invented here).
// A 3D presenter will be rendered off-screen (React Three Fiber, alpha) by the
// presenter module and registered here as a drawable source. The compositor
// draws it between the cameras/background and the graphics, on Program and on
// Preview, so streaming and recording carry it without further changes.
// Until a real rigged noris.glb exists, nothing is registered and nothing is drawn.

export interface PresenterRect { x: number; y: number; w: number; h: number } // fractions of the 1920x1080 frame
export interface PresenterLayer { source: CanvasImageSource; rect: PresenterRect; /** "program" | "preview" | "both" */ bus: "program" | "preview" | "both" }

let layer: PresenterLayer | null = null;
export function setPresenterLayer(next: PresenterLayer | null) { layer = next; }
export function getPresenterLayer(): PresenterLayer | null { return layer; }

/** Draws the presenter (if any) for the given bus; keeps its aspect ratio inside the rect, feet on the bottom edge. */
export function drawPresenter(context: CanvasRenderingContext2D, width: number, height: number, bus: "program" | "preview") {
  const l = layer;
  if (!l || (l.bus !== "both" && l.bus !== bus)) return false;
  const src = l.source as { width?: number; height?: number };
  const sw = Number(src.width) || 1;
  const sh = Number(src.height) || 1;
  const box = { x: l.rect.x * width, y: l.rect.y * height, w: l.rect.w * width, h: l.rect.h * height };
  const scale = Math.min(box.w / sw, box.h / sh);
  const w = sw * scale;
  const h = sh * scale;
  context.drawImage(l.source, box.x + (box.w - w) / 2, box.y + box.h - h, w, h);
  return true;
}
