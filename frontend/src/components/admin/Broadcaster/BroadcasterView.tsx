"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import NextImage from "next/image";
import {
  Circle, Crop, Clapperboard, Copy, Download, FileVideo2, Gamepad2, ImagePlus, Layers3,
  Mic, MonitorUp, Pause, Pencil, Play, Plus, Radio, RadioTower, RectangleHorizontal,
  ScreenShare, Settings2, Shield, Square, Trash2, Video, Volume2, VolumeX, Wifi, X,
} from "lucide-react";
import { toast } from "sonner";
import { exportGraphicHtml, type BroadcastGraphic, type BroadcastMode, type FootballScoreboard, type GraphicKind } from "./graphicExport";
import type { Peer } from "peerjs";
import { CropEditor } from "./CropEditor";
import { SourceMirror } from "./SourceMirror";
import { MediaPosition } from "./MediaPosition";
import { SessionClock } from "./SessionClock";
import { ProgramMixer, type MixerSource } from "./audioMixer";
import { startFrameClock } from "./frameClock";
import { createRoomCode, guestUrl, hostPeerId, peerOptions } from "./guestLink";
import { FootballConsole } from "./football/FootballConsole";
import { EXIT_MS } from "./football/motion";
import { FootballDeck } from "./football/FootballDeck";
import { AudioBar } from "./football/AudioBar";
import { FootballMedia } from "./football/FootballMedia";
import { playSfx } from "./football/sfx";
import { deleteMedia, listMedia, saveMedia, type MediaCategory, type MediaItem } from "./football/mediaLibrary";
import { getCompetition } from "./football/competitions";
import { footballDesignDocument } from "./football/designs";
import {
  drawScene, drawTransition, footballDesignFor, footballPosition, isFootballDesign, setLiveFootballMatch,
  type BroadcastInput, type BroadcastScene, type InputKind, type SceneLayout, type TransitionMode,
} from "./compositor";
import { useFootballMatch } from "./football/useFootballMatch";
import { KickoffCountdown, MatchClock } from "./football/MatchClock";
import type { DesignStyle, GraphicVariant } from "./graphicExport";


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

export default function BroadcasterView({ active = true }: { active?: boolean }) {
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
  const recordingRef = useRef(recording);
  recordingRef.current = recording;
  // Broadcast/recording session time, derived by <SessionClock>; nothing ticks in this component.
  const [session, setSession] = useState<{ startedAt: number | null; stoppedAt: number | null }>({ startedAt: null, stoppedAt: null });
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
  const [topbarHost, setTopbarHost] = useState<HTMLElement | null>(null);
  const fm = useFootballMatch();
  const [draggingPreviewGraphicId, setDraggingPreviewGraphicId] = useState<string | null>(null);
  const [selectedGraphicId, setSelectedGraphicId] = useState<string | null>(null);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; title: string; items: Array<{ label: string; hint?: string; danger?: boolean; run: () => void }> } | null>(null);

  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const programCanvasRef = useRef<HTMLCanvasElement>(null);
  const inputVideoRefs = useRef(new Map<string, HTMLVideoElement>());
  const [mediaLibrary, setMediaLibrary] = useState<MediaItem[]>([]);
  const [promoItemId, setPromoItemId] = useState<string | null>(null);
  // What Program showed before a promo took over, so "Quitar" can put it back.
  const promoRestoreRef = useRef<{ inputIds: string[]; layout?: SceneLayout } | null>(null);
  useEffect(() => {
    listMedia().then(setMediaLibrary).catch(() => toast.error("No se pudo leer la biblioteca de medios"));
  }, []);
  const inputImageRefs = useRef(new Map<string, HTMLImageElement>());
  const inputsRef = useRef(inputs);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const outputStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mixerRef = useRef<ProgramMixer | null>(null);
  const [masterVolume, setMasterVolume] = useState(1);
  const masterVolumeRef = useRef(1);
  masterVolumeRef.current = masterVolume;
  const programFadeAlphaRef = useRef(1);
  const isTransitioningRef = useRef(false);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const whipResourceRef = useRef<string | null>(null);
  const whipAuthRef = useRef("");
  // Values the destination dialog had when it opened, restored by "Cancelar".
  const whipDraftRef = useRef({ url: "", token: "" });
  const gamepadButtonsRef = useRef<boolean[]>([]);
  // Transitions run between what is really on air and the prepared target, never the editable scenes.
  const transitionStateRef = useRef<{
    from: BroadcastScene;
    fromGraphics: BroadcastGraphic[];
    to: BroadcastScene;
    toGraphics: BroadcastGraphic[];
    progress: number;
    startedAt: number;
    duration: number;
    onComplete: () => void;
  } | null>(null);
  const fadeStateRef = useRef<{ from: number; to: number; startedAt: number; duration: number } | null>(null);
  const templatePreviewRef = useRef<HTMLDivElement>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const previewDragRef = useRef({ graphicId: "", offsetX: 0, offsetY: 0 });
  const didLoadStorageRef = useRef(false);
  const storageErrorShownRef = useRef(false);
  inputsRef.current = inputs;
  const previewSceneIdRef = useRef(previewSceneId);
  previewSceneIdRef.current = previewSceneId;

  // While hidden behind another admin view the studio stays mounted (on air), but its keys and gamepad stay quiet.
  const activeRef = useRef(active);
  activeRef.current = active;

  // The top bar only renders its slot while this view is visible, so look it up again each time it shows.
  useEffect(() => {
    setTopbarHost(active ? document.querySelector<HTMLElement>("[data-broadcaster-topbar-slot]") : null);
  }, [active]);

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
        const normalizedGraphics: BroadcastGraphic[] = storedGraphics.map((graphic) => {
          const mode = graphic.mode ?? (graphic.football || graphic.kind === "scoreboard" ? "football" : "normal");
          // Football widgets always draw the live match; drop the stale copy older versions stored.
          return mode === "football" ? { ...graphic, mode, football: undefined } : { ...graphic, mode };
        });
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
      // Football widgets render the live match, so their (large: crests, squads) match copy is not stored.
      window.localStorage.setItem(STORAGE_GRAPHICS, JSON.stringify(graphics.map((graphic) => (graphic.mode === "football" ? { ...graphic, football: undefined } : graphic))));
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
      const peer = new Peer(hostPeerId(room), peerOptions());
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
          // One "waiting" placeholder at most, however many guests leave.
          const waiting = inputsRef.current.some((item) => item.id === guestWaitingInput.id);
          swapGuestInput(id, waiting ? null : guestWaitingInput);
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
    // A take replaces whatever is on air, promos included.
    promoRestoreRef.current = null;
    setPromoItemId(null);
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

    // Progress is driven by the frame clock (see the render effect), so it also completes in a background tab.
    activeTransitionModeRef.current = mode;
    isTransitioningRef.current = true;
    const targetSceneId = previewSceneId;
    const target = { ...targetScene, inputIds: [...targetScene.inputIds], graphicIds: targetScene.graphicIds ? [...targetScene.graphicIds] : undefined };
    transitionStateRef.current = {
      from: programSceneSnapshot,
      fromGraphics: programGraphicsSnapshot,
      to: target,
      toGraphics: targetGraphics,
      progress: 0,
      startedAt: performance.now(),
      duration: transitionMs,
      onComplete: () => {
        setProgramSceneSnapshot(target);
        setProgramGraphicsSnapshot(targetGraphics);
        setProgramSceneId(targetSceneId);
      },
    };
  }, [ftb, getSceneGraphics, previewSceneId, programGraphicsSnapshot, programSceneId, programSceneSnapshot, scenes, transitionMode, transitionMs]);

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
    isTransitioningRef.current = true;
    setFtb(goBlack);
    fadeStateRef.current = { from: programFadeAlphaRef.current, to: goBlack ? 0 : 1, startedAt: performance.now(), duration: transitionMs };
  }, [ftb, transitionMs]);

  const mixerSources = (list: BroadcastInput[]): MixerSource[] => list.map((input) => ({
    id: input.id,
    stream: input.stream,
    element: input.kind === "video" ? inputVideoRefs.current.get(input.id) : undefined,
    volume: input.volume,
    pan: input.pan,
    muted: input.muted,
  }));

  const createOutputStream = useCallback(async () => {
    if (outputStreamRef.current) return outputStreamRef.current;
    const canvas = programCanvasRef.current;
    if (!canvas) throw new Error("La salida de programa no está disponible");
    const audioContext = audioContextRef.current ?? new AudioContext();
    audioContextRef.current = audioContext;
    await audioContext.resume();
    // The mixer outlives each output: going live again reuses the same routes and media element wiring.
    const mixer = mixerRef.current ?? new ProgramMixer(audioContext, masterVolumeRef.current);
    mixerRef.current = mixer;
    mixer.sync(mixerSources(inputsRef.current), new Set(programSceneSnapshot.inputIds));
    const stream = canvas.captureStream(30);
    const track = mixer.createTrack();
    if (track) stream.addTrack(track);
    outputStreamRef.current = stream;
    return stream;
  }, [programSceneSnapshot]);

  const releaseOutputStream = useCallback(async () => {
    outputStreamRef.current?.getTracks().forEach((track) => track.stop());
    outputStreamRef.current = null;
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
      openWhipDialog();
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
      whipAuthRef.current = whipToken.trim();
      // Without this the studio would keep showing EN VIVO after the gateway or the network dropped.
      const connection = peer;
      connection.addEventListener("connectionstatechange", () => {
        if (peerConnectionRef.current !== connection) return;
        if (connection.connectionState === "disconnected") {
          toast.warning("Conexión de emisión inestable", { description: "Reintentando… si no se recupera, la emisión se detendrá." });
        } else if (connection.connectionState === "failed") {
          toast.error("Se perdió la emisión", { description: "El servidor WHIP dejó de recibir la señal. Vuelve a pulsar Emitir." });
          void stopLiveRef.current(true);
        }
      });
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

  const openWhipDialog = () => {
    whipDraftRef.current = { url: whipUrl, token: whipToken };
    setWhipOpen(true);
  };

  const stopLive = async (lost = false) => {
    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;
    const resource = whipResourceRef.current;
    const token = whipAuthRef.current;
    whipResourceRef.current = null;
    setLive(false);
    if (resource) {
      try {
        // WHIP servers that require a token for the offer also require it to tear the session down.
        const response = await fetch(resource, { method: "DELETE", headers: token ? { Authorization: `Bearer ${token}` } : undefined });
        if (!response.ok && response.status !== 404) throw new Error(`HTTP ${response.status}`);
      } catch (error) {
        toast.error("No se pudo cerrar el recurso WHIP", {
          description: error instanceof Error ? error.message : "Error al cerrar la emisión",
        });
      }
    }
    if (!recordingRef.current) await releaseOutputStream();
    if (!lost) toast.success("Emisión detenida");
  };
  const stopLiveRef = useRef(stopLive);
  stopLiveRef.current = stopLive;

  // Closing or reloading the tab would cut the broadcast and lose the recording: ask first.
  useEffect(() => {
    if (!live && !recording) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [live, recording]);

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
  // Effects go into the program mix (heard on air and in recordings) once the mixer exists.
  const sfxBus = () => (mixerRef.current ? { context: mixerRef.current.context, node: mixerRef.current.master } : undefined);

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
      position: FOOTBALL_POSITIONS[variant] ?? { x: 5, y: 5 },
    };
    setProgramGraphicsSnapshot((current) => [...current, graphic]);
  };
  const toggleAirRef = useRef(toggleAir);
  toggleAirRef.current = toggleAir;

  useEffect(() => {
    const keys: Record<string, GraphicVariant> = { F1: "elite", F2: "prematch", F3: "lineup-home", F4: "lineup-away", F5: "stats" };
    const onKey = (event: KeyboardEvent) => {
      if (!activeRef.current || activePane !== "football" || !keys[event.key] || event.repeat) return;
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
    if (sfxOn) playSfx(highlight.kind === "void" ? "var" : highlight.kind, sfxVolumeRef.current, sfxBus());
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
    setLiveFootballMatch({ ...fm.match, scorers: { home: scorersOf("home"), away: scorersOf("away") } }, fm.clockNow);
  }, [fm.match, fm.events, fm.clockNow]);
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

  // What the frame clock draws; refreshed on every render so the clock itself never restarts.
  const frameRef = useRef({ inputs, previewScene, programScene, previewGraphics, programGraphics, drawProgram: true, drawPreview: true });
  frameRef.current = {
    inputs, previewScene, programScene, previewGraphics, programGraphics,
    // Off screen and off air there is nothing to draw; on air Program keeps rendering even while hidden.
    drawProgram: active || live || recording,
    drawPreview: active,
  };

  useEffect(() => {
    let tick = 0;
    return startFrameClock(33, (now) => {
      tick += 1;
      const frame = frameRef.current;
      const transition = transitionStateRef.current;
      if (transition) {
        transition.progress = Math.min(1, (now - transition.startedAt) / transition.duration);
        if (transition.progress >= 1) {
          transitionStateRef.current = null;
          isTransitioningRef.current = false;
          // Draw the target right away: the snapshot state only lands on the next render.
          frame.programScene = transition.to;
          frame.programGraphics = transition.toGraphics;
          transition.onComplete();
        }
      }
      const fade = fadeStateRef.current;
      if (fade) {
        const progress = Math.min(1, (now - fade.startedAt) / fade.duration);
        programFadeAlphaRef.current = fade.from + (fade.to - fade.from) * progress;
        if (progress >= 1) {
          fadeStateRef.current = null;
          isTransitioningRef.current = false;
        }
      }
      const program = programCanvasRef.current;
      if (program && frame.drawProgram) {
        const active = transitionStateRef.current;
        if (active) {
          drawTransition(program, active.from, active.to, frame.inputs, inputVideoRefs.current, inputImageRefs.current, active.fromGraphics, active.toGraphics, activeTransitionModeRef.current, active.progress);
        } else {
          drawScene(program, frame.programScene, frame.inputs, inputVideoRefs.current, inputImageRefs.current, frame.programGraphics, programFadeAlphaRef.current, "program");
        }
      }
      const preview = previewCanvasRef.current;
      if (preview && frame.drawPreview && !document.hidden && tick % 2 === 0) {
        drawScene(preview, frame.previewScene, frame.inputs, inputVideoRefs.current, inputImageRefs.current, frame.previewGraphics, 1, "preview");
      }
    });
  }, []);

  // Reconciles the program mix with the current sources: new guests and microphones are heard on air at once.
  useEffect(() => {
    mixerRef.current?.sync(mixerSources(inputs), new Set(programScene?.inputIds ?? []));
  }, [inputs, programScene]);

  useEffect(() => {
    const saved = Number(window.localStorage.getItem("nexus-master-volume"));
    if (saved > 0 && saved <= 1.5) setMasterVolume(saved);
  }, []);

  useEffect(() => {
    mixerRef.current?.setMasterVolume(masterVolume);
    try { window.localStorage.setItem("nexus-master-volume", String(masterVolume)); } catch { /* sin almacenamiento */ }
  }, [masterVolume]);

  // A session starts when the first of recording/broadcast starts and ends when both have stopped.
  const onAir = live || recording;
  useEffect(() => {
    setSession((current) => {
      const running = current.startedAt !== null && current.stoppedAt === null;
      if (onAir) return running ? current : { startedAt: Date.now(), stoppedAt: null };
      return running ? { ...current, stoppedAt: Date.now() } : current;
    });
  }, [onAir]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return;
      // A held key must not fire a take or a recording toggle over and over.
      if (!activeRef.current || event.repeat) return;
      if (event.code === "Space") {
        event.preventDefault();
        takeScene();
      } else if (event.key === "Enter") {
        event.preventDefault();
        takeScene(transitionMode === "cut" ? "fade" : transitionMode);
      } else if (event.shiftKey && event.code === "KeyF") {
        // Shift+F: a fade to black blanks the output, so it never fires from a single key (F also focuses a dorsal field).
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
      const buttons = activeRef.current ? gamepad?.buttons.map((button) => button.pressed) ?? [] : [];
      if (buttons[0] && !gamepadButtonsRef.current[0]) takeScene();
      if (buttons[1] && !gamepadButtonsRef.current[1]) {
        if (recording) stopRecording();
        else void startRecording();
      }
      // The D-pad cycles only through the scenes of the current mode.
      const cycle = (step: number) => {
        const list = scenes.filter((scene) => (scene.mode ?? "normal") === studioMode);
        const index = list.findIndex((scene) => scene.id === previewSceneId);
        const next = list[(index + step + list.length) % list.length];
        if (next) setPreviewSceneId(next.id);
      };
      if (buttons[12] && !gamepadButtonsRef.current[12]) cycle(-1);
      if (buttons[13] && !gamepadButtonsRef.current[13]) cycle(1);
      gamepadButtonsRef.current = buttons;
      frame = requestAnimationFrame(poll);
    };
    frame = requestAnimationFrame(poll);
    return () => {
      window.removeEventListener("gamepadconnected", onConnected);
      window.removeEventListener("gamepaddisconnected", onDisconnected);
      cancelAnimationFrame(frame);
    };
  }, [previewSceneId, recording, scenes, startRecording, stopRecording, studioMode, takeScene]);

  useEffect(() => () => {
    mediaRecorderRef.current?.stop();
    peerConnectionRef.current?.close();
    inputsRef.current.forEach((input) => {
      input.stream?.getTracks().forEach((track) => track.stop());
      if (input.url) URL.revokeObjectURL(input.url);
    });
    outputStreamRef.current?.getTracks().forEach((track) => track.stop());
    mixerRef.current?.dispose();
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
    if (promoItemId === id) stopPromo();
  };

  // A promo replaces the sources of what is on air (Program), keeping its graphics; the saved scene is untouched.
  const airPromo = (item: MediaItem) => {
    const inputId = ensureLibraryInput(item);
    if (!promoRestoreRef.current) promoRestoreRef.current = { inputIds: programSceneSnapshot.inputIds, layout: programSceneSnapshot.layout };
    const element = inputVideoRefs.current.get(inputId);
    if (element) { element.currentTime = 0; void element.play().catch(() => undefined); }
    setProgramSceneSnapshot((current) => ({ ...current, inputIds: [inputId], layout: "single" }));
    setPromoItemId(item.id);
    toast.success(`Al aire: ${item.name}`);
  };

  const stopPromo = () => {
    const restore = promoRestoreRef.current;
    if (restore) setProgramSceneSnapshot((current) => ({ ...current, inputIds: restore.inputIds, layout: restore.layout }));
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
  const getGraphicPosition = (graphic: BroadcastGraphic) => isFootballDesign(graphic)
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
    const design = isFootballDesign(graphic) ? footballDesignFor(graphic) : null;
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
    if (isFootballDesign(graphic)) {
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
    const design = isFootballDesign(graphic) ? footballDesignFor(graphic) : null;
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
        { label: "Retirar todo del aire", hint: studioMode === "football" ? "Esc" : undefined, danger: true, run: retireAllProgram },
        ...(studioMode === "football" ? [
          { label: "Marcador al aire / retirar", hint: "F1", run: () => toggleAir("elite") },
          { label: "Anular último gol", hint: "Z", run: fm.undoGoal },
          { label: "Iniciar / pausar reloj", hint: "P", run: fm.toggleClock },
        ] : []),
        { label: ftb ? "Volver de negro" : "Fundido a negro", hint: "Mayús+F", run: toggleFadeToBlack },
        { label: "Pantalla completa", run: () => void document.documentElement.requestFullscreen?.() },
      ],
    });
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target;
      if (!activeRef.current) return;
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
    <div data-broadcaster-root onContextMenu={openGeneralMenu} onClick={() => ctxMenu && setCtxMenu(null)} className="flex h-full min-h-0 flex-col overflow-hidden bg-[#05070a] text-neutral-100">
      {/* Source pool: one decoder per source that never unmounts when tabs or modes change.
          It stays inside the viewport (1px, transparent) so the browser keeps decoding it. */}
      <div aria-hidden className="pointer-events-none fixed left-0 top-0 h-px w-px overflow-hidden opacity-0">
        {inputs.filter((input) => input.kind === "camera" || input.kind === "screen" || input.kind === "video").map((input) => (
          <video
            key={input.id}
            ref={(element) => {
              if (!element) { inputVideoRefs.current.delete(input.id); return; }
              inputVideoRefs.current.set(input.id, element);
              if (input.stream && element.srcObject !== input.stream) element.srcObject = input.stream;
            }}
            src={input.kind === "video" ? input.url : undefined}
            autoPlay={input.kind !== "video" || input.playing !== false}
            loop={input.kind === "video" && Boolean(input.loop)}
            muted
            playsInline
            onEnded={() => setInputs((current) => current.map((item) => item.id === input.id ? { ...item, playing: false } : item))}
          />
        ))}
      </div>
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
            <button type="button" onClick={() => openWhipDialog()} className="hidden rounded-md px-2 py-1.5 text-[10px] font-semibold text-neutral-500 hover:bg-white/[0.06] hover:text-white xl:inline-flex">Ajustes</button>
          </div>
          <span className="h-5 w-px bg-white/[0.1]" />
          {studioMode === "football" && (
            <>
              <span className="inline-flex items-center gap-2 rounded-lg border border-white/[0.1] bg-black/40 px-2.5 py-1 tabular-nums">
                <span className="max-w-[70px] truncate text-[11px] font-bold text-white">{fm.match.homeTeam}</span>
                <span className="text-sm font-black text-yellow-300">{fm.match.homeScore} : {fm.match.awayScore}</span>
                <span className="max-w-[70px] truncate text-[11px] font-bold text-white">{fm.match.awayTeam}</span>
                <span className="border-l border-white/10 pl-2 text-[11px] text-emerald-300">{fm.match.period} <MatchClock fm={fm} /></span>
              </span>
              <button type="button" onClick={() => void (guestRoom ? copyGuestLink() : openGuestRoom())} className="hidden rounded-md border border-emerald-400/30 px-2 py-1.5 text-[10px] font-semibold text-emerald-200 hover:bg-emerald-400/10 xl:inline-flex">{guestRoom ? "Copiar enlace invitado" : "Invitar"}</button>
              <span className="h-5 w-px bg-white/[0.1]" />
            </>
          )}
          {controllerName && <span className="hidden items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/[0.07] px-2.5 py-1.5 text-[10px] text-emerald-300 lg:inline-flex"><Gamepad2 size={13} /> Gamepad</span>}
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-black/20 px-2.5 py-1.5 text-xs tabular-nums text-neutral-300 sm:px-3 sm:py-2">
            {recording || live ? <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-yellow-300" /> : <Circle size={9} />}
            <SessionClock session={session} />
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
                  <p className="truncate text-[10px] text-emerald-100/50">{fm.match.homeTeam} vs {fm.match.awayTeam}</p>
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
                      <SourceMirror getElement={() => inputVideoRefs.current.get(input.id)} className="mt-2 aspect-video w-full rounded-lg bg-black" />
                    )}
                    {input.kind === "video" && (
                      <div className="mt-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <button type="button" onClick={() => toggleMediaPlayback(input)} className="inline-flex items-center gap-1.5 rounded-md bg-white/[0.07] px-2 py-1.5 text-[11px] text-neutral-200 hover:bg-white/[0.12]">
                            {input.playing === false ? <Play size={12} /> : <Pause size={12} />}
                            {input.playing === false ? "Reproducir" : "Pausar"}
                          </button>
                          <button type="button" onClick={() => updateInput(input.id, { loop: !input.loop })} className={`rounded-md px-2 py-1.5 text-[11px] ${input.loop ? "bg-sky-400/15 text-sky-200" : "bg-white/[0.04] text-neutral-500 hover:text-neutral-200"}`}>
                            Bucle {input.loop ? "ON" : "OFF"}
                          </button>
                          <MediaPosition name={input.name} getElement={() => inputVideoRefs.current.get(input.id)} />
                        </div>
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
          <div className={`grid grid-cols-1 gap-3 lg:grid-cols-2 ${activePane === "football" ? "flex-none p-2" : "min-h-0 flex-1 p-3"}`}>
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
                <button type="button" onClick={toggleFadeToBlack} title="Fundido a negro (Mayús+F)" className={`ml-auto rounded-lg border px-3 py-2 text-[11px] font-bold ${ftb ? "border-yellow-400 bg-yellow-300 text-black" : "border-white/10 text-neutral-300 hover:bg-white/[0.06]"}`}>FTB</button>
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
                <span className="ml-auto text-xs tabular-nums text-neutral-400"><SessionClock session={session} /></span>
              </div>
            </section>
          </div>

          {activePane === "football" && (
            <FootballDeck
              enabled={active}
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
              <button type="button" onClick={() => openWhipDialog()} className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-lg border border-white/[0.08] px-3 py-2 text-[11px] text-neutral-300 hover:bg-white/[0.06] hover:text-white">
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
                {controllerName || "Teclado: 1–9 escena · Espacio TAKE · R grabar · Mayús+F negro"}
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
            <span className="mt-0.5 text-[10px] tabular-nums text-neutral-400"><KickoffCountdown kickoff={fm.match.kickoff} period={fm.match.period} fallback={<>Emisión <SessionClock session={session} /></>} /></span>
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
            <button type="button" onClick={() => playSfx("whistle", sfxVolume, sfxBus())} title="Pitazo" className="rounded-md border border-white/[0.08] px-2 py-1.5 text-[10px] font-semibold text-neutral-300 hover:text-white">Pitazo</button>
            <button type="button" onClick={() => playSfx("goal", sfxVolume, sfxBus())} title="Probar sonido de gol" className="rounded-md border border-white/[0.08] px-2 py-1.5 text-[10px] font-semibold text-neutral-300 hover:text-white">Gol</button>
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
              <button type="button" onClick={() => { setWhipUrl(whipDraftRef.current.url); setWhipToken(whipDraftRef.current.token); setWhipOpen(false); }} aria-label="Cerrar configuración de emisión" className="rounded p-1 text-neutral-500 hover:bg-white/[0.08] hover:text-white"><X size={15} /></button>
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
              <button type="button" onClick={() => { setWhipUrl(whipDraftRef.current.url); setWhipToken(whipDraftRef.current.token); setWhipOpen(false); }} className="rounded-md border border-white/10 px-3 py-2 text-[10px] text-neutral-400 hover:bg-white/[0.05]">Cancelar</button>
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
