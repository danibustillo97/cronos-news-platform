// Virtual sets: a TV-studio background drawn in the browser (light rig, LED
// wall with the theme's artwork, lit pillars, glossy floor in perspective) with
// bezel FRAMES where the cameras go. The compositor draws the cameras exactly
// inside those frames (layouts "set-*"). Rects are fractions of 1920x1080.

import { logoToDataUrl } from "./raster";

export type SetLayout = "set-left" | "set-center" | "set-duo" | "set-desk" | "set-wall" | "set-arena";
export interface FrameRect { x: number; y: number; w: number; h: number }

export const SET_RECTS: Record<SetLayout, FrameRect[]> = {
  "set-left": [{ x: 0.04, y: 0.14, w: 0.54, h: 0.6 }],
  "set-center": [{ x: 0.22, y: 0.1, w: 0.56, h: 0.6 }],
  "set-duo": [{ x: 0.04, y: 0.17, w: 0.44, h: 0.5 }, { x: 0.52, y: 0.17, w: 0.44, h: 0.5 }],
  "set-desk": [{ x: 0.3, y: 0.08, w: 0.4, h: 0.44 }],
  // without camera: the whole screen is for graphics
  "set-wall": [],
  "set-arena": [],
};

/** Camera frames in 1920x1080 pixels (+ a small margin): graphics must stay off them. */
export function cameraRects(layout: string | undefined, cameras: number, margin = 14) {
  const rects = layout && layout in SET_RECTS ? SET_RECTS[layout as SetLayout] : [];
  return rects.slice(0, Math.max(0, cameras)).map((r) => ({ x: r.x * 1920 - margin, y: r.y * 1080 - margin, w: r.w * 1920 + margin * 2, h: r.h * 1080 + margin * 2 }));
}

export interface VirtualSet { id: string; label: string; layout: SetLayout; hint: string; camera: boolean }

export const VIRTUAL_SETS: VirtualSet[] = [
  { id: "estudio-lateral", label: "Cámara al lado", layout: "set-left", hint: "Tu cámara a la izquierda, gráficos a la derecha", camera: true },
  { id: "estudio-central", label: "Cámara al centro", layout: "set-center", hint: "Cámara grande al centro, ticker abajo", camera: true },
  { id: "estudio-debate", label: "Debate 2 cámaras", layout: "set-duo", hint: "Dos invitados frente a frente", camera: true },
  { id: "estudio-mesa", label: "Mesa de análisis", layout: "set-desk", hint: "Cámara arriba, datos abajo", camera: true },
  { id: "pantalla-led", label: "Pantalla LED (sin cámara)", layout: "set-wall", hint: "Estudio con pantalla gigante para los datos", camera: false },
  { id: "estadio", label: "Estadio de noche (sin cámara)", layout: "set-arena", hint: "Grada, luces y cancha", camera: false },
];

export type SetTheme = "nexus" | "champions" | "betplay" | "libertadores" | "junior";
/** Bumped whenever the drawings change, so saved copies of old sets are not reused. */
export const SETS_VERSION = 3;

interface Theme { bg1: string; bg2: string; glow: string; metal: string; label: string; sub: string; crest?: string }
export const SET_THEMES: Record<SetTheme, Theme> = {
  nexus: { bg1: "#050505", bg2: "#2b2306", glow: "#facc15", metal: "#3a3a3a", label: "NEXUS", sub: "FÚTBOL EN VIVO" },
  champions: { bg1: "#01030f", bg2: "#0a1f6b", glow: "#9cc0ff", metal: "#c9d3e6", label: "CHAMPIONS NIGHT", sub: "NOCHE DE ESTRELLAS" },
  betplay: { bg1: "#070707", bg2: "#3d0710", glow: "#ffd400", metal: "#5a1a1a", label: "LIGA BETPLAY", sub: "FÚTBOL COLOMBIANO" },
  libertadores: { bg1: "#050505", bg2: "#3a2b00", glow: "#f5c542", metal: "#6b5414", label: "LIBERTADORES", sub: "LA GLORIA ETERNA" },
  junior: { bg1: "#000033", bg2: "#5c0000", glow: "#ff2a2a", metal: "#e8e8e8", label: "JUNIOR", sub: "CURRAMBA · EL TIBURÓN", crest: "https://a.espncdn.com/i/teamlogos/soccer/500/4815.png" },
};
export const SET_THEME_LABEL: Record<SetTheme, string> = { nexus: "NEXUS", champions: "Champions", betplay: "BetPlay", libertadores: "Libertadores", junior: "Junior" };

const W = 1920;
const H = 1080;
const FLOOR = 0.78;

const crestCache = new Map<string, HTMLImageElement>();
async function loadCrest(url: string): Promise<HTMLImageElement | null> {
  if (crestCache.has(url)) return crestCache.get(url)!;
  try {
    const data = await logoToDataUrl(url, 640);
    const img = new Image();
    img.src = data;
    await img.decode();
    crestCache.set(url, img);
    return img;
  } catch { return null; }
}

function rng(seed: number) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}
const alpha = (hex: string, a: number) => `${hex}${Math.round(Math.max(0, Math.min(1, a)) * 255).toString(16).padStart(2, "0")}`;

function star(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, rot = -Math.PI / 2) {
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const rr = i % 2 ? r * 0.42 : r;
    const a = rot + (i * Math.PI) / 5;
    ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  ctx.closePath();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** The theme's artwork on the back wall. */
function wallArt(ctx: CanvasRenderingContext2D, theme: SetTheme, t: Theme) {
  const top = H * FLOOR;
  const r = rng(7);
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, W, top); ctx.clip();
  if (theme === "champions") {
    for (let i = 0; i < 420; i += 1) { // starfield
      const x = r() * W; const y = r() * top; const s = r() * 2.4 + 0.4;
      ctx.fillStyle = `rgba(220,232,255,${0.15 + r() * 0.6})`;
      ctx.beginPath(); ctx.arc(x, y, s, 0, Math.PI * 2); ctx.fill();
    }
    // a big ring of stars glowing behind the set, with silver orbit lines
    const cx = W * 0.5; const cy = H * 0.36;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const halo = ctx.createRadialGradient(cx, cy, 20, cx, cy, 560);
    halo.addColorStop(0, "rgba(140,180,255,.35)"); halo.addColorStop(1, "transparent");
    ctx.fillStyle = halo; ctx.fillRect(0, 0, W, top);
    ctx.restore();
    ctx.strokeStyle = "rgba(200,215,255,.18)"; ctx.lineWidth = 2;
    for (const rad of [300, 380, 470]) { ctx.beginPath(); ctx.ellipse(cx, cy, rad * 1.5, rad * 0.55, -0.12, 0, Math.PI * 2); ctx.stroke(); }
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2;
      ctx.save();
      ctx.shadowColor = "#cfe0ff"; ctx.shadowBlur = 30;
      ctx.fillStyle = "rgba(235,242,255,.55)";
      star(ctx, cx + Math.cos(a) * 250, cy + Math.sin(a) * 250, 58, a);
      ctx.fill();
      ctx.restore();
    }
  } else if (theme === "junior") {
    // red & white stripes (rojiblanco), navy shade at the edges
    const stripe = 120;
    for (let x = -stripe; x < W + stripe; x += stripe * 2) {
      ctx.fillStyle = "rgba(200,0,0,.85)"; ctx.fillRect(x, 0, stripe, top);
      ctx.fillStyle = "rgba(245,245,245,.78)"; ctx.fillRect(x + stripe, 0, stripe, top);
    }
    const shade = ctx.createLinearGradient(0, 0, W, 0);
    shade.addColorStop(0, "rgba(0,0,60,.85)"); shade.addColorStop(0.25, "rgba(0,0,60,.25)"); shade.addColorStop(0.75, "rgba(0,0,60,.25)"); shade.addColorStop(1, "rgba(0,0,60,.85)");
    ctx.fillStyle = shade; ctx.fillRect(0, 0, W, top);
    const v = ctx.createLinearGradient(0, 0, 0, top);
    v.addColorStop(0, "rgba(0,0,40,.55)"); v.addColorStop(0.5, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(0,0,30,.6)");
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, top);
  } else if (theme === "betplay") {
    for (let i = -4; i < 14; i += 1) {
      const g = ctx.createLinearGradient(0, 0, W, top);
      g.addColorStop(0, alpha(i % 2 ? "#ffd400" : "#e11d2e", 0.1)); g.addColorStop(1, "transparent");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(i * 180, 0); ctx.lineTo(i * 180 + 90, 0); ctx.lineTo(i * 180 + 90 - 500, top); ctx.lineTo(i * 180 - 500, top); ctx.fill();
    }
  } else if (theme === "libertadores") {
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 28; i += 1) {
      const a = (i / 28) * Math.PI * 2;
      ctx.fillStyle = "rgba(245,197,66,.05)";
      ctx.beginPath(); ctx.moveTo(W / 2, H * 0.36);
      ctx.lineTo(W / 2 + Math.cos(a) * 1400, H * 0.36 + Math.sin(a) * 1400);
      ctx.lineTo(W / 2 + Math.cos(a + 0.07) * 1400, H * 0.36 + Math.sin(a + 0.07) * 1400);
      ctx.fill();
    }
    ctx.restore();
  } else {
    // NEXUS: hazard stripes + hex texture
    for (let x = -H; x < W; x += 90) {
      ctx.fillStyle = "rgba(250,204,21,.05)";
      ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x + 45, top); ctx.lineTo(x + 45 + top, 0); ctx.lineTo(x + top, 0); ctx.fill();
    }
  }
  // LED panel seams
  ctx.strokeStyle = "rgba(255,255,255,.035)"; ctx.lineWidth = 2;
  for (let x = 0; x < W; x += 160) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, top); ctx.stroke(); }
  for (let y = 0; y < top; y += 160) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  ctx.restore();
}

function rig(ctx: CanvasRenderingContext2D, t: Theme) {
  // overhead truss with spotlights
  const g = ctx.createLinearGradient(0, 0, 0, 46);
  g.addColorStop(0, "#020202"); g.addColorStop(1, "rgba(0,0,0,.2)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, 46);
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 9; i += 1) {
    const x = (W / 9) * (i + 0.5);
    ctx.fillStyle = "rgba(255,255,255,.9)"; ctx.beginPath(); ctx.arc(x, 22, 6, 0, Math.PI * 2); ctx.fill();
    const beam = ctx.createLinearGradient(x, 22, x, H * 0.7);
    beam.addColorStop(0, alpha(t.glow, 0.22)); beam.addColorStop(1, "transparent");
    ctx.fillStyle = beam;
    ctx.beginPath(); ctx.moveTo(x - 8, 22); ctx.lineTo(x + 8, 22); ctx.lineTo(x + 150, H * 0.7); ctx.lineTo(x - 150, H * 0.7); ctx.fill();
  }
  ctx.restore();
  // lit pillars at both sides
  for (const x of [26, W - 26 - 22]) {
    ctx.fillStyle = "#0a0a0a"; ctx.fillRect(x - 10, 46, 42, H * FLOOR - 46);
    ctx.save(); ctx.shadowColor = t.glow; ctx.shadowBlur = 36;
    ctx.fillStyle = t.glow; ctx.fillRect(x + 6, 70, 10, H * FLOOR - 100);
    ctx.restore();
  }
}

function floor(ctx: CanvasRenderingContext2D, t: Theme) {
  const top = H * FLOOR;
  const f = ctx.createLinearGradient(0, top, 0, H);
  f.addColorStop(0, "#1a1a1d"); f.addColorStop(1, "#030303");
  ctx.fillStyle = f; ctx.fillRect(0, top, W, H - top);
  // perspective lines to a vanishing point
  ctx.save();
  ctx.beginPath(); ctx.rect(0, top, W, H - top); ctx.clip();
  ctx.strokeStyle = "rgba(255,255,255,.06)"; ctx.lineWidth = 2;
  const vx = W / 2; const vy = H * 0.42;
  for (let i = -16; i <= 16; i += 1) { ctx.beginPath(); ctx.moveTo(vx, vy); ctx.lineTo(vx + i * 170, H); ctx.stroke(); }
  for (let k = 1; k < 7; k += 1) { const y = top + (H - top) * (k / 7) ** 1.6; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  // reflection of the wall light
  const refl = ctx.createLinearGradient(0, top, 0, H);
  refl.addColorStop(0, alpha(t.glow, 0.22)); refl.addColorStop(0.4, "transparent");
  ctx.fillStyle = refl; ctx.fillRect(0, top, W, H - top);
  ctx.restore();
  ctx.save(); ctx.shadowColor = t.glow; ctx.shadowBlur = 30;
  ctx.fillStyle = t.glow; ctx.fillRect(0, top - 3, W, 5);
  ctx.restore();
}

function bezel(ctx: CanvasRenderingContext2D, r: FrameRect, t: Theme) {
  const x = r.x * W; const y = r.y * H; const w = r.w * W; const h = r.h * H;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,.8)"; ctx.shadowBlur = 50; ctx.shadowOffsetY = 20;
  roundRect(ctx, x - 18, y - 18, w + 36, h + 36, 14);
  const metal = ctx.createLinearGradient(0, y - 18, 0, y + h + 18);
  metal.addColorStop(0, "#2a2d33"); metal.addColorStop(0.5, "#0c0d10"); metal.addColorStop(1, "#1c1e22");
  ctx.fillStyle = metal; ctx.fill();
  ctx.restore();
  ctx.save(); ctx.shadowColor = t.glow; ctx.shadowBlur = 26;
  ctx.strokeStyle = t.glow; ctx.lineWidth = 3;
  roundRect(ctx, x - 6, y - 6, w + 12, h + 12, 6); ctx.stroke();
  ctx.restore();
  // corner brackets
  ctx.strokeStyle = t.metal; ctx.lineWidth = 6;
  const c = 46;
  for (const [cx, cy, dx, dy] of [[x - 18, y - 18, 1, 1], [x + w + 18, y - 18, -1, 1], [x - 18, y + h + 18, 1, -1], [x + w + 18, y + h + 18, -1, -1]] as const) {
    ctx.beginPath(); ctx.moveTo(cx, cy + dy * c); ctx.lineTo(cx, cy); ctx.lineTo(cx + dx * c, cy); ctx.stroke();
  }
  ctx.fillStyle = "#000"; ctx.fillRect(x, y, w, h);
}

function brand(ctx: CanvasRenderingContext2D, t: Theme, x: number, y: number, size: number, align: CanvasTextAlign, maxWidth = W * 0.34) {
  ctx.save();
  ctx.font = `900 ${size}px 'Arial Black', 'Segoe UI', Arial, sans-serif`;
  const fit = Math.min(1, maxWidth / Math.max(1, ctx.measureText(t.label).width));
  size = Math.floor(size * fit);
  ctx.textAlign = align;
  ctx.shadowColor = alpha(t.glow, 0.8); ctx.shadowBlur = 24;
  ctx.fillStyle = "rgba(255,255,255,.92)";
  ctx.font = `900 ${size}px 'Arial Black', 'Segoe UI', Arial, sans-serif`;
  ctx.fillText(t.label, x, y);
  ctx.shadowBlur = 0;
  ctx.fillStyle = alpha(t.glow, 0.95);
  ctx.font = `800 ${Math.round(size * 0.3)}px 'Segoe UI', Arial, sans-serif`;
  ctx.fillText(t.sub.split("").join(String.fromCharCode(8202)), x, y + size * 0.48);
  ctx.restore();
}

/** Where each layout has room for the crest / brand (outside the camera frames). */
const BRAND_SPOT: Record<SetLayout, { x: number; y: number; size: number; crest: number; align: CanvasTextAlign }> = {
  "set-left": { x: 0.79, y: 0.56, size: 74, crest: 290, align: "center" },
  "set-center": { x: 0.11, y: 0.5, size: 46, crest: 190, align: "center" },
  "set-duo": { x: 0.5, y: 0.1, size: 44, crest: 120, align: "center" },
  "set-desk": { x: 0.15, y: 0.42, size: 48, crest: 200, align: "center" },
  "set-wall": { x: 0.5, y: 0.9, size: 40, crest: 110, align: "center" },
  "set-arena": { x: 0.5, y: 0.255, size: 60, crest: 190, align: "center" },
};

export async function drawVirtualSet(layout: SetLayout, theme: SetTheme = "nexus"): Promise<Blob> {
  const t = SET_THEMES[theme];
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const crest = t.crest ? await loadCrest(t.crest) : null;
  const spot = BRAND_SPOT[layout];

  if (layout === "set-arena") {
    drawArena(ctx, t, theme);
  } else {
    const wall = ctx.createLinearGradient(0, 0, 0, H * FLOOR);
    wall.addColorStop(0, t.bg1); wall.addColorStop(1, t.bg2);
    ctx.fillStyle = wall; ctx.fillRect(0, 0, W, H);
    wallArt(ctx, theme, t);
    rig(ctx, t);
    floor(ctx, t);
  }

  // crest + brand where there is room
  const bx = spot.x * W; const by = spot.y * H;
  if (layout !== "set-wall" && layout !== "set-duo") {
    if (crest) {
      ctx.save(); ctx.shadowColor = "rgba(0,0,0,.7)"; ctx.shadowBlur = 40;
      const s = spot.crest;
      ctx.drawImage(crest, bx - s / 2, by - s - spot.size * 0.5, s, s);
      ctx.restore();
      brand(ctx, t, bx, by + spot.size * 0.55, spot.size, spot.align);
    } else {
      brand(ctx, t, bx, by, spot.size * 1.25, spot.align);
    }
  }

  // giant LED screen (no camera): a framed panel where the graphics sit
  if (layout === "set-wall") {
    const r = { x: 0.06, y: 0.07, w: 0.88, h: 0.66 };
    bezel(ctx, r, t);
    const x = r.x * W; const y = r.y * H; const w = r.w * W; const h = r.h * H;
    const panel = ctx.createLinearGradient(0, y, 0, y + h);
    panel.addColorStop(0, t.bg1); panel.addColorStop(1, t.bg2);
    ctx.fillStyle = panel; ctx.fillRect(x, y, w, h);
    ctx.save(); ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.translate(0, 0); wallArt(ctx, theme, t);
    ctx.restore();
    ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.fillRect(x, y, w, h);
    // brand on the floor strip
    if (crest) ctx.drawImage(crest, bx - 230 - 50, by - 62, 100, 100);
    brand(ctx, t, crest ? bx + 40 : bx, by, spot.size, "center");
  }

  // camera frames
  for (const r of SET_RECTS[layout]) bezel(ctx, r, t);
  if (layout === "set-duo") {
    if (crest) ctx.drawImage(crest, bx - 55, by - 70, 110, 110);
    else brand(ctx, t, bx, by + 10, spot.size, "center");
    // "VS" plate under the guests, on the floor line
    ctx.save();
    roundRect(ctx, W / 2 - 70, H * 0.705, 140, 64, 12);
    ctx.fillStyle = "#08090c"; ctx.fill();
    ctx.shadowColor = t.glow; ctx.shadowBlur = 24; ctx.strokeStyle = t.glow; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = t.glow; ctx.font = "900 44px 'Arial Black', Arial, sans-serif"; ctx.textAlign = "center";
    ctx.fillText("VS", W / 2, H * 0.705 + 48);
    ctx.restore();
  }

  // desk for the analysis set
  if (layout === "set-desk") {
    const g = ctx.createLinearGradient(0, H * 0.6, 0, H * 0.8);
    g.addColorStop(0, "#1b1d22"); g.addColorStop(1, "#08090b");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(W * 0.18, H * 0.6); ctx.quadraticCurveTo(W * 0.5, H * 0.55, W * 0.82, H * 0.6);
    ctx.lineTo(W * 0.88, H * 0.8); ctx.quadraticCurveTo(W * 0.5, H * 0.74, W * 0.12, H * 0.8);
    ctx.closePath(); ctx.fill();
    ctx.save(); ctx.shadowColor = t.glow; ctx.shadowBlur = 24; ctx.strokeStyle = t.glow; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(W * 0.18, H * 0.6); ctx.quadraticCurveTo(W * 0.5, H * 0.55, W * 0.82, H * 0.6); ctx.stroke();
    ctx.restore();
    ctx.fillStyle = "rgba(255,255,255,.85)"; ctx.font = "900 40px 'Arial Black', Arial, sans-serif"; ctx.textAlign = "center";
    ctx.fillText(t.label, W / 2, H * 0.7);
  }

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("canvas"))), "image/png"));
}

/** Night stadium: themed sky, floodlights, packed stands and a striped pitch in perspective. */
function drawArena(ctx: CanvasRenderingContext2D, t: Theme, theme: SetTheme) {
  const sky = ctx.createLinearGradient(0, 0, 0, H * 0.5);
  sky.addColorStop(0, "#01020a"); sky.addColorStop(1, t.bg2);
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
  if (theme === "champions") {
    const r = rng(3);
    for (let i = 0; i < 200; i += 1) { ctx.fillStyle = `rgba(220,232,255,${0.2 + r() * 0.6})`; ctx.fillRect(r() * W, r() * H * 0.28, 2, 2); }
  }
  // stands with the crowd (in junior: red & white crowd)
  ctx.fillStyle = "#0b0d12";
  ctx.beginPath(); ctx.moveTo(0, H * 0.28); ctx.quadraticCurveTo(W / 2, H * 0.24, W, H * 0.28); ctx.lineTo(W, H * 0.53); ctx.lineTo(0, H * 0.53); ctx.fill();
  const r = rng(11);
  for (let i = 0; i < 2600; i += 1) {
    const x = r() * W; const y = H * 0.29 + r() * H * 0.23;
    const pick = r();
    ctx.fillStyle = theme === "junior" ? (pick < 0.45 ? "rgba(220,20,20,.55)" : pick < 0.8 ? "rgba(255,255,255,.45)" : "rgba(30,40,140,.5)")
      : `rgba(255,255,255,${0.04 + pick * 0.12})`;
    ctx.fillRect(x, y, 3, 3);
  }
  // advertising boards with the theme colour
  ctx.save(); ctx.shadowColor = t.glow; ctx.shadowBlur = 20;
  ctx.fillStyle = alpha(t.glow, 0.85); ctx.fillRect(0, H * 0.505, W, 22);
  ctx.restore();
  ctx.fillStyle = "rgba(0,0,0,.55)"; ctx.font = "900 18px 'Arial Black', Arial"; ctx.textAlign = "center";
  for (let x = 160; x < W; x += 420) ctx.fillText(`${t.label} · NEXUS`, x, H * 0.505 + 17);
  // floodlights
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  for (const cx of [0.07, 0.93]) {
    const g = ctx.createRadialGradient(W * cx, H * 0.1, 4, W * cx, H * 0.1, 560);
    g.addColorStop(0, "rgba(255,255,240,.95)"); g.addColorStop(0.07, "rgba(255,255,230,.35)"); g.addColorStop(1, "transparent");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  ctx.restore();
  // pitch
  const top = H * 0.53;
  for (let i = 0; i < 12; i += 1) {
    const y0 = top + (H - top) * (i / 12) ** 1.35; const y1 = top + (H - top) * ((i + 1) / 12) ** 1.35;
    ctx.fillStyle = i % 2 ? "#1c5a25" : "#21692c"; ctx.fillRect(0, y0, W, y1 - y0 + 1);
  }
  ctx.strokeStyle = "rgba(255,255,255,.6)"; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(W * 0.5, top); ctx.lineTo(W * 0.5, H); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(W * 0.5, H * 0.76, 320, 92, 0, 0, Math.PI * 2); ctx.stroke();
  const vignette = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H);
  vignette.addColorStop(0, "transparent"); vignette.addColorStop(1, "rgba(0,0,0,.6)");
  ctx.fillStyle = vignette; ctx.fillRect(0, 0, W, H);
}
