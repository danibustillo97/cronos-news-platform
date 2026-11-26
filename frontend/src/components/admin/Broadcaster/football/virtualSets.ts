// Virtual sets: a TV-studio background drawn in the browser (LED wall, floor,
// light beams) with glowing FRAMES where the cameras go. The compositor draws
// the cameras exactly inside those frames (layouts "set-*"), so the result looks
// like a real studio. Rects are fractions of the 1920x1080 frame.

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

export type SetTheme = "nexus" | "champions" | "betplay" | "libertadores";

const THEME: Record<SetTheme, { a: string; b: string; glow: string; label: string }> = {
  nexus: { a: "#0a0a0a", b: "#2a2205", glow: "#facc15", label: "NEXUS" },
  champions: { a: "#030820", b: "#0f2d86", glow: "#8fb3ff", label: "CHAMPIONS" },
  betplay: { a: "#0a0a0d", b: "#4a0a14", glow: "#ffd400", label: "LIGA BETPLAY" },
  libertadores: { a: "#0b0b0b", b: "#4d3a00", glow: "#f5c542", label: "LIBERTADORES" },
};

export async function drawVirtualSet(layout: SetLayout, theme: SetTheme = "nexus"): Promise<Blob> {
  const W = 1920;
  const H = 1080;
  const t = THEME[theme];
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  if (layout === "set-arena") { drawArena(ctx, W, H, t); return toPng(canvas); }

  // back wall
  const wall = ctx.createLinearGradient(0, 0, 0, H * 0.78);
  wall.addColorStop(0, t.a);
  wall.addColorStop(1, t.b);
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, W, H);

  // LED wall tiles
  ctx.save();
  for (let x = 0; x < W; x += 96) {
    for (let y = 0; y < H * 0.78; y += 96) {
      const glow = 0.04 + 0.05 * Math.abs(Math.sin(x * 0.013 + y * 0.021));
      ctx.fillStyle = `${t.glow}${Math.round(glow * 255).toString(16).padStart(2, "0")}`;
      ctx.fillRect(x + 3, y + 3, 90, 90);
    }
  }
  ctx.restore();

  // light beams
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const [cx, w] of [[0.18, 260], [0.5, 320], [0.82, 260]] as const) {
    const g = ctx.createLinearGradient(W * cx, 0, W * cx, H * 0.8);
    g.addColorStop(0, `${t.glow}33`);
    g.addColorStop(1, "transparent");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(W * cx - 30, 0);
    ctx.lineTo(W * cx + 30, 0);
    ctx.lineTo(W * cx + w, H * 0.8);
    ctx.lineTo(W * cx - w, H * 0.8);
    ctx.fill();
  }
  ctx.restore();

  // glossy floor
  const floor = ctx.createLinearGradient(0, H * 0.78, 0, H);
  floor.addColorStop(0, "#151515");
  floor.addColorStop(1, "#050505");
  ctx.fillStyle = floor;
  ctx.fillRect(0, H * 0.78, W, H * 0.22);
  ctx.fillStyle = t.glow;
  ctx.fillRect(0, H * 0.78, W, 4);
  ctx.globalAlpha = 0.18;
  ctx.fillRect(0, H * 0.78 + 4, W, 30);
  ctx.globalAlpha = 1;

  // watermark on the wall
  ctx.save();
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 180px 'Arial Black', Arial, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText(t.label, W - 50, H * 0.74);
  ctx.restore();

  // camera frames (glowing borders; the camera image is drawn inside by the compositor)
  for (const r of SET_RECTS[layout]) {
    const x = r.x * W;
    const y = r.y * H;
    const w = r.w * W;
    const h = r.h * H;
    ctx.save();
    ctx.shadowColor = t.glow;
    ctx.shadowBlur = 40;
    ctx.strokeStyle = t.glow;
    ctx.lineWidth = 6;
    ctx.strokeRect(x - 6, y - 6, w + 12, h + 12);
    ctx.restore();
    ctx.fillStyle = "#000000";
    ctx.fillRect(x, y, w, h);
  }

  // giant LED screen (no camera): a framed dark panel where the graphics sit
  if (layout === "set-wall") {
    const x = W * 0.06; const y = H * 0.07; const w = W * 0.88; const h = H * 0.66;
    ctx.save();
    ctx.shadowColor = t.glow; ctx.shadowBlur = 50;
    ctx.strokeStyle = t.glow; ctx.lineWidth = 5;
    ctx.strokeRect(x, y, w, h);
    ctx.restore();
    const panel = ctx.createLinearGradient(0, y, 0, y + h);
    panel.addColorStop(0, "rgba(6,8,14,.92)"); panel.addColorStop(1, "rgba(14,18,28,.92)");
    ctx.fillStyle = panel; ctx.fillRect(x, y, w, h);
    ctx.globalAlpha = 0.06; ctx.fillStyle = t.glow;
    for (let gx = x; gx < x + w; gx += 24) ctx.fillRect(gx, y, 1, h);
    ctx.globalAlpha = 1;
  }

  // desk for the analysis set
  if (layout === "set-desk") {
    ctx.fillStyle = "#111";
    ctx.beginPath();
    ctx.moveTo(W * 0.2, H * 0.62);
    ctx.lineTo(W * 0.8, H * 0.62);
    ctx.lineTo(W * 0.86, H * 0.78);
    ctx.lineTo(W * 0.14, H * 0.78);
    ctx.fill();
    ctx.fillStyle = t.glow;
    ctx.fillRect(W * 0.2, H * 0.62, W * 0.6, 5);
  }

  return toPng(canvas);
}

function toPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("canvas"))), "image/png"));
}

/** Night stadium: dark sky, floodlights, stands and a striped pitch in perspective. */
function drawArena(ctx: CanvasRenderingContext2D, W: number, H: number, t: { a: string; b: string; glow: string; label: string }) {
  const sky = ctx.createLinearGradient(0, 0, 0, H * 0.5);
  sky.addColorStop(0, "#02040a"); sky.addColorStop(1, t.b);
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
  // stands
  ctx.fillStyle = "#0b0d12";
  ctx.beginPath(); ctx.moveTo(0, H * 0.3); ctx.lineTo(W, H * 0.3); ctx.lineTo(W, H * 0.52); ctx.lineTo(0, H * 0.52); ctx.fill();
  for (let i = 0; i < 900; i += 1) {
    const x = (i * 137.5) % W; const y = H * 0.31 + ((i * 53) % Math.round(H * 0.2));
    ctx.fillStyle = `rgba(255,255,255,${0.04 + ((i * 7) % 10) / 120})`;
    ctx.fillRect(x, y, 3, 3);
  }
  // floodlights
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  for (const cx of [0.08, 0.92]) {
    const g = ctx.createRadialGradient(W * cx, H * 0.12, 4, W * cx, H * 0.12, 520);
    g.addColorStop(0, "rgba(255,255,240,.9)"); g.addColorStop(0.08, "rgba(255,255,230,.35)"); g.addColorStop(1, "transparent");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  ctx.restore();
  // pitch
  const top = H * 0.52;
  for (let i = 0; i < 10; i += 1) {
    const y0 = top + ((H - top) * (i / 10) ** 1.4); const y1 = top + ((H - top) * ((i + 1) / 10) ** 1.4);
    ctx.fillStyle = i % 2 ? "#1d5a26" : "#226b2d"; ctx.fillRect(0, y0, W, y1 - y0 + 1);
  }
  ctx.strokeStyle = "rgba(255,255,255,.55)"; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(W * 0.5, top); ctx.lineTo(W * 0.5, H); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(W * 0.5, H * 0.74, 300, 90, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = t.glow; ctx.fillRect(0, top - 6, W, 6);
  const vignette = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H);
  vignette.addColorStop(0, "transparent"); vignette.addColorStop(1, "rgba(0,0,0,.55)");
  ctx.fillStyle = vignette; ctx.fillRect(0, 0, W, H);
}
