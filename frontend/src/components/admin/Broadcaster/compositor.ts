import type { BroadcastGraphic, BroadcastMode, FootballScoreboard, GraphicVariant } from "./graphicExport";
import type { CropRect } from "./CropEditor";
import { drawMotion, entryElapsed, motionFor } from "./football/motion";
import { getMultiVersion, renderFootballDesign, type DesignOutput } from "./football/designs";
import { getDesignImage } from "./football/raster";

// Draws Preview and Program: sources, layouts, graphics and transitions on a 1920×1080 canvas.

export type InputKind = "camera" | "screen" | "video" | "image" | "audio";
export type SceneLayout = "auto" | "single" | "split" | "triple" | "pip";
export type TransitionMode = "cut" | "fade" | "wipe" | "dip";

export interface BroadcastInput {
  id: string;
  name: string;
  kind: InputKind;
  stream?: MediaStream;
  url?: string;
  muted: boolean;
  volume: number;
  pan?: number;
  crop?: CropRect;
  playing?: boolean;
  loop?: boolean;
}

export interface BroadcastScene {
  id: string;
  mode?: BroadcastMode;
  name: string;
  inputIds: string[];
  graphicId: string | null;
  graphicIds?: string[];
  layout?: SceneLayout;
  backgroundId?: string | null;
}

// Single live match shared by every football widget (Preview and Program), with its running clock.
let liveFootballMatch: FootballScoreboard | null = null;
let liveClock: () => number = () => liveFootballMatch?.clockSeconds ?? 0;

const footballDefaultVariant = (graphic: BroadcastGraphic): GraphicVariant =>
  graphic.variant ?? (graphic.kind === "scoreboard" ? "elite" : graphic.kind === "ticker" ? "events" : "lower");

interface CachedDesign {
  source: FootballScoreboard;
  seconds: number;
  variant: GraphicVariant;
  title: string;
  subtitle: string;
  style: BroadcastGraphic["style"];
  design: DesignOutput;
  multi: number;
}
const designCache = new Map<string, CachedDesign>();
const MAX_CACHED_DESIGNS = 200;

/**
 * Design of a football widget for the current match and clock second. Both canvases ask for
 * it on every frame, so the HTML (with inline crests) is rebuilt only when an input changes;
 * keeping the same object also lets the rasteriser reuse its image.
 */
export function footballDesignFor(graphic: BroadcastGraphic): DesignOutput {
  const source = liveFootballMatch ?? graphic.football!;
  const seconds = liveFootballMatch ? liveClock() : source.clockSeconds;
  const variant = footballDefaultVariant(graphic);
  const cached = designCache.get(graphic.id);
  const multi = variant === "multi" ? getMultiVersion() : 0;
  if (cached && cached.source === source && cached.seconds === seconds && cached.variant === variant && cached.multi === multi
    && cached.title === graphic.title && cached.subtitle === graphic.subtitle && cached.style === graphic.style) {
    return cached.design;
  }
  const match = seconds === source.clockSeconds ? source : { ...source, clockSeconds: seconds };
  const design = renderFootballDesign(variant, match, graphic.title, graphic.subtitle, graphic.style);
  designCache.delete(graphic.id);
  if (designCache.size >= MAX_CACHED_DESIGNS) designCache.delete(designCache.keys().next().value as string);
  designCache.set(graphic.id, { source, seconds, variant, multi, title: graphic.title, subtitle: graphic.subtitle, style: graphic.style, design });
  return design;
}

// Keeps a football widget fully inside the 1920×1080 frame, even for positions saved by older versions.
export function footballPosition(graphic: BroadcastGraphic, design: { width: number; height: number }) {
  const scale = graphic.scale ?? 1;
  const position = graphic.position ?? { x: 3, y: 4 };
  const maxX = Math.max(0, 100 - (design.width * scale) / 19.2);
  const maxY = Math.max(0, 100 - (design.height * scale) / 10.8);
  return { x: Math.min(Math.max(0, position.x), maxX), y: Math.min(Math.max(0, position.y), maxY) };
}

export function setLiveFootballMatch(match: FootballScoreboard | null, clock?: () => number) {
  liveFootballMatch = match;
  liveClock = clock ?? (() => match?.clockSeconds ?? 0);
}

export const isFootballDesign = (graphic: BroadcastGraphic) => graphic.mode === "football" && Boolean(liveFootballMatch || graphic.football);

const footballLogoCache = new Map<string, HTMLImageElement>();

function drawCover(
  context: CanvasRenderingContext2D,
  media: HTMLVideoElement | HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
  crop?: CropRect,
) {
  const mediaWidth = media instanceof HTMLVideoElement ? media.videoWidth : media.naturalWidth;
  const mediaHeight = media instanceof HTMLVideoElement ? media.videoHeight : media.naturalHeight;
  if (!mediaWidth || !mediaHeight) return;
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  const areaX = (crop?.x ?? 0) * mediaWidth;
  const areaY = (crop?.y ?? 0) * mediaHeight;
  const areaW = (crop?.w ?? 1) * mediaWidth;
  const areaH = (crop?.h ?? 1) * mediaHeight;
  const scale = Math.max(width / areaW, height / areaH);
  const sourceWidth = width / scale;
  const sourceHeight = height / scale;
  const sourceX = areaX + (areaW - sourceWidth) / 2;
  const sourceY = areaY + (areaH - sourceHeight) / 2;
  context.drawImage(media, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
}

export function drawScene(
  canvas: HTMLCanvasElement,
  scene: BroadcastScene | undefined,
  inputs: BroadcastInput[],
  videoElements: Map<string, HTMLVideoElement>,
  imageElements: Map<string, HTMLImageElement>,
  graphics: BroadcastGraphic[],
  opacity = 1,
  surface: "preview" | "program" = "program",
  clear = true,
) {
  const context = canvas.getContext("2d");
  if (!context) return;
  const width = 1920;
  const height = 1080;
  context.save();
  context.scale(canvas.width / width, canvas.height / height);
  // A layered pass (crossfade) paints its own base at its opacity so the scene below shows through.
  context.globalAlpha = clear ? 1 : opacity;
  context.fillStyle = "#000";
  context.fillRect(0, 0, width, height);
  context.globalAlpha = opacity;
  if (!scene) {
    context.restore();
    return;
  }

  const allVisibleInputs = scene.inputIds
    .map((id) => inputs.find((input) => input.id === id))
    .filter((input): input is BroadcastInput => Boolean(input))
    .filter((input) => input.kind === "camera" || input.kind === "screen" || input.kind === "video" || input.kind === "image");
  const visibleInputs = scene.layout === "single" ? allVisibleInputs.slice(0, 1)
    : scene.layout === "split" ? allVisibleInputs.slice(0, 2)
      : scene.layout === "triple" ? allVisibleInputs.slice(0, 3)
      : allVisibleInputs;

  const drawInput = (input: BroadcastInput, x: number, y: number, cellWidth: number, cellHeight: number) => {
    const video = videoElements.get(input.id);
    if (input.kind === "image") {
      const image = imageElements.get(input.id);
      if (image?.complete) drawCover(context, image, x, y, cellWidth, cellHeight, input.crop);
    } else if (video) {
      drawCover(context, video, x, y, cellWidth, cellHeight, input.crop);
    } else if (!input.stream && input.kind === "camera") {
      context.fillStyle = "#0b1017";
      context.fillRect(x, y, cellWidth, cellHeight);
      context.fillStyle = "rgba(250,204,21,.9)";
      context.font = "700 34px Inter, Arial, sans-serif";
      context.textAlign = "center";
      context.fillText("ESPERANDO SEÑAL", x + cellWidth / 2, y + cellHeight / 2, cellWidth - 60);
    }
    context.fillStyle = "rgba(0,0,0,.58)";
    context.fillRect(x + 16, y + cellHeight - 66, Math.min(520, input.name.length * 27 + 44), 48);
    context.fillStyle = "#fff";
    context.font = "600 30px Inter, Arial, sans-serif";
    context.textAlign = "left";
    context.fillText(input.name, x + 34, y + cellHeight - 32, cellWidth - 68);
  };

  const backdrop = scene.backgroundId ? inputs.find((input) => input.id === scene.backgroundId) : undefined;
  if (backdrop) {
    const media = backdrop.kind === "image" ? imageElements.get(backdrop.id) : videoElements.get(backdrop.id);
    if (media && (media instanceof HTMLVideoElement || media.complete)) drawCover(context, media, 0, 0, width, height);
  }

  if (visibleInputs.length === 0) {
    if (backdrop) {
      // el fondo ya cubre el lienzo
    } else {
    const gradient = context.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "#15212b");
    gradient.addColorStop(0.55, "#0b1118");
    gradient.addColorStop(1, "#080a0e");
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
    context.strokeStyle = "rgba(148,163,184,.07)";
    context.lineWidth = 1;
    for (let x = 0; x <= width; x += 160) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, height);
      context.stroke();
    }
    for (let y = 0; y <= height; y += 160) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(width, y);
      context.stroke();
    }
    context.fillStyle = "#5eead4";
    context.fillRect(width / 2 - 35, height / 2 - 142, 70, 5);
    context.fillStyle = "#ffffff";
    context.font = "600 62px Inter, Arial, sans-serif";
    context.textAlign = "center";
    context.fillText("SIN FUENTES", width / 2, height / 2 - 28);
    context.fillStyle = "#9ca3af";
    context.font = "30px Inter, Arial, sans-serif";
    context.fillText(scene.name.toUpperCase(), width / 2, height / 2 + 28);
    context.fillStyle = "#6b7280";
    context.font = "25px Inter, Arial, sans-serif";
    context.fillText("Conecta cámara · pantalla · media", width / 2, height / 2 + 84);
    }
  } else if (scene.layout === "pip" && visibleInputs.length > 1) {
    drawInput(visibleInputs[0], 0, 0, width, height);
    const insetWidth = Math.round(width * 0.3);
    const insetHeight = Math.round(height * 0.3);
    const insetX = width - insetWidth - 56;
    const insetY = 56;
    context.fillStyle = "rgba(0,0,0,.8)";
    context.fillRect(insetX - 8, insetY - 8, insetWidth + 16, insetHeight + 16);
    drawInput(visibleInputs[1], insetX, insetY, insetWidth, insetHeight);
  } else {
    const gap = 8;
    const columns = scene.layout === "triple" && visibleInputs.length > 2
      ? 3
      : scene.layout === "split" && visibleInputs.length === 2 ? 2 : visibleInputs.length === 1 ? 1 : 2;
    const rows = Math.ceil(visibleInputs.length / columns);
    const cellWidth = (width - gap * (columns + 1)) / columns;
    const cellHeight = (height - gap * (rows + 1)) / rows;
    visibleInputs.forEach((input, index) => {
      const x = gap + (index % columns) * (cellWidth + gap);
      const y = gap + Math.floor(index / columns) * (cellHeight + gap);
      drawInput(input, x, y, cellWidth, cellHeight);
    });
  }

  if (!graphics.length) {
    context.restore();
    return;
  }
  graphics.forEach((graphic) => {
    if (graphic.mode === "football") {
      // Until the live match is published there is nothing to draw (never the generic legacy box).
      if (!liveFootballMatch && !graphic.football) return;
      const design = footballDesignFor(graphic);
      const image = getDesignImage(graphic.id, design);
      const scale = graphic.scale ?? 1;
      const position = footballPosition(graphic, design);
      if (image) {
        const k = width / 1920;
        const home = liveFootballMatch?.homeColor;
        const away = liveFootballMatch?.awayColor;
        const sideColor = liveFootballMatch?.highlight?.team === "away" ? away : home;
        drawMotion({
          ctx: context,
          image,
          x: (position.x / 100) * width,
          y: (position.y / 100) * height,
          w: design.width * scale * k,
          h: design.height * scale * k,
          elapsed: entryElapsed(`${surface}|${graphic.id}`, performance.now()),
          motion: motionFor(graphic.variant, liveFootballMatch?.highlight),
          tone: /^#[0-9a-f]{6}$/i.test(sideColor ?? "") ? sideColor as string : "#38bdf8",
          leavingAt: graphic.leavingAt,
          opacity,
        });
      }
      return;
    }
    const accent = /^#[0-9a-f]{6}$/i.test(graphic.accent) ? graphic.accent : "#ef4444";
  const background = /^#[0-9a-f]{6}$/i.test(graphic.background ?? "") ? graphic.background as string : "#090b0f";
  const textColor = /^#[0-9a-f]{6}$/i.test(graphic.textColor ?? "") ? graphic.textColor as string : "#ffffff";
  const subtitleColor = /^#[0-9a-f]{6}$/i.test(graphic.subtitleColor ?? "") ? graphic.subtitleColor as string : "#d1d5db";
  if (graphic.kind === "lower-third") {
    const x = Math.round(((graphic.position?.x ?? 5) / 100) * width);
    const y = Math.round(((graphic.position?.y ?? 77) / 100) * height);
    context.fillStyle = background;
    context.fillRect(x, y, 850, 150);
    context.fillStyle = accent;
    context.fillRect(x, y, 10, 150);
    context.textAlign = "left";
    context.fillStyle = textColor;
    context.font = "700 58px Inter, Arial, sans-serif";
    context.fillText(graphic.title.toUpperCase(), x + 34, y + 66, 780);
    context.fillStyle = subtitleColor;
    context.font = "34px Inter, Arial, sans-serif";
    context.fillText(graphic.subtitle, x + 34, y + 111, 780);
  } else if (graphic.kind === "scoreboard") {
    const football = graphic.football;
    const position = graphic.position ?? { x: football ? 69 : 75, y: 7 };
    const x = Math.round((position.x / 100) * width);
    const y = Math.round((position.y / 100) * height);
    const boxWidth = football ? 620 : 390;
    const boxHeight = football ? 178 : 118;
    context.save();
    context.shadowColor = "rgba(0,0,0,.45)";
    context.shadowBlur = 34;
    context.shadowOffsetY = 12;
    context.fillStyle = background;
    context.beginPath();
    context.roundRect(x, y, boxWidth, boxHeight, 4);
    context.fill();
    context.shadowColor = "transparent";
    context.fillStyle = "rgba(255,255,255,.035)";
    context.fillRect(x, y + 8, boxWidth, boxHeight - 8);
    context.fillStyle = accent;
    context.fillRect(x, y, boxWidth, 8);
    context.strokeStyle = "rgba(255,255,255,.16)";
    context.lineWidth = 2;
    context.beginPath();
    context.roundRect(x, y, boxWidth, boxHeight, 4);
    context.stroke();
    context.textAlign = "center";
    if (football) {
      const center = x + boxWidth / 2;
      context.fillStyle = subtitleColor;
      context.font = "800 16px Arial, sans-serif";
      context.fillText("NEXUS SPORT  ·  " + (football.competition ?? "PARTIDO EN VIVO").toUpperCase(), center, y + 29, boxWidth - 30);
      context.fillStyle = textColor;
      context.font = "900 28px Arial, sans-serif";
      context.fillText(football.homeTeam.toUpperCase(), x + 155, y + 91, 190);
      context.fillText(football.awayTeam.toUpperCase(), x + boxWidth - 155, y + 91, 190);
      context.fillStyle = accent;
      context.font = "950 66px Arial, sans-serif";
      context.fillText(`${football.homeScore}  :  ${football.awayScore}`, center, y + 96);
      context.fillStyle = subtitleColor;
      context.font = "700 23px Arial, sans-serif";
      const minutes = Math.floor(Math.max(0, football.clockSeconds) / 60);
      const seconds = Math.max(0, football.clockSeconds) % 60;
      const clock = `${football.period} · ${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}${football.addedTime ? ` +${football.addedTime}` : ""}`;
      context.fillText(clock, center, y + 132);
      context.font = "18px Arial, sans-serif";
      context.fillText(`■ ${football.homeYellow}     ■ ${football.awayYellow}       ■ ${football.homeRed}     ■ ${football.awayRed}`, center, y + 158);
      context.fillStyle = "rgba(255,255,255,.08)";
      context.beginPath();
      context.arc(x + 60, y + 82, 38, 0, Math.PI * 2);
      context.arc(x + boxWidth - 60, y + 82, 38, 0, Math.PI * 2);
      context.fill();
      const drawLogo = (logo: string | undefined, logoX: number) => {
        if (!logo) return;
        const cached = footballLogoCache.get(logo);
        if (cached) {
          if (cached.complete && cached.naturalWidth > 0) context.drawImage(cached, logoX, y + 50, 54, 54);
          return;
        }
        const image = new Image();
        footballLogoCache.set(logo, image);
        image.src = logo;
      };
      drawLogo(football.homeLogo, x + 33);
      drawLogo(football.awayLogo, x + boxWidth - 87);
    } else {
      context.fillStyle = textColor;
      context.font = "700 42px Inter, Arial, sans-serif";
      context.fillText(graphic.title, x + boxWidth / 2, y + 60, boxWidth - 25);
      context.fillStyle = subtitleColor;
      context.font = "28px Inter, Arial, sans-serif";
      context.fillText(graphic.subtitle, x + boxWidth / 2, y + 96, boxWidth - 25);
    }
    context.restore();
  } else {
    context.fillStyle = background;
    const tickerY = Math.round(((graphic.position?.y ?? 85) / 100) * height);
    context.fillRect(0, tickerY, width, 80);
    context.fillStyle = accent;
    context.fillRect(0, tickerY, width, 6);
    context.textAlign = "left";
    const ticker = `${graphic.title}     ·     ${graphic.subtitle}`;
    context.font = "700 42px Inter, Arial, sans-serif";
    const tickerWidth = context.measureText(ticker).width;
    const travel = (performance.now() / 30) % (tickerWidth + 120);
    const tickerX = width - travel;
    context.fillStyle = textColor;
    context.fillText(ticker, tickerX, tickerY + 50, tickerWidth);
    context.fillText(ticker, tickerX + tickerWidth + 120, tickerY + 50, tickerWidth);
  }
  });
  context.restore();
}

export function drawTransition(
  canvas: HTMLCanvasElement,
  fromScene: BroadcastScene | undefined,
  toScene: BroadcastScene | undefined,
  inputs: BroadcastInput[],
  videoElements: Map<string, HTMLVideoElement>,
  imageElements: Map<string, HTMLImageElement>,
  fromGraphics: BroadcastGraphic[],
  toGraphics: BroadcastGraphic[],
  mode: TransitionMode,
  progress: number,
) {
  const context = canvas.getContext("2d");
  if (!context) return;
  const clamped = Math.min(1, Math.max(0, progress));
  if (mode === "wipe") {
    drawScene(canvas, fromScene, inputs, videoElements, imageElements, fromGraphics, 1, "program");
    context.save();
    context.beginPath();
    context.rect(0, 0, canvas.width * clamped, canvas.height);
    context.clip();
    drawScene(canvas, toScene, inputs, videoElements, imageElements, toGraphics, 1, "program");
    context.restore();
    return;
  }
  if (mode === "dip") {
    if (clamped < 0.5) {
      drawScene(canvas, fromScene, inputs, videoElements, imageElements, fromGraphics, 1, "program");
      context.save();
      context.fillStyle = `rgba(0,0,0,${clamped * 2})`;
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.restore();
    } else {
      drawScene(canvas, toScene, inputs, videoElements, imageElements, toGraphics, (clamped - 0.5) * 2, "program");
    }
    return;
  }
  // Crossfade: the outgoing scene stays opaque and the incoming one is layered over it.
  drawScene(canvas, fromScene, inputs, videoElements, imageElements, fromGraphics, 1, "program");
  drawScene(canvas, toScene, inputs, videoElements, imageElements, toGraphics, clamped, "program", false);
}
