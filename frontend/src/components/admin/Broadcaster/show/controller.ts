// The AI program lives here, outside React: switching panels or tabs never stops the
// show. The control room (ShowPanel) subscribes to this store; the broadcaster
// registers its host functions (put the studio on Program, the audio bus, effects).
//
// Narration is optional by design: if the local narrator is reachable the director
// uses the voice; if not, it runs with captions. Nothing in the visual engine depends
// on a provider.

import { useSyncExternalStore } from "react";
import { LocalNarrator, loadNarratorSettings, NarrationQueue, type NarrationLine, type NarrationProvider, type ProviderStatus, type VoiceChoice } from "../engine/narration";
import { generateNexusLoop, music } from "../football/music";
import { Director, type DirectorState } from "./director";
import { buildEdition, reestimate, type EditionOptions } from "./editorial";
import { gatherShowData, type GatherReport } from "./data";
import { ShowRenderer, type RendererStats } from "./renderer";
import { DEFAULT_LIGHTING, LIGHT_PRESETS, type Lighting } from "./studio3d";
import type { DirectorMode, Edition, Quality, Segment, StageId } from "./types";

export interface ShowHost {
  air(canvas: HTMLCanvasElement): void;
  leave(): void;
  audioBus(): Promise<{ context: AudioContext; node: AudioNode } | null>;
  attachMusic(): void;
  sfx(kind: "goal" | "whistle" | "var"): void;
  liveSide(): { home: string; away: string; score: string; minute: string }[];
}

export interface ShowState {
  options: EditionOptions & { quality: Quality };
  edition: Edition | null;
  originals: Record<string, Segment["beats"]>; // untouched beats per segment (duration edits trim from here)
  report: GatherReport[];
  building: string | null;
  director: DirectorState | null;
  onAir: boolean;
  renderer: RendererStats | null;
  narrator: ProviderStatus | null;
  voice: VoiceChoice;
  music: { on: boolean; volume: number };
  lighting: Lighting;
  error: string | null;
}

const SAVE_KEY = "nexus-ai-show";
const LIB_KEY = "nexus-ai-show-library";
const LIGHT_KEY = "nexus-ai-show-light";
const initialLighting = (): Lighting => {
  if (typeof window === "undefined") return DEFAULT_LIGHTING;
  try { return { ...DEFAULT_LIGHTING, ...JSON.parse(window.localStorage.getItem(LIGHT_KEY) ?? "{}") }; } catch { return DEFAULT_LIGHTING; }
};
const PROVISIONAL_VOICE: VoiceChoice = { provider: "kokoro", voice: "em_alex" }; // provisional until the owner picks one

let host: ShowHost | null = null;
let renderer: ShowRenderer | null = null;
let director: Director | null = null;
let queue: NarrationQueue | null = null;
let provider: NarrationProvider | null = null;
let statsTimer = 0;
const listeners = new Set<() => void>();

const initialVoice = (): VoiceChoice => {
  if (typeof window === "undefined") return PROVISIONAL_VOICE;
  const s = loadNarratorSettings();
  return window.localStorage.getItem("nexus-narrator") ? s.voice : PROVISIONAL_VOICE;
};

let state: ShowState = {
  options: { modes: ["yesterday", "today"], leagues: [], targetMin: 30, quality: "MEDIUM" },
  edition: null, originals: {}, report: [], building: null, director: null, onAir: false, renderer: null, narrator: null,
  voice: initialVoice(), music: { on: true, volume: 0.3 }, lighting: initialLighting(), error: null,
};

function set(patch: Partial<ShowState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
  persist();
}
function persist() {
  if (typeof window === "undefined" || !state.edition) return;
  try { window.localStorage.setItem(SAVE_KEY, JSON.stringify({ edition: state.edition, originals: state.originals, options: state.options, segment: state.director?.segment ?? 0, mode: state.director?.mode ?? "AUTO" })); } catch { /* full */ }
}

export const showStore = {
  subscribe(l: () => void) { listeners.add(l); return () => listeners.delete(l); },
  get: () => state,
};
export function useShow(): ShowState { return useSyncExternalStore(showStore.subscribe, showStore.get, showStore.get); }

export function setShowHost(h: ShowHost | null) { host = h; }

// ---------------------------------------------------------------- renderer + director
function ensureRenderer(): ShowRenderer {
  if (renderer && renderer.quality === state.options.quality) return renderer;
  renderer?.dispose();
  renderer = new ShowRenderer(state.options.quality, state.lighting);
  renderer.start();
  window.clearInterval(statsTimer);
  statsTimer = window.setInterval(() => { if (renderer) set({ renderer: renderer.stats() }); }, 2000);
  if (state.onAir) host?.air(renderer.output);
  return renderer;
}
export function previewCanvas(): HTMLCanvasElement { return ensureRenderer().output; }

async function ensureNarration(): Promise<boolean> {
  provider ??= new LocalNarrator(loadNarratorSettings().url);
  const st = await provider.status();
  set({ narrator: st });
  const ok = Boolean(st.reachable && st.providers?.[state.voice.provider]?.ready);
  if (!ok) return false;
  if (!queue) {
    const bus = await host?.audioBus();
    if (!bus) return false;
    queue = new NarrationQueue(provider, bus.context, bus.node, state.voice);
  }
  queue.setVoice(state.voice);
  return true;
}

function narrateLine(line: NarrationLine): Promise<void> {
  if (!queue) return Promise.reject(new Error("Narrador no disponible"));
  return queue.speak(line);
}

function duck(on: boolean) { if (music.playing) music.setVolume(on ? state.music.volume * 0.3 : state.music.volume); }

function ensureDirector(edition: Edition): Director {
  const r = ensureRenderer();
  if (director) { director.setEdition(edition); return director; }
  director = new Director(edition, {
    renderer: r,
    narrate: (line) => narrateLine(line),
    prepare: (line) => { void queue?.prepare(line).catch(() => undefined); },
    stopNarration: () => queue?.interrupt(),
    pauseAudio: (p) => { if (p) { queue?.pause(); music.pause(); } else { queue?.resume(); if (state.music.on && music.loaded) void music.play(); } },
    duck,
    sfx: (k) => host?.sfx(k),
    sideInfo: () => ({ live: host?.liveSide() ?? [] }),
    onState: (s) => set({ director: s }),
    onSegmentDone: (i, actual) => {
      const e = state.edition;
      if (!e) return;
      set({ edition: { ...e, segments: e.segments.map((s, j) => (j === i ? { ...s, status: "done", actualS: actual } : j === i + 1 && s.status === "pending" ? { ...s, status: "on-air" } : s)) } });
    },
  });
  return director;
}

// ---------------------------------------------------------------- actions
export const show = {
  setOptions(p: Partial<ShowState["options"]>) {
    set({ options: { ...state.options, ...p } });
    if (p.quality && renderer) { director?.stop(); director = null; ensureRenderer(); }
  },
  setVoice(v: VoiceChoice) { set({ voice: v }); queue?.setVoice(v); },

  // ---- set & lighting (live, saved on this PC)
  setLighting(p: Partial<Lighting>) {
    const lighting = { ...state.lighting, ...p };
    set({ lighting });
    renderer?.setLighting(p);
    try { window.localStorage.setItem(LIGHT_KEY, JSON.stringify(lighting)); } catch { /* full */ }
  },
  lightPreset(name: string) {
    const p = LIGHT_PRESETS[name];
    if (p) show.setLighting({ ...p, preset: name });
  },
  /** Moves the studio to a configuration (operator preview of the set, outside the rundown). */
  previewStage(stage: StageId) { ensureRenderer().setStage(stage); },

  async build() {
    set({ building: "Reuniendo datos reales…", error: null });
    try {
      const { data, report } = await gatherShowData(state.options.modes, state.options.leagues, (m) => set({ building: m }));
      const edition = buildEdition(data, state.options);
      director?.stop();
      director = null;
      set({ edition, originals: Object.fromEntries(edition.segments.map((s) => [s.id, s.beats])), report, building: null, director: null });
      const r = ensureRenderer();
      r.setStage("OPENING", "WIDE");
      r.setScreen({ type: "title", kicker: "NEXUS SPORT", title: edition.title, subtitle: `${edition.segments.length} segmentos · ${Math.round(edition.estimatedS / 60)} min estimados` });
    } catch (err) {
      set({ building: null, error: err instanceof Error ? err.message : String(err) });
    }
  },

  /** One button: gathers the data if there is no edition yet, puts the studio on Program and plays. */
  async play(from?: number) {
    if (!state.edition) await show.build();
    const e = state.edition;
    if (!e) return;
    if (!state.onAir) show.air(true);
    const d = ensureDirector(e);
    const voice = await ensureNarration().catch(() => false);
    d.setVoice(voice);
    if (state.music.on) {
      try {
        if (!music.loaded) music.load(await generateNexusLoop(), "Música NEXUS (generada)");
        host?.attachMusic();
        music.setVolume(state.music.volume);
        await music.play();
      } catch { /* music optional */ }
    }
    d.play(from);
  },
  pause() { director?.pause(); },
  resume() { director?.resume(); },
  stop() { director?.stop(); music.pause(); },
  next() { director?.next(); },
  previous() { director?.previous(); },
  repeat() { director?.repeat(); },
  skip() { director?.skip(); },
  jump(i: number) { if (director) director.jump(i); else void show.play(i); },
  interrupt() { director?.interruptNarration(); },
  approve() { director?.approve(); },
  setMode(m: DirectorMode) { if (!state.edition) return; ensureDirector(state.edition).setMode(m); },

  air(on: boolean) {
    if (on) { const r = ensureRenderer(); host?.air(r.output); } else host?.leave();
    set({ onAir: on });
  },
  setMusic(p: Partial<ShowState["music"]>) {
    const m = { ...state.music, ...p };
    set({ music: m });
    music.setVolume(m.volume);
    if (p.on === false) music.pause();
    if (p.on === true && director?.state.status === "playing") void music.play();
  },

  // ---- editing (the director can change anything not locked)
  updateSegment(id: string, patch: Partial<Segment>) {
    const e = state.edition;
    if (!e) return;
    const segments = e.segments.map((s) => (s.id === id ? reestimate({ ...s, ...patch }) : s));
    set({ edition: { ...e, segments, estimatedS: segments.reduce((t, s) => t + s.estimatedS, 0) } });
    director?.setEdition(state.edition!);
  },
  moveSegment(id: string, dir: -1 | 1) {
    const e = state.edition;
    if (!e) return;
    const i = e.segments.findIndex((s) => s.id === id), j = i + dir;
    if (i < 0 || j < 0 || j >= e.segments.length) return;
    const segments = [...e.segments];
    [segments[i], segments[j]] = [segments[j], segments[i]];
    set({ edition: { ...e, segments } });
    director?.setEdition(state.edition!);
  },
  /** Duration edit: keep the beats that fit in `seconds` (from the original sequence, never invented). */
  setDuration(id: string, seconds: number) {
    const e = state.edition, orig = state.originals[id];
    if (!e || !orig) return;
    const seg = e.segments.find((s) => s.id === id);
    if (!seg || seg.locked) return;
    const beats: Segment["beats"] = [];
    let t = 0;
    for (const b of orig) {
      const bs = reestimate({ ...seg, beats: [b] }).estimatedS;
      if (beats.length && t + bs > seconds) break;
      beats.push(b); t += bs;
    }
    show.updateSegment(id, { beats, maxS: Math.max(seconds, seg.minS) });
  },
  editLine(segId: string, beatId: string, text: string) {
    const seg = state.edition?.segments.find((s) => s.id === segId);
    if (!seg || seg.locked) return;
    show.updateSegment(segId, { beats: seg.beats.map((b) => (b.id === beatId && b.narration ? { ...b, narration: { ...b.narration, text } } : b)) });
  },
  setStage(segId: string, stage: StageId) {
    const seg = state.edition?.segments.find((s) => s.id === segId);
    if (!seg || seg.locked) return;
    show.updateSegment(segId, { stage, beats: seg.beats.map((b, i) => (i === 0 ? { ...b, stage } : b)) });
  },

  // ---- save / recover
  save() {
    const e = state.edition;
    if (!e) return;
    try {
      const lib = JSON.parse(window.localStorage.getItem(LIB_KEY) ?? "[]") as { id: string; title: string; createdAt: number; edition: Edition; originals: ShowState["originals"] }[];
      const next = [{ id: e.id, title: e.title, createdAt: Date.now(), edition: e, originals: state.originals }, ...lib.filter((x) => x.id !== e.id)].slice(0, 10);
      window.localStorage.setItem(LIB_KEY, JSON.stringify(next));
    } catch { set({ error: "No se pudo guardar (almacenamiento lleno)" }); }
  },
  library(): { id: string; title: string; createdAt: number }[] {
    try { return (JSON.parse(window.localStorage.getItem(LIB_KEY) ?? "[]") as { id: string; title: string; createdAt: number }[]).map(({ id, title, createdAt }) => ({ id, title, createdAt })); } catch { return []; }
  },
  load(id: string) {
    try {
      const lib = JSON.parse(window.localStorage.getItem(LIB_KEY) ?? "[]") as { id: string; edition: Edition; originals: ShowState["originals"] }[];
      const it = lib.find((x) => x.id === id);
      if (!it) return;
      director?.stop(); director = null;
      set({ edition: it.edition, originals: it.originals, director: null });
    } catch { /* ignore */ }
  },
  /** After a reload: the last edition and where it was. */
  recoverable(): { title: string; segment: number } | null {
    try {
      const raw = JSON.parse(window.localStorage.getItem(SAVE_KEY) ?? "null");
      return raw?.edition ? { title: raw.edition.title, segment: raw.segment ?? 0 } : null;
    } catch { return null; }
  },
  recover() {
    try {
      const raw = JSON.parse(window.localStorage.getItem(SAVE_KEY) ?? "null");
      if (!raw?.edition) return;
      set({ edition: raw.edition, originals: raw.originals ?? {}, options: { ...state.options, ...raw.options } });
      const d = ensureDirector(raw.edition);
      d.setMode(raw.mode ?? "AUTO");
      set({ director: { ...d.state, segment: raw.segment ?? 0 } });
    } catch { /* ignore */ }
  },
  exportJson(): string { return JSON.stringify(state.edition, null, 2); },
  async refreshNarrator() { await ensureNarration().catch(() => false); },
};
