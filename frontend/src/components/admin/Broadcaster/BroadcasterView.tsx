"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import NextImage from "next/image";
import {
  Circle, Clapperboard, Copy, Download, FileVideo2, Gamepad2, ImagePlus, Layers3,
  Mic, MonitorUp, Pause, Pencil, Play, Plus, Radio, RadioTower, RectangleHorizontal,
  ScreenShare, Settings2, Square, Trash2, Video, Volume2, VolumeX, Wifi, X,
} from "lucide-react";
import { toast } from "sonner";
import { exportGraphicHtml, type BroadcastGraphic, type GraphicKind } from "./graphicExport";

type InputKind = "camera" | "screen" | "video" | "image" | "audio";
type SceneLayout = "auto" | "single" | "split" | "pip";

interface BroadcastInput {
  id: string;
  name: string;
  kind: InputKind;
  stream?: MediaStream;
  url?: string;
  muted: boolean;
  volume: number;
  playing?: boolean;
  loop?: boolean;
}

interface AudioRoute {
  source: AudioNode;
  gain: GainNode;
}

interface BroadcastScene {
  id: string;
  name: string;
  inputIds: string[];
  graphicId: string | null;
  layout?: SceneLayout;
}

export type { BroadcastGraphic } from "./graphicExport";

const INITIAL_SCENES: BroadcastScene[] = [
  { id: "scene-wide", name: "Cámara principal", inputIds: [], graphicId: null },
  { id: "scene-interview", name: "Entrevista", inputIds: [], graphicId: null },
  { id: "scene-break", name: "Pausa", inputIds: [], graphicId: null },
];

const INITIAL_GRAPHICS: BroadcastGraphic[] = [
  { id: "graphic-lower-third", name: "Identificador", kind: "lower-third", title: "NOMBRE DEL INVITADO", subtitle: "Cargo · Equipo", accent: "#ef4444" },
  { id: "graphic-scoreboard", name: "Marcador", kind: "scoreboard", title: "LOCAL  0  —  0  VISITANTE", subtitle: "EN VIVO · 2T  35:20", accent: "#ef4444" },
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

function createId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
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
    && (scene.layout === undefined || ["auto", "single", "split", "pip"].includes(scene.layout)));
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
) {
  const mediaWidth = media instanceof HTMLVideoElement ? media.videoWidth : media.naturalWidth;
  const mediaHeight = media instanceof HTMLVideoElement ? media.videoHeight : media.naturalHeight;
  if (!mediaWidth || !mediaHeight) return;
  const scale = Math.max(width / mediaWidth, height / mediaHeight);
  const sourceWidth = width / scale;
  const sourceHeight = height / scale;
  const sourceX = (mediaWidth - sourceWidth) / 2;
  const sourceY = (mediaHeight - sourceHeight) / 2;
  context.drawImage(media, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
}

function drawScene(
  canvas: HTMLCanvasElement,
  scene: BroadcastScene | undefined,
  inputs: BroadcastInput[],
  videoElements: Map<string, HTMLVideoElement>,
  imageElements: Map<string, HTMLImageElement>,
  graphic: BroadcastGraphic | undefined,
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
      : allVisibleInputs;

  const drawInput = (input: BroadcastInput, x: number, y: number, cellWidth: number, cellHeight: number) => {
    const video = videoElements.get(input.id);
    if (input.kind === "image") {
      const image = imageElements.get(input.id);
      if (image?.complete) drawCover(context, image, x, y, cellWidth, cellHeight);
    } else if (video) {
      drawCover(context, video, x, y, cellWidth, cellHeight);
    }
    context.fillStyle = "rgba(0,0,0,.58)";
    context.fillRect(x + 16, y + cellHeight - 66, Math.min(520, input.name.length * 27 + 44), 48);
    context.fillStyle = "#fff";
    context.font = "600 30px Inter, Arial, sans-serif";
    context.textAlign = "left";
    context.fillText(input.name, x + 34, y + cellHeight - 32, cellWidth - 68);
  };

  if (visibleInputs.length === 0) {
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
    const columns = scene.layout === "split" && visibleInputs.length === 2 ? 2 : visibleInputs.length === 1 ? 1 : 2;
    const rows = Math.ceil(visibleInputs.length / columns);
    const cellWidth = (width - gap * (columns + 1)) / columns;
    const cellHeight = (height - gap * (rows + 1)) / rows;
    visibleInputs.forEach((input, index) => {
      const x = gap + (index % columns) * (cellWidth + gap);
      const y = gap + Math.floor(index / columns) * (cellHeight + gap);
      drawInput(input, x, y, cellWidth, cellHeight);
    });
  }

  if (!graphic) {
    context.restore();
    return;
  }
  const accent = /^#[0-9a-f]{6}$/i.test(graphic.accent) ? graphic.accent : "#ef4444";
  if (graphic.kind === "lower-third") {
    const x = 96;
    const y = 832;
    context.fillStyle = "rgba(9,11,15,.92)";
    context.fillRect(x, y, 850, 150);
    context.fillStyle = accent;
    context.fillRect(x, y, 10, 150);
    context.textAlign = "left";
    context.fillStyle = "#fff";
    context.font = "700 58px Inter, Arial, sans-serif";
    context.fillText(graphic.title.toUpperCase(), x + 34, y + 66, 780);
    context.fillStyle = "#d1d5db";
    context.font = "34px Inter, Arial, sans-serif";
    context.fillText(graphic.subtitle, x + 34, y + 111, 780);
  } else if (graphic.kind === "scoreboard") {
    context.fillStyle = "rgba(9,11,15,.92)";
    context.fillRect(1450, 72, 390, 118);
    context.fillStyle = accent;
    context.fillRect(1450, 72, 390, 6);
    context.fillStyle = "#fff";
    context.textAlign = "center";
    context.font = "700 42px Inter, Arial, sans-serif";
    context.fillText(graphic.title, 1645, 132, 365);
    context.fillStyle = "#d1d5db";
    context.font = "28px Inter, Arial, sans-serif";
    context.fillText(graphic.subtitle, 1645, 166, 365);
  } else {
    context.fillStyle = "rgba(9,11,15,.94)";
    context.fillRect(0, 1000, width, 80);
    context.fillStyle = accent;
    context.fillRect(0, 1000, width, 6);
    context.textAlign = "left";
    const ticker = `${graphic.title}     ·     ${graphic.subtitle}`;
    context.font = "700 42px Inter, Arial, sans-serif";
    const tickerWidth = context.measureText(ticker).width;
    const travel = (performance.now() / 30) % (tickerWidth + 120);
    const tickerX = width - travel;
    context.fillStyle = "#fff";
    context.fillText(ticker, tickerX, 1050, tickerWidth);
    context.fillText(ticker, tickerX + tickerWidth + 120, 1050, tickerWidth);
  }
  context.restore();
}

export default function BroadcasterView() {
  const [scenes, setScenes] = useState(INITIAL_SCENES);
  const [graphics, setGraphics] = useState(INITIAL_GRAPHICS);
  const [inputs, setInputs] = useState<BroadcastInput[]>([]);
  const [previewSceneId, setPreviewSceneId] = useState(INITIAL_SCENES[0].id);
  const [programSceneId, setProgramSceneId] = useState(INITIAL_SCENES[0].id);
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
  const [activePane, setActivePane] = useState<"inputs" | "graphics">("inputs");
  const [controllerName, setControllerName] = useState("");
  const [transitionMode, setTransitionMode] = useState<"cut" | "fade">("cut");
  const [renamingSceneId, setRenamingSceneId] = useState<string | null>(null);
  const [sceneNameDraft, setSceneNameDraft] = useState("");
  const [mediaProgress, setMediaProgress] = useState<Record<string, { currentTime: number; duration: number }>>({});

  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const programCanvasRef = useRef<HTMLCanvasElement>(null);
  const inputVideoRefs = useRef(new Map<string, HTMLVideoElement>());
  const inputImageRefs = useRef(new Map<string, HTMLImageElement>());
  const inputsRef = useRef(inputs);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const outputStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioRoutesRef = useRef(new Map<string, AudioRoute[]>());
  const mediaElementSourcesRef = useRef(new Map<string, MediaElementAudioSourceNode>());
  const programFadeAlphaRef = useRef(1);
  const isTransitioningRef = useRef(false);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const whipResourceRef = useRef<string | null>(null);
  const gamepadButtonsRef = useRef<boolean[]>([]);
  const didLoadStorageRef = useRef(false);
  const storageErrorShownRef = useRef(false);
  inputsRef.current = inputs;

  const previewScene = scenes.find((scene) => scene.id === previewSceneId);
  const programScene = scenes.find((scene) => scene.id === programSceneId);
  const previewGraphic = graphics.find((graphic) => graphic.id === previewScene?.graphicId);
  const programGraphic = graphics.find((graphic) => graphic.id === programScene?.graphicId);
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
        setProgramSceneId(storedScenes[0].id);
      }
      if (storedGraphics.length) setGraphics(storedGraphics);
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
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      const track = stream.getVideoTracks()[0];
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

  const takeScene = useCallback(() => {
    if (programSceneId === previewSceneId || isTransitioningRef.current) return;
    if (transitionMode === "cut") {
      programFadeAlphaRef.current = 1;
      setProgramSceneId(previewSceneId);
      return;
    }

    const targetSceneId = previewSceneId;
    const startedAt = performance.now();
    const duration = 360;
    let sceneChanged = false;
    isTransitioningRef.current = true;
    const animateFade = (now: number) => {
      const progress = Math.min((now - startedAt) / duration, 1);
      if (progress < 0.5) {
        programFadeAlphaRef.current = 1 - progress * 2;
      } else {
        if (!sceneChanged) {
          sceneChanged = true;
          setProgramSceneId(targetSceneId);
        }
        programFadeAlphaRef.current = (progress - 0.5) * 2;
      }
      if (progress < 1) requestAnimationFrame(animateFade);
      else {
        programFadeAlphaRef.current = 1;
        isTransitioningRef.current = false;
      }
    };
    requestAnimationFrame(animateFade);
  }, [previewSceneId, programSceneId, transitionMode]);

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
    const sceneInputIds = new Set(scenes.find((scene) => scene.id === programSceneId)?.inputIds ?? []);

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
      source.connect(gain);
      gain.connect(destination);
      const routes = audioRoutesRef.current.get(input.id) ?? [];
      audioRoutesRef.current.set(input.id, [...routes, { source, gain }]);
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
  }, [inputs, programSceneId, scenes]);

  const releaseOutputStream = useCallback(async () => {
    outputStreamRef.current?.getTracks().forEach((track) => track.stop());
    outputStreamRef.current = null;
    audioRoutesRef.current.forEach((routes) => routes.forEach(({ source, gain }) => {
      source.disconnect(gain);
      gain.disconnect();
    }));
    audioRoutesRef.current.clear();
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

  const updateInput = (inputId: string, updates: Partial<Pick<BroadcastInput, "muted" | "volume" | "playing" | "loop">>) => {
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
    const scene: BroadcastScene = { id: createId("scene"), name: `Escena ${scenes.length + 1}`, inputIds: [], graphicId: null };
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
    toast.success("Plantilla HTML guardada");
  };

  const removeGraphic = (graphicId: string) => {
    setGraphics((current) => current.filter((graphic) => graphic.id !== graphicId));
    setScenes((current) => current.map((scene) => scene.graphicId === graphicId ? { ...scene, graphicId: null } : scene));
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
    };
    setEditingGraphic(graphic);
  };

  const downloadGraphic = (graphic: BroadcastGraphic) => {
    const blob = new Blob([exportGraphicHtml(graphic)], { type: "text/html;charset=utf-8" });
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
        drawScene(programCanvasRef.current, programScene, currentInputs, inputVideoRefs.current, inputImageRefs.current, programGraphic, programFadeAlphaRef.current);
      }
      if (previewCanvasRef.current && now - lastPreviewDraw >= 66) {
        lastPreviewDraw = now;
        drawScene(previewCanvasRef.current, previewScene, currentInputs, inputVideoRefs.current, inputImageRefs.current, previewGraphic);
      }
    };
    frame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frame);
  }, [inputs, previewScene, programScene, previewGraphic, programGraphic]);

  useEffect(() => {
    const activeProgramInputs = new Set(programScene?.inputIds ?? []);
    audioRoutesRef.current.forEach((routes, inputId) => {
      const input = inputs.find((item) => item.id === inputId);
      const enabled = Boolean(input && activeProgramInputs.has(inputId) && !input.muted);
      routes.forEach(({ gain }) => {
        gain.gain.setTargetAtTime(enabled ? input?.volume ?? 1 : 0, audioContextRef.current?.currentTime ?? 0, 0.02);
      });
    });
  }, [inputs, programScene]);

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
      } else if (event.key.toLowerCase() === "r") {
        event.preventDefault();
        if (recording) stopRecording();
        else void startRecording();
      } else if (/^[1-9]$/.test(event.key)) {
        const index = Number(event.key) - 1;
        if (scenes[index]) setPreviewSceneId(scenes[index].id);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [recording, scenes, startRecording, stopRecording, takeScene]);

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

  const assignGraphic = (graphicId: string) => {
    setScenes((current) => current.map((scene) => scene.id === previewSceneId
      ? { ...scene, graphicId: graphicId || null }
      : scene));
  };
  const assignLayout = (layout: SceneLayout) => {
    setScenes((current) => current.map((scene) => scene.id === previewSceneId ? { ...scene, layout } : scene));
  };
  return (
    <div className="flex h-full min-h-0 flex-col bg-[#0a0d12] text-neutral-100">
      <header className="flex min-h-16 flex-wrap items-center gap-3 border-b border-white/[0.08] bg-[#11161e] px-4 py-3 sm:px-5">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-red-400/20 bg-red-500/10 text-red-300">
            <RadioTower size={19} />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-semibold tracking-wide">Broadcaster</h2>
            <p className="text-xs text-neutral-500">Estudio de producción · 1080p / 30 fps</p>
          </div>
          {controllerName && (
            <span className="hidden items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/[0.07] px-3 py-1.5 text-xs text-emerald-300 sm:inline-flex">
              <Gamepad2 size={14} /> Control conectado
            </span>
          )}
        </div>
        <div className="flex items-center gap-2.5">
          <span className="inline-flex items-center gap-2 rounded-lg border border-white/[0.08] bg-black/20 px-3 py-2 text-sm tabular-nums text-neutral-300">
            {recording || live ? <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" /> : <Circle size={10} />}
            {elapsedLabel}
          </span>
          {recording ? (
            <button type="button" onClick={stopRecording} className="inline-flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-xs font-semibold text-red-300 hover:bg-red-500/20">
              <Square size={14} fill="currentColor" /> Detener grabación
            </button>
          ) : (
            <button type="button" onClick={() => void startRecording()} className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3.5 py-2.5 text-xs font-semibold text-neutral-200 hover:bg-white/[0.06]">
              <Circle size={13} className="text-red-400" /> Grabar
            </button>
          )}
          {live ? (
            <button type="button" onClick={() => void stopLive()} className="inline-flex items-center gap-2 rounded-lg bg-red-500 px-3.5 py-2.5 text-xs font-semibold text-white hover:bg-red-400">
              <Wifi size={15} /> Detener emisión
            </button>
          ) : (
            <button type="button" onClick={() => void publishWhip()} className="inline-flex items-center gap-2 rounded-lg bg-red-500 px-3.5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-red-950/30 hover:bg-red-400">
              <Radio size={15} /> Emitir
            </button>
          )}
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col xl:flex-row">
        <aside className="flex max-h-[34vh] min-h-[170px] flex-col border-b border-white/[0.08] bg-[#0d1117] xl:max-h-none xl:w-[250px] xl:flex-shrink-0 xl:border-b-0 xl:border-r">
          <div className="flex items-center gap-1 border-b border-white/[0.07] p-2.5">
            <button type="button" onClick={() => setActivePane("inputs")} className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium ${activePane === "inputs" ? "bg-white/[0.09] text-white" : "text-neutral-500 hover:text-neutral-200"}`}>
              <Video size={14} className="mr-1.5 inline" /> Fuentes
            </button>
            <button type="button" onClick={() => setActivePane("graphics")} className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium ${activePane === "graphics" ? "bg-white/[0.09] text-white" : "text-neutral-500 hover:text-neutral-200"}`}>
              <Layers3 size={14} className="mr-1.5 inline" /> Gráficos
            </button>
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
                      <button type="button" onClick={() => removeInput(input)} aria-label={`Quitar ${input.name}`} className="rounded-md p-1 text-neutral-500 hover:bg-red-500/10 hover:text-red-300">
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
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2 border-b border-white/[0.07] p-3">
                <button type="button" onClick={() => addGraphic("lower-third")} className="rounded-lg border border-white/10 px-2 py-2 text-[11px] text-neutral-200 hover:bg-white/[0.06]">
                  <Plus size={13} className="mr-1 inline" /> Identificador
                </button>
                <button type="button" onClick={() => addGraphic("scoreboard")} className="rounded-lg border border-white/10 px-2 py-2 text-[11px] text-neutral-200 hover:bg-white/[0.06]">
                  <Plus size={13} className="mr-1 inline" /> Marcador
                </button>
                <button type="button" onClick={() => addGraphic("ticker")} className="col-span-2 rounded-lg border border-white/10 px-2 py-2 text-[11px] text-neutral-200 hover:bg-white/[0.06]">
                  <Plus size={13} className="mr-1 inline" /> Cintillo informativo
                </button>
              </div>
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
                {graphics.map((graphic) => (
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
                      <button type="button" onClick={() => removeGraphic(graphic.id)} aria-label={`Eliminar ${graphic.name}`} className="rounded-md p-1.5 text-neutral-500 hover:bg-red-500/10 hover:text-red-300">
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <p className="mt-1 text-[10px] text-neutral-500">{graphic.kind === "scoreboard" ? "Marcador" : graphic.kind === "ticker" ? "Cintillo" : "Identificador"} · {graphic.title}</p>
                    <button type="button" onClick={() => assignGraphic(graphic.id)} className="mt-2.5 w-full rounded-lg border border-white/[0.08] px-2.5 py-2 text-[11px] text-neutral-300 hover:bg-white/[0.06] hover:text-white">
                      {previewScene?.graphicId === graphic.id ? "Visible en Preview" : "Aplicar a Preview"}
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </aside>

        <main className="flex min-h-[320px] min-w-0 flex-1 flex-col bg-[#0a0d12]">
          <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 p-3 lg:grid-cols-2">
            <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-emerald-400/20 bg-[#11161e] shadow-xl shadow-black/20">
              <div className="flex items-center gap-2 border-b border-white/[0.07] px-4 py-3">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                <span className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-200">Preview</span>
                <span className="min-w-0 flex-1 truncate text-right text-xs text-neutral-400">{previewScene?.name}</span>
              </div>
              <div className="relative m-auto w-full max-w-[960px] overflow-hidden bg-black">
                <canvas ref={previewCanvasRef} width={1280} height={720} className="block aspect-video h-auto w-full" />
              </div>
              <div className="flex flex-wrap items-center gap-2 border-t border-white/[0.07] px-3 py-2.5">
                <button type="button" onClick={takeScene} disabled={programSceneId === previewSceneId} className="inline-flex items-center gap-2 rounded-lg bg-emerald-400 px-4 py-2 text-xs font-bold text-[#07120d] transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-40">
                  <Play size={14} fill="currentColor" /> TAKE
                </button>
                <label className="ml-auto flex items-center gap-2 text-[11px] text-neutral-500">
                  Transición
                  <select aria-label="Transición entre escenas" value={transitionMode} onChange={(event) => setTransitionMode(event.target.value as "cut" | "fade")} className="h-8 rounded-md border border-white/10 bg-[#0b0e13] px-2 text-[11px] text-neutral-200 outline-none">
                    <option value="cut">Corte</option>
                    <option value="fade">Fundido · 360 ms</option>
                  </select>
                </label>
              </div>
            </section>

            <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-red-400/20 bg-[#11161e] shadow-xl shadow-black/20">
              <div className="flex items-center gap-2 border-b border-white/[0.07] px-4 py-3">
                <span className={`h-2 w-2 rounded-full ${live ? "animate-pulse bg-red-400" : "bg-red-500"}`} />
                <span className="text-xs font-bold uppercase tracking-[0.12em] text-red-200">Program</span>
                <span className="min-w-0 flex-1 truncate text-right text-xs text-neutral-400">{programScene?.name}</span>
              </div>
              <div className="relative m-auto w-full max-w-[960px] overflow-hidden bg-black">
                <canvas ref={programCanvasRef} width={1920} height={1080} className="block aspect-video h-auto w-full" />
                {live && <span className="absolute left-3 top-3 inline-flex items-center gap-2 rounded-md bg-red-600 px-3 py-1.5 text-xs font-bold text-white"><span className="h-2 w-2 animate-pulse rounded-full bg-white" /> EN VIVO</span>}
              </div>
              <div className="flex items-center gap-2 border-t border-white/[0.07] px-4 py-2.5">
                <span className="text-[11px] text-neutral-500">Salida compuesta · 1920 × 1080 · 30 fps</span>
                <span className="ml-auto text-xs tabular-nums text-neutral-400">{elapsedLabel}</span>
              </div>
            </section>
          </div>

          <section className="border-t border-white/[0.08] bg-[#0d1117] px-3 py-2.5">
            <div className="mb-2 flex items-center gap-2">
              <RectangleHorizontal size={15} className="text-neutral-400" />
              <span className="text-xs font-semibold uppercase tracking-[0.1em] text-neutral-300">Escenas</span>
              <span className="text-[11px] text-neutral-600">{scenes.length} disponibles</span>
              <button type="button" onClick={addScene} className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-[11px] font-medium text-neutral-300 hover:bg-white/[0.06] hover:text-white">
                <Plus size={13} /> Nueva escena
              </button>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {scenes.map((scene, index) => (
                <div key={scene.id} className={`flex min-w-[190px] items-stretch overflow-hidden rounded-xl border ${previewSceneId === scene.id ? "border-emerald-400/40 bg-emerald-500/[0.07]" : "border-white/[0.08] bg-[#141a22]"}`}>
                  <div className="min-w-0 flex-1 px-3 py-2.5">
                    <span className="block text-[10px] font-medium text-neutral-500">S{String(index + 1).padStart(2, "0")} {programSceneId === scene.id ? "· AL AIRE" : ""}</span>
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
                      <button type="button" onClick={() => setPreviewSceneId(scene.id)} className="mt-1 block w-full truncate text-left text-xs font-semibold text-neutral-100 hover:text-emerald-200">{scene.name}</button>
                    )}
                    <span className="mt-1 block text-[11px] text-neutral-500">{scene.inputIds.length} fuentes</span>
                  </div>
                  <div className="flex flex-col border-l border-white/[0.07]">
                    <button type="button" onClick={() => { setSceneNameDraft(scene.name); setRenamingSceneId(scene.id); }} aria-label={`Renombrar escena ${scene.name}`} className="flex-1 px-2 text-neutral-500 hover:bg-white/[0.06] hover:text-white">
                      <Pencil size={12} />
                    </button>
                    <button type="button" onClick={() => duplicateScene(scene)} aria-label={`Duplicar escena ${scene.name}`} className="flex-1 border-t border-white/[0.07] px-2 text-neutral-500 hover:bg-white/[0.06] hover:text-white">
                      <Copy size={12} />
                    </button>
                    <button type="button" onClick={() => removeScene(scene)} aria-label={`Eliminar escena ${scene.name}`} className="flex-1 border-t border-white/[0.07] px-2 text-neutral-500 hover:bg-red-500/10 hover:text-red-300">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </main>

        <aside className="flex max-h-[34vh] min-h-[180px] flex-col border-t border-white/[0.08] bg-[#0d1117] xl:max-h-none xl:w-[270px] xl:flex-shrink-0 xl:border-l xl:border-t-0">
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
                          className={`rounded-md p-1.5 ${input.muted ? "bg-red-500/10 text-red-300" : "bg-white/[0.06] text-amber-200 hover:bg-white/[0.1]"}`}
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
                <option value="pip">Cuadro en cuadro</option>
              </select>
              <p className="mt-1 text-[10px] leading-relaxed text-neutral-600">Define cómo se componen las fuentes de la escena seleccionada.</p>
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-medium text-neutral-400">Gráfico de Preview</label>
              <select
                aria-label="Gráfico de la escena Preview"
                value={previewScene?.graphicId ?? ""}
                onChange={(event) => assignGraphic(event.target.value)}
                className="h-9 w-full rounded-lg border border-white/10 bg-[#101114] px-3 text-xs text-neutral-200 outline-none"
              >
                <option value="">Sin gráfico</option>
                {graphics.map((graphic) => <option key={graphic.id} value={graphic.id}>{graphic.name}</option>)}
              </select>
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
                <Wifi size={14} className={live ? "text-red-300" : "text-neutral-500"} />
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
        </aside>
      </div>

      {editingGraphic && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Editor de plantilla gráfica">
          <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-[#11161e] p-5 shadow-2xl">
            <div className="mb-4 flex items-center gap-2">
              <Layers3 size={18} className="text-red-300" />
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
              <label className="flex items-center gap-2 text-xs text-neutral-400">Color de acento
                <input type="color" value={editingGraphic.accent} onChange={(event) => setEditingGraphic({ ...editingGraphic, accent: event.target.value })} className="h-8 w-10 cursor-pointer rounded border border-white/10 bg-transparent" />
                <span className="font-mono text-neutral-500">{editingGraphic.accent}</span>
              </label>
              <div className="rounded-xl border border-white/[0.08] bg-black/20 p-3">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Vista previa · 16:9</p>
                <div className="relative flex aspect-video items-end overflow-hidden rounded-lg bg-gradient-to-br from-[#252b35] via-[#11151c] to-black p-5">
                  {editingGraphic.kind === "scoreboard" ? (
                    <div className="absolute right-4 top-4 max-w-[80%] rounded-lg border border-white/10 bg-black/80 px-4 py-3 text-center">
                      <strong className="block truncate text-sm text-white">{editingGraphic.title || "Marcador"}</strong>
                      <span className="mt-1 block truncate text-xs text-neutral-400">{editingGraphic.subtitle || "Información"}</span>
                      <span className="absolute inset-x-0 top-0 h-1 rounded-t-lg" style={{ backgroundColor: editingGraphic.accent }} />
                    </div>
                  ) : editingGraphic.kind === "ticker" ? (
                    <div className="absolute inset-x-0 bottom-4 border-t-2 bg-black/85 px-5 py-3" style={{ borderColor: editingGraphic.accent }}>
                      <strong className="text-sm text-white">{editingGraphic.title || "Titular"}</strong>
                      <span className="ml-4 text-xs text-neutral-300">{editingGraphic.subtitle || "Información"}</span>
                    </div>
                  ) : (
                    <div className="flex max-w-[85%] items-stretch overflow-hidden rounded-lg border border-white/10 bg-black/85">
                      <span className="w-1.5" style={{ backgroundColor: editingGraphic.accent }} />
                      <span className="px-4 py-3">
                        <strong className="block truncate text-sm text-white">{editingGraphic.title || "Titular"}</strong>
                        <span className="mt-1 block truncate text-xs text-neutral-300">{editingGraphic.subtitle || "Subtítulo"}</span>
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <p className="text-[11px] leading-relaxed text-neutral-500">Edita el texto y color, aplícalo a Preview o exporta un HTML transparente.</p>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setEditingGraphic(null)} className="rounded-lg border border-white/10 px-4 py-2.5 text-xs text-neutral-300 hover:bg-white/[0.05]">Cancelar</button>
                <button type="button" onClick={() => saveGraphic(editingGraphic)} className="rounded-lg bg-red-500 px-4 py-2.5 text-xs font-semibold text-white hover:bg-red-400">Guardar gráfico</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {whipOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Configurar destino de emisión">
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#111215] p-4 shadow-2xl">
            <div className="mb-4 flex items-center gap-2">
              <RadioTower size={15} className="text-red-300" />
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
              <button type="button" onClick={() => setWhipOpen(false)} className="rounded-md bg-red-500 px-3 py-2 text-[10px] font-semibold text-white hover:bg-red-400">Guardar destino</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
