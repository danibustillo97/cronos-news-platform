import type { FootballScoreboard, GraphicVariant } from "../graphicExport";

type Motion = "score" | "elite" | "goal" | "card" | "sub" | "void" | "var" | "panel";

const starts = new Map<string, { start: number; last: number }>();
const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
const easeOutBack = (t: number) => 1 + 2.4 * Math.pow(t - 1, 3) + 1.4 * Math.pow(t - 1, 2);
const easeOutBounce = (t: number) => {
  if (t < 1 / 2.75) return 7.5625 * t * t;
  if (t < 2 / 2.75) { const u = t - 1.5 / 2.75; return 7.5625 * u * u + 0.75; }
  if (t < 2.5 / 2.75) { const u = t - 2.25 / 2.75; return 7.5625 * u * u + 0.9375; }
  const u = t - 2.625 / 2.75;
  return 7.5625 * u * u + 0.984375;
};

/** Milliseconds since the widget (re)appeared on a canvas; restarts after a gap so each take replays the entry. */
export function entryElapsed(key: string, now: number): number {
  let entry = starts.get(key);
  if (!entry || now - entry.last > 400) {
    entry = { start: now, last: now };
    starts.set(key, entry);
  }
  entry.last = now;
  return now - entry.start;
}

export const EXIT_MS = 380;

export function motionFor(variant: GraphicVariant | undefined, highlight: FootballScoreboard["highlight"]): Motion {
  switch (variant) {
    case "elite": return "elite";
    case "compact": case "editorial": case "live": return "score";
    case "goal": return "goal";
    case "var": return "var";
    case "events":
      if (highlight?.kind === "yellow" || highlight?.kind === "red") return "card";
      if (highlight?.kind === "sub") return "sub";
      if (highlight?.kind === "void") return "void";
      return "card";
    default: return "panel";
  }
}

let scratch: HTMLCanvasElement | null = null;

function withSweep(image: HTMLImageElement, e: number): CanvasImageSource {
  const progress = (e - 420) / 900;
  if (progress <= 0 || progress >= 1) return image;
  const w = image.naturalWidth || 1;
  const h = image.naturalHeight || 1;
  scratch = scratch ?? document.createElement("canvas");
  if (scratch.width !== w || scratch.height !== h) { scratch.width = w; scratch.height = h; }
  const g = scratch.getContext("2d");
  if (!g) return image;
  g.clearRect(0, 0, w, h);
  g.globalCompositeOperation = "source-over";
  g.drawImage(image, 0, 0, w, h);
  g.globalCompositeOperation = "source-atop";
  const x = -0.3 * w + 1.6 * w * easeOutCubic(progress);
  const band = g.createLinearGradient(x - 0.14 * w, 0, x + 0.14 * w, 0);
  band.addColorStop(0, "rgba(255,255,255,0)");
  band.addColorStop(0.5, "rgba(255,255,255,0.5)");
  band.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = band;
  g.fillRect(0, 0, w, h);
  g.globalCompositeOperation = "source-over";
  return scratch;
}

interface Input {
  ctx: CanvasRenderingContext2D;
  image: HTMLImageElement;
  x: number;
  y: number;
  w: number;
  h: number;
  elapsed: number;
  motion: Motion;
  tone: string;
  leavingAt?: number;
}

export function drawMotion({ ctx, image, x, y, w, h, elapsed, motion, tone, leavingAt }: Input) {
  const out = leavingAt ? clamp01((Date.now() - leavingAt) / EXIT_MS) : 0;
  const e = elapsed;
  ctx.save();
  let alpha = clamp01(e / 220);
  const source: CanvasImageSource = motion === "sub" ? image : withSweep(image, e);
  const cx = x + w / 2;
  const cy = y + h / 2;

  if (motion === "goal") {
    const t = clamp01(e / 700);
    if (e < 1000) {
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.62);
      glow.addColorStop(0, tone + "aa");
      glow.addColorStop(1, tone + "00");
      ctx.globalAlpha = (1 - clamp01(e / 1000)) * (1 - out);
      ctx.fillStyle = glow;
      ctx.fillRect(cx - w * 0.7, cy - h * 1.6, w * 1.4, h * 3.2);
    }
    const s = (0.55 + 0.45 * easeOutBack(t)) * (1 - 0.1 * out);
    ctx.globalAlpha = alpha * (1 - out);
    ctx.translate(cx, cy);
    ctx.scale(s, s);
    ctx.drawImage(source, -w / 2, -h / 2, w, h);
  } else if (motion === "card") {
    const t = clamp01(e / 800);
    const drop = (1 - easeOutBounce(t)) * h * 1.4;
    ctx.globalAlpha = clamp01(e / 140) * (1 - out);
    ctx.translate(cx, cy - drop + out * h * 0.5);
    ctx.rotate((1 - easeOutCubic(t)) * -0.05);
    ctx.drawImage(source, -w / 2, -h / 2, w, h);
  } else if (motion === "sub") {
    const iw = image.naturalWidth || w;
    const ih = image.naturalHeight || h;
    [0, 1].forEach((band) => {
      const tb = clamp01((e - band * 200) / 500);
      const offset = -(1 - easeOutCubic(tb)) * w * 0.55 - out * w * 0.2;
      ctx.globalAlpha = tb * (1 - out);
      ctx.drawImage(source, 0, (ih / 2) * band, iw, ih / 2, x + offset, y + (h / 2) * band, w, h / 2);
    });
  } else if (motion === "void") {
    const t = clamp01(e / 600);
    const shake = Math.sin(e * 0.06) * (1 - t) * w * 0.012;
    ctx.globalAlpha = alpha * (1 - out);
    ctx.drawImage(source, x + shake - out * w * 0.1, y, w, h);
    if (e < 380) {
      ctx.globalAlpha = (1 - e / 380) * 0.35;
      ctx.fillStyle = "#ef4444";
      ctx.fillRect(x, y, w, h);
    }
  } else if (motion === "var") {
    ctx.globalAlpha = (e < 360 ? (Math.floor(e / 70) % 2 ? 0.35 : 1) : 1) * (1 - out);
    ctx.drawImage(source, x - out * w * 0.1, y, w, h);
  } else if (motion === "elite") {
    const t = easeOutExpo(clamp01(e / 760));
    ctx.globalAlpha = clamp01(e / 160) * (1 - out);
    const width = w * t * (1 - out);
    ctx.beginPath();
    ctx.rect(cx - width / 2, y - h, width + 0.01, h * 3);
    ctx.clip();
    ctx.drawImage(source, x, y + out * h * 0.3, w, h);
  } else {
    const t = easeOutCubic(clamp01(e / 520));
    ctx.globalAlpha = t * (1 - out);
    ctx.drawImage(source, x - (1 - t) * w * 0.1 - out * w * 0.1, y, w, h);
  }
  ctx.restore();
}
