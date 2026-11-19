"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Mic, MicOff, SlidersHorizontal, Volume2, VolumeX, X } from "lucide-react";
import { MIN_DB, useAudioLevels } from "./useAudioLevels";

export interface AudioBarInput {
  id: string;
  name: string;
  stream?: MediaStream;
  muted: boolean;
  volume: number;
  pan?: number;
}

interface Props {
  inputs: AudioBarInput[];
  programInputIds: string[];
  onUpdateInput: (inputId: string, updates: Partial<Pick<AudioBarInput, "muted" | "volume" | "pan">>) => void;
  masterVolume: number;
  onMasterVolume: (value: number) => void;
}

const TICKS = [-60, -40, -30, -20, -12, -6, 0];
const pct = (db: number) => Math.min(100, Math.max(0, ((db - MIN_DB) / -MIN_DB) * 100));
const gainDb = (volume: number) => (volume > 0 ? 20 * Math.log10(volume) : MIN_DB);

function Bar({ label, db, peak, off, hot }: { label: string; db: number; peak: number; off?: boolean; hot?: boolean }) {
  const shown = off ? MIN_DB : db;
  const readout = shown <= MIN_DB ? "−∞" : shown.toFixed(1);
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-11 flex-shrink-0 text-[9px] font-black uppercase tracking-wider text-neutral-300">{label}</span>
      <div className="relative h-2.5 flex-1 overflow-hidden rounded-[2px] bg-black/80">
        <div className="absolute inset-0 transition-[clip-path] duration-75" style={{ background: "linear-gradient(90deg,#16a34a 0 70%,#eab308 70% 90%,#ef4444 90% 100%)", clipPath: `inset(0 ${100 - pct(shown)}% 0 0)` }} />
        <div className="absolute inset-0 opacity-60" style={{ background: "repeating-linear-gradient(90deg,transparent 0 3px,#05070b 3px 4px)" }} />
        {TICKS.map((tick) => <span key={tick} className="absolute inset-y-0 w-px bg-white/25" style={{ left: `${pct(tick)}%` }} />)}
        {!off && peak > MIN_DB && <span className="absolute inset-y-0 w-0.5 bg-white" style={{ left: `${pct(peak)}%` }} />}
      </div>
      <span className={`w-11 flex-shrink-0 text-right text-[10px] font-bold tabular-nums ${hot ? "text-red-400" : "text-neutral-200"}`}>{readout}<span className="text-[8px] font-normal text-neutral-500"> dB</span></span>
    </div>
  );
}

const fmtDb = (volume: number) => (volume <= 0 ? "−∞" : `${(20 * Math.log10(volume)).toFixed(1)} dB`);
const panLabel = (pan: number) => (Math.abs(pan) < 0.05 ? "C" : pan < 0 ? `L${Math.round(-pan * 100)}` : `R${Math.round(pan * 100)}`);

function MixerPanel({ inputs, programInputIds, levels, onUpdateInput, masterVolume, onMasterVolume, onClose }: Props & { levels: ReturnType<typeof useAudioLevels>; onClose: () => void }) {
  return (
    <div role="dialog" aria-label="Mezcla de audio" className="absolute bottom-full left-0 z-50 mb-2 w-[360px] rounded-xl border border-white/10 bg-[#0b0e14] p-3 shadow-2xl shadow-black/70">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-yellow-300">Mezcla de audio</span>
        <button type="button" onClick={onClose} aria-label="Cerrar mezcla" className="rounded p-1 text-neutral-400 hover:bg-white/10 hover:text-white"><X size={12} /></button>
      </div>
      <div className="mb-2 rounded-lg border border-yellow-300/20 bg-yellow-300/[0.05] p-2">
        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-neutral-200"><span>Salida maestra</span><span className="tabular-nums text-yellow-200">{fmtDb(masterVolume)}</span></div>
        <input type="range" min={0} max={1.5} step={0.01} value={masterVolume} onChange={(event) => onMasterVolume(Number(event.target.value))} onDoubleClick={() => onMasterVolume(1)} aria-label="Volumen maestro" className="mt-1 w-full accent-yellow-300" />
      </div>
      <div className="max-h-[260px] space-y-2 overflow-y-auto pr-0.5" style={{ scrollbarWidth: "thin" }}>
        {inputs.length === 0 && <p className="py-3 text-center text-[11px] text-neutral-500">Sin fuentes de audio. Conecta un micrófono o cámara en Fuentes.</p>}
        {inputs.map((input) => {
          const inProgram = programInputIds.includes(input.id);
          const level = levels[input.id];
          const db = level ? level.db + (input.volume > 0 ? 20 * Math.log10(input.volume) : MIN_DB) : MIN_DB;
          return (
            <div key={input.id} className={`rounded-lg border p-2 ${inProgram ? "border-emerald-400/25 bg-white/[0.04]" : "border-white/[0.06] bg-white/[0.02]"}`}>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => onUpdateInput(input.id, { muted: !input.muted })} title={input.muted ? "Activar" : "Silenciar"} className={`rounded p-1 ${input.muted ? "bg-red-500/25 text-red-300" : "bg-white/[0.06] text-emerald-200"}`}>{input.muted ? <VolumeX size={12} /> : <Volume2 size={12} />}</button>
                <span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-neutral-100">{input.name}</span>
                <span className={`rounded px-1.5 py-0.5 text-[8px] font-black uppercase ${inProgram ? "bg-emerald-400/15 text-emerald-300" : "bg-white/[0.06] text-neutral-500"}`}>{inProgram ? "En Program" : "Fuera"}</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-sm bg-black/80"><div className="h-full w-full" style={{ background: "linear-gradient(90deg,#16a34a 0 70%,#eab308 70% 90%,#ef4444 90% 100%)", clipPath: `inset(0 ${100 - pct(input.muted ? MIN_DB : db)}% 0 0)` }} /></div>
              <div className="mt-1.5 grid grid-cols-[34px_1fr_48px] items-center gap-x-2 gap-y-1 text-[9px] uppercase tracking-wider text-neutral-500">
                <span>Nivel</span>
                <input type="range" min={0} max={1.5} step={0.01} value={input.volume} onChange={(event) => onUpdateInput(input.id, { volume: Number(event.target.value) })} onDoubleClick={() => onUpdateInput(input.id, { volume: 1 })} aria-label={`Volumen de ${input.name}`} className="accent-emerald-400" />
                <span className="text-right tabular-nums text-neutral-300">{fmtDb(input.volume)}</span>
                <span>Balance</span>
                <input type="range" min={-1} max={1} step={0.05} value={input.pan ?? 0} onChange={(event) => onUpdateInput(input.id, { pan: Number(event.target.value) })} onDoubleClick={() => onUpdateInput(input.id, { pan: 0 })} aria-label={`Balance de ${input.name}`} className="accent-yellow-300" />
                <span className="text-right tabular-nums text-neutral-300">{panLabel(input.pan ?? 0)}</span>
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-[9px] text-neutral-600">Doble clic en un control para restablecerlo. Los cambios se aplican a la salida en vivo.</p>
    </div>
  );
}

export function AudioBar({ inputs, programInputIds, onUpdateInput, masterVolume, onMasterVolume }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false); };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("pointerdown", onDown); window.removeEventListener("keydown", onKey); };
  }, [open]);
  const levels = useAudioLevels(inputs);
  const withAudio = inputs.filter((input) => input.stream?.getAudioTracks().length);
  const mic = withAudio.find((input) => !input.id.startsWith("guest-")) ?? withAudio[0];

  const master = useMemo(() => {
    let db = MIN_DB;
    let peak = MIN_DB;
    withAudio.forEach((input) => {
      const level = levels[input.id];
      if (!level || input.muted || !programInputIds.includes(input.id)) return;
      db = Math.max(db, level.db + gainDb(input.volume) + gainDb(masterVolume));
      peak = Math.max(peak, level.peakDb + gainDb(input.volume) + gainDb(masterVolume));
    });
    return { db, peak };
  }, [withAudio, levels, programInputIds, masterVolume]);

  const micLevel = mic ? levels[mic.id] : undefined;
  const micDb = mic && micLevel ? micLevel.db + gainDb(mic.volume) : MIN_DB;
  const micPeak = mic && micLevel ? micLevel.peakDb + gainDb(mic.volume) : MIN_DB;

  return (
    <div ref={rootRef} className="relative flex w-[300px] flex-shrink-0 items-center gap-2" aria-label="Medidores de audio">
      {open && <MixerPanel inputs={withAudio} programInputIds={programInputIds} levels={levels} onUpdateInput={onUpdateInput} masterVolume={masterVolume} onMasterVolume={onMasterVolume} onClose={() => setOpen(false)} />}
      {mic ? (
        <button type="button" onClick={() => onUpdateInput(mic.id, { muted: !mic.muted })} title={`${mic.muted ? "Activar" : "Silenciar"} ${mic.name}`} className={`rounded-md p-1.5 ${mic.muted ? "bg-red-500/25 text-red-300" : "bg-white/[0.06] text-emerald-200"}`}>{mic.muted ? <MicOff size={13} /> : <Mic size={13} />}</button>
      ) : (
        <span className="rounded-md bg-white/[0.04] p-1.5 text-neutral-600" title="Sin micrófono: conéctalo en Medios"><MicOff size={13} /></span>
      )}
      <div role="button" tabIndex={0} aria-expanded={open} aria-label="Abrir mezcla de audio" title="Clic para abrir la mezcla: niveles, balance y salida" onClick={() => setOpen((value) => !value)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setOpen((value) => !value); } }} className="group relative flex min-w-0 flex-1 cursor-pointer flex-col gap-1 rounded-md px-1 py-0.5 hover:bg-white/[0.05]">
        <SlidersHorizontal size={10} className="absolute -right-0.5 -top-2 text-neutral-600 group-hover:text-yellow-300" />
        <Bar label="Mic" db={micDb} peak={micPeak} off={!mic || mic.muted} hot={micPeak > -3} />
        <Bar label="Salida" db={master.db} peak={master.peak} hot={master.peak > -3} />
      </div>
    </div>
  );
}
