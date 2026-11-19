"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import NextImage from "next/image";
import {
  Activity, Circle, Crop, Clapperboard, Copy, Download, FileVideo2, Gamepad2, ImagePlus, Layers3,
  Mic, MonitorUp, Pause, Pencil, Play, Plus, Radio, RadioTower, RectangleHorizontal,
  ScreenShare, Settings2, Shield, Square, Trash2, UsersRound, Video, Volume2, VolumeX, Wifi, X,
} from "lucide-react";
import { toast } from "sonner";
import { exportGraphicHtml, type BroadcastGraphic, type BroadcastMode, type FootballScoreboard, type GraphicKind } from "./graphicExport";
import type { Peer } from "peerjs";
import { CropEditor, type CropRect } from "./CropEditor";
import { createRoomCode, guestUrl, hostPeerId } from "./guestLink";
import { FootballConsole } from "./football/FootballConsole";
import { drawMotion, entryElapsed, motionFor } from "./football/motion";
import { EXIT_MS } from "./football/motion";
import { FootballDeck } from "./football/FootballDeck";
import { AudioBar } from "./football/AudioBar";
import { FootballMedia } from "./football/FootballMedia";
import { playSfx } from "./football/sfx";
import { deleteMedia, listMedia, saveMedia, type MediaCategory, type MediaItem } from "./football/mediaLibrary";
import { getCompetition } from "./football/competitions";
import { footballDesignDocument, renderFootballDesign } from "./football/designs";
import { getDesignImage } from "./football/raster";
import { useFootballMatch } from "./football/useFootballMatch";
import type { DesignStyle, GraphicVariant } from "./graphicExport";

// Single live match shared by every football widget (Preview and Program).
let liveFootballMatch: FootballScoreboard | null = null;

const footballDefaultVariant = (graphic: BroadcastGraphic): GraphicVariant =>
  graphic.variant ?? (graphic.kind === "scoreboard" ? "elite" : graphic.kind === "ticker" ? "events" : "lower");

function footballDesignFor(graphic: BroadcastGraphic) {
  return renderFootballDesign(footballDefaultVariant(graphic), liveFootballMatch ?? graphic.football!, graphic.title, graphic.subtitle, graphic.style);
}

// Keeps a football widget fully inside the 1920×1080 frame, even for positions saved by older versions.
function footballPosition(graphic: BroadcastGraphic, design: { width: number; height: number }) {
  const scale = graphic.scale ?? 1;
  const position = graphic.position ?? { x: 3, y: 4 };
  const maxX = Math.max(0, 100 - (design.width * scale) / 19.2);
  const maxY = Math.max(0, 100 - (design.height * scale) / 10.8);
  return { x: Math.min(Math.max(0, position.x), maxX), y: Math.min(Math.max(0, position.y), maxY) };
}
import { loadLatestFootballBroadcast, saveFootballBroadcast, type FootballBroadcastPayload, type FootballPlayer } from "@/lib/footballBroadcastStorage";

type InputKind = "camera" | "screen" | "video" | "image" | "audio";
type SceneLayout = "auto" | "single" | "split" | "triple" | "pip";
type TransitionMode = "cut" | "fade" | "wipe" | "dip";

interface BroadcastInput {
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

interface AudioRoute {
  source: AudioNode;
  gain: GainNode;
  pan: StereoPannerNode;
}

interface BroadcastScene {
  id: string;
  mode?: BroadcastMode;
  name: string;
  inputIds: string[];
  graphicId: string | null;
  graphicIds?: string[];
  layout?: SceneLayout;
  backgroundId?: string | null;
}

export type { BroadcastGraphic } from "./graphicExport";

const INITIAL_SCENES: BroadcastScene[] = [
  { id: "scene-wide", mode: "normal", name: "Cámara principal", inputIds: [], graphicId: null },
  { id: "scene-interview", mode: "normal", name: "Entrevista", inputIds: [], graphicId: null },
  { id: "scene-break", mode: "normal", name: "Pausa", inputIds: [], graphicId: null },
];

const INITIAL_GRAPHICS: BroadcastGraphic[] = [
  { id: "graphic-lower-third", mode: "normal", name: "Identificador", kind: "lower-third", title: "NOMBRE DEL INVITADO", subtitle: "Cargo · Equipo", accent: "#ef4444" },
  {
    id: "graphic-scoreboard",
    mode: "football",
    name: "Marcador fútbol",
    kind: "scoreboard",
    title: "LOCAL  0  —  0  VISITANTE",
    subtitle: "EN VIVO · 1T  00:00",
    accent: "#ef4444",
    variant: "elite",
    football: {
      homeTeam: "LOCAL",
      awayTeam: "VISITANTE",
      homeScore: 0,
      awayScore: 0,
      period: "1T",
      clockSeconds: 0,
      addedTime: 0,
      homeYellow: 0,
      awayYellow: 0,
      homeRed: 0,
      awayRed: 0,
      accent2: "#f97316",
      competition: "PARTIDO EN VIVO",
    },
    position: { x: 69, y: 7 },
  },
];

const STORAGE_SCENES = "nexus-broadcaster-scenes-v1";
const STORAGE_GRAPHICS = "nexus-broadcaster-graphics-v1";
const INPUT_KIND_LABEL: Record<InputKind, string> = {
  camera: "Cámara",
  screen: "Pantalla",
  video: "Video",
  image: "Imagen",
  audio: "Audio",
};
const footballLogoCache = new Map<string, HTMLImageElement>();

function createId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function createFootballScoreboard(): FootballScoreboard {
  return {
    homeTeam: "LOCAL",
    awayTeam: "VISITANTE",
    homeScore: 0,
    awayScore: 0,
    period: "1T",
    clockSeconds: 0,
    addedTime: 0,
    homeYellow: 0,
    awayYellow: 0,
    homeRed: 0,
    awayRed: 0,
    accent2: "#f97316",
    competition: "PARTIDO EN VIVO",
    homeShots: 0,
    awayShots: 0,
    homePossession: 50,
    awayPossession: 50,
    homeSubstitutions: 0,
    awaySubstitutions: 0,
    matchStatus: "scheduled",
    chromaKey: false,
    chromaColor: "#00ff00",
  };
}

function formatMediaTime(seconds: number): string {
  const safeSeconds = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  return `${String(Math.floor(safeSeconds / 60)).padStart(2, "0")}:${String(safeSeconds % 60).padStart(2, "0")}`;
}

function readStored<T>(key: string, fallback: T, isValid: (value: unknown) => value is T): T {
  const raw = window.localStorage.getItem(key);
  if (!raw) return fallback;
  const value: unknown = JSON.parse(raw);
  if (!isValid(value)) throw new Error(`El formato guardado de ${key} no es válido`);
  return value;
}

function isScenes(value: unknown): value is BroadcastScene[] {
  return Array.isArray(value) && value.every((scene) =>
    typeof scene.id === "string" && typeof scene.name === "string"
    && Array.isArray(scene.inputIds) && (scene.graphicId === null || typeof scene.graphicId === "string")
    && (scene.graphicIds === undefined || Array.isArray(scene.graphicIds))
    && (scene.layout === undefined || ["auto", "single", "split", "triple", "pip"].includes(scene.layout)));
}

function isGraphics(value: unknown): value is BroadcastGraphic[] {
  return Array.isArray(value) && value.every((graphic) =>
    typeof graphic.id === "string" && typeof graphic.name === "string"
    && ["lower-third", "scoreboard", "ticker"].includes(graphic.kind)
    && typeof graphic.title === "string" && typeof graphic.subtitle === "string"
    && typeof graphic.accent === "string");
}

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

function drawScene(
  canvas: HTMLCanvasElement,
  scene: BroadcastScene | undefined,
  inputs: BroadcastInput[],
  videoElements: Map<string, HTMLVideoElement>,
  imageElements: Map<string, HTMLImageElement>,
  graphics: BroadcastGraphic[],
  opacity = 1,
) {
  const context = canvas.getContext("2d");
  if (!context) return;
  const width = 1920;
  const height = 1080;
  context.save();
  context.scale(canvas.width / width, canvas.height / height);
  context.fillStyle = "#101114";
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
    if (graphic.mode === "football" && (liveFootballMatch || graphic.football)) {
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
          elapsed: entryElapsed(`${width}|${graphic.id}`, performance.now()),
          motion: motionFor(graphic.variant, liveFootballMatch?.highlight),
          tone: /^#[0-9a-f]{6}$/i.test(sideColor ?? "") ? sideColor as string : "#38bdf8",
          leavingAt: graphic.leavingAt,
        });
      }      return;
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

function drawTransition(
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
    drawScene(canvas, fromScene, inputs, videoElements, imageElements, fromGraphics);
    context.save();
    context.beginPath();
    context.rect(0, 0, canvas.width * clamped, canvas.height);
    context.clip();
    drawScene(canvas, toScene, inputs, videoElements, imageElements, toGraphics);
    context.restore();
    return;
  }
  if (mode === "dip") {
    if (clamped < 0.5) {
      drawScene(canvas, fromScene, inputs, videoElements, imageElements, fromGraphics);
      context.save();
      context.fillStyle = `rgba(0,0,0,${clamped * 2})`;
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.restore();
    } else {
      context.fillStyle = "#000";
      context.fillRect(0, 0, canvas.width, canvas.height);
      drawScene(canvas, toScene, inputs, videoElements, imageElements, toGraphics, (clamped - 0.5) * 2);
    }
    return;
  }
  drawScene(canvas, fromScene, inputs, videoElements, imageElements, fromGraphics, 1 - clamped);
  drawScene(canvas, toScene, inputs, videoElements, imageElements, toGraphics, clamped);
}

export default function BroadcasterView() {
  const [scenes, setScenes] = useState(INITIAL_SCENES);
  const [graphics, setGraphics] = useState(INITIAL_GRAPHICS);
  const [inputs, setInputs] = useState<BroadcastInput[]>([]);
  const [cropInputId, setCropInputId] = useState<string | null>(null);
  const [previewSceneId, setPreviewSceneId] = useState(INITIAL_SCENES[0].id);
  const [programSceneId, setProgramSceneId] = useState(INITIAL_SCENES[2].id);
  const [programSceneSnapshot, setProgramSceneSnapshot] = useState<BroadcastScene>(INITIAL_SCENES[2]);
  const [programGraphicsSnapshot, setProgramGraphicsSnapshot] = useState<BroadcastGraphic[]>([]);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState("");
  const [selectedMicrophoneId, setSelectedMicrophoneId] = useState("");
  const [editingGraphic, setEditingGraphic] = useState<BroadcastGraphic | null>(null);
  const [whipUrl, setWhipUrl] = useState("");
  const [whipToken, setWhipToken] = useState("");
  const [whipOpen, setWhipOpen] = useState(false);
  const [live, setLive] = useState(false);
  const liveRef = useRef(live);
  const [recording, setRecording] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [activePane, setActivePane] = useState<"inputs" | "graphics" | "football">("inputs");
  const [controllerName, setControllerName] = useState("");
  const [transitionMode, setTransitionMode] = useState<TransitionMode>("fade");
  const [transitionMs, setTransitionMs] = useState(500);
  const [ftb, setFtb] = useState(false);
  const [guestRoom, setGuestRoom] = useState<string | null>(null);
  const guestPeerRef = useRef<Peer | null>(null);
  const activeTransitionModeRef = useRef<TransitionMode>("cut");
  const [renamingSceneId, setRenamingSceneId] = useState<string | null>(null);
  const [sceneNameDraft, setSceneNameDraft] = useState("");
  const [mediaProgress, setMediaProgress] = useState<Record<string, { currentTime: number; duration: number }>>({});
  const [topbarHost, setTopbarHost] = useState<HTMLElement | null>(null);
  const fm = useFootballMatch();
  const [selectedFootballGraphicId, setSelectedFootballGraphicId] = useState<string | null>(null);
  const [footballMatchId, setFootballMatchId] = useState<string | null>(null);
  const [footballMatchName, setFootballMatchName] = useState("Partido sin título");
  const [footballLineups, setFootballLineups] = useState<{ home: FootballPlayer[]; away: FootballPlayer[] }>({ home: [], away: [] });
  const [footballEvents, setFootballEvents] = useState<FootballBroadcastPayload["events"]>([]);
  const [lineupDrafts, setLineupDrafts] = useState({ home: "", away: "" });
  const [lineupDorsals, setLineupDorsals] = useState({ home: "1", away: "1" });
  const [lineupPositions, setLineupPositions] = useState<{ home: FootballPlayer["position"]; away: FootballPlayer["position"] }>({ home: "MED", away: "MED" });
  const [footballSection, setFootballSection] = useState<"match" | "lineups" | "events" | "analytics">("match");
  const [footballGoalHistory, setFootballGoalHistory] = useState<Array<{ team: "home" | "away"; eventId: string }>>([]);
  const [footballAuditLog, setFootballAuditLog] = useState<NonNullable<FootballBroadcastPayload["audit"]>>([]);
  const [rightStudioTab, setRightStudioTab] = useState<"composition" | "properties" | "animation">("composition");
  const [hiddenFootballLayers, setHiddenFootballLayers] = useState<string[]>([]);
  const [footballStorageReady, setFootballStorageReady] = useState(false);
  const footballSaveErrorShownRef = useRef(false);
  const [draggingPreviewGraphicId, setDraggingPreviewGraphicId] = useState<string | null>(null);
  const [selectedGraphicId, setSelectedGraphicId] = useState<string | null>(null);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; title: string; items: Array<{ label: string; hint?: string; danger?: boolean; run: () => void }> } | null>(null);

  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const programCanvasRef = useRef<HTMLCanvasElement>(null);
  const inputVideoRefs = useRef(new Map<string, HTMLVideoElement>());
  const [mediaLibrary, setMediaLibrary] = useState<MediaItem[]>([]);
  const [promoItemId, setPromoItemId] = useState<string | null>(null);
  const promoRestoreRef = useRef<{ sceneId: string; inputIds: string[]; layout?: SceneLayout } | null>(null);
  useEffect(() => {
    listMedia().then(setMediaLibrary).catch(() => toast.error("No se pudo leer la biblioteca de medios"));
  }, []);
  const inputImageRefs = useRef(new Map<string, HTMLImageElement>());
  const inputsRef = useRef(inputs);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const outputStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioRoutesRef = useRef(new Map<string, AudioRoute[]>());
  const masterGainRef = useRef<GainNode | null>(null);
  const [masterVolume, setMasterVolume] = useState(1);
  const masterVolumeRef = useRef(1);
  masterVolumeRef.current = masterVolume;
  const mediaElementSourcesRef = useRef(new Map<string, MediaElementAudioSourceNode>());
  const programFadeAlphaRef = useRef(1);
  const isTransitioningRef = useRef(false);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const whipResourceRef = useRef<string | null>(null);
  const gamepadButtonsRef = useRef<boolean[]>([]);
  const transitionStateRef = useRef<{ fromId: string; toId: string; progress: number } | null>(null);
  const templatePreviewRef = useRef<HTMLDivElement>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const previewDragRef = useRef({ graphicId: "", offsetX: 0, offsetY: 0 });
  const didLoadStorageRef = useRef(false);
  const storageErrorShownRef = useRef(false);
  inputsRef.current = inputs;
  const previewSceneIdRef = useRef(previewSceneId);
  previewSceneIdRef.current = previewSceneId;

  useEffect(() => {
    setTopbarHost(document.querySelector("[data-broadcaster-topbar-slot]"));
  }, []);

  const studioMode: BroadcastMode = activePane === "football" ? "football" : "normal";
  const modeScenes = scenes.filter((scene) => (scene.mode ?? "normal") === studioMode);
  const modeGraphics = graphics.filter((graphic) => (graphic.mode ?? (graphic.football ? "football" : "normal")) === studioMode);
  const previewScene = scenes.find((scene) => scene.id === previewSceneId);
  const programScene = programSceneSnapshot;
  const getSceneGraphics = useCallback((scene: BroadcastScene | undefined) => {
    const ids = scene?.graphicIds?.length ? scene.graphicIds : scene?.graphicId ? [scene.graphicId] : [];
    return ids.map((id) => graphics.find((graphic) => graphic.id === id)).filter((graphic): graphic is BroadcastGraphic => Boolean(graphic));
  }, [graphics]);
  const previewGraphics = getSceneGraphics(previewScene);
  const programGraphics = programGraphicsSnapshot;
  const elapsedLabel = `${String(Math.floor(elapsedSeconds / 3600)).padStart(2, "0")}:${String(Math.floor((elapsedSeconds % 3600) / 60)).padStart(2, "0")}:${String(elapsedSeconds % 60).padStart(2, "0")}`;
  const whipHost = useMemo(() => {
    try {
      return whipUrl ? new URL(whipUrl).host : "Sin configurar";
    } catch {
      return "Endpoint inválido";
    }
  }, [whipUrl]);
  liveRef.current = live;

  useEffect(() => {
    try {
      const storedScenes = readStored(STORAGE_SCENES, INITIAL_SCENES, isScenes);
      const storedGraphics = readStored(STORAGE_GRAPHICS, INITIAL_GRAPHICS, isGraphics);
      if (storedScenes.length) {
        setScenes(storedScenes);
        setPreviewSceneId(storedScenes[0].id);
        const storedProgramScene = storedScenes[1] ?? storedScenes[0];
        setProgramSceneId(storedProgramScene.id);
        setProgramSceneSnapshot(storedProgramScene);
      }
      if (storedGraphics.length) {
        const normalizedGraphics = storedGraphics.map((graphic) => ({
          ...graphic,
          mode: graphic.mode ?? (graphic.football ? "football" : "normal"),
          ...(graphic.kind === "scoreboard" && !graphic.football ? { football: createFootballScoreboard(), mode: "football" as const } : {}),
        }));
        setGraphics(normalizedGraphics);
        const storedProgramScene = storedScenes[1] ?? storedScenes[0];
        const ids = storedProgramScene?.graphicIds?.length ? storedProgramScene.graphicIds : storedProgramScene?.graphicId ? [storedProgramScene.graphicId] : [];
        setProgramGraphicsSnapshot(ids.map((id) => normalizedGraphics.find((graphic) => graphic.id === id)).filter((graphic): graphic is BroadcastGraphic => Boolean(graphic)));
      }
    } catch (error) {
      toast.error("No se pudieron cargar las escenas o plantillas guardadas", {
        description: error instanceof Error ? error.message : "Error de almacenamiento local",
      });
    } finally {
      didLoadStorageRef.current = true;
    }
  }, []);

  useEffect(() => {
    if (!didLoadStorageRef.current) return;
    try {
      window.localStorage.setItem(STORAGE_SCENES, JSON.stringify(scenes));
      window.localStorage.setItem(STORAGE_GRAPHICS, JSON.stringify(graphics));
    } catch (error) {
      if (!storageErrorShownRef.current) {
        toast.error("No se pudieron guardar las plantillas en este navegador", {
          description: error instanceof Error ? error.message : "Almacenamiento local no disponible",
        });
        storageErrorShownRef.current = true;
      }
    }
  }, [scenes, graphics]);

  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) {
      toast.error("Este navegador no permite consultar dispositivos multimedia");
      return;
    }
    try {
      const available = await navigator.mediaDevices.enumerateDevices();
      setDevices(available.filter((device) => device.kind === "videoinput" || device.kind === "audioinput"));
    } catch (error) {
      toast.error("No se pudieron consultar los dispositivos", {
        description: error instanceof Error ? error.message : "Error de permisos",
      });
    }
  }, []);

  useEffect(() => {
    void refreshDevices();
  }, [refreshDevices]);

  const connectCamera = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("getUserMedia no está disponible en este navegador");
      const constraints: MediaStreamConstraints = {
        video: selectedCameraId ? { deviceId: { exact: selectedCameraId }, width: 1920, height: 1080 } : { width: 1920, height: 1080 },
        audio: false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      const track = stream.getVideoTracks()[0];
      const input: BroadcastInput = {
        id: createId("camera"),
        name: track?.label || "Cámara",
        kind: "camera",
        stream,
        muted: false,
        volume: 1,
      };
      setInputs((current) => [...current, input]);
      setScenes((current) => current.map((scene) => scene.id === previewSceneId
        ? { ...scene, inputIds: [...scene.inputIds, input.id] }
        : scene));
      await refreshDevices();
      toast.success("Cámara conectada");
    } catch (error) {
      toast.error("No se pudo conectar la cámara", {
        description: error instanceof Error ? error.message : "Revisa los permisos del navegador",
      });
    }
  };

  const connectMicrophone = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("getUserMedia no está disponible en este navegador");
      const audio = selectedMicrophoneId ? { deviceId: { exact: selectedMicrophoneId } } : true;
      const stream = await navigator.mediaDevices.getUserMedia({ audio, video: false });
      const track = stream.getAudioTracks()[0];
      const input: BroadcastInput = {
        id: createId("mic"),
        name: track?.label || "Micrófono",
        kind: "audio",
        stream,
        muted: false,
        volume: 1,
      };
      setInputs((current) => [...current, input]);
      setScenes((current) => current.map((scene) => scene.id === previewSceneId
        ? { ...scene, inputIds: [...scene.inputIds, input.id] }
        : scene));
      await refreshDevices();
      toast.success("Micrófono conectado");
    } catch (error) {
      toast.error("No se pudo conectar el micrófono", {
        description: error instanceof Error ? error.message : "Revisa los permisos del navegador",
      });
    }
  };

  const connectScreen = async () => {
    try {
      if (!navigator.mediaDevices?.getDisplayMedia) throw new Error("La captura de pantalla no está disponible");
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 30, max: 60 }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: true });
      const track = stream.getVideoTracks()[0];
      if (track && "contentHint" in track) track.contentHint = "detail";
      const input: BroadcastInput = {
        id: createId("screen"), name: track?.label || "Pantalla", kind: "screen", stream, muted: false, volume: 1,
      };
      setInputs((current) => [...current, input]);
      setScenes((current) => current.map((scene) => scene.id === previewSceneId
        ? { ...scene, inputIds: [...scene.inputIds, input.id] }
        : scene));
      track.addEventListener("ended", () => {
        setInputs((current) => current.filter((source) => source.id !== input.id));
        setScenes((current) => current.map((scene) => ({ ...scene, inputIds: scene.inputIds.filter((id) => id !== input.id) })));
      }, { once: true });
      toast.success("Pantalla compartida");
    } catch (error) {
      toast.error("No se pudo iniciar la captura de pantalla", {
        description: error instanceof Error ? error.message : "La captura fue cancelada o no está permitida",
      });
    }
  };

  const addMediaFile = (file: File) => {
    const kind: InputKind | null = file.type.startsWith("video/") ? "video"
      : file.type.startsWith("image/") ? "image" : null;
    if (!kind) {
      toast.error("Formato no compatible", { description: "Usa un archivo de video o imagen. El audio se conecta desde un micrófono." });
      return;
    }
    const input: BroadcastInput = {
      id: createId(kind), name: file.name, kind, url: URL.createObjectURL(file), muted: false, volume: 1,
      ...(kind === "video" ? { playing: true, loop: false } : {}),
    };
    if (kind === "image" && input.url) {
      const image = new Image();
      image.src = input.url;
      inputImageRefs.current.set(input.id, image);
    }
    setInputs((current) => [...current, input]);
    setScenes((current) => current.map((scene) => scene.id === previewSceneId
      ? { ...scene, inputIds: [...scene.inputIds, input.id] }
      : scene));
    toast.success(`${INPUT_KIND_LABEL[kind]} agregado a la escena`);
  };

  const removeInput = (input: BroadcastInput) => {
    input.stream?.getTracks().forEach((track) => track.stop());
    if (input.url) URL.revokeObjectURL(input.url);
    inputVideoRefs.current.delete(input.id);
    inputImageRefs.current.delete(input.id);
    setInputs((current) => current.filter((source) => source.id !== input.id));
    setScenes((current) => current.map((scene) => ({ ...scene, inputIds: scene.inputIds.filter((id) => id !== input.id) })));
  };

  const closeGuestRoom = useCallback(() => {
    guestPeerRef.current?.destroy();
    guestPeerRef.current = null;
    setGuestRoom(null);
    setInputs((current) => current.filter((item) => !item.id.startsWith("guest-")));
    setScenes((current) => current.map((scene) => ({ ...scene, inputIds: scene.inputIds.filter((id) => !id.startsWith("guest-")) })));
  }, []);

  // Fuente fija del invitado: existe desde que se crea el enlace y nunca entra sola a Program.
  const swapGuestInput = (fromId: string, to: BroadcastInput | null) => {
    setInputs((current) => {
      const rest = current.filter((item) => item.id !== fromId);
      return to ? [...rest, to] : rest;
    });
    setScenes((current) => current.map((scene) => ({
      ...scene,
      inputIds: to ? scene.inputIds.map((id) => (id === fromId ? to.id : id)) : scene.inputIds.filter((id) => id !== fromId),
    })));
  };
  const guestWaitingInput: BroadcastInput = { id: "guest-wait", name: "Invitado · esperando señal", kind: "camera", muted: false, volume: 1 };

  const openGuestRoom = async () => {
    if (guestPeerRef.current) return;
    const room = createRoomCode();
    try {
      const { Peer } = await import("peerjs");
      const peer = new Peer(hostPeerId(room));
      guestPeerRef.current = peer;
      peer.on("open", () => {
        setGuestRoom(room);
        setInputs((current) => current.some((item) => item.id === guestWaitingInput.id) ? current : [...current, guestWaitingInput]);
        toast.success("Sala lista", { description: "El invitado aparece en Medios esperando señal; tú decides cuándo sale al aire" });
      });
      peer.on("call", (call) => {
        call.answer();
        call.on("stream", (stream) => {
          const guestName = typeof call.metadata?.name === "string" ? call.metadata.name : "Invitado";
          const input: BroadcastInput = { id: `guest-${call.peer}`, name: `Invitado · ${guestName}`, kind: "camera", stream, muted: false, volume: 1 };
          if (inputsRef.current.some((item) => item.id === input.id)) return;
          swapGuestInput(guestWaitingInput.id, input);
          toast.success(`${guestName} se conectó`, { description: "Disponible en Medios. Llévalo a Preview cuando quieras" });
        });
        call.on("close", () => {
          const id = `guest-${call.peer}`;
          swapGuestInput(id, guestWaitingInput);
          inputVideoRefs.current.delete(id);
          toast.info("El invitado salió de la llamada");
        });
      });
      peer.on("error", (error) => {
        toast.error("No se pudo abrir la sala de invitados", { description: error.message });
        closeGuestRoom();
      });
    } catch (error) {
      toast.error("No se pudo abrir la sala de invitados", { description: error instanceof Error ? error.message : undefined });
    }
  };

  const copyGuestLink = async () => {
    if (!guestRoom) return;
    try {
      await navigator.clipboard.writeText(guestUrl(window.location.origin, guestRoom));
      toast.success("Enlace copiado");
    } catch {
      toast.error("No se pudo copiar el enlace");
    }
  };

  useEffect(() => () => { guestPeerRef.current?.destroy(); }, []);

  const takeScene = useCallback((override?: TransitionMode) => {
    if (isTransitioningRef.current) return;
    // Same scene: refresh Program with the prepared composition instead of blocking the take.
    const mode = ftb || programSceneId === previewSceneId ? "cut" : override ?? transitionMode;
    const targetScene = scenes.find((scene) => scene.id === previewSceneId);
    if (!targetScene) return;
    const targetGraphics = getSceneGraphics(targetScene);
    if (mode === "cut") {
      if (!ftb) programFadeAlphaRef.current = 1;
      setProgramSceneSnapshot({ ...targetScene, inputIds: [...targetScene.inputIds], graphicIds: targetScene.graphicIds ? [...targetScene.graphicIds] : undefined });
      setProgramGraphicsSnapshot(targetGraphics);
      setProgramSceneId(previewSceneId);
      return;
    }

    const targetSceneId = previewSceneId;
    const startedAt = performance.now();
    const duration = transitionMs;
    activeTransitionModeRef.current = mode;
    let sceneChanged = false;
    isTransitioningRef.current = true;
    transitionStateRef.current = { fromId: programSceneId, toId: targetSceneId, progress: 0 };
    const animateFade = (now: number) => {
      const progress = Math.min((now - startedAt) / duration, 1);
      transitionStateRef.current = { fromId: programSceneId, toId: targetSceneId, progress };
      if (progress < 0.5) {
        programFadeAlphaRef.current = 1 - progress * 2;
      } else {
        if (!sceneChanged) {
          sceneChanged = true;
          setProgramSceneSnapshot({ ...targetScene, inputIds: [...targetScene.inputIds], graphicIds: targetScene.graphicIds ? [...targetScene.graphicIds] : undefined });
          setProgramGraphicsSnapshot(targetGraphics);
          setProgramSceneId(targetSceneId);
        }
        programFadeAlphaRef.current = (progress - 0.5) * 2;
      }
      if (progress < 1) requestAnimationFrame(animateFade);
      else {
        programFadeAlphaRef.current = 1;
        isTransitioningRef.current = false;
        transitionStateRef.current = null;
      }
    };
    requestAnimationFrame(animateFade);
  }, [ftb, getSceneGraphics, previewSceneId, programSceneId, scenes, transitionMode, transitionMs]);

  const toggleProgramOverlay = useCallback((graphicId: string) => {
    const graphic = graphics.find((item) => item.id === graphicId);
    if (!graphic) return;
    setProgramGraphicsSnapshot((current) => current.some((item) => item.id === graphicId)
      ? current.filter((item) => item.id !== graphicId)
      : [...current, { ...graphic }]);
  }, [graphics]);

  const toggleFadeToBlack = useCallback(() => {
    if (isTransitioningRef.current) return;
    const goBlack = !ftb;
    const from = programFadeAlphaRef.current;
    const to = goBlack ? 0 : 1;
    const startedAt = performance.now();
    isTransitioningRef.current = true;
    setFtb(goBlack);
    const step = (now: number) => {
      const progress = Math.min((now - startedAt) / transitionMs, 1);
      programFadeAlphaRef.current = from + (to - from) * progress;
      if (progress < 1) requestAnimationFrame(step);
      else isTransitioningRef.current = false;
    };
    requestAnimationFrame(step);
  }, [ftb, transitionMs]);

  const createOutputStream = useCallback(async () => {
    if (outputStreamRef.current) return outputStreamRef.current;
    const canvas = programCanvasRef.current;
    if (!canvas) throw new Error("La salida de programa no está disponible");
    const stream = canvas.captureStream(30);
    outputStreamRef.current = stream;
    const audioContext = audioContextRef.current ?? new AudioContext();
    audioContextRef.current = audioContext;
    await audioContext.resume();
    const destination = audioContext.createMediaStreamDestination();
    const master = audioContext.createGain();
    master.gain.value = masterVolumeRef.current;
    master.connect(destination);
    masterGainRef.current = master;
    const sceneInputIds = new Set(programSceneSnapshot.inputIds);

    inputs.forEach((input) => {
      let source: AudioNode | undefined;
      const audioTracks = input.stream?.getAudioTracks() ?? [];
      if (audioTracks.length) {
        source = audioContext.createMediaStreamSource(new MediaStream(audioTracks));
      } else if (input.kind === "video") {
        const element = inputVideoRefs.current.get(input.id);
        if (element) {
          let mediaSource = mediaElementSourcesRef.current.get(input.id);
          if (!mediaSource) {
            mediaSource = audioContext.createMediaElementSource(element);
            mediaElementSourcesRef.current.set(input.id, mediaSource);
          }
          source = mediaSource;
          element.muted = false;
        }
      }
      if (!source) return;

      const gain = audioContext.createGain();
      const isInProgram = sceneInputIds.has(input.id);
      gain.gain.value = isInProgram && !input.muted ? input.volume : 0;
      const pan = audioContext.createStereoPanner();
      pan.pan.value = input.pan ?? 0;
      source.connect(gain);
      gain.connect(pan);
      pan.connect(master);
      const routes = audioRoutesRef.current.get(input.id) ?? [];
      audioRoutesRef.current.set(input.id, [...routes, { source, gain, pan }]);
    });

    destination.stream.getAudioTracks().forEach((track) => stream.addTrack(track));
    if (destination.stream.getAudioTracks().length) {
      const tracks = audioRoutesRef.current;
      const updateAudioMix = () => {
        tracks.forEach((routes, inputId) => {
          const input = inputs.find((item) => item.id === inputId);
          const enabled = Boolean(input && sceneInputIds.has(inputId) && !input.muted);
          routes.forEach(({ gain }) => {
            gain.gain.setTargetAtTime(enabled ? input?.volume ?? 1 : 0, audioContext.currentTime, 0.02);
          });
        });
      };
      updateAudioMix();
    }
    outputStreamRef.current = stream;
    return stream;
  }, [inputs, programSceneSnapshot]);

  const releaseOutputStream = useCallback(async () => {
    outputStreamRef.current?.getTracks().forEach((track) => track.stop());
    outputStreamRef.current = null;
    audioRoutesRef.current.forEach((routes) => routes.forEach(({ source, gain, pan }) => {
      source.disconnect(gain);
      gain.disconnect();
      pan.disconnect();
    }));
    audioRoutesRef.current.clear();
    masterGainRef.current?.disconnect();
    masterGainRef.current = null;
    inputsRef.current.forEach((input) => {
      const element = inputVideoRefs.current.get(input.id);
      if (element) element.muted = true;
    });
  }, []);

  const startRecording = useCallback(async () => {
    if (recording) return;
    try {
      if (!("MediaRecorder" in window)) throw new Error("MediaRecorder no está disponible en este navegador");
      const stream = await createOutputStream();
      const mimeType = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"]
        .find((candidate) => MediaRecorder.isTypeSupported(candidate));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recordedChunksRef.current = [];
      recorder.addEventListener("dataavailable", (event) => {
        if (event.data.size) recordedChunksRef.current.push(event.data);
      });
      recorder.addEventListener("stop", () => {
        const blob = new Blob(recordedChunksRef.current, { type: recorder.mimeType || "video/webm" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `nexus-broadcast-${new Date().toISOString().replace(/[:.]/g, "-")}.webm`;
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        toast.success("Grabación lista", { description: "El archivo WebM se descargó en este dispositivo." });
        if (!liveRef.current) void releaseOutputStream();
      });
      mediaRecorderRef.current = recorder;
      recorder.start(1000);
      if (!liveRef.current) setElapsedSeconds(0);
      setRecording(true);
      toast.success("Grabación iniciada");
    } catch (error) {
      if (!liveRef.current) await releaseOutputStream();
      toast.error("No se pudo iniciar la grabación", {
        description: error instanceof Error ? error.message : "Error de captura",
      });
    }
  }, [createOutputStream, recording, releaseOutputStream]);

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder?.state === "recording") recorder.stop();
    mediaRecorderRef.current = null;
    setRecording(false);
  }, []);

  const publishWhip = async () => {
    if (live) return;
    if (!whipUrl.trim()) {
      setWhipOpen(true);
      return;
    }
    let peer: RTCPeerConnection | null = null;
    try {
      const endpoint = new URL(whipUrl.trim());
      if (endpoint.protocol !== "https:" && endpoint.hostname !== "localhost" && endpoint.hostname !== "127.0.0.1") {
        throw new Error("El endpoint de emisión debe usar HTTPS");
      }
      const stream = await createOutputStream();
      peer = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
      peerConnectionRef.current = peer;
      stream.getTracks().forEach((track) => peer?.addTrack(track, stream));
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      if (peer.iceGatheringState !== "complete") {
        await new Promise<void>((resolve, reject) => {
          const timeout = window.setTimeout(() => reject(new Error("Tiempo de espera al reunir candidatos ICE")), 10000);
          peer?.addEventListener("icegatheringstatechange", () => {
            if (peer?.iceGatheringState === "complete") {
              window.clearTimeout(timeout);
              resolve();
            }
          });
        });
      }
      const sdp = peer.localDescription?.sdp;
      if (!sdp) throw new Error("No se pudo crear la oferta WebRTC");
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/sdp",
          Accept: "application/sdp",
          ...(whipToken.trim() ? { Authorization: `Bearer ${whipToken.trim()}` } : {}),
        },
        body: sdp,
      });
      if (!response.ok) throw new Error(`El servidor WHIP respondió HTTP ${response.status}`);
      const answer = await response.text();
      const resource = response.headers.get("Location");
      if (!answer || !resource) throw new Error("El endpoint no devolvió la respuesta WHIP esperada");
      await peer.setRemoteDescription({ type: "answer", sdp: answer });
      whipResourceRef.current = new URL(resource, endpoint).toString();
      if (!recording) setElapsedSeconds(0);
      setLive(true);
      toast.success("Emisión conectada");
    } catch (error) {
      peer?.close();
      peerConnectionRef.current = null;
      toast.error("No se pudo iniciar la emisión WHIP", {
        description: error instanceof Error ? error.message : "Verifica el gateway y su configuración CORS",
      });
      if (!recording) await releaseOutputStream();
    }
  };

  const stopLive = async () => {
    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;
    const resource = whipResourceRef.current;
    whipResourceRef.current = null;
    setLive(false);
    if (resource) {
      try {
        const response = await fetch(resource, { method: "DELETE" });
        if (!response.ok && response.status !== 404) throw new Error(`HTTP ${response.status}`);
      } catch (error) {
        toast.error("No se pudo cerrar el recurso WHIP", {
          description: error instanceof Error ? error.message : "Error al cerrar la emisión",
        });
      }
    }
    if (!recording) await releaseOutputStream();
    toast.success("Emisión detenida");
  };

  const toggleSceneInput = (sceneId: string, inputId: string) => {
    setScenes((current) => current.map((scene) => {
      if (scene.id !== sceneId) return scene;
      const inputIds = scene.inputIds.includes(inputId)
        ? scene.inputIds.filter((id) => id !== inputId)
        : [...scene.inputIds, inputId];
      return { ...scene, inputIds };
    }));
  };

  const updateInput = (inputId: string, updates: Partial<Pick<BroadcastInput, "muted" | "volume" | "pan" | "playing" | "loop" | "crop">>) => {
    setInputs((current) => current.map((input) => input.id === inputId ? { ...input, ...updates } : input));
  };

  const toggleMediaPlayback = (input: BroadcastInput) => {
    const element = inputVideoRefs.current.get(input.id);
    if (!element || input.kind !== "video") return;
    if (element.paused) {
      void element.play().then(() => setInputs((current) => current.map((item) =>
        item.id === input.id ? { ...item, playing: true } : item,
      ))).catch((error: unknown) => {
        toast.error("No se pudo reproducir el archivo", {
          description: error instanceof Error ? error.message : "Error de reproducción",
        });
      });
    } else {
      element.pause();
      setInputs((current) => current.map((item) => item.id === input.id ? { ...item, playing: false } : item));
    }
  };

  const updateMediaProgress = (inputId: string, element: HTMLVideoElement) => {
    setMediaProgress((current) => ({
      ...current,
      [inputId]: { currentTime: element.currentTime, duration: Number.isFinite(element.duration) ? element.duration : 0 },
    }));
  };

  const seekMedia = (inputId: string, currentTime: number) => {
    const element = inputVideoRefs.current.get(inputId);
    if (!element) return;
    element.currentTime = currentTime;
    updateMediaProgress(inputId, element);
  };

  const addScene = () => {
    const scene: BroadcastScene = { id: createId("scene"), mode: studioMode, name: `Escena ${modeScenes.length + 1}`, inputIds: [], graphicId: null };
    setScenes((current) => [...current, scene]);
    setPreviewSceneId(scene.id);
  };

  const duplicateScene = (scene: BroadcastScene) => {
    const duplicate = {
      ...scene,
      id: createId("scene"),
      name: `${scene.name} copia`,
      inputIds: [...scene.inputIds],
    };
    setScenes((current) => {
      const index = current.findIndex((item) => item.id === scene.id);
      return [...current.slice(0, index + 1), duplicate, ...current.slice(index + 1)];
    });
    setPreviewSceneId(duplicate.id);
  };

  const saveSceneName = (sceneId: string) => {
    const name = sceneNameDraft.trim();
    if (!name) {
      toast.error("El nombre de la escena no puede estar vacío");
      return;
    }
    setScenes((current) => current.map((scene) => scene.id === sceneId ? { ...scene, name } : scene));
    setRenamingSceneId(null);
  };

  const removeScene = (scene: BroadcastScene) => {
    if (scenes.length <= 1) {
      toast.error("Debe quedar al menos una escena");
      return;
    }
    const remaining = scenes.filter((item) => item.id !== scene.id);
    setScenes(remaining);
    if (previewSceneId === scene.id) setPreviewSceneId(remaining[0].id);
    if (programSceneId === scene.id) setProgramSceneId(remaining[0].id);
  };

  const saveGraphic = (graphic: BroadcastGraphic) => {
    setGraphics((current) => current.some((item) => item.id === graphic.id)
      ? current.map((item) => item.id === graphic.id ? graphic : item)
      : [...current, graphic]);
    setEditingGraphic(null);
    toast.success("Plantilla guardada");
  };

  const footballWidgets = graphics.filter((graphic) => graphic.mode === "football");
  const footballPreviewIds = getSceneGraphics(previewScene).map((graphic) => graphic.id);
  const footballProgramIds = programGraphicsSnapshot.map((graphic) => graphic.id);

  const FOOTBALL_POSITIONS: Record<string, { x: number; y: number }> = {
    elite: { x: 3, y: 4 }, compact: { x: 3, y: 4 }, editorial: { x: 3, y: 4 }, live: { x: 19, y: 86 },
    goal: { x: 21.5, y: 66 }, lower: { x: 4, y: 78 }, var: { x: 3, y: 18 }, events: { x: 4, y: 82 },
    prematch: { x: 23, y: 26 }, "lineup-home": { x: 3, y: 17 }, "lineup-away": { x: 74, y: 17 }, stats: { x: 3, y: 17 },
  };
  const FOOTBALL_NAMES: Record<string, string> = {
    elite: "NEXUS Elite", compact: "NEXUS Compact", editorial: "NEXUS Editorial", live: "NEXUS Live", goal: "NEXUS Goal",
    lower: "NEXUS Lower Third", var: "NEXUS VAR", events: "NEXUS Match Events", prematch: "NEXUS Previa",
    "lineup-home": "Alineación local", "lineup-away": "Alineación visitante", stats: "NEXUS Estadísticas",
  };

  const addFootballWidget = (variant: GraphicVariant, options?: { style?: DesignStyle; scale?: number; position?: { x: number; y: number }; name?: string }) => {
    const graphic: BroadcastGraphic = {
      id: createId("graphic"),
      mode: "football",
      name: options?.name ?? FOOTBALL_NAMES[variant] ?? variant,
      kind: ["elite", "compact", "editorial", "live"].includes(variant) ? "scoreboard" : variant === "lower" ? "lower-third" : "ticker",
      title: "",
      subtitle: "",
      accent: getCompetition(fm.match.competitionId ?? "custom").accent,
      variant,
      style: options?.style,
      scale: options?.scale ?? 1,
      football: fm.match,
      position: options?.position ?? FOOTBALL_POSITIONS[variant] ?? { x: 5, y: 5 },
    };
    if (graphic.kind === "scoreboard") {
      // un solo marcador por escena: el nuevo reemplaza al anterior y se retira de la lista
      const sceneIds = new Set(previewScene?.graphicIds ?? (previewScene?.graphicId ? [previewScene.graphicId] : []));
      const boards = new Set(graphics.filter((item) => item.mode === "football" && item.kind === "scoreboard" && sceneIds.has(item.id)).map((item) => item.id));
      setGraphics((current) => [...current.filter((item) => !boards.has(item.id)), graphic]);
      setScenes((current) => current.map((scene) => {
        if (scene.id !== previewSceneId) return scene;
        const ids = (scene.graphicIds?.length ? scene.graphicIds : scene.graphicId ? [scene.graphicId] : []).filter((id) => !boards.has(id));
        return { ...scene, graphicIds: [...ids, graphic.id], graphicId: ids[0] ?? graphic.id };
      }));
    } else {
      assignGraphic(graphic.id);
    }
    toast.success(`${graphic.name} añadido a Preview`);
  };

  const [autoReact, setAutoReact] = useState(true);
  const [sfxOn, setSfxOn] = useState(true);
  const [sfxVolume, setSfxVolume] = useState(0.7);
  const sfxVolumeRef = useRef(0.7);
  sfxVolumeRef.current = sfxVolume;
  useEffect(() => {
    const saved = Number(window.localStorage.getItem("nexus-sfx-volume"));
    if (saved > 0 && saved <= 1) setSfxVolume(saved);
  }, []);
  const changeSfxVolume = (value: number) => {
    setSfxVolume(value);
    try { window.localStorage.setItem("nexus-sfx-volume", String(value)); } catch { /* sin almacenamiento */ }
  };
  const autoAirRef = useRef<{ id: string; timer: number } | null>(null);

  const footerKickoff = (() => {
    const at = fm.match.kickoff ? new Date(fm.match.kickoff).getTime() : NaN;
    if (Number.isNaN(at) || fm.match.period !== "PRE") return "";
    const diff = at - Date.now();
    if (diff <= 0) return "Inicio inminente";
    const d = Math.floor(diff / 86400000); const h = Math.floor((diff % 86400000) / 3600000); const m = Math.floor((diff % 3600000) / 60000);
    return d > 0 ? `Inicio en ${d} d ${h} h` : `Inicio en ${h} h ${m} min`;
  })();
  const exitProgram = (test: (item: BroadcastGraphic) => boolean) => {
    const stamp = Date.now();
    setProgramGraphicsSnapshot((current) => current.map((item) => (test(item) && !item.leavingAt ? { ...item, leavingAt: stamp } : item)));
    window.setTimeout(() => setProgramGraphicsSnapshot((current) => current.filter((item) => item.leavingAt !== stamp)), EXIT_MS + 40);
  };
  const retireProgramGraphic = (graphicId: string) => exitProgram((item) => item.id === graphicId);
  const retireAllProgram = () => {
    if (autoAirRef.current) { window.clearTimeout(autoAirRef.current.timer); autoAirRef.current = null; }
    exitProgram(() => true);
    fm.clearHighlight();
  };

  // Puts a temporary widget straight on Program and removes it after a few seconds.
  const airTemp = (variant: GraphicVariant, options: { title?: string; subtitle?: string } = {}, seconds = 7) => {
    if (autoAirRef.current) {
      window.clearTimeout(autoAirRef.current.timer);
      const previousId = autoAirRef.current.id;
      setProgramGraphicsSnapshot((current) => current.filter((item) => item.id !== previousId));
    }
    const id = `auto-${variant}-${Date.now()}`;
    const graphic: BroadcastGraphic = {
      id,
      mode: "football",
      name: `${FOOTBALL_NAMES[variant] ?? variant} (auto)`,
      kind: variant === "lower" ? "lower-third" : "ticker",
      title: options.title ?? "",
      subtitle: options.subtitle ?? "",
      accent: getCompetition(fm.match.competitionId ?? "custom").accent,
      variant,
      scale: 1,
      football: fm.match,
      position: FOOTBALL_POSITIONS[variant] ?? { x: 5, y: 5 },
    };
    setProgramGraphicsSnapshot((current) => [...current, graphic]);
    const timer = window.setTimeout(() => {
      exitProgram((item) => item.id === id);
      if (autoAirRef.current?.id === id) autoAirRef.current = null;
      if (variant !== "lower") fm.clearHighlight();
    }, seconds * 1000);
    autoAirRef.current = { id, timer };
  };
  const airTempRef = useRef(airTemp);
  airTempRef.current = airTemp;

  const toggleAir = (variant: GraphicVariant) => {
    const onAir = programGraphicsSnapshot.some((item) => item.variant === variant && !item.leavingAt);
    if (onAir) {
      exitProgram((item) => item.variant === variant);
      return;
    }
    const graphic: BroadcastGraphic = {
      id: `live-${variant}-${Date.now()}`,
      mode: "football",
      name: FOOTBALL_NAMES[variant] ?? variant,
      kind: ["elite", "compact", "editorial", "live"].includes(variant) ? "scoreboard" : variant === "lower" ? "lower-third" : "ticker",
      title: "",
      subtitle: "",
      accent: getCompetition(fm.match.competitionId ?? "custom").accent,
      variant,
      scale: 1,
      football: fm.match,
      position: FOOTBALL_POSITIONS[variant] ?? { x: 5, y: 5 },
    };
    setProgramGraphicsSnapshot((current) => [...current, graphic]);
  };
  const toggleAirRef = useRef(toggleAir);
  toggleAirRef.current = toggleAir;

  useEffect(() => {
    const keys: Record<string, GraphicVariant> = { F1: "elite", F2: "prematch", F3: "lineup-home", F4: "lineup-away", F5: "stats" };
    const onKey = (event: KeyboardEvent) => {
      if (activePane !== "football" || !keys[event.key]) return;
      event.preventDefault();
      toggleAirRef.current(keys[event.key]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activePane]);

  const highlight = fm.match.highlight;
  useEffect(() => {
    if (studioMode !== "football") return;
    if (!highlight) {
      const current = autoAirRef.current;
      if (current && !current.id.startsWith("auto-lower")) {
        window.clearTimeout(current.timer);
        exitProgram((item) => item.id === current.id);
        autoAirRef.current = null;
      }
      return;
    }
    if (sfxOn) playSfx(highlight.kind === "void" ? "var" : highlight.kind, sfxVolumeRef.current);
    if (!autoReact) return;
    const variant: GraphicVariant = highlight.kind === "goal" ? "goal" : highlight.kind === "var" ? "var" : "events";
    airTempRef.current(variant, { subtitle: highlight.detail ?? "" }, variant === "goal" ? 8 : 6);
  }, [highlight, autoReact, studioMode, sfxOn]);

  const applyFootballTemplate = (competitionId: string) => {
    const theme = getCompetition(competitionId);
    fm.setMatch({ competitionId: theme.id, competition: theme.name });
    const hasScoreboard = footballWidgets.some((graphic) => ["elite", "compact", "editorial", "live"].includes(graphic.variant ?? "") && footballPreviewIds.includes(graphic.id));
    if (!hasScoreboard) addFootballWidget("elite");
    toast.success(`Tema ${theme.name} aplicado`);
  };

  useEffect(() => {
    const scorersOf = (side: "home" | "away") => fm.events
      .filter((event) => event.kind === "goal" && !event.voided && event.team === side)
      .map((event) => `${event.player.split(" ").slice(-1)[0]} ${event.minute}'`);
    liveFootballMatch = { ...fm.match, scorers: { home: scorersOf("home"), away: scorersOf("away") } };
  }, [fm.match, fm.events]);
  const removeGraphic = (graphicId: string) => {
    setGraphics((current) => current.filter((graphic) => graphic.id !== graphicId));
    setScenes((current) => current.map((scene) => {
      const graphicIds = (scene.graphicIds?.length ? scene.graphicIds : scene.graphicId ? [scene.graphicId] : []).filter((id) => id !== graphicId);
      return { ...scene, graphicIds, graphicId: graphicIds[0] ?? null };
    }));
    if (editingGraphic?.id === graphicId) setEditingGraphic(null);
    toast.success("Plantilla eliminada");
  };

  const addGraphic = (kind: GraphicKind) => {
    const graphic: BroadcastGraphic = {
      id: createId("graphic"),
      name: kind === "scoreboard" ? "Marcador nuevo" : kind === "ticker" ? "Cintillo nuevo" : "Identificador nuevo",
      kind,
      title: kind === "scoreboard" ? "LOCAL  0  —  0  VISITANTE" : "TITULAR DEL GRÁFICO",
      subtitle: kind === "scoreboard" ? "EN VIVO · 1T  00:00" : "Subtítulo o información",
      accent: "#ef4444",
      variant: kind === "scoreboard" ? "elite" : kind === "ticker" ? "events" : "lower",
      background: "#090b0f",
      textColor: "#ffffff",
      subtitleColor: "#d1d5db",
      radius: 8,
      scale: 1,
      alignment: "left",
      ...(kind === "scoreboard" ? {
        football: createFootballScoreboard(),
        position: { x: 69, y: 7 },
      } : {}),
    };
    setEditingGraphic(graphic);
  };

  const activateFootballMode = () => {
    setActivePane("football");
    const existing = graphics.find((graphic) => graphic.kind === "scoreboard" && graphic.football);
    const footballScene = scenes.find((scene) => scene.mode === "football" && scene.name === "Partido en vivo");
    const footballStandby = scenes.find((scene) => scene.mode === "football" && scene.name === "Espera");
    const sceneId = footballScene?.id ?? createId("scene-football");
    const standbyId = footballStandby?.id ?? createId("scene-football");
    const nextGraphic = existing ?? {
      id: createId("graphic"),
      mode: "football" as const,
      name: "Marcador principal",
      kind: "scoreboard" as const,
      title: "PARTIDO EN VIVO",
      subtitle: "1T · 00:00",
      accent: "#22d3ee",
      variant: "elite" as const,
      background: "#07111d",
      textColor: "#ffffff",
      subtitleColor: "#9fb3c8",
      radius: 14,
      scale: 1,
      alignment: "center" as const,
      football: createFootballScoreboard(),
      position: { x: 3, y: 4 },
    };
    if (!existing) setGraphics((current) => [...current, nextGraphic]);
    setScenes((current) => {
      const withFootball = [
        ...current,
        ...(!current.some((scene) => scene.id === sceneId) ? [{ id: sceneId, mode: "football" as const, name: "Partido en vivo", inputIds: [], graphicId: nextGraphic.id, graphicIds: [nextGraphic.id] }] : []),
        ...(!current.some((scene) => scene.id === standbyId) ? [{ id: standbyId, mode: "football" as const, name: "Espera", inputIds: [], graphicId: null, graphicIds: [] }] : []),
      ];
      return withFootball.map((scene) => scene.id === sceneId
        ? { ...scene, mode: "football", graphicIds: scene.graphicIds?.length ? scene.graphicIds : [nextGraphic.id], graphicId: scene.graphicId ?? nextGraphic.id }
        : scene);
    });
    setSelectedFootballGraphicId(nextGraphic.id);
    setPreviewSceneId(sceneId);
    setProgramSceneId(standbyId);
    const standbyScene = scenes.find((scene) => scene.id === standbyId) ?? { id: standbyId, mode: "football" as const, name: "Espera", inputIds: [], graphicId: null, graphicIds: [] };
    setProgramSceneSnapshot(standbyScene);
    setProgramGraphicsSnapshot([]);
  };

  const activateNormalMode = () => {
    const normalScenes = scenes.filter((scene) => (scene.mode ?? "normal") === "normal");
    const preview = normalScenes[0] ?? INITIAL_SCENES[0];
    const program = normalScenes[1] ?? normalScenes[0] ?? INITIAL_SCENES[0];
    setActivePane("inputs");
    setPreviewSceneId(preview.id);
    setProgramSceneId(program.id);
    setProgramSceneSnapshot(program);
    setProgramGraphicsSnapshot(getSceneGraphics(program));
  };

  const downloadGraphic = (graphic: BroadcastGraphic) => {
    const html = graphic.mode === "football"
      ? footballDesignDocument(footballDesignFor(graphic), graphic.position ?? { x: 5, y: 5 }, graphic.scale ?? 1)
      : exportGraphicHtml(graphic);
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${graphic.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "plantilla"}.html`;
    link.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    let frame = 0;
    let lastProgramDraw = 0;
    let lastPreviewDraw = 0;
    const render = (now: number) => {
      frame = requestAnimationFrame(render);
      const currentInputs = inputs;
      if (programCanvasRef.current && now - lastProgramDraw >= 33) {
        lastProgramDraw = now;
        const transitionState = transitionStateRef.current;
        if (transitionState) {
          const fromScene = scenes.find((scene) => scene.id === transitionState.fromId);
          const toScene = scenes.find((scene) => scene.id === transitionState.toId);
          const fromGraphics = getSceneGraphics(fromScene);
          const toGraphics = getSceneGraphics(toScene);
          drawTransition(programCanvasRef.current, fromScene, toScene, currentInputs, inputVideoRefs.current, inputImageRefs.current, fromGraphics, toGraphics, activeTransitionModeRef.current, transitionState.progress);
        } else {
          drawScene(programCanvasRef.current, programScene, currentInputs, inputVideoRefs.current, inputImageRefs.current, programGraphics, programFadeAlphaRef.current);
        }
      }
      if (previewCanvasRef.current && now - lastPreviewDraw >= 66) {
        lastPreviewDraw = now;
        drawScene(previewCanvasRef.current, previewScene, currentInputs, inputVideoRefs.current, inputImageRefs.current, previewGraphics);
      }
    };
    frame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frame);
  }, [getSceneGraphics, inputs, previewScene, programScene, previewGraphics, programGraphics, scenes]);

  useEffect(() => {
    const activeProgramInputs = new Set(programScene?.inputIds ?? []);
    audioRoutesRef.current.forEach((routes, inputId) => {
      const input = inputs.find((item) => item.id === inputId);
      const enabled = Boolean(input && activeProgramInputs.has(inputId) && !input.muted);
      routes.forEach(({ gain, pan }) => {
        const now = audioContextRef.current?.currentTime ?? 0;
        gain.gain.setTargetAtTime(enabled ? input?.volume ?? 1 : 0, now, 0.02);
        pan.pan.setTargetAtTime(input?.pan ?? 0, now, 0.02);
      });
    });
  }, [inputs, programScene]);

  useEffect(() => {
    const saved = Number(window.localStorage.getItem("nexus-master-volume"));
    if (saved > 0 && saved <= 1.5) setMasterVolume(saved);
  }, []);

  useEffect(() => {
    masterGainRef.current?.gain.setTargetAtTime(masterVolume, audioContextRef.current?.currentTime ?? 0, 0.02);
    try { window.localStorage.setItem("nexus-master-volume", String(masterVolume)); } catch { /* sin almacenamiento */ }
  }, [masterVolume]);

  useEffect(() => {
    if (!recording && !live) return;
    const timer = window.setInterval(() => setElapsedSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [recording, live]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return;
      if (event.code === "Space") {
        event.preventDefault();
        takeScene();
      } else if (event.key === "Enter") {
        event.preventDefault();
        takeScene(transitionMode === "cut" ? "fade" : transitionMode);
      } else if (event.key.toLowerCase() === "f") {
        event.preventDefault();
        toggleFadeToBlack();
      } else if (event.key.toLowerCase() === "r") {
        event.preventDefault();
        if (recording) stopRecording();
        else void startRecording();
      } else if (event.shiftKey && event.code.startsWith("Digit")) {
        const overlay = modeGraphics[Number(event.code.slice(5)) - 1];
        if (overlay) { event.preventDefault(); toggleProgramOverlay(overlay.id); }
      } else if (/^[1-9]$/.test(event.key)) {
        const index = Number(event.key) - 1;
        const modeScene = scenes.filter((scene) => (scene.mode ?? "normal") === studioMode)[index];
        if (modeScene) setPreviewSceneId(modeScene.id);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [modeGraphics, recording, scenes, startRecording, stopRecording, studioMode, takeScene, toggleFadeToBlack, toggleProgramOverlay, transitionMode]);

  useEffect(() => {
    const onConnected = (event: GamepadEvent) => setControllerName(event.gamepad.id);
    const onDisconnected = () => setControllerName("");
    window.addEventListener("gamepadconnected", onConnected);
    window.addEventListener("gamepaddisconnected", onDisconnected);
    let frame = 0;
    const poll = () => {
      const gamepad = navigator.getGamepads?.().find((item) => item?.connected);
      const buttons = gamepad?.buttons.map((button) => button.pressed) ?? [];
      if (buttons[0] && !gamepadButtonsRef.current[0]) takeScene();
      if (buttons[1] && !gamepadButtonsRef.current[1]) {
        if (recording) stopRecording();
        else void startRecording();
      }
      if (buttons[12] && !gamepadButtonsRef.current[12]) {
        const index = scenes.findIndex((scene) => scene.id === previewSceneId);
        const next = scenes[(index + scenes.length - 1) % scenes.length];
        if (next) setPreviewSceneId(next.id);
      }
      if (buttons[13] && !gamepadButtonsRef.current[13]) {
        const index = scenes.findIndex((scene) => scene.id === previewSceneId);
        const next = scenes[(index + 1) % scenes.length];
        if (next) setPreviewSceneId(next.id);
      }
      gamepadButtonsRef.current = buttons;
      frame = requestAnimationFrame(poll);
    };
    frame = requestAnimationFrame(poll);
    return () => {
      window.removeEventListener("gamepadconnected", onConnected);
      window.removeEventListener("gamepaddisconnected", onDisconnected);
      cancelAnimationFrame(frame);
    };
  }, [previewSceneId, recording, scenes, startRecording, stopRecording, takeScene]);

  useEffect(() => () => {
    mediaRecorderRef.current?.stop();
    peerConnectionRef.current?.close();
    inputsRef.current.forEach((input) => {
      input.stream?.getTracks().forEach((track) => track.stop());
      if (input.url) URL.revokeObjectURL(input.url);
    });
    outputStreamRef.current?.getTracks().forEach((track) => track.stop());
    void audioContextRef.current?.close();
  }, []);

  const assignGraphic = (graphicId: string, targetSceneId = previewSceneId) => {
    if (!graphicId) return;
    setScenes((current) => current.map((scene) => {
      if (scene.id !== targetSceneId) return scene;
      const currentIds = scene.graphicIds?.length ? scene.graphicIds : scene.graphicId ? [scene.graphicId] : [];
      const graphicIds = currentIds.includes(graphicId)
        ? currentIds.filter((id) => id !== graphicId)
        : [...currentIds, graphicId];
      return { ...scene, graphicIds, graphicId: graphicIds[0] ?? null };
    }));
  };
  const assignLayout = (layout: SceneLayout) => {
    setScenes((current) => current.map((scene) => scene.id === previewSceneId ? { ...scene, layout } : scene));
  };

  const ensureLibraryInput = (item: MediaItem): string => {
    const id = `lib-${item.id}`;
    if (!inputsRef.current.some((input) => input.id === id)) {
      const url = URL.createObjectURL(item.blob);
      if (item.kind === "image") {
        const image = new Image();
        image.src = url;
        inputImageRefs.current.set(id, image);
      }
      const input: BroadcastInput = { id, name: item.name, kind: item.kind, url, muted: false, volume: 1, ...(item.kind === "video" ? { playing: true, loop: item.category === "fondo" } : {}) };
      inputsRef.current = [...inputsRef.current, input];
      setInputs((current) => [...current, input]);
    }
    return id;
  };

  const uploadLibrary = async (files: FileList, category: MediaCategory) => {
    const added: MediaItem[] = [];
    for (const file of Array.from(files)) {
      const kind = file.type.startsWith("video/") ? "video" : file.type.startsWith("image/") ? "image" : null;
      if (!kind) { toast.error(`${file.name}: formato no compatible`); continue; }
      const item: MediaItem = { id: createId("media"), name: file.name, kind, category, blob: file, createdAt: Date.now() };
      try { await saveMedia(item); added.push(item); } catch { toast.error(`No se pudo guardar ${file.name}`); }
    }
    if (added.length) {
      setMediaLibrary((current) => [...current, ...added]);
      toast.success(`${added.length} archivo(s) guardados en la biblioteca`);
    }
  };

  const removeLibraryItem = async (id: string) => {
    try { await deleteMedia(id); } catch { toast.error("No se pudo eliminar"); return; }
    setMediaLibrary((current) => current.filter((item) => item.id !== id));
    const inputId = `lib-${id}`;
    setScenes((current) => current.map((scene) => ({ ...scene, inputIds: scene.inputIds.filter((value) => value !== inputId), backgroundId: scene.backgroundId === inputId ? null : scene.backgroundId })));
    if (promoItemId === id) setPromoItemId(null);
  };

  const airPromo = (item: MediaItem) => {
    const inputId = ensureLibraryInput(item);
    const current = scenes.find((scene) => scene.id === programSceneId);
    if (!promoRestoreRef.current && current) promoRestoreRef.current = { sceneId: current.id, inputIds: current.inputIds, layout: current.layout };
    setScenes((current) => current.map((scene) => scene.id === programSceneId ? { ...scene, inputIds: [inputId], layout: "single" } : scene));
    setPromoItemId(item.id);
    toast.success(`Al aire: ${item.name}`);
  };

  const stopPromo = () => {
    const restore = promoRestoreRef.current;
    if (restore) setScenes((current) => current.map((scene) => scene.id === restore.sceneId ? { ...scene, inputIds: restore.inputIds, layout: restore.layout } : scene));
    promoRestoreRef.current = null;
    setPromoItemId(null);
  };

  const setBackground = (item: MediaItem) => {
    const inputId = ensureLibraryInput(item);
    setScenes((current) => current.map((scene) => scene.id === previewSceneId ? { ...scene, backgroundId: scene.backgroundId === inputId ? null : inputId } : scene));
  };

  const toggleSceneSource = (inputId: string) => {
    setScenes((current) => current.map((scene) => scene.id === previewSceneId
      ? { ...scene, inputIds: scene.inputIds.includes(inputId) ? scene.inputIds.filter((value) => value !== inputId) : [...scene.inputIds, inputId] }
      : scene));
  };

  const startTemplateDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!editingGraphic || !templatePreviewRef.current) return;
    const target = event.currentTarget.getBoundingClientRect();
    dragOffsetRef.current = { x: event.clientX - target.left, y: event.clientY - target.top };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveTemplateDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!editingGraphic || !event.currentTarget.hasPointerCapture(event.pointerId) || !templatePreviewRef.current) return;
    const canvas = templatePreviewRef.current.getBoundingClientRect();
    const nextX = ((event.clientX - canvas.left - dragOffsetRef.current.x) / canvas.width) * 100;
    const nextY = ((event.clientY - canvas.top - dragOffsetRef.current.y) / canvas.height) * 100;
    setEditingGraphic({
      ...editingGraphic,
      position: {
        x: Math.min(88, Math.max(0, nextX)),
        y: Math.min(84, Math.max(0, nextY)),
      },
    });
  };
  const loadTeamLogo = (team: "homeLogo" | "awayLogo", file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Escudo no válido", { description: "Selecciona una imagen PNG, JPG, WEBP o SVG." });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string" || !editingGraphic?.football) return;
      setEditingGraphic({
        ...editingGraphic,
        football: { ...editingGraphic.football, [team]: reader.result },
      });
    };
    reader.onerror = () => toast.error("No se pudo cargar el escudo");
    reader.readAsDataURL(file);
  };
  const loadGraphicImage = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Plantilla no válida", { description: "Selecciona una imagen PNG, JPG, WEBP o SVG." });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string" || !editingGraphic) return;
      setEditingGraphic({ ...editingGraphic, backgroundImage: reader.result });
    };
    reader.onerror = () => toast.error("No se pudo cargar la plantilla");
    reader.readAsDataURL(file);
  };
  const getGraphicPosition = (graphic: BroadcastGraphic) => graphic.mode === "football" && (liveFootballMatch || graphic.football)
    ? footballPosition(graphic, footballDesignFor(graphic))
    : graphic.position ?? (
    graphic.kind === "lower-third" ? { x: 5, y: 77 }
      : graphic.kind === "ticker" ? { x: 0, y: 85 }
        : { x: 69, y: 7 }
  );
  const startPreviewGraphicDrag = (event: ReactPointerEvent<HTMLDivElement>, graphic: BroadcastGraphic) => {
    if (event.button !== 0) return;
    setSelectedGraphicId(graphic.id);
    event.currentTarget.focus();
    const canvas = event.currentTarget.parentElement?.getBoundingClientRect();
    if (!canvas) return;
    const position = getGraphicPosition(graphic);
    previewDragRef.current = {
      graphicId: graphic.id,
      offsetX: event.clientX - canvas.left - (position.x / 100) * canvas.width,
      offsetY: event.clientY - canvas.top - (position.y / 100) * canvas.height,
    };
    setDraggingPreviewGraphicId(graphic.id);
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const movePreviewGraphic = (event: ReactPointerEvent<HTMLDivElement>) => {
    const { graphicId, offsetX, offsetY } = previewDragRef.current;
    if (!graphicId || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const canvas = event.currentTarget.parentElement?.getBoundingClientRect();
    if (!canvas) return;
    const graphic = graphics.find((item) => item.id === graphicId);
    if (!graphic) return;
    const design = graphic.mode === "football" && (liveFootballMatch || graphic.football) ? footballDesignFor(graphic) : null;
    const spanX = design ? ((design.width * (graphic.scale ?? 1)) / 1920) * 100 : 0;
    const spanY = design ? ((design.height * (graphic.scale ?? 1)) / 1080) * 100 : 0;
    const maxX = design ? Math.max(0, 100 - spanX) : graphic.kind === "ticker" ? 0 : graphic.kind === "scoreboard" ? 58 : 78;
    const maxY = design ? Math.max(0, 100 - spanY) : 88;
    setGraphics((current) => current.map((item) => item.id === graphicId ? {
      ...item,
      position: {
        x: Math.min(maxX, Math.max(0, ((event.clientX - canvas.left - offsetX) / canvas.width) * 100)),
        y: Math.min(maxY, Math.max(0, ((event.clientY - canvas.top - offsetY) / canvas.height) * 100)),
      },
    } : item));
  };
  const endPreviewGraphicDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    previewDragRef.current.graphicId = "";
    setDraggingPreviewGraphicId(null);
  };
  const graphicOverlaySize = (graphic: BroadcastGraphic) => {
    if (graphic.mode === "football" && (liveFootballMatch || graphic.football)) {
      const design = footballDesignFor(graphic);
      return { width: `${(design.width / 1920) * 100}%`, aspectRatio: `${design.width} / ${design.height}` };
    }
    return graphic.kind === "ticker"
      ? { width: "100%", aspectRatio: "24 / 1" }
      : graphic.kind === "scoreboard"
        ? { width: "20.3%", aspectRatio: "390 / 118" }
        : { width: "44.3%", aspectRatio: "850 / 150" };
  };
  const nudgeGraphic = (graphicId: string, dx: number, dy: number) => {
    setGraphics((current) => current.map((item) => item.id === graphicId
      ? { ...item, position: { x: Math.min(100, Math.max(0, getGraphicPosition(item).x + dx)), y: Math.min(100, Math.max(0, getGraphicPosition(item).y + dy)) } }
      : item));
  };
  const centerGraphic = (graphic: BroadcastGraphic) => {
    const design = graphic.mode === "football" && (liveFootballMatch || graphic.football) ? footballDesignFor(graphic) : null;
    const w = design ? ((design.width * (graphic.scale ?? 1)) / 1920) * 100 : 20;
    setGraphics((current) => current.map((item) => item.id === graphic.id ? { ...item, position: { x: Math.max(0, (100 - w) / 2), y: getGraphicPosition(item).y } } : item));
  };
  const duplicateGraphic = (graphic: BroadcastGraphic) => {
    const copy: BroadcastGraphic = { ...graphic, id: createId("graphic"), name: `${graphic.name} copia`, position: { x: Math.min(90, getGraphicPosition(graphic).x + 3), y: Math.min(90, getGraphicPosition(graphic).y + 4) } };
    setGraphics((current) => [...current, copy]);
    assignGraphic(copy.id);
    setSelectedGraphicId(copy.id);
  };
  const openPreviewMenu = (event: React.MouseEvent, graphic: BroadcastGraphic) => {
    event.preventDefault();
    event.stopPropagation();
    setSelectedGraphicId(graphic.id);
    setCtxMenu({
      x: event.clientX, y: event.clientY, title: graphic.name,
      items: [
        { label: "Quitar de Preview", hint: "Supr", run: () => { assignGraphic(graphic.id); setSelectedGraphicId(null); } },
        { label: "Centrar horizontal", run: () => centerGraphic(graphic) },
        { label: "Duplicar", hint: "Ctrl+D", run: () => duplicateGraphic(graphic) },
        { label: "Más grande", hint: "+", run: () => setGraphics((current) => current.map((item) => item.id === graphic.id ? { ...item, scale: Math.min(2, (item.scale ?? 1) + 0.1) } : item)) },
        { label: "Más pequeño", hint: "-", run: () => setGraphics((current) => current.map((item) => item.id === graphic.id ? { ...item, scale: Math.max(0.3, (item.scale ?? 1) - 0.1) } : item)) },
        { label: "Eliminar widget", danger: true, run: () => removeGraphic(graphic.id) },
      ],
    });
  };
  const openGeneralMenu = (event: React.MouseEvent) => {
    event.preventDefault();
    const target = event.target as HTMLElement;
    if (target.closest("input, textarea")) return;
    setCtxMenu({
      x: event.clientX, y: event.clientY, title: "NEXUS",
      items: [
        { label: "TAKE", hint: "Espacio", run: () => takeScene() },
        { label: "Retirar todo del aire", hint: "Esc", danger: true, run: retireAllProgram },
        ...(studioMode === "football" ? [
          { label: "Marcador al aire / retirar", hint: "F1", run: () => toggleAir("elite") },
          { label: "Anular último gol", hint: "Z", run: fm.undoGoal },
          { label: "Iniciar / pausar reloj", hint: "P", run: fm.toggleClock },
        ] : []),
        { label: "Pantalla completa", hint: "F", run: () => void document.documentElement.requestFullscreen?.() },
      ],
    });
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return;
      if (event.key === "Escape" && ctxMenu) { setCtxMenu(null); return; }
      const graphic = graphics.find((item) => item.id === selectedGraphicId);
      if (!graphic) return;
      const step = event.shiftKey ? 2 : 0.5;
      const arrows: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
      if (arrows[event.key]) { event.preventDefault(); nudgeGraphic(graphic.id, ...arrows[event.key]); }
      else if (event.key === "Delete" || event.key === "Backspace") { event.preventDefault(); assignGraphic(graphic.id); setSelectedGraphicId(null); }
      else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d") { event.preventDefault(); duplicateGraphic(graphic); }
      else if (event.key === "+" || event.key === "=") setGraphics((current) => current.map((item) => item.id === graphic.id ? { ...item, scale: Math.min(2, (item.scale ?? 1) + 0.05) } : item));
      else if (event.key === "-") setGraphics((current) => current.map((item) => item.id === graphic.id ? { ...item, scale: Math.max(0.3, (item.scale ?? 1) - 0.05) } : item));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div onContextMenu={openGeneralMenu} onClick={() => ctxMenu && setCtxMenu(null)} className="flex h-full min-h-0 flex-col overflow-hidden bg-[#05070a] text-neutral-100">
      {ctxMenu && (
        <div role="menu" aria-label={ctxMenu.title} className="fixed z-[200] min-w-[200px] overflow-hidden rounded-lg border border-white/15 bg-[#0d1117] py-1 text-[11px] shadow-2xl shadow-black/60" style={{ left: Math.min(ctxMenu.x, window.innerWidth - 220), top: Math.min(ctxMenu.y, window.innerHeight - ctxMenu.items.length * 30 - 40) }} onContextMenu={(event) => event.preventDefault()}>
          <p className="border-b border-white/10 px-3 py-1 text-[9px] font-bold uppercase tracking-widest text-yellow-300">{ctxMenu.title}</p>
          {ctxMenu.items.map((item) => (
            <button key={item.label} role="menuitem" type="button" onClick={() => { item.run(); setCtxMenu(null); }} className={`flex w-full items-center justify-between gap-6 px-3 py-1.5 text-left hover:bg-white/10 ${item.danger ? "text-yellow-300" : "text-neutral-200"}`}>
              <span>{item.label}</span>{item.hint && <kbd className="text-[9px] text-neutral-500">{item.hint}</kbd>}
            </button>
          ))}
        </div>
      )}
      {topbarHost && createPortal(
        <div className="flex min-w-max items-center gap-1.5 sm:gap-2">
          <div className="flex items-center gap-1.5">
            <span className="hidden items-center gap-1.5 px-1 text-[12px] font-black uppercase tracking-tight text-white lg:flex"><span className="text-yellow-300">NEXUS</span> SPORT <span className="rounded bg-yellow-300 px-1.5 py-0.5 text-[9px] text-black">STUDIO</span></span>
            <span className="hidden h-5 w-px bg-white/[0.1] lg:block" />
            <button type="button" onClick={activateNormalMode} className={`rounded-md px-2 py-1.5 text-[10px] font-semibold transition-colors sm:px-2.5 sm:text-[11px] ${studioMode === "normal" ? "bg-yellow-300 text-black" : "text-neutral-400 hover:bg-white/[0.06] hover:text-white"}`}>Modo normal</button>
            <button type="button" onClick={activateFootballMode} className={`rounded-md px-2 py-1.5 text-[10px] font-semibold transition-colors sm:px-2.5 sm:text-[11px] ${studioMode === "football" ? "bg-yellow-300 text-black" : "text-neutral-400 hover:bg-white/[0.06] hover:text-white"}`}>Modo fútbol</button>
            <button type="button" onClick={() => setWhipOpen(true)} className="hidden rounded-md px-2 py-1.5 text-[10px] font-semibold text-neutral-500 hover:bg-white/[0.06] hover:text-white xl:inline-flex">Ajustes</button>
          </div>
          <span className="h-5 w-px bg-white/[0.1]" />
          {studioMode === "football" && (
            <>
              <span className="inline-flex items-center gap-2 rounded-lg border border-white/[0.1] bg-black/40 px-2.5 py-1 tabular-nums">
                <span className="max-w-[70px] truncate text-[11px] font-bold text-white">{fm.match.homeTeam}</span>
                <span className="text-sm font-black text-yellow-300">{fm.match.homeScore} : {fm.match.awayScore}</span>
                <span className="max-w-[70px] truncate text-[11px] font-bold text-white">{fm.match.awayTeam}</span>
                <span className="border-l border-white/10 pl-2 text-[11px] text-emerald-300">{fm.match.period} {formatMediaTime(fm.match.clockSeconds)}</span>
              </span>
              <button type="button" onClick={() => void (guestRoom ? copyGuestLink() : openGuestRoom())} className="hidden rounded-md border border-emerald-400/30 px-2 py-1.5 text-[10px] font-semibold text-emerald-200 hover:bg-emerald-400/10 xl:inline-flex">{guestRoom ? "Copiar enlace invitado" : "Invitar"}</button>
              <span className="h-5 w-px bg-white/[0.1]" />
            </>
          )}
          {controllerName && <span className="hidden items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/[0.07] px-2.5 py-1.5 text-[10px] text-emerald-300 lg:inline-flex"><Gamepad2 size={13} /> Gamepad</span>}
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-black/20 px-2.5 py-1.5 text-xs tabular-nums text-neutral-300 sm:px-3 sm:py-2">
            {recording || live ? <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-yellow-300" /> : <Circle size={9} />}
            {elapsedLabel}
          </span>
          {recording ? (
            <button type="button" onClick={stopRecording} aria-label="Detener grabación" className="inline-flex items-center gap-1.5 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-2.5 py-2 text-[10px] font-semibold text-yellow-300 hover:bg-yellow-500/20 sm:px-3.5 sm:text-xs">
              <Square size={13} fill="currentColor" /><span className="hidden sm:inline">Detener</span>
            </button>
          ) : (
            <button type="button" onClick={() => void startRecording()} aria-label="Grabar" className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-2 text-[10px] font-semibold text-neutral-200 hover:bg-white/[0.06] sm:px-3.5 sm:text-xs">
              <Circle size={12} className="text-yellow-400" /><span className="hidden sm:inline">Grabar</span>
            </button>
          )}
          {live ? (
            <button type="button" onClick={() => void stopLive()} aria-label="Detener emisión" className="inline-flex items-center gap-1.5 rounded-lg bg-yellow-300 px-2.5 py-2 text-[10px] font-semibold text-black hover:bg-yellow-200 sm:px-3.5 sm:text-xs">
              <Wifi size={14} /><span className="hidden sm:inline">Detener emisión</span>
            </button>
          ) : (
            <button type="button" onClick={() => void publishWhip()} aria-label="Emitir" className="inline-flex items-center gap-1.5 rounded-lg bg-yellow-300 px-2.5 py-2 text-[10px] font-semibold text-black shadow-lg shadow-yellow-950/30 hover:bg-yellow-200 sm:px-3.5 sm:text-xs">
              <Radio size={14} /><span className="hidden sm:inline">Emitir</span>
            </button>
          )}
        </div>,
        topbarHost,
      )}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden xl:flex-row">
        <aside className={`flex max-h-[34vh] min-h-[170px] flex-col border-b border-white/[0.08] bg-[#0d1117] xl:max-h-none xl:flex-shrink-0 xl:border-b-0 xl:border-r ${activePane === "football" ? "xl:w-[360px]" : "xl:w-[250px]"}`}>
          <div className="flex items-center gap-2 border-b border-white/[0.07] p-2.5">
            {activePane === "football" ? (
              <>
                <Shield size={15} className="text-emerald-300" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-emerald-100">Configuración de fútbol</p>
                  <p className="truncate text-[10px] text-emerald-100/50">{footballMatchName}</p>
                </div>
                <button type="button" onClick={activateNormalMode} className="rounded-md border border-white/10 px-2 py-1.5 text-[10px] text-neutral-400 hover:text-white">Modo normal</button>
              </>
            ) : (
              <>
                <button type="button" onClick={() => setActivePane("inputs")} className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium ${activePane === "inputs" ? "bg-white/[0.09] text-white" : "text-neutral-500 hover:text-neutral-200"}`}>
                  <Video size={14} className="mr-1.5 inline" /> Fuentes
                </button>
                <button type="button" onClick={() => setActivePane("graphics")} className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium ${activePane === "graphics" ? "bg-white/[0.09] text-white" : "text-neutral-500 hover:text-neutral-200"}`}>
                  <Layers3 size={14} className="mr-1.5 inline" /> Gráficos
                </button>
              </>
            )}
          </div>
          {activePane === "inputs" ? (
            <>
              <div className="grid grid-cols-2 gap-2 border-b border-white/[0.07] p-3">
                <select
                  aria-label="Dispositivo de cámara"
                  value={selectedCameraId}
                  onChange={(event) => setSelectedCameraId(event.target.value)}
                  className="col-span-2 h-9 min-w-0 rounded-lg border border-white/10 bg-[#101114] px-3 text-xs text-neutral-300 outline-none"
                >
                  <option value="">Cámara predeterminada</option>
                  {devices.filter((device) => device.kind === "videoinput").map((device, index) => (
                    <option key={`${device.deviceId}-${index}`} value={device.deviceId}>
                      {device.label || `Cámara ${index + 1}`}
                    </option>
                  ))}
                </select>
                <button type="button" onClick={() => void connectCamera()} className="flex items-center justify-center gap-1.5 rounded-lg border border-white/10 px-2 py-2 text-[11px] text-neutral-200 hover:bg-white/[0.06]">
                  <Video size={14} /> Cámara
                </button>
                <button type="button" onClick={() => void connectMicrophone()} className="flex items-center justify-center gap-1.5 rounded-lg border border-white/10 px-2 py-2 text-[11px] text-neutral-200 hover:bg-white/[0.06]">
                  <Mic size={14} /> Micrófono
                </button>
                <select
                  aria-label="Dispositivo de micrófono"
                  value={selectedMicrophoneId}
                  onChange={(event) => setSelectedMicrophoneId(event.target.value)}
                  className="col-span-2 h-9 min-w-0 rounded-lg border border-white/10 bg-[#101114] px-3 text-xs text-neutral-300 outline-none"
                >
                  <option value="">Micrófono predeterminado</option>
                  {devices.filter((device) => device.kind === "audioinput").map((device, index) => (
                    <option key={`${device.deviceId}-${index}`} value={device.deviceId}>
                      {device.label || `Micrófono ${index + 1}`}
                    </option>
                  ))}
                </select>
                <button type="button" onClick={() => void connectScreen()} className="col-span-2 flex items-center justify-center gap-1.5 rounded-lg border border-white/10 px-2 py-2 text-[11px] text-neutral-200 hover:bg-white/[0.06]">
                  <MonitorUp size={14} /> Compartir pantalla
                </button>
                <label className="col-span-2 flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-dashed border-white/15 px-2 py-2 text-[11px] text-neutral-300 hover:border-white/30 hover:text-white">
                  <Plus size={14} /> Cargar video o imagen
                  <input
                    type="file"
                    accept="video/*,image/*"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) addMediaFile(file);
                      event.currentTarget.value = "";
                    }}
                  />
                </label>
              </div>
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
                {inputs.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-white/10 px-3 py-6 text-center">
                    <Video size={22} className="mx-auto mb-2 text-neutral-600" />
                    <p className="text-xs font-medium text-neutral-400">Añade una fuente</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-neutral-600">Cámara, audio, pantalla, video o imagen. Luego asígnala a una escena.</p>
                  </div>
                ) : inputs.map((input) => (
                  <div key={input.id} className="group rounded-xl border border-white/[0.08] bg-[#141a22] p-2.5">
                    <div className="flex items-center gap-1.5">
                      {input.kind === "camera" ? <Video size={14} className="text-sky-300" />
                        : input.kind === "screen" ? <ScreenShare size={14} className="text-violet-300" />
                          : input.kind === "audio" ? <Volume2 size={14} className="text-amber-300" />
                            : input.kind === "image" ? <ImagePlus size={14} className="text-emerald-300" />
                              : <FileVideo2 size={14} className="text-emerald-300" />}
                      <span className="min-w-0 flex-1 truncate text-xs font-medium text-neutral-200">{input.name}</span>
                      {input.kind !== "audio" && (
                        <button type="button" onClick={() => setCropInputId(input.id)} aria-label={`Recortar ${input.name}`} title="Recortar y encuadrar" className={`rounded-md p-1 hover:bg-yellow-300/10 hover:text-yellow-300 ${input.crop ? "text-yellow-300" : "text-neutral-500"}`}>
                          <Crop size={14} />
                        </button>
                      )}
                      <button type="button" onClick={() => removeInput(input)} aria-label={`Quitar ${input.name}`} className="rounded-md p-1 text-neutral-500 hover:bg-yellow-500/10 hover:text-yellow-300">
                        <X size={14} />
                      </button>
                    </div>
                    {input.kind === "image" && input.url && (
                      <NextImage src={input.url} alt={input.name} width={16} height={9} unoptimized className="mt-2 aspect-video w-full rounded-lg bg-black object-cover" />
                    )}
                    {(input.kind === "camera" || input.kind === "screen" || input.kind === "video") && (
                      <video
                        ref={(element) => {
                          if (!element) {
                            inputVideoRefs.current.delete(input.id);
                            return;
                          }
                          inputVideoRefs.current.set(input.id, element);
                          if (input.stream && element.srcObject !== input.stream) element.srcObject = input.stream;
                        }}
                        src={input.kind === "video" ? input.url : undefined}
                        autoPlay={input.kind !== "video" || input.playing !== false}
                        muted
                        loop={input.kind === "video" && input.loop}
                        playsInline
                        onLoadedMetadata={(event) => updateMediaProgress(input.id, event.currentTarget)}
                        onTimeUpdate={(event) => updateMediaProgress(input.id, event.currentTarget)}
                        onEnded={() => setInputs((current) => current.map((item) => item.id === input.id ? { ...item, playing: false } : item))}
                        className="mt-2 aspect-video w-full rounded-lg bg-black object-cover"
                      />
                    )}
                    {input.kind === "video" && (
                      <div className="mt-2">
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={() => toggleMediaPlayback(input)} className="inline-flex items-center gap-1.5 rounded-md bg-white/[0.07] px-2 py-1.5 text-[11px] text-neutral-200 hover:bg-white/[0.12]">
                            {input.playing === false ? <Play size={12} /> : <Pause size={12} />}
                            {input.playing === false ? "Reproducir" : "Pausar"}
                          </button>
                          <button type="button" onClick={() => updateInput(input.id, { loop: !input.loop })} className={`rounded-md px-2 py-1.5 text-[11px] ${input.loop ? "bg-sky-400/15 text-sky-200" : "bg-white/[0.04] text-neutral-500 hover:text-neutral-200"}`}>
                            Bucle {input.loop ? "ON" : "OFF"}
                          </button>
                          <span className="ml-auto text-[10px] tabular-nums text-neutral-500">
                            {formatMediaTime(mediaProgress[input.id]?.currentTime ?? 0)} / {formatMediaTime(mediaProgress[input.id]?.duration ?? 0)}
                          </span>
                        </div>
                        <input
                          aria-label={`Posición de ${input.name}`}
                          type="range"
                          min="0"
                          max={mediaProgress[input.id]?.duration || 0}
                          step="0.1"
                          value={mediaProgress[input.id]?.currentTime ?? 0}
                          disabled={!mediaProgress[input.id]?.duration}
                          onChange={(event) => seekMedia(input.id, Number(event.target.value))}
                          className="mt-2 h-1.5 w-full cursor-pointer accent-sky-400 disabled:cursor-not-allowed disabled:opacity-40"
                        />
                      </div>
                    )}
                    <div className="mt-2 flex flex-wrap gap-1">
                      {scenes.map((scene) => {
                        const assigned = scene.inputIds.includes(input.id);
                        return (
                          <button
                            key={scene.id}
                            type="button"
                            onClick={() => toggleSceneInput(scene.id, input.id)}
                            className={`rounded-md px-2 py-1.5 text-[10px] ${assigned ? "bg-sky-500/15 text-sky-200" : "bg-white/[0.04] text-neutral-500 hover:text-neutral-300"}`}
                          >
                            {assigned ? "✓ " : "+ "}{scene.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : activePane === "graphics" ? (
            <>
              <div className="grid grid-cols-2 gap-2 border-b border-white/[0.07] p-3">
                <button type="button" onClick={() => addGraphic("lower-third")} className="rounded-lg border border-white/10 px-2 py-2 text-[11px] text-neutral-200 hover:bg-white/[0.06]">
                  <Plus size={13} className="mr-1 inline" /> Identificador
                </button>
                <button type="button" onClick={() => addGraphic("ticker")} className="col-span-2 rounded-lg border border-white/10 px-2 py-2 text-[11px] text-neutral-200 hover:bg-white/[0.06]">
                  <Plus size={13} className="mr-1 inline" /> Cintillo informativo
                </button>
              </div>
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
                {modeGraphics.map((graphic) => (
                  <div key={graphic.id} className="rounded-xl border border-white/[0.08] bg-[#141a22] p-3">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: graphic.accent }} />
                      <span className="min-w-0 flex-1 truncate text-xs font-medium text-neutral-200">{graphic.name}</span>
                      <button type="button" onClick={() => setEditingGraphic(graphic)} aria-label={`Editar ${graphic.name}`} className="rounded-md p-1.5 text-neutral-400 hover:bg-white/[0.08] hover:text-white">
                        <Settings2 size={14} />
                      </button>
                      <button type="button" onClick={() => downloadGraphic(graphic)} aria-label={`Descargar HTML de ${graphic.name}`} className="rounded-md p-1.5 text-neutral-400 hover:bg-white/[0.08] hover:text-white">
                        <Download size={14} />
                      </button>
                      <button type="button" onClick={() => removeGraphic(graphic.id)} aria-label={`Eliminar ${graphic.name}`} className="rounded-md p-1.5 text-neutral-500 hover:bg-yellow-500/10 hover:text-yellow-300">
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <p className="mt-1 text-[10px] text-neutral-500">{graphic.kind === "scoreboard" ? "Marcador" : graphic.kind === "ticker" ? "Cintillo" : "Identificador"} · {graphic.title}</p>
                    <button type="button" onClick={() => assignGraphic(graphic.id)} className="mt-2.5 w-full rounded-lg border border-white/[0.08] px-2.5 py-2 text-[11px] text-neutral-300 hover:bg-white/[0.06] hover:text-white">
                      {(previewScene?.graphicIds?.includes(graphic.id) || (!previewScene?.graphicIds?.length && previewScene?.graphicId === graphic.id)) ? "Quitar de Preview" : "Añadir a Preview"}
                    </button>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <FootballConsole
              fm={fm}
              graphics={footballWidgets}
              previewGraphicIds={footballPreviewIds}
              programGraphicIds={footballProgramIds}
              onAddWidget={addFootballWidget}
              onUpdateGraphic={(graphicId, patch) => setGraphics((current) => current.map((item) => (item.id === graphicId ? { ...item, ...patch } : item)))}
              onTogglePreview={(graphicId) => assignGraphic(graphicId)}
              onToggleProgram={toggleProgramOverlay}
              onRemove={removeGraphic}
              onDownload={downloadGraphic}
              onApplyTemplate={applyFootballTemplate}
            />
          )}
        </aside>

        <main className={`flex min-h-[320px] min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden bg-[#080b10]`}>
          {studioMode === "football" && (
            <div aria-hidden className="pointer-events-none fixed -left-[9999px] top-0 h-px w-px overflow-hidden">
              {inputs.filter((input) => input.kind === "camera" || input.kind === "screen" || input.kind === "video").map((input) => (
                <video
                  key={input.id}
                  ref={(element) => {
                    if (!element) { inputVideoRefs.current.delete(input.id); return; }
                    inputVideoRefs.current.set(input.id, element);
                    if (input.stream && element.srcObject !== input.stream) element.srcObject = input.stream;
                  }}
                  src={input.kind === "video" ? input.url : undefined}
                  autoPlay
                  loop={input.loop}
                  muted
                  playsInline
                />
              ))}
            </div>
          )}          <div className={`grid grid-cols-1 gap-3 lg:grid-cols-2 ${activePane === "football" ? "flex-none p-2" : "min-h-0 flex-1 p-3"}`}>
            <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-emerald-400/20 bg-[#11161e] shadow-xl shadow-black/20">
              <div className="flex items-center gap-2 border-b border-white/[0.07] px-4 py-3">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                <span className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-200">Preview</span>
                <span className="min-w-0 flex-1 truncate text-right text-xs text-neutral-400">{previewScene?.name}</span>
              </div>
              <div className={`relative m-auto aspect-video w-full overflow-hidden max-w-[420px] bg-[conic-gradient(#1b2028_25%,#10141a_0_50%,#1b2028_0_75%,#10141a_0)_0_0/24px_24px]`}>
                <canvas ref={previewCanvasRef} width={1280} height={720} className="block aspect-video h-auto w-full" />
                {previewGraphics.map((graphic) => {
                  const position = getGraphicPosition(graphic);
                  const size = graphicOverlaySize(graphic);
                  const dragging = draggingPreviewGraphicId === graphic.id;
                  return (
                    <div
                      key={graphic.id}
                      role="button"
                      tabIndex={0}
                      aria-label={`Mover widget ${graphic.name}`}
                      onPointerDown={(event) => startPreviewGraphicDrag(event, graphic)}
                      onPointerMove={movePreviewGraphic}
                      onPointerUp={endPreviewGraphicDrag}
                      onPointerCancel={endPreviewGraphicDrag}
                      onContextMenu={(event) => openPreviewMenu(event, graphic)}
                      onClick={(event) => event.stopPropagation()}
                      className={`group absolute cursor-grab rounded-lg border outline-none transition-colors active:cursor-grabbing ${dragging ? "border-emerald-300 bg-emerald-300/10" : selectedGraphicId === graphic.id ? "border-yellow-300 bg-yellow-300/5" : "border-transparent hover:border-emerald-300/70 hover:bg-emerald-300/5"}`}
                      style={{
                        left: `${position.x}%`,
                        top: `${position.y}%`,
                        width: size.width,
                        aspectRatio: size.aspectRatio,
                        transform: `scale(${graphic.scale ?? 1})`,
                        transformOrigin: "top left",
                        touchAction: "none",
                      }}
                    >
                      <span className={`pointer-events-none absolute left-2 top-2 rounded bg-black/70 px-2 py-1 text-[9px] font-semibold uppercase tracking-wide text-emerald-200 transition-opacity ${dragging ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
                        Mover · {graphic.name}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="flex flex-wrap items-center gap-1.5 border-t border-white/[0.07] px-3 py-2.5">
                <button type="button" onClick={() => takeScene("cut")} title="Corte directo (Espacio)" className="rounded-lg bg-emerald-400 px-4 py-2 text-xs font-bold text-[#07120d] transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-40">CUT</button>
                <button type="button" onClick={() => takeScene(transitionMode === "cut" ? "fade" : transitionMode)} title="Transición automática (Enter)" className="rounded-lg bg-sky-400 px-4 py-2 text-xs font-bold text-[#06121a] transition hover:bg-sky-300 disabled:cursor-not-allowed disabled:opacity-40">AUTO</button>
                {(["fade", "wipe", "dip"] as TransitionMode[]).map((mode) => (
                  <button key={mode} type="button" onClick={() => setTransitionMode(mode)} className={`rounded-md border px-2.5 py-2 text-[11px] font-semibold ${transitionMode === mode ? "border-sky-300/50 bg-sky-400/15 text-sky-200" : "border-white/10 text-neutral-400 hover:text-white"}`}>
                    {mode === "fade" ? "Fundido" : mode === "wipe" ? "Barrido" : "Dip"}
                  </button>
                ))}
                <label className="flex items-center gap-1.5 text-[11px] text-neutral-500">
                  <input aria-label="Duración de la transición" type="range" min="100" max="2000" step="50" value={transitionMs} onChange={(event) => setTransitionMs(Number(event.target.value))} className="h-1.5 w-20 accent-sky-400" />
                  <span className="w-12 tabular-nums">{transitionMs} ms</span>
                </label>
                <button type="button" onClick={toggleFadeToBlack} title="Fundido a negro (F)" className={`ml-auto rounded-lg border px-3 py-2 text-[11px] font-bold ${ftb ? "border-yellow-400 bg-yellow-300 text-black" : "border-white/10 text-neutral-300 hover:bg-white/[0.06]"}`}>FTB</button>
              </div>
            </section>

            <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-yellow-400/20 bg-[#11161e] shadow-xl shadow-black/20">
              <div className="flex items-center gap-2 border-b border-white/[0.07] px-4 py-3">
                <span className={`h-2 w-2 rounded-full ${live ? "animate-pulse bg-yellow-400" : "bg-yellow-300"}`} />
                <span className="text-xs font-bold uppercase tracking-[0.12em] text-yellow-200">Program</span>
                <span className="min-w-0 flex-1 truncate text-right text-xs text-neutral-400">{programScene?.name}</span>
              </div>
              <div className={`relative m-auto aspect-video w-full overflow-hidden bg-black max-w-[420px]`}>
                <canvas ref={programCanvasRef} width={1920} height={1080} className="block aspect-video h-auto w-full" />
                {live && <span className="absolute left-3 top-3 inline-flex items-center gap-2 rounded-md bg-yellow-300 px-3 py-1.5 text-xs font-bold text-black"><span className="h-2 w-2 animate-pulse rounded-full bg-white" /> EN VIVO</span>}
              </div>
              <div className="flex flex-wrap items-center gap-1.5 border-t border-white/[0.07] px-4 py-2.5">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Overlays</span>
                {modeGraphics.slice(0, 4).map((graphic, index) => {
                  const on = programGraphics.some((item) => item.id === graphic.id);
                  return (
                    <button key={graphic.id} type="button" onClick={() => toggleProgramOverlay(graphic.id)} title={`Mostrar/ocultar en Program (Mayús+${index + 1})`} className={`max-w-[120px] truncate rounded-md border px-2 py-1.5 text-[10px] font-semibold ${on ? "border-yellow-400 bg-yellow-300 text-black" : "border-white/10 text-neutral-400 hover:text-black"}`}>
                      {index + 1} · {graphic.name}
                    </button>
                  );
                })}
                <span className="ml-auto text-xs tabular-nums text-neutral-400">{elapsedLabel}</span>
              </div>
            </section>
          </div>

          {activePane === "football" && (
            <FootballDeck
              fm={fm}
              airGraphics={programGraphicsSnapshot.map((graphic) => ({ id: graphic.id, name: graphic.name }))}
              onRetire={retireProgramGraphic}
              onRetireAll={retireAllProgram}
              onAirTemp={(variant, options) => airTemp(variant, options, 6)}
            />
          )}

          {activePane === "football" && (
            <FootballMedia
              sources={inputs.filter((input) => !input.id.startsWith("lib-") && input.kind !== "audio").map((input) => ({ id: input.id, name: input.name, kind: input.kind }))}
              sceneInputIds={scenes.find((scene) => scene.id === previewSceneId)?.inputIds ?? []}
              layout={scenes.find((scene) => scene.id === previewSceneId)?.layout ?? "auto"}
              backgroundItemId={(scenes.find((scene) => scene.id === previewSceneId)?.backgroundId ?? "").replace("lib-", "") || null}
              promoItemId={promoItemId}
              library={mediaLibrary}
              onUpload={uploadLibrary}
              onDeleteItem={removeLibraryItem}
              onPromo={airPromo}
              onStopPromo={stopPromo}
              onBackground={setBackground}
              onToggleSource={toggleSceneSource}
              onLayout={assignLayout}
              onConnectCamera={connectCamera}
              onConnectMic={connectMicrophone}
              onConnectScreen={connectScreen}
              onCrop={setCropInputId}
              croppedIds={inputs.filter((input) => input.crop).map((input) => input.id)}
            />
          )}

          <section className="border-t border-white/[0.08] bg-[#0d1117] px-3 py-2.5">
            <div className="mb-2 flex items-center gap-2">
              <RectangleHorizontal size={15} className="text-neutral-400" />
              <span className="text-xs font-semibold uppercase tracking-[0.1em] text-neutral-300">Escenas</span>
              <span className="text-[11px] text-neutral-600">{modeScenes.length} disponibles</span>
              <div className="relative ml-auto flex items-center gap-2">
                {guestRoom ? (
                  <div className="flex items-center gap-1.5 rounded-lg border border-emerald-400/30 bg-emerald-400/[0.07] px-2 py-1">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                    <input readOnly aria-label="Enlace de invitado" value={guestUrl(typeof window === "undefined" ? "" : window.location.origin, guestRoom)} onFocus={(event) => event.currentTarget.select()} className="hidden w-44 bg-transparent text-[10px] text-emerald-100 outline-none md:block" />
                    <button type="button" onClick={() => void copyGuestLink()} className="rounded-md bg-emerald-400 px-2 py-1 text-[10px] font-bold text-black hover:bg-emerald-300">Copiar</button>
                    <button type="button" onClick={closeGuestRoom} aria-label="Cerrar sala de invitados" className="rounded-md p-1 text-emerald-200/70 hover:text-white"><X size={12} /></button>
                  </div>
                ) : (
                  <button type="button" onClick={() => void openGuestRoom()} title="Genera un enlace para que un invitado entre con cámara y micrófono" className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/30 px-3 py-2 text-[11px] font-medium text-emerald-200 hover:bg-emerald-400/10">
                    <Video size={13} /> Invitar por enlace
                  </button>
                )}
                <button type="button" onClick={addScene} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-[11px] font-medium text-neutral-300 hover:bg-white/[0.06] hover:text-white">
                  <Plus size={13} /> Nueva escena
                </button>
              </div>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {modeScenes.map((scene, index) => (
                <div key={scene.id} className={`flex min-w-[140px] flex-none items-stretch overflow-hidden rounded-lg border ${previewSceneId === scene.id ? "border-yellow-300/50 bg-yellow-300/[0.07]" : "border-white/[0.08] bg-[#141a22]"}`}>
                  <div className="min-w-0 flex-1 px-2.5 py-1.5">
                    <span className="block text-[9px] font-medium text-neutral-500">S{String(index + 1).padStart(2, "0")} · {scene.inputIds.length} fuentes {programSceneId === scene.id ? "· AL AIRE" : ""}</span>
                    {renamingSceneId === scene.id ? (
                      <input
                        autoFocus
                        value={sceneNameDraft}
                        onChange={(event) => setSceneNameDraft(event.target.value)}
                        onBlur={() => setRenamingSceneId(null)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") saveSceneName(scene.id);
                          if (event.key === "Escape") setRenamingSceneId(null);
                        }}
                        className="mt-1 h-7 w-full rounded border border-white/15 bg-black/30 px-2 text-xs text-white outline-none"
                      />
                    ) : (
                      <button type="button" onClick={() => setPreviewSceneId(scene.id)} className="block w-full truncate text-left text-xs font-semibold text-neutral-100 hover:text-yellow-200">{scene.name}</button>
                    )}
                    {previewSceneId === scene.id && <div className="mt-1.5 flex max-w-[240px] flex-wrap gap-1">
                      {modeGraphics.map((graphic) => {
                        const assigned = (scene.graphicIds?.length ? scene.graphicIds : scene.graphicId ? [scene.graphicId] : []).includes(graphic.id);
                        return (
                          <button
                            key={graphic.id}
                            type="button"
                            onClick={() => {
                              setPreviewSceneId(scene.id);
                              assignGraphic(graphic.id, scene.id);
                            }}
                            className={`max-w-full truncate rounded-md border px-1.5 py-1 text-[9px] ${assigned ? "border-yellow-300/40 bg-yellow-300/10 text-yellow-200" : "border-white/[0.08] text-neutral-500 hover:text-neutral-200"}`}
                            title={`${assigned ? "Quitar" : "Agregar"} ${graphic.name}`}
                          >
                            {assigned ? "✓ " : "+ "}{graphic.name}
                          </button>
                        );
                      })}
                    </div>}
                  </div>
                  <div className="flex flex-col border-l border-white/[0.07]">
                    <button type="button" onClick={() => { setSceneNameDraft(scene.name); setRenamingSceneId(scene.id); }} aria-label={`Renombrar escena ${scene.name}`} className="flex-1 px-2 text-neutral-500 hover:bg-white/[0.06] hover:text-white">
                      <Pencil size={12} />
                    </button>
                    <button type="button" onClick={() => duplicateScene(scene)} aria-label={`Duplicar escena ${scene.name}`} className="flex-1 border-t border-white/[0.07] px-2 text-neutral-500 hover:bg-white/[0.06] hover:text-white">
                      <Copy size={12} />
                    </button>
                    <button type="button" onClick={() => removeScene(scene)} aria-label={`Eliminar escena ${scene.name}`} className="flex-1 border-t border-white/[0.07] px-2 text-neutral-500 hover:bg-yellow-500/10 hover:text-yellow-300">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </main>

        {activePane !== "football" && <aside className="flex max-h-[34vh] min-h-[180px] flex-col border-t border-white/[0.08] bg-[#0d1117] xl:max-h-none xl:w-[270px] xl:flex-shrink-0 xl:border-l xl:border-t-0">
          <div className="flex items-center gap-2 border-b border-white/[0.07] px-4 py-3">
            <Clapperboard size={15} className="text-neutral-400" />
            <h3 className="text-xs font-semibold text-neutral-100">Mezclador y control</h3>
          </div>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
            <section>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Mezcla al aire</p>
                <span className="text-[10px] text-neutral-600">Solo fuentes de Program</span>
              </div>
              <div className="space-y-2">
                {inputs.filter((input) => input.kind === "video" || (input.stream?.getAudioTracks().length ?? 0) > 0).length === 0 ? (
                  <p className="rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 py-3 text-[11px] leading-relaxed text-neutral-500">
                    Añade un micrófono, audio de pantalla o video con sonido para mezclarlo en la salida.
                  </p>
                ) : inputs.filter((input) => input.kind === "video" || (input.stream?.getAudioTracks().length ?? 0) > 0).map((input) => {
                  const inProgram = Boolean(programScene?.inputIds.includes(input.id));
                  return (
                    <div key={input.id} className={`rounded-lg border p-2.5 ${inProgram ? "border-amber-400/20 bg-amber-400/[0.04]" : "border-white/[0.06] bg-white/[0.02] opacity-70"}`}>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => updateInput(input.id, { muted: !input.muted })}
                          aria-label={`${input.muted ? "Activar" : "Silenciar"} ${input.name}`}
                          className={`rounded-md p-1.5 ${input.muted ? "bg-yellow-500/10 text-yellow-300" : "bg-white/[0.06] text-amber-200 hover:bg-white/[0.1]"}`}
                        >
                          {input.muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                        </button>
                        <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-neutral-200">{input.name}</span>
                        <span className="text-[10px] tabular-nums text-neutral-500">{Math.round(input.volume * 100)}%</span>
                      </div>
                      <input
                        aria-label={`Volumen de ${input.name}`}
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={input.volume}
                        onChange={(event) => updateInput(input.id, { volume: Number(event.target.value) })}
                        className="mt-2 h-1.5 w-full cursor-pointer accent-amber-400"
                      />
                      <p className="mt-1 text-[10px] text-neutral-600">{inProgram ? "En el programa" : "No suena hasta entrar en programa"}</p>
                    </div>
                  );
                })}
              </div>
            </section>
            <div>
              <label className="mb-1.5 block text-[11px] font-medium text-neutral-400">Composición de Preview</label>
              <select
                aria-label="Composición de Preview"
                value={previewScene?.layout ?? "auto"}
                onChange={(event) => assignLayout(event.target.value as SceneLayout)}
                className="h-9 w-full rounded-lg border border-white/10 bg-[#101114] px-3 text-xs text-neutral-200 outline-none"
              >
                <option value="auto">Automática · cuadrícula</option>
                <option value="single">Pantalla completa · primera fuente</option>
                <option value="split">Dividida · dos fuentes</option>
                <option value="triple">Tres fuentes · columnas</option>
                <option value="pip">Cuadro en cuadro</option>
              </select>
              <p className="mt-1 text-[10px] leading-relaxed text-neutral-600">Define cómo se componen las fuentes de la escena seleccionada.</p>
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-medium text-neutral-400">Gráfico de Preview</label>
              <select
                aria-label="Gráfico de la escena Preview"
                value=""
                onChange={(event) => assignGraphic(event.target.value)}
                className="h-9 w-full rounded-lg border border-white/10 bg-[#101114] px-3 text-xs text-neutral-200 outline-none"
              >
                <option value="">Añadir gráfico a la composición…</option>
                {modeGraphics.map((graphic) => <option key={graphic.id} value={graphic.id}>{graphic.name}</option>)}
              </select>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(previewScene?.graphicIds?.length ? previewScene.graphicIds : previewScene?.graphicId ? [previewScene.graphicId] : []).map((id) => {
                  const graphic = graphics.find((item) => item.id === id);
                  return graphic ? <span key={id} className="rounded-full border border-yellow-400/20 bg-yellow-500/10 px-2 py-1 text-[10px] text-yellow-200">{graphic.name}</span> : null;
                })}
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-[11px] font-medium text-neutral-400">Fuentes de Preview</p>
              <div className="space-y-1.5">
                {inputs.length === 0 ? <p className="text-[11px] text-neutral-600">Sin fuentes conectadas</p> : inputs.map((input) => {
                  const active = Boolean(previewScene?.inputIds.includes(input.id));
                  return (
                    <button
                      key={input.id}
                      type="button"
                      onClick={() => toggleSceneInput(previewSceneId, input.id)}
                      className={`flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-[11px] ${active ? "border-sky-400/20 bg-sky-500/[0.06] text-sky-200" : "border-white/[0.06] text-neutral-500 hover:text-neutral-300"}`}
                    >
                      {active ? <Pause size={13} /> : <Play size={13} />}
                      <span className="min-w-0 flex-1 truncate">{input.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3">
              <div className="flex items-center gap-1.5">
                <Wifi size={14} className={live ? "text-yellow-300" : "text-neutral-500"} />
                <span className="text-[11px] font-semibold text-neutral-200">Destino de emisión</span>
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-neutral-500">Publicación WHIP/WebRTC. Requiere un gateway para retransmitir a RTMP.</p>
              <button type="button" onClick={() => setWhipOpen(true)} className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-lg border border-white/[0.08] px-3 py-2 text-[11px] text-neutral-300 hover:bg-white/[0.06] hover:text-white">
                <Settings2 size={13} /> Configurar destino
              </button>
              <p className="mt-1.5 truncate text-[10px] text-neutral-600">{whipHost}</p>
            </div>
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3">
              <div className="flex items-center gap-1.5">
                <Gamepad2 size={14} className={controllerName ? "text-emerald-300" : "text-neutral-500"} />
                <span className="text-[11px] font-semibold text-neutral-200">Atajos de producción</span>
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-neutral-500">
                {controllerName || "Teclado: 1–9 escena · Espacio TAKE · R grabar"}
              </p>
              {!controllerName && <p className="mt-1 text-[10px] leading-relaxed text-neutral-600">Gamepad: A TAKE · B grabar · cruceta cambia escena.</p>}
            </div>
          </div>
        </aside>}
      </div>
      {activePane === "football" && (
        <footer className="flex h-16 flex-shrink-0 items-center gap-2 border-t border-white/[0.1] bg-[#090c11] px-3">
          <AudioBar inputs={inputs} programInputIds={programScene?.inputIds ?? []} onUpdateInput={updateInput} masterVolume={masterVolume} onMasterVolume={setMasterVolume} />
          <div className="h-8 w-px bg-white/[0.1]" />
          <div className="flex min-w-[96px] flex-col px-2 leading-3">
            <span className="text-[10px] font-bold uppercase text-white">AL AIRE <span className="text-yellow-300">{programGraphicsSnapshot.length}</span></span>
            <span className="mt-0.5 text-[10px] tabular-nums text-neutral-400">{footerKickoff || `Emisión ${elapsedLabel}`}</span>
            <label className="mt-0.5 flex items-center gap-1 text-[9px] text-neutral-500"><input type="checkbox" checked={autoReact} onChange={(event) => setAutoReact(event.target.checked)} className="accent-emerald-400" /> Gráf. auto</label>
          </div>
          <div className="h-8 w-px bg-white/[0.1]" />
          <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            {modeScenes.map((scene, index) => {
              const isProgram = programSceneId === scene.id;
              const isPreview = previewSceneId === scene.id;
              return <button key={scene.id} type="button" onClick={() => setPreviewSceneId(scene.id)} title={`Preparar «${scene.name}» en Preview (tecla ${index + 1})`} className={`flex-shrink-0 rounded-lg border px-2.5 py-1.5 text-[10px] font-semibold ${isProgram ? "border-yellow-400 bg-yellow-500/20 text-white" : isPreview ? "border-emerald-400 bg-emerald-400/15 text-emerald-100" : "border-white/[0.08] text-neutral-400 hover:text-white"}`}><span className="mr-1 text-neutral-500">{index + 1}</span>{scene.name}</button>;
            })}
          </div>
          <div className="h-8 w-px bg-white/[0.1]" />
          <div className="flex items-center gap-1.5 px-1">
            <button type="button" onClick={() => setSfxOn((value) => !value)} title="Efectos de sonido automáticos en goles y tarjetas" className={`rounded-md border px-2 py-1.5 text-[10px] font-semibold ${sfxOn ? "border-yellow-300/50 text-yellow-200" : "border-white/10 text-neutral-500"}`}>SFX {sfxOn ? "ON" : "OFF"}</button>
            <input type="range" min={0.1} max={1} step={0.05} value={sfxVolume} onChange={(event) => changeSfxVolume(Number(event.target.value))} aria-label="Volumen de efectos" className="w-16 accent-yellow-300" />
            <button type="button" onClick={() => playSfx("whistle", sfxVolume)} title="Pitazo" className="rounded-md border border-white/[0.08] px-2 py-1.5 text-[10px] font-semibold text-neutral-300 hover:text-white">Pitazo</button>
            <button type="button" onClick={() => playSfx("goal", sfxVolume)} title="Probar sonido de gol" className="rounded-md border border-white/[0.08] px-2 py-1.5 text-[10px] font-semibold text-neutral-300 hover:text-white">Gol</button>
          </div>
          <div className="h-8 w-px bg-white/[0.1]" />
          {([
            ["Marcador", "F1", "elite"],
            ["Previa", "F2", "prematch"],
            ["Local", "F3", "lineup-home"],
            ["Visita", "F4", "lineup-away"],
            ["Stats", "F5", "stats"],
          ] as Array<[string, string, GraphicVariant]>).map(([label, shortcut, variant]) => {
            const onAir = programGraphicsSnapshot.some((item) => item.variant === variant);
            return <button key={shortcut} type="button" onClick={() => toggleAir(variant)} title={onAir ? "Retirar del aire" : "Sacar al aire"} className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-[10px] font-semibold ${onAir ? "border-yellow-400 bg-yellow-500/25 text-white" : "border-white/[0.08] bg-white/[0.025] text-neutral-300 hover:border-white/20 hover:text-white"}`}>{onAir && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-yellow-400" />}<span>{label}</span><kbd className="rounded bg-white/10 px-1 py-0.5 text-[9px] text-neutral-400">{shortcut}</kbd></button>;
          })}          <button type="button" onClick={() => takeScene()} className="rounded-lg bg-emerald-500 px-4 py-2 text-[10px] font-black text-black hover:bg-emerald-400">TAKE <kbd className="ml-1 rounded bg-black/20 px-1">Espacio</kbd></button>
          <button type="button" onClick={retireAllProgram} className="rounded-lg border border-yellow-400/40 bg-yellow-500/10 px-3 py-2 text-[10px] font-bold text-yellow-200 hover:bg-yellow-500/20">Retirar todo <kbd className="ml-1 rounded bg-black/30 px-1">Esc</kbd></button>
          <button type="button" onClick={() => document.documentElement.requestFullscreen?.()} aria-label="Pantalla completa" className="rounded-lg border border-white/[0.08] p-2 text-neutral-400 hover:text-white"><RectangleHorizontal size={15} /></button>
        </footer>
      )}

      {editingGraphic && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Editor de plantilla gráfica">
          <div className="max-h-[min(900px,calc(100vh-32px))] w-full max-w-3xl overflow-y-auto rounded-2xl border border-white/10 bg-[#11161e] p-5 shadow-2xl">
            <div className="mb-4 flex items-center gap-2">
              <Layers3 size={18} className="text-yellow-300" />
              <h3 className="flex-1 text-base font-semibold">Editor de gráfico</h3>
              <button type="button" onClick={() => setEditingGraphic(null)} aria-label="Cerrar editor de plantilla" className="rounded p-1 text-neutral-500 hover:bg-white/[0.08] hover:text-white"><X size={15} /></button>
            </div>
            <div className="space-y-3">
              <label className="block text-xs text-neutral-400">Nombre de plantilla
                <input value={editingGraphic.name} onChange={(event) => setEditingGraphic({ ...editingGraphic, name: event.target.value })} className="mt-1.5 h-10 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white outline-none focus:border-white/25" />
              </label>
              <label className="block text-xs text-neutral-400">{editingGraphic.kind === "scoreboard" ? "Marcador" : "Titular"}
                <input value={editingGraphic.title} onChange={(event) => setEditingGraphic({ ...editingGraphic, title: event.target.value })} className="mt-1.5 h-10 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white outline-none focus:border-white/25" />
              </label>
              <label className="block text-xs text-neutral-400">Subtítulo / información
                <input value={editingGraphic.subtitle} onChange={(event) => setEditingGraphic({ ...editingGraphic, subtitle: event.target.value })} className="mt-1.5 h-10 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white outline-none focus:border-white/25" />
              </label>
              <label className="block text-xs text-neutral-400">Plantilla visual / marcador oficial
                <input type="file" accept="image/*" onChange={(event) => { loadGraphicImage(event.target.files?.[0]); event.currentTarget.value = ""; }} className="mt-1.5 block w-full text-[10px] text-neutral-500 file:mr-2 file:rounded-md file:border-0 file:bg-white/10 file:px-2 file:py-1.5 file:text-[10px] file:text-neutral-200" />
                <span className="mt-1 block text-[10px] text-neutral-600">Carga un PNG/WebP transparente de CONMEBOL, liga o patrocinador. Se adapta a la escala y posición del widget.</span>
              </label>
              {editingGraphic.football && (
                <section className="rounded-xl border border-yellow-400/15 bg-yellow-500/[0.04] p-3">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-yellow-100">Configuración de partido</p>
                      <p className="mt-0.5 text-[10px] text-yellow-200/50">Los controles se reflejan en vivo en Preview y Program.</p>
                    </div>
                    <span className="rounded-full bg-yellow-400/10 px-2 py-1 text-[10px] font-semibold text-yellow-200">FÚTBOL</span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block text-xs text-neutral-400 sm:col-span-2">Competición
                      <input value={editingGraphic.football.competition ?? ""} onChange={(event) => setEditingGraphic({ ...editingGraphic, football: { ...editingGraphic.football!, competition: event.target.value } })} placeholder="Liga · Jornada · Final" className="mt-1.5 h-9 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-xs text-white outline-none focus:border-yellow-300/40" />
                    </label>
                    <label className="block text-xs text-neutral-400">Local
                      <input value={editingGraphic.football.homeTeam} onChange={(event) => setEditingGraphic({ ...editingGraphic, football: { ...editingGraphic.football!, homeTeam: event.target.value } })} className="mt-1.5 h-9 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-xs text-white outline-none focus:border-yellow-300/40" />
                    </label>
                    <label className="block text-xs text-neutral-400">Visitante
                      <input value={editingGraphic.football.awayTeam} onChange={(event) => setEditingGraphic({ ...editingGraphic, football: { ...editingGraphic.football!, awayTeam: event.target.value } })} className="mt-1.5 h-9 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-xs text-white outline-none focus:border-yellow-300/40" />
                    </label>
                    <label className="block text-xs text-neutral-400">Escudo local
                      <input type="file" accept="image/*" onChange={(event) => { loadTeamLogo("homeLogo", event.target.files?.[0]); event.currentTarget.value = ""; }} className="mt-1.5 block w-full text-[10px] text-neutral-500 file:mr-2 file:rounded-md file:border-0 file:bg-white/10 file:px-2 file:py-1.5 file:text-[10px] file:text-neutral-200" />
                    </label>
                    <label className="block text-xs text-neutral-400">Escudo visitante
                      <input type="file" accept="image/*" onChange={(event) => { loadTeamLogo("awayLogo", event.target.files?.[0]); event.currentTarget.value = ""; }} className="mt-1.5 block w-full text-[10px] text-neutral-500 file:mr-2 file:rounded-md file:border-0 file:bg-white/10 file:px-2 file:py-1.5 file:text-[10px] file:text-neutral-200" />
                    </label>
                    <label className="block text-xs text-neutral-400">Goles local
                      <input type="number" min="0" value={editingGraphic.football.homeScore} onChange={(event) => setEditingGraphic({ ...editingGraphic, football: { ...editingGraphic.football!, homeScore: Math.max(0, Number(event.target.value)) } })} className="mt-1.5 h-9 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-xs text-white outline-none focus:border-yellow-300/40" />
                    </label>
                    <label className="block text-xs text-neutral-400">Goles visitante
                      <input type="number" min="0" value={editingGraphic.football.awayScore} onChange={(event) => setEditingGraphic({ ...editingGraphic, football: { ...editingGraphic.football!, awayScore: Math.max(0, Number(event.target.value)) } })} className="mt-1.5 h-9 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-xs text-white outline-none focus:border-yellow-300/40" />
                    </label>
                    <label className="flex items-center gap-2 text-xs text-neutral-400">Color secundario
                      <input type="color" value={editingGraphic.football.accent2 ?? "#f97316"} onChange={(event) => setEditingGraphic({ ...editingGraphic, football: { ...editingGraphic.football!, accent2: event.target.value } })} className="h-8 w-10 cursor-pointer rounded border border-white/10 bg-transparent" />
                      <span className="font-mono text-neutral-500">{editingGraphic.football.accent2 ?? "#f97316"}</span>
                    </label>
                  </div>
                </section>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex items-center gap-2 text-xs text-neutral-400">Acento
                  <input type="color" value={editingGraphic.accent} onChange={(event) => setEditingGraphic({ ...editingGraphic, accent: event.target.value })} className="h-8 w-10 cursor-pointer rounded border border-white/10 bg-transparent" />
                  <span className="font-mono text-neutral-500">{editingGraphic.accent}</span>
                </label>
                <label className="flex items-center gap-2 text-xs text-neutral-400">Fondo
                  <input type="color" value={editingGraphic.background ?? "#090b0f"} onChange={(event) => setEditingGraphic({ ...editingGraphic, background: event.target.value })} className="h-8 w-10 cursor-pointer rounded border border-white/10 bg-transparent" />
                  <span className="font-mono text-neutral-500">{editingGraphic.background ?? "#090b0f"}</span>
                </label>
                <label className="flex items-center gap-2 text-xs text-neutral-400">Texto
                  <input type="color" value={editingGraphic.textColor ?? "#ffffff"} onChange={(event) => setEditingGraphic({ ...editingGraphic, textColor: event.target.value })} className="h-8 w-10 cursor-pointer rounded border border-white/10 bg-transparent" />
                  <span className="font-mono text-neutral-500">{editingGraphic.textColor ?? "#ffffff"}</span>
                </label>
                <label className="flex items-center gap-2 text-xs text-neutral-400">Subtexto
                  <input type="color" value={editingGraphic.subtitleColor ?? "#d1d5db"} onChange={(event) => setEditingGraphic({ ...editingGraphic, subtitleColor: event.target.value })} className="h-8 w-10 cursor-pointer rounded border border-white/10 bg-transparent" />
                  <span className="font-mono text-neutral-500">{editingGraphic.subtitleColor ?? "#d1d5db"}</span>
                </label>
                <label className="block text-xs text-neutral-400">Escala
                  <div className="mt-1.5 flex items-center gap-2">
                    <input type="range" min="0.75" max="1.4" step="0.05" value={editingGraphic.scale ?? 1} onChange={(event) => setEditingGraphic({ ...editingGraphic, scale: Number(event.target.value) })} className="w-full accent-yellow-400" />
                    <span className="w-10 text-right text-[11px] tabular-nums text-neutral-500">{Math.round((editingGraphic.scale ?? 1) * 100)}%</span>
                  </div>
                </label>
                <label className="block text-xs text-neutral-400">Redondeado
                  <div className="mt-1.5 flex items-center gap-2">
                    <input type="range" min="0" max="32" step="1" value={editingGraphic.radius ?? 8} onChange={(event) => setEditingGraphic({ ...editingGraphic, radius: Number(event.target.value) })} className="w-full accent-yellow-400" />
                    <span className="w-10 text-right text-[11px] tabular-nums text-neutral-500">{editingGraphic.radius ?? 8}px</span>
                  </div>
                </label>
                <label className="block text-xs text-neutral-400">Alineación
                  <select value={editingGraphic.alignment ?? "left"} onChange={(event) => setEditingGraphic({ ...editingGraphic, alignment: event.target.value as BroadcastGraphic["alignment"] })} className="mt-1.5 h-9 w-full rounded-lg border border-white/10 bg-black/20 px-2.5 text-xs text-white outline-none">
                    <option value="left">Izquierda</option>
                    <option value="center">Centro</option>
                    <option value="right">Derecha</option>
                  </select>
                </label>
              </div>
              <div className="rounded-xl border border-white/[0.08] bg-black/20 p-3">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Vista previa · 16:9</p>
                <div ref={templatePreviewRef} className="relative flex aspect-video items-end overflow-hidden rounded-lg bg-gradient-to-br from-[#252b35] via-[#11151c] to-black p-5">
                  {editingGraphic.backgroundImage && <img src={editingGraphic.backgroundImage} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-contain" />}
                  {editingGraphic.kind === "scoreboard" ? (
                    <div
                      onPointerDown={startTemplateDrag}
                      onPointerMove={moveTemplateDrag}
                      onPointerUp={(event) => event.currentTarget.releasePointerCapture(event.pointerId)}
                      className="absolute flex w-[min(88%,520px)] cursor-grab flex-col gap-2 border border-white/15 p-3 text-center shadow-2xl active:cursor-grabbing"
                      style={{
                        left: `${editingGraphic.position?.x ?? 69}%`,
                        top: `${editingGraphic.position?.y ?? 7}%`,
                        background: `linear-gradient(135deg, ${editingGraphic.background ?? "#090b0f"}, ${editingGraphic.football?.accent2 ?? "#f97316"}33)`,
                        borderTop: `3px solid ${editingGraphic.accent}`,
                        borderRadius: editingGraphic.radius ?? 8,
                        transform: `scale(${editingGraphic.scale ?? 1})`,
                        transformOrigin: "top left",
                        touchAction: "none",
                      }}
                    >
                      <span className="text-[8px] font-bold tracking-[0.18em] text-neutral-400">{editingGraphic.football?.competition ?? "PARTIDO EN VIVO"}</span>
                      <div className="grid grid-cols-[1fr_auto_auto_auto_1fr] items-center gap-2">
                        <div className="flex min-w-0 items-center gap-1.5">
                          {editingGraphic.football?.homeLogo ? <img src={editingGraphic.football.homeLogo} alt="" className="h-7 w-7 rounded-lg object-contain" /> : <span className="h-7 w-7 rounded-lg bg-white/10" />}
                          <strong className="truncate text-[clamp(9px,1.4vw,16px)] text-left" style={{ color: editingGraphic.textColor ?? "#ffffff" }}>{editingGraphic.football?.homeTeam ?? "LOCAL"}</strong>
                        </div>
                        <strong className="text-[clamp(20px,3vw,38px)] leading-none" style={{ color: editingGraphic.textColor ?? "#ffffff" }}>{editingGraphic.football?.homeScore ?? 0}</strong>
                        <span className="text-sm text-neutral-400">:</span>
                        <strong className="text-[clamp(20px,3vw,38px)] leading-none" style={{ color: editingGraphic.textColor ?? "#ffffff" }}>{editingGraphic.football?.awayScore ?? 0}</strong>
                        <div className="flex min-w-0 items-center justify-end gap-1.5">
                          <strong className="truncate text-right text-[clamp(9px,1.4vw,16px)]" style={{ color: editingGraphic.textColor ?? "#ffffff" }}>{editingGraphic.football?.awayTeam ?? "VISITANTE"}</strong>
                          {editingGraphic.football?.awayLogo ? <img src={editingGraphic.football.awayLogo} alt="" className="h-7 w-7 rounded-lg object-contain" /> : <span className="h-7 w-7 rounded-lg bg-white/10" />}
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-2 text-[9px]" style={{ color: editingGraphic.subtitleColor ?? "#d1d5db" }}>
                        <span className="rounded-full border border-white/15 px-2 py-0.5">{editingGraphic.football?.period ?? "1T"} · {formatMediaTime(editingGraphic.football?.clockSeconds ?? 0)}{editingGraphic.football?.addedTime ? ` +${editingGraphic.football.addedTime}` : ""}</span>
                        <span>🟨 {editingGraphic.football?.homeYellow ?? 0}/{editingGraphic.football?.awayYellow ?? 0} · 🟥 {editingGraphic.football?.homeRed ?? 0}/{editingGraphic.football?.awayRed ?? 0}</span>
                      </div>
                      <span className="pointer-events-none absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] text-neutral-500">Arrastra para posicionar</span>
                    </div>
                  ) : editingGraphic.kind === "ticker" ? (
                    <div className="absolute inset-x-0 bottom-4 border-t-2 px-5 py-3" style={{ borderColor: editingGraphic.accent, backgroundColor: editingGraphic.background ?? "#090b0f", textAlign: editingGraphic.alignment ?? "left", transform: `scale(${editingGraphic.scale ?? 1})`, transformOrigin: "bottom center" }}>
                      <strong className="text-sm" style={{ color: editingGraphic.textColor ?? "#ffffff" }}>{editingGraphic.title || "Titular"}</strong>
                      <span className="ml-4 text-xs" style={{ color: editingGraphic.subtitleColor ?? "#d1d5db" }}>{editingGraphic.subtitle || "Información"}</span>
                    </div>
                  ) : (
                    <div className="flex max-w-[85%] items-stretch overflow-hidden border border-white/10" style={{ backgroundColor: editingGraphic.background ?? "#090b0f", borderRadius: editingGraphic.radius ?? 8, transform: `scale(${editingGraphic.scale ?? 1})`, transformOrigin: "bottom left" }}>
                      <span className="w-1.5" style={{ backgroundColor: editingGraphic.accent }} />
                      <span className="px-4 py-3">
                        <strong className="block truncate text-sm" style={{ color: editingGraphic.textColor ?? "#ffffff" }}>{editingGraphic.title || "Titular"}</strong>
                        <span className="mt-1 block truncate text-xs" style={{ color: editingGraphic.subtitleColor ?? "#d1d5db" }}>{editingGraphic.subtitle || "Subtítulo"}</span>
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <p className="text-[11px] leading-relaxed text-neutral-500">Diseña la plantilla con controles visuales. Se adapta a 16:9, móvil y salida transparente sin editar XML ni HTML.</p>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setEditingGraphic(null)} className="rounded-lg border border-white/10 px-4 py-2.5 text-xs text-neutral-300 hover:bg-white/[0.05]">Cancelar</button>
                <button type="button" onClick={() => saveGraphic(editingGraphic)} className="rounded-lg bg-yellow-300 px-4 py-2.5 text-xs font-semibold text-black hover:bg-yellow-200">Guardar gráfico</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {whipOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Configurar destino de emisión">
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#111215] p-4 shadow-2xl">
            <div className="mb-4 flex items-center gap-2">
              <RadioTower size={15} className="text-yellow-300" />
              <h3 className="flex-1 text-sm font-semibold">Destino de emisión</h3>
              <button type="button" onClick={() => setWhipOpen(false)} aria-label="Cerrar configuración de emisión" className="rounded p-1 text-neutral-500 hover:bg-white/[0.08] hover:text-white"><X size={15} /></button>
            </div>
            <label className="block text-[10px] text-neutral-400">Endpoint de ingest WHIP
              <input
                value={whipUrl}
                onChange={(event) => setWhipUrl(event.target.value)}
                placeholder="https://tu-gateway.example/live/stream"
                spellCheck={false}
                className="mt-1 h-9 w-full rounded-md border border-white/10 bg-black/20 px-2.5 text-xs text-white outline-none focus:border-white/25"
              />
            </label>
            <label className="mt-3 block text-[10px] text-neutral-400">Token Bearer (opcional)
              <input
                type="password"
                value={whipToken}
                onChange={(event) => setWhipToken(event.target.value)}
                autoComplete="new-password"
                placeholder="No se guarda en el navegador"
                className="mt-1 h-9 w-full rounded-md border border-white/10 bg-black/20 px-2.5 text-xs text-white outline-none focus:border-white/25"
              />
            </label>
            <div className="mt-3 rounded-lg border border-amber-400/15 bg-amber-400/[0.04] p-3 text-[9px] leading-relaxed text-amber-100/70">
              El navegador no envía RTMP directamente. Broadcaster publica por WHIP/WebRTC; conecta aquí un gateway como MediaMTX o SRS para retransmitir a YouTube, Facebook u otros destinos RTMP. El endpoint no se guarda en disco.
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => { setWhipUrl(""); setWhipOpen(false); }} className="rounded-md border border-white/10 px-3 py-2 text-[10px] text-neutral-400 hover:bg-white/[0.05]">Cancelar</button>
              <button type="button" onClick={() => setWhipOpen(false)} className="rounded-md bg-yellow-300 px-3 py-2 text-[10px] font-semibold text-black hover:bg-yellow-200">Guardar destino</button>
            </div>
          </div>
        </div>
      )}

      {cropInputId && (() => {
        const target = inputs.find((input) => input.id === cropInputId);
        if (!target) return null;
        return (
          <CropEditor
            name={target.name}
            stream={target.stream}
            url={target.url}
            kind={target.kind}
            crop={target.crop}
            onClose={() => setCropInputId(null)}
            onSave={(crop) => { updateInput(target.id, { crop }); setCropInputId(null); toast.success(crop ? "Encuadre aplicado" : "Recorte quitado"); }}
          />
        );
      })()}

    </div>
  );
}
