// Audiovisual director: runs an Edition beat by beat and keeps narration, set,
// camera, LED wall, lower thirds, music and effects in sync.
//
// - A beat applies its visuals first (stage → camera → screen → lower third), then
//   the narration plays; the next beat starts when the voice ends (+ hold). The LED
//   content advances with the words (progressive reveal lives in the beats).
// - With no voice available, the narration is shown as captions and timed by its
//   estimated reading length: the show never waits on TTS and never fakes a voice.
// - Music ducks while the narrator speaks; CRITICAL beats get an impact effect and a
//   slower, deliberate camera.
// - Modes: AUTO runs the whole edition; SEMI stops before any segment that is not
//   approved; MANUAL stops at the end of every segment until the director continues.
// - The director never loses control: pause, resume, stop, next, previous, repeat,
//   jump, skip beat and interrupt narration act immediately.

import { estimateSeconds, lineSegments, type NarrationLine } from "../engine/narration";
import type { ShowRenderer } from "./renderer";
import { STAGE_LABEL, type Beat, type DirectorMode, type Edition } from "./types";

export type DirectorStatus = "idle" | "playing" | "paused" | "awaiting-approval" | "awaiting-operator" | "done";
export interface DirectorState {
  status: DirectorStatus;
  mode: DirectorMode;
  segment: number;
  beat: number;
  startedAt: number | null;
  segmentStartedAt: number | null;
  elapsedS: number;
  narrating: string | null;
  nextNarration: string | null;
  voice: "voz" | "subtítulos";
  error: string | null;
}

export interface DirectorDeps {
  renderer: ShowRenderer;
  /** Plays a line and resolves when it ends. Absent → captions. */
  narrate?: (line: NarrationLine) => Promise<void>;
  prepare?: (line: NarrationLine) => void;
  stopNarration?: () => void;
  pauseAudio?: (paused: boolean) => void;
  duck?: (on: boolean) => void;
  sfx?: (kind: "goal" | "whistle" | "var") => void;
  sideInfo?: () => { live: { home: string; away: string; score: string; minute: string }[] };
  onState: (s: DirectorState) => void;
  onSegmentDone?: (index: number, actualS: number) => void;
}

const clock = () => new Date().toLocaleTimeString("es-CO", { timeZone: "America/Bogota", hour: "2-digit", minute: "2-digit" });
const date = () => new Date().toLocaleDateString("es-CO", { timeZone: "America/Bogota", weekday: "long", day: "numeric", month: "long" });

export class Director {
  private gen = 0;              // bumps on every jump/stop: stale loops exit
  private paused = false;
  private resumeWaiters: (() => void)[] = [];
  private gate: (() => void) | null = null;
  private skipBeat = false;
  private s: DirectorState = { status: "idle", mode: "AUTO", segment: 0, beat: 0, startedAt: null, segmentStartedAt: null, elapsedS: 0, narrating: null, nextNarration: null, voice: "subtítulos", error: null };
  private clockTimer = 0;

  constructor(private edition: Edition, private deps: DirectorDeps) {}

  get state() { return this.s; }
  setEdition(e: Edition) { this.edition = e; }
  setMode(mode: DirectorMode) { this.set({ mode }); if (this.gate && (mode === "AUTO" || (mode === "SEMI" && this.edition.segments[this.s.segment]?.approved))) this.release(); }
  setVoice(available: boolean) { this.set({ voice: available && this.deps.narrate ? "voz" : "subtítulos" }); }

  private set(p: Partial<DirectorState>) { this.s = { ...this.s, ...p }; this.deps.onState(this.s); }

  // ---------------------------------------------------------------- controls
  play(from?: number) {
    if (from === undefined && this.s.status === "paused") { this.resume(); return; }
    if (from === undefined) from = this.s.status === "done" ? 0 : this.s.segment;
    this.gen++;
    this.paused = false;
    this.deps.pauseAudio?.(false);
    this.resumeWaiters.splice(0).forEach((r) => r());
    this.set({ status: "playing", segment: from, beat: 0, startedAt: this.s.startedAt ?? Date.now(), error: null });
    this.startClock();
    void this.run(this.gen, from, 0);
  }
  pause() { if (this.s.status !== "playing") return; this.paused = true; this.deps.pauseAudio?.(true); this.set({ status: "paused" }); }
  resume() {
    if (!this.paused) return;
    this.paused = false; this.deps.pauseAudio?.(false);
    this.set({ status: "playing" });
    this.resumeWaiters.splice(0).forEach((r) => r());
  }
  stop() {
    this.gen++; this.paused = false; this.deps.stopNarration?.(); this.deps.duck?.(false); this.deps.pauseAudio?.(false);
    this.resumeWaiters.splice(0).forEach((r) => r()); this.gate = null;
    window.clearInterval(this.clockTimer);
    this.set({ status: "idle", narrating: null, nextNarration: null, startedAt: null });
  }
  jump(segment: number) {
    if (segment < 0 || segment >= this.edition.segments.length) return;
    this.deps.stopNarration?.();
    this.gate = null;
    this.play(segment);
  }
  next() { if (this.gate) { this.release(); return; } this.jump(this.s.segment + 1); }
  previous() { this.jump(Math.max(0, this.s.segment - 1)); }
  repeat() { this.jump(this.s.segment); }
  skip() { this.skipBeat = true; this.deps.stopNarration?.(); }
  interruptNarration() { this.deps.stopNarration?.(); }
  approve() { if (this.s.status === "awaiting-approval") this.release(); }
  private release() { const g = this.gate; this.gate = null; g?.(); }

  // ---------------------------------------------------------------- engine
  private startClock() {
    window.clearInterval(this.clockTimer);
    this.clockTimer = window.setInterval(() => {
      const r = this.deps.renderer;
      r.setOverlay({ clock: clock() });
      const seg = this.edition.segments[this.s.segment];
      r.setSide({ label: seg ? STAGE_LABEL[seg.stage] : "NEXUS SPORT", sub: seg?.title, clock: clock(), date: date(), live: this.deps.sideInfo?.().live ?? [] });
      if (this.s.startedAt && this.s.status !== "paused") this.set({ elapsedS: Math.round((Date.now() - this.s.startedAt) / 1000) });
    }, 1000);
  }

  private async wait(ms: number, gen: number) {
    let left = ms;
    while (left > 0 && gen === this.gen && !this.skipBeat) {
      if (this.paused) { await new Promise<void>((r) => this.resumeWaiters.push(r)); continue; }
      const step = Math.min(200, left);
      await new Promise((r) => setTimeout(r, step));
      left -= step;
    }
  }

  private async untilResumed(gen: number) { while (this.paused && gen === this.gen) await new Promise<void>((r) => this.resumeWaiters.push(r)); }

  private apply(b: Beat) {
    const r = this.deps.renderer;
    if (b.stage) r.setStage(b.stage, b.shot);
    else if (b.shot) r.setShot(b.shot, b.weight === "CRITICAL" ? 2400 : 1600);
    if (b.screen) r.setScreen(b.screen);
    if (b.lower !== undefined) r.setLower(b.lower);
    if (b.sfx) this.deps.sfx?.(b.sfx === "impact" ? "var" : b.sfx);
  }

  private async narrate(line: NarrationLine, gen: number) {
    const r = this.deps.renderer;
    const est = estimateSeconds(lineSegments(line)) * 1000;
    if (this.s.voice === "voz" && this.deps.narrate) {
      this.deps.duck?.(true);
      r.setOverlay({ caption: undefined });
      try {
        // never stall the show on the voice: a line that does not finish in time is let go
        await Promise.race([this.deps.narrate(line), new Promise((ok) => setTimeout(ok, est * 2.5 + 8000))]);
      } catch (err) {
        this.set({ error: err instanceof Error ? err.message : String(err) });
        r.setOverlay({ caption: line.text });
        await this.wait(est, gen);
      } finally { this.deps.duck?.(false); }
    } else {
      r.setOverlay({ caption: line.text });
      await this.wait(est, gen);
    }
  }

  private async run(gen: number, segIndex: number, beatIndex: number) {
    const segs = this.edition.segments;
    for (let si = segIndex; si < segs.length && gen === this.gen; si++) {
      const seg = segs[si];
      if (seg.status === "skipped" || !seg.beats.length) continue;
      // SEMI: unapproved segments wait for the director
      if (this.s.mode === "SEMI" && !seg.approved) {
        this.set({ status: "awaiting-approval", segment: si, beat: 0 });
        await new Promise<void>((r) => { this.gate = r; });
        if (gen !== this.gen) return;
        this.set({ status: "playing" });
      }
      const started = Date.now();
      this.set({ segment: si, segmentStartedAt: started });
      this.deps.renderer.setOverlay({ segment: seg.title, lower: null, caption: undefined });
      for (let bi = si === segIndex ? beatIndex : 0; bi < seg.beats.length && gen === this.gen; bi++) {
        await this.untilResumed(gen);
        if (gen !== this.gen) return;
        this.skipBeat = false;
        const b = seg.beats[bi];
        const ahead = [...seg.beats.slice(bi + 1), ...(segs[si + 1]?.beats ?? [])].filter((x) => x.narration).slice(0, 2);
        this.set({ beat: bi, narrating: b.narration?.text ?? null, nextNarration: ahead[0]?.narration?.text ?? null });
        this.apply(b);
        ahead.forEach((x) => this.deps.prepare?.(x.narration!)); // the next two lines are generated while this one plays
        if (b.narration) await this.narrate(b.narration, gen);
        if (gen !== this.gen) return;
        if (b.holdMs) await this.wait(b.holdMs, gen);
      }
      if (gen !== this.gen) return;
      const actual = Math.round((Date.now() - started) / 1000);
      this.deps.onSegmentDone?.(si, actual);
      this.deps.renderer.setOverlay({ caption: undefined });
      if (this.s.mode === "MANUAL" && si < segs.length - 1) {
        this.set({ status: "awaiting-operator", narrating: null });
        await new Promise<void>((r) => { this.gate = r; });
        if (gen !== this.gen) return;
        this.set({ status: "playing" });
      }
    }
    if (gen === this.gen) {
      window.clearInterval(this.clockTimer);
      this.deps.renderer.setLower(null);
      this.set({ status: "done", narrating: null, nextNarration: null });
    }
  }
}
