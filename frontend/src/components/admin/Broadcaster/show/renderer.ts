// Show renderer: the final 1920×1080 frame of the AI program = Virtual Studio (3D, or
// the 2D fallback) + on-air overlay (station bug, segment, lower third, captions).
// The compositor shows this canvas as a live backdrop of Program, so Preview/Program,
// TAKE, the other graphics and /broadcast/output keep working exactly as before.
// Frames are produced only when something changes (camera move, new screen, overlay).

import { startFrameClock } from "../frameClock";
import { drawOverlay, drawScreen, drawSide, setImageListener, type OverlayInfo, type SideInfo } from "./screens";
import { DEFAULT_LIGHTING, drawFallback, VirtualStudio, webglAvailable, type Lighting } from "./studio3d";
import type { LowerThird, Quality, ScreenContent, Shot, StageId } from "./types";

export interface RendererStats { mode: "3d" | "2d"; quality: Quality; framesPerSecond: number; error?: string }

export class ShowRenderer {
  readonly output: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private studio: VirtualStudio | null = null;
  private fb: { main: HTMLCanvasElement; left: HTMLCanvasElement; right: HTMLCanvasElement } | null = null;
  private screen: ScreenContent | null = null;
  private side: SideInfo = { label: "", clock: "", date: "", live: [] };
  private overlay: OverlayInfo = { lower: null, segment: "", clock: "" };
  private overlayDirty = true;
  private stop: (() => void) | null = null;
  private frames: number[] = [];
  private light: Lighting;
  error?: string;

  constructor(readonly quality: Quality = "MEDIUM", lighting: Lighting = DEFAULT_LIGHTING) {
    this.light = { ...lighting };
    this.output = document.createElement("canvas");
    this.output.width = 1920; this.output.height = 1080;
    this.ctx = this.output.getContext("2d")!;
    if (webglAvailable()) {
      try { this.studio = new VirtualStudio(quality, this.light); } catch (err) { this.error = err instanceof Error ? err.message : String(err); }
    }
    if (!this.studio) {
      const mk = (w: number, h: number) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };
      this.fb = { main: mk(1280, 720), left: mk(432, 576), right: mk(432, 576) };
    }
    setImageListener(() => this.redrawScreens());
    this.redrawScreens();
  }

  get mode(): "3d" | "2d" { return this.studio ? "3d" : "2d"; }
  private surfaces() { return this.studio ?? this.fb!; }

  start() {
    if (this.stop) return;
    this.stop = startFrameClock(33, (now) => this.tick(now));
  }

  private tick(now: number) {
    const rendered = this.studio ? this.studio.tick(now) : false;
    if (!rendered && !this.overlayDirty) return;
    if (this.studio) this.ctx.drawImage(this.studio.canvas, 0, 0, 1920, 1080);
    else { const f = this.fb!; drawFallback(this.ctx, f.main, f.left, f.right, this.light); }
    drawOverlay(this.ctx, this.overlay);
    this.overlayDirty = false;
    this.frames.push(now);
    if (this.frames.length > 60) this.frames.shift();
  }

  stats(): RendererStats {
    const f = this.frames, now = performance.now();
    const recent = f.filter((t) => now - t < 2000);
    return { mode: this.mode, quality: this.quality, framesPerSecond: Math.round(recent.length / 2), error: this.error };
  }

  private redrawScreens() {
    const s = this.surfaces();
    drawScreen(s.main.getContext("2d")!, s.main.width, s.main.height, this.screen);
    drawSide(s.left.getContext("2d")!, s.left.width, s.left.height, "left", this.side);
    drawSide(s.right.getContext("2d")!, s.right.width, s.right.height, "right", this.side);
    this.studio?.touch("all");
    this.overlayDirty = true;
  }

  setScreen(c: ScreenContent | null) {
    this.screen = c;
    const s = this.surfaces();
    drawScreen(s.main.getContext("2d")!, s.main.width, s.main.height, c);
    this.studio?.touch("main");
    this.overlayDirty = true;
  }

  setSide(info: SideInfo) {
    const same = JSON.stringify(info) === JSON.stringify(this.side);
    if (same) return;
    this.side = info;
    const s = this.surfaces();
    drawSide(s.left.getContext("2d")!, s.left.width, s.left.height, "left", info);
    drawSide(s.right.getContext("2d")!, s.right.width, s.right.height, "right", info);
    this.studio?.touch("left"); this.studio?.touch("right");
    this.overlayDirty = true;
  }

  setOverlay(patch: Partial<OverlayInfo>) {
    const next = { ...this.overlay, ...patch };
    if (JSON.stringify(next) === JSON.stringify(this.overlay)) return;
    this.overlay = next;
    this.overlayDirty = true;
  }

  /** A lower third that would repeat what the LED already shows becomes a small source tag. */
  setLower(lower: LowerThird | null) {
    const repeats = Boolean(lower && this.screen && ["result", "stats", "table", "fixtures", "numbers", "poll", "title", "closing"].includes(this.screen.type));
    this.setOverlay(repeats ? { lower: null, source: lower?.source } : { lower, source: undefined });
  }
  setStage(stage: StageId, shot?: Shot) { this.studio?.setStage(stage, true, shot); this.overlayDirty = true; }
  setShot(shot: Shot, ms?: number) { this.studio?.setShot(shot, ms); }
  /** Operator lighting, applied live. */
  setLighting(patch: Partial<Lighting>) { this.light = { ...this.light, ...patch }; this.studio?.setLighting(patch); this.overlayDirty = true; }

  dispose() {
    this.stop?.(); this.stop = null;
    setImageListener(() => undefined);
    this.studio?.dispose(); this.studio = null;
  }
}
