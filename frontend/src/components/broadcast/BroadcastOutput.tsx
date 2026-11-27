"use client";

// /broadcast/output — the final renderer of the show. Shows ONLY what is on air: the
// Program of the broadcaster (same compositor, same scenes, graphics, transitions and
// audio mix), received from the operator tab over a local link (see programOutput.ts).
//
// - Always a 16:9 stage (1920×1080 source) scaled to the window, black outside it; no scroll.
// - Before any studio connects: a NEXUS SPORT standby slate.
// - If the studio tab reloads or drops: the last valid frame stays frozen on screen while
//   it reconnects by itself; the audience never sees a black hole or an error.
// - Audio: browsers block sound until a click on the page. The output tries; if blocked
//   it plays muted and shows a small hint until the operator clicks once (before going live).
// - Keys (operator only, nothing is shown on air): M mute · ↑/↓ volume · F fullscreen · S stats.

import { useEffect, useRef, useState } from "react";
import { fpsOf, ProgramOutputClient, type OutputStats } from "@/components/admin/Broadcaster/engine/programOutput";

type LinkState = "waiting" | "connecting" | "live" | "lost";

export default function BroadcastOutput() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const holdRef = useRef<HTMLCanvasElement>(null);
  const clientRef = useRef<ProgramOutputClient | null>(null);
  const [state, setState] = useState<LinkState>("waiting");
  const [everLive, setEverLive] = useState(false);
  const [holding, setHolding] = useState(false);
  const [audio, setAudio] = useState<OutputStats["audio"]>("none");
  const [showStats, setShowStats] = useState(false);
  const [stats, setStats] = useState<OutputStats | null>(null);
  const [cursor, setCursor] = useState(true);
  const audioRef = useRef(audio);
  audioRef.current = audio;

  // no page chrome: nothing may scroll or peek out of the capture
  useEffect(() => {
    const html = document.documentElement, body = document.body;
    const prev = [html.style.overflow, body.style.overflow, body.style.background];
    html.style.overflow = body.style.overflow = "hidden";
    body.style.background = "#000";
    if (new URLSearchParams(window.location.search).get("stats") === "1") setShowStats(true);
    return () => { [html.style.overflow, body.style.overflow, body.style.background] = prev; };
  }, []);

  const play = async (video: HTMLVideoElement) => {
    const hasAudio = (video.srcObject as MediaStream | null)?.getAudioTracks().length;
    if (!hasAudio) { video.muted = true; setAudio("none"); await video.play().catch(() => undefined); return; }
    try {
      video.muted = false;
      await video.play();
      setAudio("on");
    } catch {
      video.muted = true; // autoplay policy: picture now, sound after one click
      setAudio("blocked");
      await video.play().catch(() => undefined);
    }
  };

  // freeze the last frame (kept during interruptions)
  const hold = () => {
    const video = videoRef.current, canvas = holdRef.current;
    if (!video || !canvas || !video.videoWidth) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    setHolding(true);
  };

  useEffect(() => {
    const client = new ProgramOutputClient({
      onStream: (stream) => {
        const video = videoRef.current;
        if (!video) return;
        if (video.srcObject !== stream) video.srcObject = stream;
        stream.onaddtrack = () => void play(video);
        void play(video);
      },
      onState: (next) => {
        if (next === "lost") hold();
        if (next === "live") setEverLive(true);
        setState(next);
      },
    });
    clientRef.current = client;
    client.start();
    return () => { client.stop(); clientRef.current = null; };
  }, []);

  // un-freeze only once the new signal is really presenting frames
  useEffect(() => {
    const video = videoRef.current;
    if (!video || state !== "live") return;
    const release = () => setHolding(false);
    if ("requestVideoFrameCallback" in video) {
      const id = video.requestVideoFrameCallback(release);
      return () => video.cancelVideoFrameCallback(id);
    }
    const t = window.setTimeout(release, 500);
    return () => window.clearTimeout(t);
  }, [state]);

  // real measured performance, reported to the studio (and shown here only with S)
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !("requestVideoFrameCallback" in video)) return;
    const times: number[] = [];
    let id = 0;
    const onFrame = (now: number) => {
      times.push(now);
      if (times.length > 120) times.splice(0, times.length - 120);
      id = video.requestVideoFrameCallback(onFrame);
    };
    id = video.requestVideoFrameCallback(onFrame);
    const started = performance.now();
    const timer = window.setInterval(async () => {
      const client = clientRef.current;
      if (!client) return;
      const { dropped, jitterMs } = await client.inbound();
      const mem = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
      const lastAge = times.length ? performance.now() - times[times.length - 1] : Infinity;
      const s: OutputStats = {
        // a frozen signal is 0 fps, not the last average
        fps: lastAge > 1500 ? 0 : fpsOf(times),
        width: video.videoWidth, height: video.videoHeight, dropped, jitterMs,
        memoryMb: mem ? Math.round(mem.usedJSHeapSize / 1048576) : null,
        audio: audioRef.current,
        uptimeS: Math.round((performance.now() - started) / 1000),
      };
      setStats(s);
      client.report(s);
    }, 2000);
    return () => { video.cancelVideoFrameCallback(id); window.clearInterval(timer); };
  }, []);

  // operator keys + one click to enable sound; the cursor hides itself
  useEffect(() => {
    let idle = 0;
    const wake = () => { setCursor(true); window.clearTimeout(idle); idle = window.setTimeout(() => setCursor(false), 2000); };
    const unlock = () => {
      const video = videoRef.current;
      if (video && audioRef.current === "blocked") void play(video);
    };
    const onKey = (e: KeyboardEvent) => {
      const video = videoRef.current;
      if (!video) return;
      const k = e.key.toLowerCase();
      if (k === "m") {
        if (audioRef.current === "blocked") { void play(video); return; }
        video.muted = !video.muted;
        setAudio(video.muted ? "muted" : "on");
      } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        video.volume = Math.max(0, Math.min(1, Math.round((video.volume + (e.key === "ArrowUp" ? 0.1 : -0.1)) * 10) / 10));
      } else if (k === "f") {
        if (document.fullscreenElement) void document.exitFullscreen(); else void document.documentElement.requestFullscreen().catch(() => undefined);
      } else if (k === "s") setShowStats((v) => !v);
    };
    wake();
    window.addEventListener("mousemove", wake);
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", onKey);
    return () => { window.clearTimeout(idle); window.removeEventListener("mousemove", wake); window.removeEventListener("pointerdown", unlock); window.removeEventListener("keydown", onKey); };
  }, []);

  const standby = !everLive;

  return (
    <main
      className="fixed inset-0 flex items-center justify-center overflow-hidden bg-black"
      style={{ cursor: cursor ? "default" : "none" }}
      aria-label="Salida de emisión NEXUS SPORT"
    >
      <div className="relative overflow-hidden bg-black" style={{ width: "min(100vw, 177.7778vh)", height: "min(56.25vw, 100vh)" }}>
        <video ref={videoRef} playsInline autoPlay muted className="absolute inset-0 h-full w-full object-contain" />
        <canvas ref={holdRef} className="absolute inset-0 h-full w-full object-contain" style={{ opacity: holding ? 1 : 0 }} />
        {standby && <Standby />}
      </div>

      {audio === "blocked" && !standby && (
        <button type="button" onClick={() => videoRef.current && void play(videoRef.current)}
          className="absolute bottom-3 right-3 rounded-md bg-black/70 px-3 py-1.5 text-xs font-semibold text-white/80 ring-1 ring-white/20">
          Clic para activar el audio de la salida
        </button>
      )}
      {showStats && <StatsPanel state={state} stats={stats} holding={holding} />}
    </main>
  );
}

function Standby() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center"
      style={{ background: "radial-gradient(ellipse at 50% 40%, #1a1a1a 0%, #050505 70%)" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/nexus-symbol.svg" alt="" className="rounded-[18%]" style={{ width: "7.5%" }} />
      <div className="mt-[2%] font-black tracking-tight text-white" style={{ fontSize: "min(5.2vw, 9.2vh)", lineHeight: 1 }}>
        NEXUS <span style={{ color: "#f5c518" }}>SPORT</span>
      </div>
      <div className="mt-[1.4%] font-semibold uppercase text-white/60" style={{ fontSize: "min(1.5vw, 2.6vh)", letterSpacing: "0.3em" }}>
        La transmisión comienza en breve
      </div>
    </div>
  );
}

function StatsPanel({ state, stats, holding }: { state: LinkState; stats: OutputStats | null; holding: boolean }) {
  const label: Record<LinkState, string> = { waiting: "Esperando estudio", connecting: "Conectando", live: "Señal en vivo", lost: "Reconectando (último cuadro)" };
  return (
    <div className="absolute left-3 top-3 rounded-md bg-black/80 px-3 py-2 font-mono text-[11px] leading-5 text-white/90 ring-1 ring-white/15">
      <div>{label[state]}{holding ? " · congelado" : ""}</div>
      {stats && (
        <>
          <div>{stats.fps} fps · {stats.width}×{stats.height}</div>
          <div>caídos {stats.dropped} · jitter {stats.jitterMs} ms</div>
          <div>audio {stats.audio} · mem {stats.memoryMb ?? "—"} MB · {Math.floor(stats.uptimeS / 60)} min</div>
        </>
      )}
      <div className="text-white/50">S oculta · M audio · F pantalla completa</div>
    </div>
  );
}
