// NEXUS AI Narrator — provider-agnostic narration for the show.
//
// The voice is generated ON THE BROADCASTING PC by the local NEXUS Narrator service
// (automation/narrator, http://127.0.0.1:8802): Kokoro-82M as the main provider and
// Piper as the alternative, both free and offline. The operator's browser talks to it
// directly; Vercel never does. Nothing here fakes a voice: with the service down the
// status says so and synthesis fails with the real error.
//
// - NarrationProvider: the contract the editorial engine uses (replaceable without
//   touching the show).
// - Profiles (EPIC, NEWS, ANALYSIS, DEBATE, EXPECTATION, FRIENDLY): speed, pauses and
//   intensity per intervention. Kokoro has no emotion control; the profile is carried
//   by pacing, silences, gain and the wording.
// - segment(): splits a narration into phrases with intentional pauses.
// - NarrationQueue: prepares the NEXT line while the current one plays, plays them
//   back-to-back into a Web Audio node (the program mix), and supports pause, resume,
//   interrupt and retries. Generation never blocks the renderer: it is just a fetch.

export type NarrationProfile = "EPIC" | "NEWS" | "ANALYSIS" | "DEBATE" | "EXPECTATION" | "FRIENDLY";
export type ProviderId = "kokoro" | "piper";

export interface ProfileStyle { label: string; speed: number; gain: number; sentencePauseMs: number; clausePauseMs: number; leadPauseMs: number }
export const PROFILES: Record<NarrationProfile, ProfileStyle> = {
  EPIC: { label: "Épico", speed: 1.06, gain: 1.15, sentencePauseMs: 520, clausePauseMs: 220, leadPauseMs: 250 },
  NEWS: { label: "Noticias", speed: 1.0, gain: 1.0, sentencePauseMs: 380, clausePauseMs: 160, leadPauseMs: 150 },
  ANALYSIS: { label: "Análisis", speed: 0.95, gain: 0.95, sentencePauseMs: 520, clausePauseMs: 220, leadPauseMs: 200 },
  DEBATE: { label: "Debate", speed: 0.98, gain: 1.0, sentencePauseMs: 600, clausePauseMs: 240, leadPauseMs: 250 },
  EXPECTATION: { label: "Expectativa", speed: 0.97, gain: 1.05, sentencePauseMs: 560, clausePauseMs: 220, leadPauseMs: 250 },
  FRIENDLY: { label: "Cercano", speed: 0.96, gain: 0.95, sentencePauseMs: 480, clausePauseMs: 200, leadPauseMs: 150 },
};

export interface NarrationSegment { text: string; speed?: number; pauseAfterMs: number }
export interface NarrationLine {
  id: string;
  text: string;
  profile: NarrationProfile;
  /** Extra emphasis on this line: a little slower and louder (a goal, a final score). */
  emphasis?: boolean;
  /** Silence before the next line, on top of the profile's sentence pause. */
  pauseAfterMs?: number;
}
export interface VoiceChoice { provider: ProviderId; voice: string }
export interface SynthesisResult { audio: ArrayBuffer; durationS: number; elapsedS: number; cached: boolean }
export interface ProviderStatus {
  reachable: boolean;
  error?: string;
  busy?: boolean;
  providers?: Record<ProviderId, { ready: boolean; error: string | null; lastRtf: number | null; voices: Record<string, string>; model?: string; generatedSeconds: number }>;
  cache?: { files: number; mb: number; maxMb: number };
  lexiconEntries?: number;
  lastError?: { at: number; message: string } | null;
}
export interface LexiconEntry { term: string; say?: string; ipa?: string; kind?: string }

export interface NarrationProvider {
  status(): Promise<ProviderStatus>;
  synthesize(segments: NarrationSegment[], voice: VoiceChoice, opts?: { speed?: number; gain?: number; signal?: AbortSignal }): Promise<SynthesisResult>;
  lexicon(): Promise<LexiconEntry[]>;
  saveLexicon(entries: LexiconEntry[]): Promise<number>;
}

export const DEFAULT_NARRATOR_URL = "http://127.0.0.1:8802";
export const DEFAULT_VOICE: VoiceChoice = { provider: "kokoro", voice: "em_santa" };

const ORD = ["", "primero", "segundo", "tercero", "cuarto", "quinto", "sexto", "séptimo", "octavo", "noveno", "décimo", "undécimo", "duodécimo", "decimotercero", "decimocuarto", "decimoquinto", "decimosexto", "decimoséptimo", "decimoctavo", "decimonoveno", "vigésimo"];
/** What the VOICE says (the screen keeps the written form): minutes, ordinals, scores, abbreviations. */
export function speakable(text: string): string {
  return text
    .replace(/(\d+)\s*\+\s*(\d+)'/g, "$1 más $2")          // 90+3'
    .replace(/(\d+)'/g, "$1")                                // 37'
    .replace(/\b(\d{1,2})\s*\.?\s*[º°]/g, (_, n) => ORD[Number(n)] ?? `${n}`) // 9.º
    .replace(/\(e\.c\.\)/g, "en contra").replace(/\(p\)/g, "de penal")
    .replace(/\s+vs\.?\s+/gi, " contra ")
    .replace(/\b(\d+)\s*-\s*(\d+)\b/g, "$1 a $2")           // 4-1
    .replace(/\s+·\s+/g, ", ");
}

/** Splits narration into phrases: a pause after every sentence and a shorter one after clauses. */
export function segment(text: string, profile: NarrationProfile, emphasis = false, trailingMs = 0): NarrationSegment[] {
  const style = PROFILES[profile];
  const clean = speakable(text).replace(/\s+/g, " ").trim();
  if (!clean) return [];
  // sentences (keep the ¿…? / ¡…! marks with their sentence)
  const sentences = clean.match(/[^.!?…]+(?:[.!?…]+["»”)]?|$)/g)?.map((s) => s.trim()).filter(Boolean) ?? [clean];
  const out: NarrationSegment[] = [];
  for (const s of sentences) {
    // long sentences breathe at ; : — and at commas only when the sentence is long
    const parts = s.length > 140 ? s.split(/(?<=[;:—])\s+|(?<=,)\s+(?=\S{4,})/).filter(Boolean) : [s];
    parts.forEach((p, i) => {
      const last = i === parts.length - 1;
      out.push({ text: p.trim(), speed: emphasis ? 0.94 : undefined, pauseAfterMs: last ? style.sentencePauseMs : style.clausePauseMs });
    });
  }
  out[out.length - 1].pauseAfterMs += trailingMs;
  return out;
}

/** Rough duration for planning before the audio exists (Spanish ≈ 15 chars/s at speed 1 plus pauses). */
export function estimateSeconds(segments: NarrationSegment[], speed = 1): number {
  return segments.reduce((t, s) => t + s.text.length / (15 * (s.speed ?? 1) * speed) + s.pauseAfterMs / 1000, 0);
}

export function lineSegments(line: NarrationLine): NarrationSegment[] {
  return segment(line.text, line.profile, line.emphasis, line.pauseAfterMs ?? 0);
}

export const lineKey = (line: NarrationLine, voice: VoiceChoice) => `${voice.provider}:${voice.voice}:${line.profile}:${line.emphasis ? 1 : 0}:${line.pauseAfterMs ?? 0}:${line.text}`;

// ----------------------------------------------------------------------------- local service provider

export class LocalNarrator implements NarrationProvider {
  constructor(readonly baseUrl = DEFAULT_NARRATOR_URL) {}

  async status(): Promise<ProviderStatus> {
    try {
      const res = await fetch(`${this.baseUrl}/status`, { cache: "no-store", signal: AbortSignal.timeout(3000) });
      if (!res.ok) return { reachable: false, error: `El servicio respondió ${res.status}` };
      return { reachable: true, ...(await res.json()) };
    } catch {
      return { reachable: false, error: `No hay servicio de narración en ${this.baseUrl}. Inícialo en este PC (automation/narrator).` };
    }
  }

  async synthesize(segments: NarrationSegment[], voice: VoiceChoice, opts: { speed?: number; gain?: number; signal?: AbortSignal } = {}): Promise<SynthesisResult> {
    const res = await fetch(`${this.baseUrl}/synthesize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: voice.provider, voice: voice.voice, speed: opts.speed ?? 1, gain: opts.gain ?? 1, segments }),
      signal: opts.signal,
    });
    if (!res.ok) {
      const detail = await res.json().then((b) => b.detail ?? b.error).catch(() => res.statusText);
      throw new Error(`Narración ${res.status}: ${detail}`);
    }
    return {
      audio: await res.arrayBuffer(),
      durationS: Number(res.headers.get("X-Duration") ?? 0),
      elapsedS: Number(res.headers.get("X-Elapsed") ?? 0),
      cached: res.headers.get("X-Cache") === "hit",
    };
  }

  async lexicon(): Promise<LexiconEntry[]> {
    const res = await fetch(`${this.baseUrl}/lexicon`, { cache: "no-store" });
    if (!res.ok) throw new Error(`Diccionario ${res.status}`);
    return res.json();
  }

  async saveLexicon(entries: LexiconEntry[]): Promise<number> {
    const res = await fetch(`${this.baseUrl}/lexicon`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(entries) });
    if (!res.ok) throw new Error(`Diccionario ${res.status}`);
    return (await res.json()).saved;
  }
}

// ----------------------------------------------------------------------------- settings (per broadcasting PC)

const SETTINGS_KEY = "nexus-narrator";
export interface NarratorSettings { url: string; voice: VoiceChoice; volume: number }
export function loadNarratorSettings(): NarratorSettings {
  try {
    const raw = JSON.parse(window.localStorage.getItem(SETTINGS_KEY) ?? "null");
    if (raw?.voice?.provider && raw?.voice?.voice) return { url: raw.url || DEFAULT_NARRATOR_URL, voice: raw.voice, volume: Number(raw.volume ?? 1) };
  } catch { /* defaults */ }
  return { url: DEFAULT_NARRATOR_URL, voice: DEFAULT_VOICE, volume: 1 };
}
export function saveNarratorSettings(s: NarratorSettings) {
  try { window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* sin almacenamiento */ }
}

// ----------------------------------------------------------------------------- playback queue

export type QueueEvent =
  | { type: "preparing"; line: NarrationLine }
  | { type: "start"; line: NarrationLine; durationS: number }
  | { type: "end"; line: NarrationLine }
  | { type: "error"; line: NarrationLine; message: string }
  | { type: "idle" };

/**
 * Plays narration lines back-to-back. While line N plays, line N+1 is already being
 * synthesized, so there is no gap waiting for the voice. Failed lines are retried
 * (backoff) and then skipped with an error event: the show goes on, silent, instead
 * of stalling.
 */
export class NarrationQueue {
  private queue: NarrationLine[] = [];
  private ready = new Map<string, Promise<AudioBuffer>>();
  private current: { source: AudioBufferSourceNode; line: NarrationLine } | null = null;
  private running = false;
  private paused = false;
  private cache = new Map<string, AudioBuffer>(); // LRU of decoded audio
  private aborts = new Map<string, AbortController>();
  private waiters = new Map<string, { resolve: () => void; reject: (e: Error) => void }>();
  readonly gain: GainNode;

  constructor(
    private readonly provider: NarrationProvider,
    private readonly context: AudioContext,
    output: AudioNode,
    private voice: VoiceChoice,
    private readonly onEvent: (e: QueueEvent) => void = () => undefined,
    private readonly retries = 2,
  ) {
    this.gain = context.createGain();
    this.gain.connect(output);
  }

  setVoice(voice: VoiceChoice) { this.voice = voice; }
  setVolume(v: number) { this.gain.gain.setTargetAtTime(v, this.context.currentTime, 0.05); }
  get playing() { return Boolean(this.current); }
  get pending() { return this.queue.length; }

  /** Starts synthesizing a line ahead of time (cached by text, profile and voice). */
  prepare(line: NarrationLine): Promise<AudioBuffer> {
    const key = lineKey(line, this.voice);
    const hit = this.cache.get(key);
    if (hit) return Promise.resolve(hit);
    let p = this.ready.get(key);
    if (!p) {
      this.onEvent({ type: "preparing", line });
      const style = PROFILES[line.profile];
      const ctrl = new AbortController();
      this.aborts.set(key, ctrl);
      p = (async () => {
        let lastErr: unknown;
        for (let attempt = 0; attempt <= this.retries; attempt++) {
          try {
            const r = await this.provider.synthesize(lineSegments(line), this.voice, { speed: style.speed, gain: style.gain * (line.emphasis ? 1.08 : 1), signal: ctrl.signal });
            const buffer = await this.context.decodeAudioData(r.audio.slice(0));
            this.cache.set(key, buffer);
            if (this.cache.size > 30) this.cache.delete(this.cache.keys().next().value!); // ~1 MB per 10 s of decoded audio
            return buffer;
          } catch (err) {
            lastErr = err;
            if (ctrl.signal.aborted) break;
            await new Promise((ok) => setTimeout(ok, 600 * (attempt + 1)));
          }
        }
        throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
      })().finally(() => { this.ready.delete(key); this.aborts.delete(key); });
      this.ready.set(key, p);
    }
    return p;
  }

  /** Appends lines; the first two start generating right away. */
  enqueue(lines: NarrationLine[]) {
    this.queue.push(...lines);
    this.queue.slice(0, 2).forEach((l) => void this.prepare(l).catch(() => undefined));
    if (!this.running) void this.loop();
  }

  /** Plays one line (after whatever is queued) and resolves when it has been heard; rejects if it failed. */
  speak(line: NarrationLine): Promise<void> {
    return new Promise((resolve, reject) => { this.waiters.set(line.id, { resolve, reject }); this.enqueue([line]); });
  }

  /** Stops the current line and drops everything queued (the director took over). */
  interrupt() {
    this.queue.forEach((l) => { this.waiters.get(l.id)?.resolve(); this.waiters.delete(l.id); });
    this.queue = [];
    this.aborts.forEach((a) => a.abort());
    this.current?.source.stop();
  }

  pause() { if (!this.paused) { this.paused = true; void this.context.suspend(); } }
  resume() { if (this.paused) { this.paused = false; void this.context.resume(); } }

  private async loop() {
    this.running = true;
    while (this.queue.length) {
      const line = this.queue.shift()!;
      const next = this.queue[0];
      try {
        const buffer = await this.prepare(line);
        if (next) void this.prepare(next).catch(() => undefined); // keep one ahead
        await new Promise<void>((done) => {
          const source = this.context.createBufferSource();
          source.buffer = buffer;
          source.connect(this.gain);
          source.onended = () => { this.current = null; done(); };
          this.current = { source, line };
          this.onEvent({ type: "start", line, durationS: buffer.duration });
          source.start();
        });
        this.onEvent({ type: "end", line });
        this.waiters.get(line.id)?.resolve(); this.waiters.delete(line.id);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.onEvent({ type: "error", line, message });
        this.waiters.get(line.id)?.reject(new Error(message)); this.waiters.delete(line.id);
      }
    }
    this.running = false;
    this.onEvent({ type: "idle" });
  }

  dispose() { this.interrupt(); this.waiters.forEach((w) => w.resolve()); this.waiters.clear(); this.gain.disconnect(); this.cache.clear(); }
}
