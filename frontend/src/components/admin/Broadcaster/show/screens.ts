// Broadcast graphics of the NEXUS SPORT Virtual Studio, drawn into 2D canvases that
// become the LED wall, the side screens and the on-air overlay. Identity: graphite,
// NEXUS yellow, white for the main information, metal grey. No purple, no neon.
// Everything is designed for the wall it lives on (16:9 LED, portrait side towers),
// with large type, clear hierarchy and progressive reveal (`reveal` = items shown).

import type { LowerThird, ScreenContent, TeamRef } from "./types";

export const C = { bg: "#0c0d10", panel: "#15171c", panel2: "#1d2027", line: "#2a2e37", metal: "#8b919c", text: "#f4f5f7", dim: "#a7adb8", gold: "#f5c518", goldInk: "#141414", live: "#e5322d" };
const F = (w: number, size: number) => `${w} ${size}px Inter, "Segoe UI", Arial, sans-serif`;

// ------------------------------------------------------------------ crest images (data URLs only: canvases must stay untainted for WebGL)
const images = new Map<string, HTMLImageElement>();
let onImage: () => void = () => undefined;
export function setImageListener(fn: () => void) { onImage = fn; }
function img(src?: string): HTMLImageElement | null {
  if (!src || !src.startsWith("data:")) return null;
  let im = images.get(src);
  if (!im) {
    im = new Image();
    im.onload = () => onImage();
    im.src = src;
    images.set(src, im);
    if (images.size > 300) images.delete(images.keys().next().value!);
  }
  return im.complete && im.naturalWidth ? im : null;
}

function fit(ctx: CanvasRenderingContext2D, text: string, maxW: number, weight: number, size: number, min = 14): number {
  let s = size;
  ctx.font = F(weight, s);
  while (s > min && ctx.measureText(text).width > maxW) { s -= 2; ctx.font = F(weight, s); }
  return s;
}
function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; if (lines.length === maxLines) break; } else cur = t;
  }
  if (lines.length < maxLines && cur) lines.push(cur);
  if (lines.length === maxLines && words.join(" ").length > lines.join(" ").length) lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S*$/, "…");
  return lines;
}
function crest(ctx: CanvasRenderingContext2D, t: TeamRef, x: number, y: number, size: number) {
  const im = img(t.logo);
  if (im) { ctx.drawImage(im, x - size / 2, y - size / 2, size, size); return; }
  ctx.fillStyle = C.panel2;
  ctx.beginPath(); ctx.arc(x, y, size / 2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = C.text; ctx.font = F(800, size * 0.32); ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText((t.short || t.name).slice(0, 3).toUpperCase(), x, y);
}
function frame(ctx: CanvasRenderingContext2D, w: number, h: number, kicker?: string) {
  // soft surface: a calm gradient and one gentle light from above (no hard lines)
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "#16181d"); g.addColorStop(1, "#0a0b0d");
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  const glow = ctx.createRadialGradient(w / 2, -h * 0.25, 0, w / 2, -h * 0.25, h * 0.95);
  glow.addColorStop(0, "rgba(245,197,24,0.10)"); glow.addColorStop(1, "rgba(245,197,24,0)");
  ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h);
  if (kicker) {
    ctx.font = F(800, h * 0.032); ctx.textAlign = "left"; ctx.textBaseline = "middle";
    const kw = ctx.measureText(kicker.toUpperCase()).width + w * 0.036, kh = h * 0.058;
    ctx.fillStyle = C.gold; ctx.beginPath(); ctx.roundRect(w * 0.05, h * 0.075, kw, kh, kh / 2); ctx.fill();
    ctx.fillStyle = C.goldInk; ctx.fillText(kicker.toUpperCase(), w * 0.05 + w * 0.018, h * 0.075 + kh / 2 + 1);
    ctx.textBaseline = "alphabetic";
  }
}

// ------------------------------------------------------------------ LED wall
export function drawScreen(ctx: CanvasRenderingContext2D, w: number, h: number, c: ScreenContent | null) {
  ctx.save();
  ctx.textBaseline = "alphabetic";
  if (!c) { idle(ctx, w, h); ctx.restore(); return; }
  switch (c.type) {
    case "title": {
      frame(ctx, w, h, c.kicker);
      ctx.textAlign = "left"; ctx.fillStyle = C.text;
      ctx.font = F(900, h * 0.11);
      wrap(ctx, c.title, w * 0.88, 2).forEach((l, i) => ctx.fillText(l, w * 0.05, h * (0.42 + i * 0.13)));
      if (c.subtitle) { ctx.fillStyle = C.dim; ctx.font = F(500, h * 0.045); wrap(ctx, c.subtitle, w * 0.85, 2).forEach((l, i) => ctx.fillText(l, w * 0.05, h * (0.74 + i * 0.065))); }
      break;
    }
    case "headlines": {
      frame(ctx, w, h, "Los temas de hoy");
      ctx.textAlign = "left";
      ctx.fillStyle = C.text; ctx.font = F(900, h * 0.075); ctx.fillText(c.title, w * 0.05, h * 0.3);
      c.items.slice(0, Math.max(0, c.reveal)).slice(0, 4).forEach((t, i) => {
        const y = h * (0.42 + i * 0.13);
        ctx.fillStyle = C.gold; ctx.fillRect(w * 0.05, y - h * 0.05, w * 0.008, h * 0.07);
        ctx.fillStyle = C.text; const s = fit(ctx, t, w * 0.84, 700, h * 0.05, 16); ctx.font = F(700, s); ctx.fillText(t, w * 0.075, y);
      });
      break;
    }
    case "result": {
      frame(ctx, w, h, c.league);
      const cy = h * 0.44;
      crest(ctx, c.home, w * 0.2, cy, h * 0.24);
      crest(ctx, c.away, w * 0.8, cy, h * 0.24);
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillStyle = C.gold; ctx.fillRect(w * 0.36, cy - h * 0.12, w * 0.28, h * 0.24);
      ctx.fillStyle = C.goldInk; ctx.font = F(900, h * 0.17);
      ctx.fillText(c.reveal >= 1 ? `${c.home.score ?? 0} - ${c.away.score ?? 0}` : "vs", w * 0.5, cy + h * 0.01);
      ctx.fillStyle = C.text;
      const ns = Math.min(fit(ctx, c.home.name, w * 0.3, 800, h * 0.05), fit(ctx, c.away.name, w * 0.3, 800, h * 0.05));
      ctx.font = F(800, ns);
      ctx.fillText(c.home.name, w * 0.2, cy + h * 0.18); ctx.fillText(c.away.name, w * 0.8, cy + h * 0.18);
      ctx.fillStyle = c.status.startsWith("EN VIVO") ? C.live : C.metal; ctx.font = F(800, h * 0.036); ctx.fillText(c.status, w * 0.5, cy + h * 0.17);
      if (c.reveal >= 2) {
        ctx.font = F(500, h * 0.033); ctx.fillStyle = C.dim; ctx.textBaseline = "alphabetic";
        c.scorers.home.slice(0, 4).forEach((s, i) => { ctx.textAlign = "center"; ctx.fillText(s, w * 0.2, h * (0.73 + i * 0.05)); });
        c.scorers.away.slice(0, 4).forEach((s, i) => { ctx.textAlign = "center"; ctx.fillText(s, w * 0.8, h * (0.73 + i * 0.05)); });
      }
      break;
    }
    case "stats": {
      frame(ctx, w, h, c.title);
      crest(ctx, c.home, w * 0.1, h * 0.26, h * 0.1); crest(ctx, c.away, w * 0.9, h * 0.26, h * 0.1);
      ctx.textAlign = "center"; ctx.fillStyle = C.text; ctx.font = F(800, h * 0.04);
      ctx.fillText(`${c.home.short ?? c.home.name}  ·  ${c.away.short ?? c.away.name}`, w * 0.5, h * 0.28);
      c.rows.slice(0, Math.min(5, c.reveal)).forEach((r, i) => {
        const y = h * (0.4 + i * 0.12), tot = r.home + r.away || 1, bw = w * 0.36;
        ctx.fillStyle = C.dim; ctx.font = F(700, h * 0.033); ctx.textAlign = "center"; ctx.fillText(r.label.toUpperCase(), w * 0.5, y - h * 0.025);
        const hv = r.home / tot, av = r.away / tot;
        ctx.fillStyle = C.panel2; ctx.fillRect(w * 0.5 - bw - w * 0.01, y, bw, h * 0.03); ctx.fillRect(w * 0.51, y, bw, h * 0.03);
        ctx.fillStyle = r.home >= r.away ? C.gold : C.metal; ctx.fillRect(w * 0.49 - bw * hv, y, bw * hv, h * 0.03);
        ctx.fillStyle = r.away > r.home ? C.gold : C.metal; ctx.fillRect(w * 0.51, y, bw * av, h * 0.03);
        ctx.fillStyle = C.text; ctx.font = F(900, h * 0.045);
        ctx.textAlign = "right"; ctx.fillText(`${r.home}${r.percent ? "%" : ""}`, w * 0.5 - bw - w * 0.02, y + h * 0.03);
        ctx.textAlign = "left"; ctx.fillText(`${r.away}${r.percent ? "%" : ""}`, w * 0.51 + bw + w * 0.01, y + h * 0.03);
      });
      break;
    }
    case "headline": {
      frame(ctx, w, h, c.kicker);
      ctx.textAlign = "left"; ctx.fillStyle = C.text; ctx.font = F(900, h * 0.075);
      const lines = wrap(ctx, c.title, w * 0.88, 3);
      lines.forEach((l, i) => ctx.fillText(l, w * 0.05, h * (0.32 + i * 0.095)));
      if (c.body) { ctx.fillStyle = C.dim; ctx.font = F(500, h * 0.04); wrap(ctx, c.body, w * 0.86, 3).forEach((l, i) => ctx.fillText(l, w * 0.05, h * (0.36 + lines.length * 0.095 + i * 0.06))); }
      ctx.fillStyle = C.metal; ctx.font = F(700, h * 0.03);
      ctx.fillText(`FUENTE: ${c.source.toUpperCase()}${c.date ? ` · ${c.date}` : ""}`, w * 0.05, h * 0.92);
      if (c.provisional) { ctx.fillStyle = C.live; ctx.textAlign = "right"; ctx.fillText("SIN CONFIRMAR", w * 0.95, h * 0.92); }
      break;
    }
    case "table": {
      frame(ctx, w, h, c.title);
      ctx.textBaseline = "middle";
      const rows = c.rows.slice(0, 8), rh = h * 0.085;
      ctx.fillStyle = C.metal; ctx.font = F(700, h * 0.028); ctx.textAlign = "right";
      ctx.fillText("PJ", w * 0.74, h * 0.22); ctx.fillText("DG", w * 0.84, h * 0.22); ctx.fillText("PTS", w * 0.94, h * 0.22);
      rows.slice(0, c.reveal).forEach((r, i) => {
        const y = h * 0.29 + i * rh, on = c.highlight.includes(r.team);
        ctx.fillStyle = on ? "rgba(245,197,24,0.16)" : i % 2 ? "rgba(255,255,255,0.025)" : "transparent"; ctx.fillRect(w * 0.05, y - rh / 2, w * 0.9, rh);
        ctx.fillStyle = on ? C.gold : C.dim; ctx.font = F(900, h * 0.04); ctx.textAlign = "left"; ctx.fillText(String(r.pos), w * 0.065, y);
        crest(ctx, { name: r.team, logo: r.logo }, w * 0.15, y, rh * 0.7);
        ctx.fillStyle = C.text; const s = fit(ctx, r.team, w * 0.48, 700, h * 0.042); ctx.font = F(700, s); ctx.fillText(r.team, w * 0.19, y);
        ctx.font = F(700, h * 0.04); ctx.textAlign = "right"; ctx.fillStyle = C.dim;
        ctx.fillText(String(r.played), w * 0.74, y); ctx.fillText(`${r.gd > 0 ? "+" : ""}${r.gd}`, w * 0.84, y);
        ctx.fillStyle = C.text; ctx.font = F(900, h * 0.045); ctx.fillText(String(r.points), w * 0.94, y);
      });
      break;
    }
    case "fixtures": {
      frame(ctx, w, h, c.title);
      ctx.textBaseline = "middle";
      c.rows.slice(0, Math.min(6, c.reveal)).forEach((r, i) => {
        const y = h * (0.28 + i * 0.115);
        ctx.fillStyle = "rgba(255,255,255,0.03)"; ctx.fillRect(w * 0.05, y - h * 0.048, w * 0.9, h * 0.096);
        ctx.fillStyle = C.gold; ctx.font = F(900, fit(ctx, r.time, w * 0.13, 900, h * 0.038)); ctx.textAlign = "left"; ctx.fillText(r.time, w * 0.065, y - (r.day ? h * 0.015 : 0));
        if (r.day) { ctx.fillStyle = C.metal; ctx.font = F(700, h * 0.024); ctx.fillText(r.day.toUpperCase(), w * 0.065, y + h * 0.025); }
        crest(ctx, r.home, w * 0.415, y, h * 0.065); crest(ctx, r.away, w * 0.585, y, h * 0.065);
        ctx.fillStyle = C.text; ctx.font = F(800, fit(ctx, r.home.name, w * 0.19, 800, h * 0.036)); ctx.textAlign = "right"; ctx.fillText(r.home.name, w * 0.38, y);
        ctx.font = F(800, fit(ctx, r.away.name, w * 0.19, 800, h * 0.036)); ctx.textAlign = "left"; ctx.fillText(r.away.name, w * 0.62, y);
        ctx.fillStyle = C.metal; ctx.font = F(700, h * 0.022); ctx.textAlign = "right"; ctx.fillText(r.league.toUpperCase(), w * 0.94, y);
      });
      break;
    }
    case "poll": {
      frame(ctx, w, h, "La audiencia opina");
      ctx.textAlign = "left"; ctx.fillStyle = C.text; ctx.font = F(900, h * 0.065);
      wrap(ctx, c.question, w * 0.88, 2).forEach((l, i) => ctx.fillText(l, w * 0.05, h * (0.3 + i * 0.08)));
      if (c.state === "none") {
        ctx.fillStyle = C.dim; ctx.font = F(600, h * 0.04); ctx.fillText("La votación aún no está abierta.", w * 0.05, h * 0.62);
      } else {
        c.options.slice(0, 4).forEach((o, i) => {
          const y = h * (0.5 + i * 0.11), pct = c.total ? Math.round((o.votes / c.total) * 100) : 0;
          ctx.fillStyle = C.panel2; ctx.fillRect(w * 0.05, y - h * 0.04, w * 0.9, h * 0.08);
          ctx.fillStyle = C.gold; ctx.fillRect(w * 0.05, y - h * 0.04, w * 0.9 * (pct / 100), h * 0.08);
          ctx.fillStyle = pct > 50 ? C.goldInk : C.text; ctx.font = F(800, h * 0.038); ctx.textBaseline = "middle"; ctx.fillText(o.label, w * 0.07, y);
          ctx.textAlign = "right"; ctx.fillStyle = C.text; ctx.fillText(c.total ? `${pct}%` : "—", w * 0.93, y); ctx.textAlign = "left";
        });
        ctx.fillStyle = C.metal; ctx.font = F(700, h * 0.03); ctx.textBaseline = "alphabetic";
        ctx.fillText(c.total ? `${c.total} votos reales del portal · ${c.state === "open" ? "votación abierta" : "votación cerrada"}` : "Todavía no hay votos", w * 0.05, h * 0.95);
      }
      break;
    }
    case "numbers": {
      frame(ctx, w, h, c.title);
      c.items.slice(0, Math.min(6, c.reveal)).forEach((it, i) => {
        const col = i % 3, row = Math.floor(i / 3), x = w * (0.05 + col * 0.31), y = h * (0.25 + row * 0.34);
        ctx.fillStyle = C.panel; ctx.fillRect(x, y, w * 0.29, h * 0.3);
        ctx.fillStyle = C.gold; ctx.fillRect(x, y, w * 0.006, h * 0.3);
        ctx.fillStyle = C.text; ctx.textAlign = "left"; ctx.font = F(900, fit(ctx, it.value, w * 0.25, 900, h * 0.12)); ctx.fillText(it.value, x + w * 0.02, y + h * 0.15);
        ctx.fillStyle = C.dim; ctx.font = F(600, h * 0.032); wrap(ctx, it.label, w * 0.25, 2).forEach((l, j) => ctx.fillText(l, x + w * 0.02, y + h * (0.22 + j * 0.045)));
      });
      break;
    }
    case "closing": {
      frame(ctx, w, h, "Cierre");
      ctx.textAlign = "left"; ctx.fillStyle = C.text; ctx.font = F(900, h * 0.08); ctx.fillText(c.title, w * 0.05, h * 0.3);
      c.lines.slice(0, Math.min(5, c.reveal)).forEach((l, i) => {
        ctx.fillStyle = C.gold; ctx.fillRect(w * 0.05, h * (0.41 + i * 0.1) - h * 0.03, w * 0.012, h * 0.012);
        ctx.fillStyle = C.text; ctx.font = F(600, fit(ctx, l, w * 0.84, 600, h * 0.042)); ctx.fillText(l, w * 0.075, h * (0.41 + i * 0.1));
      });
      break;
    }
  }
  ctx.restore();
}

function idle(ctx: CanvasRenderingContext2D, w: number, h: number) {
  frame(ctx, w, h);
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.font = F(900, h * 0.16); ctx.fillStyle = C.text; ctx.fillText("NEXUS", w * 0.5 - h * 0.28, h * 0.5);
  ctx.fillStyle = C.gold; ctx.fillText("SPORT", w * 0.5 + h * 0.42, h * 0.5);
}

// ------------------------------------------------------------------ side towers (portrait)
export interface SideInfo { label: string; sub?: string; clock: string; date: string; live: { home: string; away: string; score: string; minute: string }[] }
export function drawSide(ctx: CanvasRenderingContext2D, w: number, h: number, side: "left" | "right", info: SideInfo) {
  frame(ctx, w, h);
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  if (side === "left") {
    // calm brand panel: the mark and the section, nothing else
    ctx.fillStyle = C.gold; ctx.beginPath(); ctx.arc(w / 2, h * 0.36, w * 0.13, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = C.goldInk; ctx.font = F(900, w * 0.12); ctx.fillText("N", w / 2, h * 0.365);
    ctx.fillStyle = C.text; ctx.font = F(800, fit(ctx, info.label.toUpperCase(), w * 0.8, 800, w * 0.09)); ctx.fillText(info.label.toUpperCase(), w / 2, h * 0.6);
  } else {
    ctx.fillStyle = C.dim; ctx.font = F(700, w * 0.055); ctx.fillText(info.date.toUpperCase(), w / 2, h * 0.14);
    if (info.live.length) {
      ctx.fillStyle = C.live; ctx.font = F(800, w * 0.06); ctx.fillText("● EN VIVO", w / 2, h * 0.26);
      info.live.slice(0, 4).forEach((m, i) => {
        const y = h * (0.37 + i * 0.13);
        ctx.fillStyle = C.panel2; ctx.beginPath(); ctx.roundRect(w * 0.07, y - h * 0.05, w * 0.86, h * 0.1, 18); ctx.fill();
        ctx.fillStyle = C.text; ctx.font = F(800, w * 0.052);
        ctx.fillText(`${m.home.slice(0, 10)} ${m.score} ${m.away.slice(0, 10)}`, w / 2, y - h * 0.012);
        ctx.fillStyle = C.dim; ctx.font = F(700, w * 0.042); ctx.fillText(m.minute, w / 2, y + h * 0.027);
      });
    } else {
      ctx.fillStyle = C.text; ctx.font = F(800, w * 0.09); ctx.fillText("NEXUS", w / 2, h * 0.46);
      ctx.fillStyle = C.gold; ctx.fillText("SPORT", w / 2, h * 0.56);
    }
  }
}

// ------------------------------------------------------------------ on-air overlay (drawn over the 3D frame, 1920×1080)
export interface OverlayInfo { lower: LowerThird | null; segment: string; clock: string; caption?: string; live?: boolean; source?: string }
export function drawOverlay(ctx: CanvasRenderingContext2D, o: OverlayInfo) {
  // station bug, top-left
  ctx.save();
  const box = (x: number, y: number, w: number, h: number, r: number, fill: string) => { ctx.fillStyle = fill; ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill(); };
  box(48, 40, 286, 54, 27, "rgba(12,13,16,0.72)");
  ctx.fillStyle = C.gold; ctx.beginPath(); ctx.arc(76, 67, 7, 0, Math.PI * 2); ctx.fill();
  ctx.textBaseline = "middle"; ctx.textAlign = "left";
  ctx.font = F(800, 27); ctx.fillStyle = C.text; ctx.fillText("NEXUS", 96, 67);
  ctx.fillStyle = C.gold; ctx.fillText("SPORT", 203, 67);
  if (o.clock) {
    box(1640, 40, 232, 54, 27, "rgba(12,13,16,0.72)");
    ctx.fillStyle = C.text; ctx.font = F(800, 26); ctx.textAlign = "center"; ctx.fillText(o.clock, 1756, 67);
  }
  if (o.segment) {
    ctx.font = F(800, 20); const sw = ctx.measureText(o.segment.toUpperCase()).width + 36;
    box(48, 104, sw, 34, 17, C.gold);
    ctx.fillStyle = C.goldInk; ctx.textAlign = "left"; ctx.fillText(o.segment.toUpperCase(), 66, 122);
  }
  if (o.lower) {
    const x = 120, y = 820, w = 1680;
    box(x, y, w, 118, 22, "rgba(12,13,16,0.84)");
    box(x + 22, y + 26, 6, 66, 3, C.gold);
    ctx.font = F(800, 22); const kw = ctx.measureText(o.lower.kicker.toUpperCase()).width + 36;
    box(x + 22, y - 44, kw, 36, 18, C.gold);
    ctx.fillStyle = C.goldInk; ctx.textAlign = "left"; ctx.fillText(o.lower.kicker.toUpperCase(), x + 40, y - 26);
    ctx.fillStyle = C.text; ctx.font = F(800, fit(ctx, o.lower.text, w - 80, 800, 46, 24)); ctx.fillText(o.lower.text, x + 44, y + 52);
    if (o.lower.source) { ctx.fillStyle = C.metal; ctx.font = F(600, 22); ctx.fillText(`Fuente: ${o.lower.source}`, x + 44, y + 96); }
  }
  if (!o.lower && o.source) {
    ctx.font = F(600, 20); const t = `Fuente: ${o.source}`; const tw = ctx.measureText(t).width + 32;
    box(1872 - tw, 1000, tw, 36, 18, "rgba(12,13,16,0.6)");
    ctx.fillStyle = C.dim; ctx.textAlign = "left"; ctx.fillText(t, 1872 - tw + 16, 1018);
  }
  if (o.caption) {
    // narration as subtitles when there is no voice (never a fake voice)
    ctx.font = F(600, 30); const lines = wrap(ctx, o.caption, 1640, 2);
    const y0 = 1048 - (lines.length - 1) * 40;
    lines.forEach((l, i) => {
      const tw = ctx.measureText(l).width + 40;
      box(960 - tw / 2, y0 + i * 40 - 19, tw, 38, 12, "rgba(0,0,0,0.7)");
      ctx.fillStyle = C.text; ctx.textAlign = "center"; ctx.fillText(l, 960, y0 + i * 40);
    });
  }
  ctx.restore();
}
