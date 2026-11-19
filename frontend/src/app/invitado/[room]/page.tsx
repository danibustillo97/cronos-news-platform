"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import type { MediaConnection, Peer } from "peerjs";
import { hostPeerId } from "@/components/admin/Broadcaster/guestLink";

type Status = "idle" | "calling" | "live" | "error";

export default function GuestPage() {
  const { room } = useParams<{ room: string }>();
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const peerRef = useRef<Peer | null>(null);
  const callRef = useRef<MediaConnection | null>(null);

  const leave = useCallback(() => {
    callRef.current?.close();
    peerRef.current?.destroy();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    callRef.current = null;
    peerRef.current = null;
    streamRef.current = null;
    setStatus("idle");
  }, []);

  useEffect(() => leave, [leave]);

  const join = async () => {
    try {
      setMessage("");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      const { Peer } = await import("peerjs");
      const peer = new Peer();
      peerRef.current = peer;
      setStatus("calling");
      peer.on("open", () => {
        const call = peer.call(hostPeerId(room), stream, { metadata: { name: name.trim() || "Invitado" } });
        callRef.current = call;
        call.on("stream", () => setStatus("live"));
        call.on("close", () => { setStatus("error"); setMessage("La producción cerró la llamada."); });
        call.on("error", () => { setStatus("error"); setMessage("No se pudo conectar con la producción."); });
      });
      peer.on("error", (error) => {
        setStatus("error");
        setMessage(error.type === "peer-unavailable" ? "La producción aún no está esperando invitados." : "Error de conexión.");
      });
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "No se pudo acceder a la cámara o micrófono.");
    }
  };

  const toggle = (kind: "audio" | "video") => {
    const tracks = kind === "audio" ? streamRef.current?.getAudioTracks() : streamRef.current?.getVideoTracks();
    tracks?.forEach((track) => { track.enabled = !track.enabled; });
    if (kind === "audio") setMuted((value) => !value);
    else setCameraOff((value) => !value);
  };

  const connected = status === "calling" || status === "live";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-5 bg-[#080b10] p-4 text-white">
      <div className="text-center">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-yellow-300">NEXUS SPORT STUDIO</p>
        <h1 className="mt-1 text-xl font-semibold">Estás invitado a la transmisión</h1>
      </div>
      <div className="relative aspect-video w-full max-w-xl overflow-hidden rounded-xl border border-white/10 bg-black">
        <video ref={videoRef} autoPlay muted playsInline className="h-full w-full -scale-x-100 object-cover" />
        {status === "live" && <span className="absolute left-3 top-3 rounded bg-emerald-500 px-2 py-1 text-[10px] font-bold text-black">CONECTADO</span>}
        {status === "calling" && <span className="absolute left-3 top-3 rounded bg-yellow-300 px-2 py-1 text-[10px] font-bold text-black">CONECTANDO…</span>}
      </div>
      {!connected && (
        <div className="flex w-full max-w-xl gap-2">
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Tu nombre" className="h-11 min-w-0 flex-1 rounded-lg border border-white/10 bg-[#11161e] px-3 text-sm outline-none" />
          <button type="button" onClick={() => void join()} className="rounded-lg bg-yellow-300 px-5 text-sm font-bold text-black hover:bg-yellow-200">Unirme</button>
        </div>
      )}
      {connected && (
        <div className="flex gap-2">
          <button type="button" onClick={() => toggle("audio")} className={`rounded-lg px-4 py-2 text-sm ${muted ? "bg-red-500" : "bg-white/10"}`}>{muted ? "Micrófono apagado" : "Micrófono"}</button>
          <button type="button" onClick={() => toggle("video")} className={`rounded-lg px-4 py-2 text-sm ${cameraOff ? "bg-red-500" : "bg-white/10"}`}>{cameraOff ? "Cámara apagada" : "Cámara"}</button>
          <button type="button" onClick={leave} className="rounded-lg border border-red-400/40 px-4 py-2 text-sm text-red-300">Salir</button>
        </div>
      )}
      {message && <p className="text-sm text-red-300">{message}</p>}
    </main>
  );
}
