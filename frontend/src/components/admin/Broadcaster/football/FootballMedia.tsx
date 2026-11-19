"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, Crop, ImageIcon, Mic, Monitor, Play, Square, Trash2, Upload, Video, X } from "lucide-react";
import type { MediaCategory, MediaItem } from "./mediaLibrary";

type Layout = "auto" | "single" | "split" | "triple" | "pip";

interface SourceChip {
  id: string;
  name: string;
  kind: string;
}

interface Props {
  sources: SourceChip[];
  sceneInputIds: string[];
  layout: Layout;
  backgroundItemId: string | null;
  promoItemId: string | null;
  library: MediaItem[];
  onUpload: (files: FileList, category: MediaCategory) => void;
  onDeleteItem: (id: string) => void;
  onPromo: (item: MediaItem) => void;
  onStopPromo: () => void;
  onBackground: (item: MediaItem) => void;
  onToggleSource: (id: string) => void;
  onLayout: (layout: Layout) => void;
  onConnectCamera: () => void;
  onConnectMic: () => void;
  onConnectScreen: () => void;
  onCrop?: (id: string) => void;
  croppedIds?: string[];
}

const LAYOUTS: Array<[Layout, string]> = [["auto", "Auto"], ["single", "1"], ["split", "2"], ["triple", "3"], ["pip", "PiP"]];
const chip = "rounded-md border px-2 py-1.5 text-[10px] font-semibold transition";

function Thumb({ item }: { item: MediaItem }) {
  const url = useMemo(() => URL.createObjectURL(item.blob), [item.blob]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return item.kind === "image"
    ? <img src={url} alt="" className="h-full w-full object-cover" />
    : <video src={url} muted preload="metadata" className="h-full w-full object-cover" />;
}

export function FootballMedia({ sources, sceneInputIds, layout, backgroundItemId, promoItemId, library, onUpload, onDeleteItem, onPromo, onStopPromo, onBackground, onToggleSource, onLayout, onConnectCamera, onConnectMic, onConnectScreen, onCrop, croppedIds = [] }: Props) {
  const [category, setCategory] = useState<MediaCategory | "todos">("todos");
  const [uploadAs, setUploadAs] = useState<MediaCategory>("promo");
  const fileRef = useRef<HTMLInputElement>(null);
  const shown = library.filter((item) => category === "todos" || item.category === category);

  return (
    <section aria-label="Composición y biblioteca" className="grid flex-none grid-cols-1 gap-2 border-t border-white/[0.08] bg-[#0b0f15] p-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
      <div className="rounded-xl border border-white/[0.08] bg-[#11161e] p-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[9px] font-bold uppercase tracking-widest text-neutral-500">Fuentes de la escena</span>
          <span className="ml-auto flex gap-1">
            <button type="button" onClick={onConnectCamera} className={`${chip} inline-flex items-center gap-1 border-white/10 text-neutral-200 hover:bg-white/10`}><Camera size={11} /> Cámara</button>
            <button type="button" onClick={onConnectMic} className={`${chip} inline-flex items-center gap-1 border-white/10 text-neutral-200 hover:bg-white/10`}><Mic size={11} /> Mic</button>
            <button type="button" onClick={onConnectScreen} className={`${chip} inline-flex items-center gap-1 border-white/10 text-neutral-200 hover:bg-white/10`}><Monitor size={11} /> Pantalla</button>
          </span>
        </div>
        <div className="mt-2 flex min-h-[28px] flex-wrap gap-1">
          {sources.length === 0 && <span className="text-[10px] text-neutral-600">Sin fuentes: conecta una cámara o sube un video.</span>}
          {sources.map((source) => {
            const on = sceneInputIds.includes(source.id);
            return (
              <span key={source.id} className="inline-flex">
                <button type="button" onClick={() => onToggleSource(source.id)} title={on ? "Quitar de la escena en Preview" : "Añadir a la escena en Preview"} className={`${chip} max-w-[150px] truncate ${onCrop && source.kind !== "audio" ? "rounded-r-none" : ""} ${on ? "border-yellow-300/60 bg-yellow-300/15 text-yellow-100" : "border-white/10 text-neutral-400 hover:text-white"}`}>
                  {on ? "✓ " : "+ "}{source.name}
                </button>
                {onCrop && source.kind !== "audio" && (
                  <button type="button" onClick={() => onCrop(source.id)} title="Recortar y encuadrar" aria-label={`Recortar ${source.name}`} className={`rounded-md rounded-l-none border border-l-0 px-1.5 ${croppedIds.includes(source.id) ? "border-yellow-300/60 bg-yellow-300/20 text-yellow-200" : "border-white/10 text-neutral-400 hover:text-yellow-200"}`}><Crop size={11} /></button>
                )}
              </span>
            );
          })}
        </div>
        <div className="mt-2 flex items-center gap-1">
          <span className="mr-1 text-[9px] font-bold uppercase tracking-widest text-neutral-500">Composición</span>
          {LAYOUTS.map(([id, label]) => (
            <button key={id} type="button" onClick={() => onLayout(id)} className={`${chip} ${layout === id ? "border-yellow-300 bg-yellow-300/20 text-yellow-100" : "border-white/10 text-neutral-400 hover:text-white"}`}>{label}</button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-white/[0.08] bg-[#11161e] p-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[9px] font-bold uppercase tracking-widest text-neutral-500">Biblioteca · promos y fondos</span>
          {(["todos", "promo", "fondo"] as const).map((id) => (
            <button key={id} type="button" onClick={() => setCategory(id)} className={`${chip} ${category === id ? "border-yellow-300 bg-yellow-300/20 text-yellow-100" : "border-white/10 text-neutral-400 hover:text-white"}`}>{id === "todos" ? "Todo" : id === "promo" ? "Promos" : "Fondos"}</button>
          ))}
          <span className="ml-auto flex items-center gap-1">
            <select aria-label="Categoría al subir" value={uploadAs} onChange={(event) => setUploadAs(event.target.value as MediaCategory)} className="h-7 rounded-md border border-white/10 bg-[#0a0d12] px-1 text-[10px] text-neutral-200 outline-none">
              <option value="promo">como Promo</option>
              <option value="fondo">como Fondo</option>
            </select>
            <button type="button" onClick={() => fileRef.current?.click()} className={`${chip} inline-flex items-center gap-1 border-yellow-300/50 bg-yellow-300/15 text-yellow-100 hover:bg-yellow-300/25`}><Upload size={11} /> Subir</button>
            <input ref={fileRef} type="file" accept="video/*,image/*" multiple hidden onChange={(event) => { if (event.target.files?.length) onUpload(event.target.files, uploadAs); event.target.value = ""; }} />
          </span>
        </div>
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
          {shown.length === 0 && <span className="py-3 text-[10px] text-neutral-600">La biblioteca está vacía. Sube tus promociones, patrocinadores y fondos: quedan guardados en este equipo.</span>}
          {shown.map((item) => (
            <div key={item.id} className={`w-[112px] flex-none overflow-hidden rounded-lg border bg-[#0a0d12] ${promoItemId === item.id ? "border-yellow-400" : backgroundItemId === item.id ? "border-yellow-300" : "border-white/10"}`}>
              <div className="relative aspect-video bg-black">
                <Thumb item={item} />
                <span className="absolute left-1 top-1 rounded bg-black/70 px-1 text-[8px] font-bold uppercase text-white/80">{item.kind === "video" ? <Video size={9} className="inline" /> : <ImageIcon size={9} className="inline" />} {item.category}</span>
                <button type="button" onClick={() => onDeleteItem(item.id)} aria-label={`Eliminar ${item.name}`} className="absolute right-1 top-1 rounded bg-black/70 p-0.5 text-white/70 hover:text-yellow-300"><Trash2 size={10} /></button>
              </div>
              <p className="truncate px-1.5 pt-1 text-[10px] text-neutral-300">{item.name}</p>
              <div className="grid grid-cols-2 gap-1 p-1">
                {promoItemId === item.id
                  ? <button type="button" onClick={onStopPromo} className="inline-flex items-center justify-center gap-1 rounded bg-yellow-300 py-1 text-[10px] font-bold text-black"><Square size={9} /> Quitar</button>
                  : <button type="button" onClick={() => onPromo(item)} className="inline-flex items-center justify-center gap-1 rounded bg-yellow-300 py-0.5 text-[10px] font-bold text-black hover:bg-yellow-200"><Play size={9} /> Al aire</button>}
                <button type="button" onClick={() => onBackground(item)} className={`inline-flex items-center justify-center gap-1 rounded py-0.5 text-[10px] font-bold ${backgroundItemId === item.id ? "bg-yellow-300 text-black" : "border border-white/10 text-neutral-200 hover:bg-white/10"}`}>{backgroundItemId === item.id ? <><X size={9} /> Fondo</> : "Fondo"}</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
