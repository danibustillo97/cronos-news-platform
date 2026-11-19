"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Save, Trash2 } from "lucide-react";
import type { BroadcastGraphic, DesignStyle, GraphicVariant } from "../graphicExport";
import { FOOTBALL_VARIANT_LABEL } from "./designs";

export interface WidgetLook {
  id: string;
  name: string;
  variant: GraphicVariant;
  style: DesignStyle;
  scale: number;
  position: { x: number; y: number };
}

export interface AddOptions {
  style?: DesignStyle;
  scale?: number;
  position?: { x: number; y: number };
  name?: string;
}

interface Props {
  graphics: BroadcastGraphic[];
  defaults: { accent: string; home: string; away: string };
  onUpdate: (graphicId: string, patch: Partial<BroadcastGraphic>) => void;
  onAddWidget: (variant: GraphicVariant, options?: AddOptions) => void;
}

const STORAGE_KEY = "nexus-football-looks-v1";
const hex = (value: string | undefined, fallback: string) => (/^#[0-9a-f]{6}$/i.test(value ?? "") ? (value as string) : fallback);
const label = "text-[10px] font-semibold uppercase tracking-widest text-neutral-500";

export function WidgetBuilder({ graphics, defaults, onUpdate, onAddWidget }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [looks, setLooks] = useState<WidgetLook[]>([]);
  const [lookName, setLookName] = useState("");

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
      if (Array.isArray(saved)) setLooks(saved);
    } catch { /* sin composiciones guardadas */ }
  }, []);

  const persist = (next: WidgetLook[]) => {
    setLooks(next);
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { toast.error("No se pudo guardar en este navegador"); }
  };

  const graphic = graphics.find((item) => item.id === selectedId) ?? graphics[graphics.length - 1];
  const style = graphic?.style ?? {};
  const patchStyle = (changes: Partial<DesignStyle>) => graphic && onUpdate(graphic.id, { style: { ...style, ...changes } });
  const position = graphic?.position ?? { x: 5, y: 5 };

  const saveLook = () => {
    if (!graphic?.variant) return;
    const name = lookName.trim() || `${FOOTBALL_VARIANT_LABEL[graphic.variant] ?? graphic.variant} personalizado`;
    persist([...looks, { id: `look-${Date.now()}`, name, variant: graphic.variant, style, scale: graphic.scale ?? 1, position }]);
    setLookName("");
    toast.success("Composición guardada", { description: name });
  };

  return (
    <div className="space-y-2 rounded-xl border border-yellow-300/20 bg-[#141a22] p-2.5">
      <p className="text-[10px] font-bold uppercase tracking-widest text-yellow-300">Constructor de widgets</p>
      {!graphic ? (
        <p className="text-[10px] text-neutral-500">Añade un widget arriba y edítalo aquí: colores, elementos, tamaño y posición.</p>
      ) : (
        <>
          <select aria-label="Widget a editar" value={graphic.id} onChange={(event) => setSelectedId(event.target.value)} className="h-8 w-full rounded-md border border-white/10 bg-[#0a0d12] px-2 text-[11px] text-white outline-none">
            {graphics.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <div className="grid grid-cols-3 gap-2">
            {([["Acento", "accent", defaults.accent], ["Local", "homeColor", defaults.home], ["Visita", "awayColor", defaults.away]] as const).map(([text, field, fallback]) => (
              <label key={field} className="flex flex-col gap-1">
                <span className={label}>{text}</span>
                <input type="color" value={hex(style[field], fallback)} onChange={(event) => patchStyle({ [field]: event.target.value })} className="h-7 w-full cursor-pointer rounded border border-white/10 bg-transparent" />
              </label>
            ))}
          </div>
          <div className="flex gap-3 text-[10px] text-neutral-300">
            <label className="flex items-center gap-1"><input type="checkbox" checked={style.showCards !== false} onChange={(event) => patchStyle({ showCards: event.target.checked })} className="accent-yellow-300" /> Tarjetas</label>
            <label className="flex items-center gap-1"><input type="checkbox" checked={style.showCompetition !== false} onChange={(event) => patchStyle({ showCompetition: event.target.checked })} className="accent-yellow-300" /> Competición</label>
            <button type="button" onClick={() => onUpdate(graphic.id, { style: undefined, scale: 1 })} className="ml-auto text-neutral-500 hover:text-white">Restablecer</button>
          </div>
          {([["Tamaño", 0.4, 1.4, 0.05, graphic.scale ?? 1, (value: number) => onUpdate(graphic.id, { scale: value })], ["Posición X", 0, 90, 1, position.x, (value: number) => onUpdate(graphic.id, { position: { ...position, x: value } })], ["Posición Y", 0, 95, 1, position.y, (value: number) => onUpdate(graphic.id, { position: { ...position, y: value } })]] as const).map(([text, min, max, step, value, apply]) => (
            <label key={text} className="flex items-center gap-2">
              <span className={`${label} w-16`}>{text}</span>
              <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => apply(Number(event.target.value))} className="h-1 flex-1 accent-yellow-300" />
              <span className="w-9 text-right text-[10px] tabular-nums text-neutral-400">{step < 1 ? value.toFixed(2) : `${value}%`}</span>
            </label>
          ))}
          <div className="flex gap-1.5">
            <input value={lookName} onChange={(event) => setLookName(event.target.value)} placeholder="Nombre de la composición" className="h-8 min-w-0 flex-1 rounded-md border border-white/10 bg-[#0a0d12] px-2 text-[11px] text-white outline-none" />
            <button type="button" onClick={saveLook} className="inline-flex items-center gap-1 rounded-md border border-yellow-300/40 bg-yellow-300/10 px-2.5 text-[10px] font-bold text-yellow-200 hover:bg-yellow-300/20"><Save size={12} />Guardar</button>
          </div>
        </>
      )}
      {looks.length > 0 && (
        <div className="space-y-1 border-t border-white/[0.06] pt-2">
          <p className={label}>Mis composiciones</p>
          {looks.map((look) => (
            <div key={look.id} className="flex items-center gap-1.5 rounded-md bg-black/25 px-2 py-1.5">
              <span className="h-3 w-3 rounded-full" style={{ background: look.style.accent ?? defaults.accent }} />
              <span className="min-w-0 flex-1 truncate text-[10px] text-neutral-200">{look.name}<i className="ml-1 not-italic text-neutral-600">{FOOTBALL_VARIANT_LABEL[look.variant]}</i></span>
              <button type="button" onClick={() => onAddWidget(look.variant, { style: look.style, scale: look.scale, position: look.position, name: look.name })} className="rounded border border-emerald-400/30 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-200 hover:bg-emerald-400/10">Usar</button>
              <button type="button" onClick={() => persist(looks.filter((item) => item.id !== look.id))} aria-label={`Borrar ${look.name}`} className="p-1 text-neutral-500 hover:text-red-300"><Trash2 size={11} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
