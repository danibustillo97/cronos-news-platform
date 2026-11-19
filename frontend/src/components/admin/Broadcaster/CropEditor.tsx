"use client";

import { useEffect, useRef, useState } from "react";
import { Crop, RotateCcw, ScanLine, X } from "lucide-react";

export interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Props {
  name: string;
  stream?: MediaStream;
  url?: string;
  kind: "camera" | "screen" | "video" | "image" | "audio";
  crop?: CropRect;
  onSave: (crop: CropRect | undefined) => void;
  onClose: () => void;
}

const clamp = (value: number) => Math.min(1, Math.max(0, value));

/** Finds the bounding box of the non-dark content (removes letterbox bars and empty margins). */
function detectContent(video: HTMLVideoElement): CropRect | null {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return null;
  const w = 320;
  const h = Math.max(1, Math.round((w * vh) / vw));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  context.drawImage(video, 0, 0, w, h);
  const { data } = context.getImageData(0, 0, w, h);
  const lit = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    return data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722 > 22;
  };
  const rowLit = (y: number) => { let n = 0; for (let x = 0; x < w; x += 1) if (lit(x, y)) n += 1; return n > w * 0.04; };
  const colLit = (x: number) => { let n = 0; for (let y = 0; y < h; y += 1) if (lit(x, y)) n += 1; return n > h * 0.04; };
  let top = 0; while (top < h && !rowLit(top)) top += 1;
  let bottom = h - 1; while (bottom > top && !rowLit(bottom)) bottom -= 1;
  let left = 0; while (left < w && !colLit(left)) left += 1;
  let right = w - 1; while (right > left && !colLit(right)) right -= 1;
  if (right - left < w * 0.1 || bottom - top < h * 0.1) return null;
  return { x: left / w, y: top / h, w: (right - left + 1) / w, h: (bottom - top + 1) / h };
}

export function CropEditor({ name, stream, url, kind, crop, onSave, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const [rect, setRect] = useState<CropRect | undefined>(crop);
  const [lock, setLock] = useState(true);
  const [message, setMessage] = useState("Arrastra sobre la imagen para elegir el área.");

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (stream) video.srcObject = stream;
    void video.play().catch(() => undefined);
  }, [stream]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const point = (event: React.PointerEvent) => {
    const box = stageRef.current?.getBoundingClientRect();
    if (!box) return { x: 0, y: 0 };
    return { x: clamp((event.clientX - box.left) / box.width), y: clamp((event.clientY - box.top) / box.height) };
  };

  const build = (a: { x: number; y: number }, b: { x: number; y: number }): CropRect => {
    const video = videoRef.current;
    const ratio = video?.videoWidth && video.videoHeight ? video.videoWidth / video.videoHeight : 16 / 9;
    let w = Math.abs(b.x - a.x);
    let h = Math.abs(b.y - a.y);
    if (lock) {
      h = (w * ratio) / (16 / 9);
      if (h > 1) { h = 1; w = (h * (16 / 9)) / ratio; }
    }
    const x = b.x >= a.x ? a.x : Math.max(0, a.x - w);
    const y = b.y >= a.y ? a.y : Math.max(0, a.y - h);
    return { x: Math.min(x, 1 - w), y: Math.min(y, 1 - h), w, h };
  };

  const down = (event: React.PointerEvent) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = point(event);
    setRect(undefined);
  };
  const move = (event: React.PointerEvent) => {
    if (!dragRef.current) return;
    setRect(build(dragRef.current, point(event)));
  };
  const up = () => {
    dragRef.current = null;
    setRect((current) => {
      if (current && (current.w < 0.04 || current.h < 0.04)) return undefined;
      if (current) setMessage("Área lista. Pulsa «Aplicar» para encuadrar y ajustar automáticamente.");
      return current;
    });
  };

  const auto = () => {
    const found = videoRef.current ? detectContent(videoRef.current) : null;
    if (found) { setRect(found); setMessage("Contenido detectado sin bordes negros. Puedes ajustarlo arrastrando de nuevo."); }
    else setMessage("No se detectó un área distinta; arrastra manualmente.");
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4" role="dialog" aria-label={`Recortar ${name}`}>
      <div className="flex max-h-full w-full max-w-4xl flex-col gap-3 rounded-2xl border border-yellow-300/20 bg-[#0b0e14] p-4 shadow-2xl">
        <div className="flex items-center gap-2">
          <Crop size={15} className="text-yellow-300" />
          <h3 className="min-w-0 flex-1 truncate text-sm font-bold text-white">Encuadre automático · {name}</h3>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="rounded p-1 text-neutral-400 hover:bg-white/10 hover:text-white"><X size={15} /></button>
        </div>
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-lg bg-black">
          <div ref={stageRef} onPointerDown={down} onPointerMove={move} onPointerUp={up} className="relative inline-block cursor-crosshair touch-none select-none">
            {kind === "image"
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={url} alt="" draggable={false} className="block max-h-[60vh] max-w-full" />
              : <video ref={videoRef} src={kind === "video" ? url : undefined} muted playsInline autoPlay loop className="pointer-events-none block max-h-[60vh] max-w-full" />}
            {rect && (
              <>
                <div className="pointer-events-none absolute inset-0 bg-black/55" style={{ clipPath: `polygon(0 0,100% 0,100% 100%,0 100%,0 0,${rect.x * 100}% ${rect.y * 100}%,${rect.x * 100}% ${(rect.y + rect.h) * 100}%,${(rect.x + rect.w) * 100}% ${(rect.y + rect.h) * 100}%,${(rect.x + rect.w) * 100}% ${rect.y * 100}%,${rect.x * 100}% ${rect.y * 100}%)` }} />
                <div className="pointer-events-none absolute border-2 border-yellow-300 shadow-[0_0_0_1px_rgba(0,0,0,.6)]" style={{ left: `${rect.x * 100}%`, top: `${rect.y * 100}%`, width: `${rect.w * 100}%`, height: `${rect.h * 100}%` }} />
              </>
            )}
          </div>
        </div>
        <p className="text-[11px] text-neutral-400">{message}</p>
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-1.5 text-[11px] text-neutral-300"><input type="checkbox" checked={lock} onChange={(event) => setLock(event.target.checked)} className="accent-yellow-300" /> Bloquear 16:9 (llena el cuadro sin deformar)</label>
          <span className="ml-auto flex flex-wrap gap-2">
            <button type="button" onClick={auto} disabled={kind === "image"} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-[11px] font-semibold text-neutral-200 hover:bg-white/10 disabled:opacity-40"><ScanLine size={13} /> Detectar contenido</button>
            <button type="button" onClick={() => { setRect(undefined); onSave(undefined); }} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-[11px] font-semibold text-neutral-200 hover:bg-white/10"><RotateCcw size={13} /> Sin recorte</button>
            <button type="button" disabled={!rect} onClick={() => onSave(rect)} className="rounded-lg bg-yellow-300 px-4 py-2 text-[11px] font-bold text-black hover:bg-yellow-200 disabled:opacity-40">Aplicar</button>
          </span>
        </div>
      </div>
    </div>
  );
}
