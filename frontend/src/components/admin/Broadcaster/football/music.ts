// Background music for the automatic show.
//  - "Música NEXUS": a sports-TV loop synthesised in the browser (kick, hats,
//    bass, chord pads) — no files, no rights issues.
//  - or the user's own song (file).
// When the program mixer exists (live / recording) the music is routed into it,
// so it reaches the stream; it is also heard locally.

const RATE = 44100;

function wav(buffer: AudioBuffer): Blob {
  const ch = buffer.numberOfChannels;
  const len = buffer.length * ch * 2;
  const out = new DataView(new ArrayBuffer(44 + len));
  const str = (o: number, s: string) => [...s].forEach((c, i) => out.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF"); out.setUint32(4, 36 + len, true); str(8, "WAVE"); str(12, "fmt ");
  out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, ch, true); out.setUint32(24, RATE, true);
  out.setUint32(28, RATE * ch * 2, true); out.setUint16(32, ch * 2, true); out.setUint16(34, 16, true); str(36, "data"); out.setUint32(40, len, true);
  const data = [...Array(ch)].map((_, c) => buffer.getChannelData(c));
  let o = 44;
  for (let i = 0; i < buffer.length; i += 1) for (let c = 0; c < ch; c += 1) { out.setInt16(o, Math.max(-1, Math.min(1, data[c][i])) * 0x7fff, true); o += 2; }
  return new Blob([out], { type: "audio/wav" });
}

/** 8 bars at 100 bpm (~19 s) that loop seamlessly. */
export async function generateNexusLoop(): Promise<Blob> {
  const bpm = 100;
  const beat = 60 / bpm;
  const bars = 8;
  const seconds = bars * 4 * beat;
  const ctx = new OfflineAudioContext(2, Math.ceil(seconds * RATE), RATE);
  const master = ctx.createGain();
  master.gain.value = 0.55;
  const comp = ctx.createDynamicsCompressor();
  master.connect(comp);
  comp.connect(ctx.destination);

  const noise = ctx.createBuffer(1, RATE, RATE);
  const nd = noise.getChannelData(0);
  for (let i = 0; i < nd.length; i += 1) nd[i] = Math.random() * 2 - 1;

  const kick = (t: number) => {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.18);
    g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.35);
  };
  const hat = (t: number, v: number) => {
    const s = ctx.createBufferSource(); s.buffer = noise;
    const f = ctx.createBiquadFilter(); f.type = "highpass"; f.frequency.value = 7500;
    const g = ctx.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + 0.06);
  };
  const clap = (t: number) => {
    const s = ctx.createBufferSource(); s.buffer = noise;
    const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 1500;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.35, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + 0.2);
  };
  const note = (freq: number, t: number, dur: number, type: OscillatorType, vol: number, cutoff: number) => {
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq;
    const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = cutoff;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.04); g.gain.setValueAtTime(vol, t + dur - 0.08); g.gain.linearRampToValueAtTime(0.0001, t + dur);
    o.connect(f); f.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
  };
  const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
  // Am - F - C - G
  const chords = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];
  for (let bar = 0; bar < bars; bar += 1) {
    const t0 = bar * 4 * beat;
    const chord = chords[bar % 4];
    chord.forEach((m) => { note(hz(m), t0, 4 * beat, "sawtooth", 0.05, 1400); note(hz(m + 12), t0, 4 * beat, "triangle", 0.03, 3000); });
    for (let b = 0; b < 4; b += 1) {
      const t = t0 + b * beat;
      kick(t);
      if (b % 2 === 1) clap(t);
      hat(t + beat / 2, 0.18); hat(t + beat / 4 * 3, 0.08);
      note(hz(chord[0] - 24), t, beat * 0.45, "square", 0.12, 500);
      note(hz(chord[0] - 12), t + beat / 2, beat * 0.3, "square", 0.07, 700);
    }
    // little lead on even bars
    if (bar % 2 === 1) [0, 0.75, 1.5, 2.5].forEach((off, i) => note(hz(chord[i % 3] + 12), t0 + off * beat, beat * 0.5, "triangle", 0.06, 4000));
  }
  return wav(await ctx.startRendering());
}

class MusicPlayer {
  readonly el: HTMLAudioElement | null = typeof Audio !== "undefined" ? new Audio() : null;
  private attachedTo: AudioContext | null = null;
  private monitor: GainNode | null = null;
  private monitorOn = true;
  private url: string | null = null;
  name = "";

  constructor() { if (this.el) { this.el.loop = true; this.el.volume = 0.35; } }

  load(blob: Blob, name: string) {
    if (!this.el) return;
    if (this.url) URL.revokeObjectURL(this.url);
    this.url = URL.createObjectURL(blob);
    this.el.src = this.url;
    this.name = name;
  }
  get loaded() { return Boolean(this.el?.src); }
  get playing() { return Boolean(this.el && !this.el.paused); }
  async play() { await this.el?.play().catch(() => undefined); }
  pause() { this.el?.pause(); }
  setVolume(v: number) { if (this.el) this.el.volume = Math.max(0, Math.min(1, v)); }
  /** Route into the program mix (stream) + speakers. Once per audio context. */
  attach(context: AudioContext, bus: AudioNode) {
    if (!this.el || this.attachedTo === context) return;
    const src = context.createMediaElementSource(this.el);
    src.connect(bus);
    this.monitor = context.createGain();
    this.monitor.gain.value = this.monitorOn ? 1 : 0;
    src.connect(this.monitor);
    this.monitor.connect(context.destination);
    this.attachedTo = context;
  }
  /** Studio speakers. Off while a Broadcast Output tab plays the mix, so the music is never heard twice. */
  setMonitor(on: boolean) {
    this.monitorOn = on;
    if (this.monitor) this.monitor.gain.value = on ? 1 : 0;
  }
}

export const music = new MusicPlayer();
