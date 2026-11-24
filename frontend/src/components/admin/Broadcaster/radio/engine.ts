// Radio audio engine (WebAudio). Executes what the auto DJ decides.
//
//   deck A ┐
//   deck B ┼─► music bus (ducking) ─┐
//   mic ───────► mic gain ──────────┼─► compressor ─► limiter ─► master ─┬─► on-air MediaStream (WHIP)
//                                                                     └─► monitor (headphones, optional)
//
// Tracks play through <audio> elements (streamed from Storage, never fully
// decoded in memory). Crossfade starts `crossfadeS` before the end.

export interface DeckTrack {
  id: string;
  url: string;
  title: string;
  artist: string;
  kind: string;
}

type Listener = (event: EngineEvent) => void;
export type EngineEvent =
  | { type: "started"; track: DeckTrack }
  | { type: "needNext" }
  | { type: "ended"; track: DeckTrack }
  | { type: "error"; track: DeckTrack; message: string };

interface Deck {
  audio: HTMLAudioElement;
  gain: GainNode;
  track: DeckTrack | null;
}

export class RadioEngine {
  readonly ctx: AudioContext;
  readonly output: MediaStream;
  private readonly musicBus: GainNode;
  private readonly micGain: GainNode;
  private readonly master: GainNode;
  private readonly monitor: GainNode;
  private readonly analyser: AnalyserNode;
  private readonly decks: [Deck, Deck];
  private active = 0;
  private micStream: MediaStream | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;
  private listeners = new Set<Listener>();
  private nextRequested = false;
  private timer: number | null = null;
  crossfadeS = 6;
  duckLevel = 0.25;

  constructor() {
    this.ctx = new AudioContext({ latencyHint: "playback" });
    this.musicBus = this.ctx.createGain();
    this.micGain = this.ctx.createGain();
    this.micGain.gain.value = 0;
    const compressor = this.ctx.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 12;
    compressor.ratio.value = 3;
    compressor.attack.value = 0.01;
    compressor.release.value = 0.25;
    const limiter = this.ctx.createDynamicsCompressor();
    limiter.threshold.value = -1.5;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.05;
    this.master = this.ctx.createGain();
    this.monitor = this.ctx.createGain();
    this.monitor.gain.value = 0;
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 1024;

    this.musicBus.connect(compressor);
    this.micGain.connect(compressor);
    compressor.connect(limiter);
    limiter.connect(this.master);
    this.master.connect(this.analyser);
    const destination = this.ctx.createMediaStreamDestination();
    this.master.connect(destination);
    this.master.connect(this.monitor);
    this.monitor.connect(this.ctx.destination);
    this.output = destination.stream;

    this.decks = [this.makeDeck(), this.makeDeck()];
    this.timer = window.setInterval(() => this.tick(), 250);
  }

  private makeDeck(): Deck {
    const audio = new Audio();
    audio.crossOrigin = "anonymous"; // Storage serves CORS; required to route into WebAudio
    audio.preload = "auto";
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    this.ctx.createMediaElementSource(audio).connect(gain);
    gain.connect(this.musicBus);
    const deck: Deck = { audio, gain, track: null };
    audio.addEventListener("ended", () => {
      if (deck.track) this.emit({ type: "ended", track: deck.track });
      if (deck === this.decks[this.active] && !this.nextRequested) this.requestNext();
    });
    audio.addEventListener("error", () => {
      if (!deck.track) return;
      this.emit({ type: "error", track: deck.track, message: "No se pudo reproducir la pista" });
      if (deck === this.decks[this.active]) this.requestNext();
    });
    return deck;
  }

  on(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: EngineEvent) {
    this.listeners.forEach((l) => l(event));
  }

  private requestNext() {
    this.nextRequested = true;
    this.emit({ type: "needNext" });
  }

  private tick() {
    const deck = this.decks[this.active];
    if (!deck.track || deck.audio.paused) return;
    const remaining = deck.audio.duration - deck.audio.currentTime;
    if (Number.isFinite(remaining) && remaining <= this.crossfadeS + 0.3 && !this.nextRequested) this.requestNext();
  }

  /** Starts `track` on the idle deck, crossfading from the current one. */
  async play(track: DeckTrack, opts: { crossfadeS?: number } = {}): Promise<void> {
    await this.ctx.resume();
    const fade = Math.max(0.05, opts.crossfadeS ?? this.crossfadeS);
    const from = this.decks[this.active];
    const toIndex = from.track ? 1 - this.active : this.active;
    const to = this.decks[toIndex];
    to.track = track;
    to.audio.src = track.url;
    to.audio.currentTime = 0;
    const now = this.ctx.currentTime;
    to.gain.gain.cancelScheduledValues(now);
    to.gain.gain.setValueAtTime(0, now);
    try {
      await to.audio.play();
    } catch (error) {
      this.emit({ type: "error", track, message: error instanceof Error ? error.message : "No se pudo reproducir" });
      this.nextRequested = false;
      this.requestNext();
      return;
    }
    to.gain.gain.linearRampToValueAtTime(1, now + fade);
    if (from !== to && from.track) {
      from.gain.gain.cancelScheduledValues(now);
      from.gain.gain.setValueAtTime(from.gain.gain.value, now);
      from.gain.gain.linearRampToValueAtTime(0, now + fade);
      const previous = from;
      window.setTimeout(() => { previous.audio.pause(); previous.track = null; }, fade * 1000 + 100);
    }
    this.active = toIndex;
    this.nextRequested = false;
    this.emit({ type: "started", track });
  }

  /** Skip now: short crossfade to whatever the DJ picks next. */
  skip() {
    if (!this.nextRequested) this.requestNext();
  }

  pause() {
    this.decks.forEach((d) => d.audio.pause());
  }

  async resume() {
    await this.ctx.resume();
    const deck = this.decks[this.active];
    if (deck.track) await deck.audio.play();
  }

  get current(): { track: DeckTrack | null; position: number; duration: number; paused: boolean } {
    const deck = this.decks[this.active];
    return { track: deck.track, position: deck.audio.currentTime || 0, duration: deck.audio.duration || 0, paused: deck.audio.paused };
  }

  /** Mic on/off with automatic talk-over ducking of the music. */
  async setMic(on: boolean, deviceId?: string) {
    await this.ctx.resume();
    const now = this.ctx.currentTime;
    if (on) {
      if (!this.micStream) {
        this.micStream = await navigator.mediaDevices.getUserMedia({
          audio: { deviceId: deviceId ? { exact: deviceId } : undefined, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
        this.micSource = this.ctx.createMediaStreamSource(this.micStream);
        this.micSource.connect(this.micGain);
      }
      this.micGain.gain.setTargetAtTime(1.4, now, 0.05);
      this.musicBus.gain.setTargetAtTime(this.duckLevel, now, 0.12);
    } else {
      this.micGain.gain.setTargetAtTime(0, now, 0.08);
      this.musicBus.gain.setTargetAtTime(1, now, 0.35);
    }
  }

  setMonitor(on: boolean) {
    this.monitor.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.05);
  }

  setVolume(value: number) {
    this.master.gain.setTargetAtTime(Math.max(0, Math.min(1.5, value)), this.ctx.currentTime, 0.05);
  }

  /** 0..1 output level for the meter. */
  level(): number {
    const data = new Float32Array(this.analyser.fftSize);
    this.analyser.getFloatTimeDomainData(data);
    let peak = 0;
    for (const v of data) peak = Math.max(peak, Math.abs(v));
    return peak;
  }

  async dispose() {
    if (this.timer) window.clearInterval(this.timer);
    this.decks.forEach((d) => { d.audio.pause(); d.audio.src = ""; });
    this.micStream?.getTracks().forEach((t) => t.stop());
    await this.ctx.close();
  }
}
