// Broadcast Output: the Program signal of the broadcaster, delivered to a clean tab
// (/broadcast/output) that KICK Web Go Live (or Restream, or any tab capture) can share.
//
// No second production engine: the operator tab keeps compositing Program exactly as
// today (scenes, graphics, transitions, fade to black, the audio mix). That canvas and
// the mix track travel to the output tab over a LOCAL WebRTC peer connection (same
// browser, loopback: no server, no stream key, no FFmpeg). Signalling uses a
// BroadcastChannel, so it only ever reaches tabs of the same origin and profile.
//
//   output  ── hello ──▶  host        (output announces itself, repeats until served)
//   host    ── offer ──▶  output      (one peer per output tab)
//   output  ── answer ─▶  host
//   both    ── ice ────▶  other side
//   output  ── stats ──▶  host        (real measured fps / drops, shown to the operator)
//   host    ── ready ──▶  all         (host (re)started: outputs say hello again)
//   host    ── beat ───▶  all         (every second: an output whose studio went silent
//                                       for BEAT_TIMEOUT_MS freezes the last frame and re-announces)
//   either  ── bye ────▶  other side
//
// An output locks onto the first host that serves it and ignores other broadcaster tabs
// until that host leaves, so two open studios never fight over one output.

export const OUTPUT_CHANNEL = "nexus-program-output";
export const OUTPUT_PATH = "/broadcast/output";
export const OUTPUT_FPS = 30;
export const BEAT_MS = 1000;
export const BEAT_TIMEOUT_MS = 3500;
/** An output that stopped reporting for this long (tab killed) is released by the studio. */
const OUTPUT_SILENCE_MS = 10_000;
/** Loopback has bandwidth to spare: keep text and crests sharp instead of saving bits. */
export const OUTPUT_BITRATE_KBPS = { min: 4000, start: 8000, max: 16000 };

export interface OutputStats {
  fps: number;            // frames actually presented by the output tab (requestVideoFrameCallback)
  width: number;
  height: number;
  dropped: number;        // frames dropped by the output decoder since connecting
  jitterMs: number;
  memoryMb: number | null; // JS heap of the output tab when the browser exposes it
  audio: "on" | "muted" | "blocked" | "none";
  uptimeS: number;
}

export type OutputMessage =
  | { t: "hello"; outputId: string }
  | { t: "ready"; hostId: string }
  | { t: "beat"; hostId: string }
  | { t: "offer"; hostId: string; to: string; sdp: string }
  | { t: "answer"; hostId: string; from: string; sdp: string }
  | { t: "ice"; hostId: string; to?: string; from?: string; candidate: RTCIceCandidateInit }
  | { t: "stats"; hostId: string; from: string; stats: OutputStats }
  | { t: "bye"; hostId?: string; from?: string };

export const randomId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

/** Raises the bitrate bounds Chrome's encoder may use on every video codec of an SDP (x-google-* fmtp). */
export function tuneVideoBitrate(sdp: string, kbps = OUTPUT_BITRATE_KBPS): string {
  const lines = sdp.split("\r\n");
  const videoPts = new Set<string>();
  let inVideo = false;
  for (const line of lines) {
    if (line.startsWith("m=")) inVideo = line.startsWith("m=video");
    const m = inVideo && /^a=rtpmap:(\d+) (VP8|VP9|H264|AV1)\//i.exec(line);
    if (m) videoPts.add(m[1]);
  }
  const extra = `x-google-min-bitrate=${kbps.min};x-google-start-bitrate=${kbps.start};x-google-max-bitrate=${kbps.max}`;
  const seen = new Set<string>();
  const out = lines.map((line) => {
    const m = /^a=fmtp:(\d+) (.*)$/.exec(line);
    if (!m || !videoPts.has(m[1])) return line;
    seen.add(m[1]);
    const params = m[2].split(";").filter((p) => !p.trim().startsWith("x-google-"));
    return `a=fmtp:${m[1]} ${[...params, extra].join(";")}`;
  });
  // codecs without an fmtp line get one right after their rtpmap
  const result: string[] = [];
  for (const line of out) {
    result.push(line);
    const m = /^a=rtpmap:(\d+) /.exec(line);
    if (m && videoPts.has(m[1]) && !seen.has(m[1])) result.push(`a=fmtp:${m[1]} ${extra}`);
  }
  return result.join("\r\n");
}

/** Hardware H.264 first (low CPU on long shows), then VP8/VP9; retransmission codecs untouched. */
export function preferCodecs<T extends { mimeType: string }>(codecs: T[]): T[] {
  const rank = (c: T) => {
    const m = c.mimeType.toLowerCase();
    if (m === "video/h264") return 0;
    if (m === "video/vp8") return 1;
    if (m === "video/vp9") return 2;
    if (m === "video/av1") return 3;
    return 4; // rtx / red / ulpfec
  };
  return [...codecs].sort((a, b) => rank(a) - rank(b));
}

/** Frames per second over a sliding window of presentation timestamps (ms). */
export function fpsOf(times: number[], windowMs = 2000): number {
  if (times.length < 2) return 0;
  const last = times[times.length - 1];
  const inWindow = times.filter((t) => last - t <= windowMs);
  if (inWindow.length < 2) return 0;
  const span = inWindow[inWindow.length - 1] - inWindow[0];
  return span > 0 ? Math.round(((inWindow.length - 1) * 1000) / span) : 0;
}

// ----------------------------------------------------------------- host (operator tab)

export interface OutputPeerInfo { id: string; state: RTCPeerConnectionState; stats: OutputStats | null; sentFps: number; limitation: string }
export interface HostStatus { outputs: OutputPeerInfo[] }

interface Peer { seenAt: number; pc: RTCPeerConnection; video: RTCRtpSender | null; audio: RTCRtpSender | null; stats: OutputStats | null; sentFps: number; limitation: string; lastFrames: number; lastAt: number; pendingIce: RTCIceCandidateInit[] }

export class ProgramOutputHost {
  readonly hostId = randomId();
  private channel: BroadcastChannel | null = null;
  private peers = new Map<string, Peer>();
  private canvas: HTMLCanvasElement | null = null;
  private videoTrack: MediaStreamTrack | null = null;
  private audioTrack: MediaStreamTrack | null = null;
  private statsTimer = 0;
  private beatTimer = 0;
  private readonly onPageHide = () => this.stop();

  constructor(
    private readonly onStatus: (status: HostStatus) => void,
    private readonly getAudioTrack: () => MediaStreamTrack | null,
  ) {}

  start() {
    if (this.channel || typeof BroadcastChannel === "undefined" || typeof RTCPeerConnection === "undefined") return;
    this.channel = new BroadcastChannel(OUTPUT_CHANNEL);
    this.channel.onmessage = (event) => void this.onMessage(event.data as OutputMessage);
    this.post({ t: "ready", hostId: this.hostId });
    this.statsTimer = window.setInterval(() => void this.sampleStats(), 2000);
    this.beatTimer = window.setInterval(() => this.post({ t: "beat", hostId: this.hostId }), BEAT_MS);
    window.addEventListener("pagehide", this.onPageHide); // studio tab closed or reloaded: outputs know at once
  }

  stop() {
    if (!this.channel) return;
    window.removeEventListener("pagehide", this.onPageHide);
    window.clearInterval(this.beatTimer);
    this.post({ t: "bye", hostId: this.hostId });
    this.peers.forEach((p) => p.pc.close());
    this.peers.clear();
    this.channel?.close();
    this.channel = null;
    window.clearInterval(this.statsTimer);
    this.videoTrack?.stop();
    this.audioTrack?.stop();
    this.videoTrack = this.audioTrack = null;
    this.canvas = null;
    this.emit();
  }

  get count() { return this.peers.size; }

  /** Called from the frame clock with the current Program canvas: a remounted canvas is re-captured live. */
  syncCanvas(canvas: HTMLCanvasElement | null) {
    if (!canvas || canvas === this.canvas || this.peers.size === 0) return;
    this.canvas = canvas;
    const track = canvas.captureStream(OUTPUT_FPS).getVideoTracks()[0] ?? null;
    if (track && "contentHint" in track) track.contentHint = "detail"; // graphics and text, not motion
    const old = this.videoTrack;
    this.videoTrack = track;
    this.peers.forEach((p) => void p.video?.replaceTrack(track));
    old?.stop();
  }

  /** The audio mix appeared (first user gesture created the mixer) or was rebuilt. */
  refreshAudio() {
    const track = this.getAudioTrack();
    if (!track) return;
    const old = this.audioTrack;
    this.audioTrack = track;
    this.peers.forEach((p) => void p.audio?.replaceTrack(track));
    old?.stop();
  }

  private post(message: OutputMessage) { this.channel?.postMessage(message); }
  private emit() {
    this.onStatus({ outputs: [...this.peers.entries()].map(([id, p]) => ({ id, state: p.pc.connectionState, stats: p.stats, sentFps: p.sentFps, limitation: p.limitation })) });
  }

  private drop(id: string) {
    const peer = this.peers.get(id);
    if (!peer) return;
    peer.pc.close();
    this.peers.delete(id);
    if (this.peers.size === 0) { this.videoTrack?.stop(); this.videoTrack = null; this.canvas = null; }
    this.emit();
  }

  private async onMessage(msg: OutputMessage) {
    if (msg.t === "hello") return this.serve(msg.outputId);
    if (msg.t === "answer" && msg.hostId === this.hostId) {
      const peer = this.peers.get(msg.from);
      if (peer && peer.pc.signalingState === "have-local-offer") {
        try {
          await peer.pc.setRemoteDescription({ type: "answer", sdp: tuneVideoBitrate(msg.sdp) });
          for (const c of peer.pendingIce.splice(0)) await peer.pc.addIceCandidate(c).catch(() => undefined);
        } catch { this.drop(msg.from); }
      }
      return;
    }
    if (msg.t === "ice" && msg.hostId === this.hostId && msg.from) {
      const peer = this.peers.get(msg.from);
      if (peer?.pc.remoteDescription) await peer.pc.addIceCandidate(msg.candidate).catch(() => undefined);
      else peer?.pendingIce.push(msg.candidate);
      return;
    }
    if (msg.t === "stats" && msg.hostId === this.hostId) {
      const peer = this.peers.get(msg.from);
      if (peer) { peer.stats = msg.stats; peer.seenAt = Date.now(); this.emit(); }
      return;
    }
    if (msg.t === "bye" && msg.from) this.drop(msg.from);
  }

  private async serve(outputId: string) {
    // repeated hellos of an output being served are ignored (a reloaded output has a new id)
    if (this.peers.has(outputId)) return;
    const pc = new RTCPeerConnection({ iceServers: [] }); // same machine: host candidates are enough
    const peer: Peer = { seenAt: Date.now(), pc, video: null, audio: null, stats: null, sentFps: 0, limitation: "", lastFrames: 0, lastAt: 0, pendingIce: [] };
    this.peers.set(outputId, peer);
    const video = pc.addTransceiver("video", { direction: "sendonly" });
    const audio = pc.addTransceiver("audio", { direction: "sendonly" });
    peer.video = video.sender;
    peer.audio = audio.sender;
    try {
      const caps = RTCRtpSender.getCapabilities?.("video");
      if (caps && "setCodecPreferences" in video) video.setCodecPreferences(preferCodecs(caps.codecs));
    } catch { /* browser default codec order */ }
    if (this.videoTrack) await video.sender.replaceTrack(this.videoTrack);
    if (!this.audioTrack) this.audioTrack = this.getAudioTrack();
    if (this.audioTrack) await audio.sender.replaceTrack(this.audioTrack);
    pc.onicecandidate = (e) => { if (e.candidate) this.post({ t: "ice", hostId: this.hostId, to: outputId, candidate: e.candidate.toJSON() }); };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") void this.tuneSender(video.sender);
      if (pc.connectionState === "failed" || pc.connectionState === "closed") this.drop(outputId);
      else this.emit();
    };
    if (this.peers.get(outputId) !== peer) return; // dropped while preparing
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    if (this.peers.get(outputId) !== peer) return;
    this.post({ t: "offer", hostId: this.hostId, to: outputId, sdp: pc.localDescription?.sdp ?? offer.sdp ?? "" });
    // first output: capture Program on the very next frame tick
    if (!this.videoTrack) this.canvas = null;
    this.emit();
  }

  private async tuneSender(sender: RTCRtpSender) {
    try {
      const params = sender.getParameters();
      params.encodings = (params.encodings?.length ? params.encodings : [{}]).map((e) => ({ ...e, maxBitrate: OUTPUT_BITRATE_KBPS.max * 1000, maxFramerate: OUTPUT_FPS }));
      (params as RTCRtpSendParameters & { degradationPreference?: string }).degradationPreference = "maintain-resolution";
      await sender.setParameters(params);
    } catch { /* defaults still work */ }
  }

  private async sampleStats() {
    if (!this.peers.size) return;
    const now = Date.now();
    [...this.peers.entries()].filter(([, p]) => now - p.seenAt > OUTPUT_SILENCE_MS).forEach(([id]) => this.drop(id));
    await Promise.all([...this.peers.values()].map(async (peer) => {
      try {
        const report = await peer.video?.getStats();
        report?.forEach((s) => {
          if (s.type !== "outbound-rtp") return;
          const frames = Number(s.framesEncoded ?? 0);
          const now = Number(s.timestamp ?? performance.now());
          if (peer.lastAt) peer.sentFps = Math.round(((frames - peer.lastFrames) * 1000) / Math.max(1, now - peer.lastAt));
          peer.lastFrames = frames;
          peer.lastAt = now;
          peer.limitation = String(s.qualityLimitationReason ?? "");
        });
      } catch { /* closed meanwhile */ }
    }));
    this.emit();
  }
}

// ----------------------------------------------------------------- client (output tab)

export interface ClientCallbacks {
  onStream: (stream: MediaStream) => void;
  onState: (state: "waiting" | "connecting" | "live" | "lost") => void;
}

export class ProgramOutputClient {
  readonly outputId = randomId();
  private channel: BroadcastChannel | null = null;
  private pc: RTCPeerConnection | null = null;
  private hostId: string | null = null;
  private helloTimer = 0;
  private watchTimer = 0;
  private beatAt = 0;
  private pendingIce: RTCIceCandidateInit[] = [];
  private readonly onPageHide = () => this.stop();

  constructor(private readonly cb: ClientCallbacks) {}

  start() {
    if (this.channel || typeof BroadcastChannel === "undefined") return;
    this.channel = new BroadcastChannel(OUTPUT_CHANNEL);
    this.channel.onmessage = (event) => void this.onMessage(event.data as OutputMessage);
    this.hello();
    // until a host serves us, keep announcing (the studio may open after the output)
    this.helloTimer = window.setInterval(() => { if (!this.hostId) this.hello(); }, 2000);
    // studio silent (tab crashed, machine asleep): freeze the last frame and look for it again
    this.watchTimer = window.setInterval(() => { if (this.hostId && Date.now() - this.beatAt > BEAT_TIMEOUT_MS) this.lose(); }, 500);
    window.addEventListener("pagehide", this.onPageHide);
  }

  stop() {
    if (!this.channel) return;
    window.removeEventListener("pagehide", this.onPageHide);
    this.channel.postMessage({ t: "bye", from: this.outputId } satisfies OutputMessage);
    window.clearInterval(this.helloTimer);
    window.clearInterval(this.watchTimer);
    this.pc?.close();
    this.pc = null;
    this.channel?.close();
    this.channel = null;
  }

  report(stats: OutputStats) {
    if (this.hostId) this.channel?.postMessage({ t: "stats", hostId: this.hostId, from: this.outputId, stats } satisfies OutputMessage);
  }

  /** Inbound video stats of the peer (decoder drops and jitter). */
  async inbound(): Promise<{ dropped: number; jitterMs: number }> {
    let dropped = 0, jitterMs = 0;
    try {
      (await this.pc?.getStats())?.forEach((s) => {
        if (s.type === "inbound-rtp" && s.kind === "video") { dropped = Number(s.framesDropped ?? 0); jitterMs = Math.round(Number(s.jitter ?? 0) * 1000); }
      });
    } catch { /* closed */ }
    return { dropped, jitterMs };
  }

  private hello() { this.channel?.postMessage({ t: "hello", outputId: this.outputId } satisfies OutputMessage); }

  private lose() {
    this.pc?.close();
    this.pc = null;
    this.hostId = null;
    this.pendingIce = [];
    this.cb.onState("lost"); // the page keeps the last valid frame on screen
    this.hello();
  }

  private async onMessage(msg: OutputMessage) {
    if (msg.t === "beat") { if (msg.hostId === this.hostId) this.beatAt = Date.now(); return; }
    if (msg.t === "ready") {
      // a studio (re)started: take it if we are unserved or our current studio went silent
      if (!this.hostId) this.hello();
      else if (Date.now() - this.beatAt > BEAT_TIMEOUT_MS) this.lose();
      return;
    }
    if (msg.t === "bye" && msg.hostId && msg.hostId === this.hostId) { this.lose(); return; }
    if (msg.t === "offer" && msg.to === this.outputId) {
      if (this.hostId && this.hostId !== msg.hostId) return; // already served by another studio
      this.pc?.close();
      this.hostId = msg.hostId;
      this.beatAt = Date.now();
      this.cb.onState("connecting");
      const pc = new RTCPeerConnection({ iceServers: [] });
      this.pc = pc;
      // picture and sound arrive as separate tracks: one stream carries both to the <video>
      const stream = new MediaStream();
      pc.ontrack = (e) => { stream.getTracks().filter((t) => t.kind === e.track.kind).forEach((t) => stream.removeTrack(t)); stream.addTrack(e.track); this.cb.onStream(stream); };
      pc.onicecandidate = (e) => { if (e.candidate && this.hostId) this.channel?.postMessage({ t: "ice", hostId: this.hostId, from: this.outputId, candidate: e.candidate.toJSON() } satisfies OutputMessage); };
      pc.onconnectionstatechange = () => {
        if (pc !== this.pc) return;
        if (pc.connectionState === "connected") this.cb.onState("live");
        if (pc.connectionState === "failed" || pc.connectionState === "closed") this.lose();
        if (pc.connectionState === "disconnected") this.cb.onState("lost");
      };
      await pc.setRemoteDescription({ type: "offer", sdp: msg.sdp });
      for (const c of this.pendingIce.splice(0)) await pc.addIceCandidate(c).catch(() => undefined);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      this.channel?.postMessage({ t: "answer", hostId: msg.hostId, from: this.outputId, sdp: pc.localDescription?.sdp ?? answer.sdp ?? "" } satisfies OutputMessage);
      return;
    }
    if (msg.t === "ice" && msg.to === this.outputId && msg.hostId === this.hostId) {
      if (this.pc?.remoteDescription) await this.pc.addIceCandidate(msg.candidate).catch(() => undefined);
      else this.pendingIce.push(msg.candidate);
    }
  }
}
