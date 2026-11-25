"use client";

// Ready-made templates under the program monitor: one click mounts the scene on
// air (scoreboard, multi, preview, debate, half time...). Each shows a real thumbnail.

import { Camera, Eraser, Layers } from "lucide-react";
import type { GraphicVariant } from "../graphicExport";
import type { FootballMatchController } from "./useFootballMatch";
import { renderFootballDesign } from "./designs";
import { drawBackground, type BackgroundTheme } from "./backgrounds";

type Persist = (variant: GraphicVariant, options?: { title?: string; subtitle?: string }) => void;

interface Props {
  fm: FootballMatchController;
  onPersist: Persist;
  onClear: () => void;
  onBackground: (blob: Blob, name: string) => void;
  onCamera: () => void;
  onDebate: () => void;
}

function Thumb({ variant, fm, title = "" }: { variant: GraphicVariant; fm: FootballMatchController; title?: string }) {
  const d = renderFootballDesign(variant, fm.match, title, "");
  const scale = Math.min(112 / d.width, 62 / d.height);
  return (
    <div className="relative h-[72px] w-full overflow-hidden rounded-lg bg-[radial-gradient(120%_120%_at_20%_0%,#1d4f2c,#0b2414)]">
      <div className="absolute left-1/2 top-1/2 origin-center" style={{ width: d.width, transform: `translate(-50%,-50%) scale(${scale})` }} dangerouslySetInnerHTML={{ __html: d.html }} />
    </div>
  );
}

function themeFor(league?: string): BackgroundTheme {
  if (league === "uefa.champions") return "champions";
  if (league === "conmebol.libertadores") return "libertadores";
  if (league === "col.1") return "betplay";
  if (league === "eng.1") return "premier";
  return "jornada";
}

export function TemplateBar({ fm, onPersist, onClear, onBackground, onCamera, onDebate }: Props) {
  const league = fm.fixture?.league;
  const bg = async (t: BackgroundTheme, name: string) => onBackground(await drawBackground(t), name);
  const templates: { id: string; label: string; hint: string; thumb: GraphicVariant; title?: string; run: () => void }[] = [
    { id: "board", label: "Marcador", hint: "Marcador Pro de la competición", thumb: "pro", run: () => onPersist("pro") },
    { id: "multi", label: "Multipantalla", hint: "Todos los partidos en pantalla", thumb: "multi", title: "Resultados en vivo", run: () => { onPersist("multi", { title: "Resultados en vivo" }); onPersist("pro"); } },
    { id: "preview", label: "Previa", hint: "Fondo + previa + marcador", thumb: "prematch", run: () => { void bg(themeFor(league), "Fondo de la competición"); onPersist("prematch"); } },
    { id: "debate", label: "Debate en vivo", hint: "Votación del partido al aire", thumb: "poll", run: () => { void bg("debate", "Fondo debate"); onDebate(); } },
    { id: "half", label: "Entretiempo", hint: "Estadísticas + marcador", thumb: "stats", run: () => { void bg("entretiempo", "Fondo entretiempo"); onPersist("stats"); onPersist("pro"); } },
    { id: "lineups", label: "Alineaciones", hint: "Local y visitante", thumb: "lineup-home", run: () => { onPersist("lineup-home"); onPersist("lineup-away"); } },
  ];
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#0f141c] p-2.5">
      <div className="mb-2 flex items-center gap-2">
        <Layers size={14} className="text-yellow-300" />
        <p className="text-[12px] font-bold text-white">Plantillas listas · un clic y sale al aire</p>
        <div className="ml-auto flex gap-1.5">
          <button type="button" onClick={onCamera} className="inline-flex items-center gap-1 rounded-lg border border-white/15 px-2.5 py-1.5 text-[11px] font-semibold text-neutral-200 hover:border-white/40"><Camera size={12} /> Mi cámara</button>
          <button type="button" onClick={onClear} className="inline-flex items-center gap-1 rounded-lg border border-white/15 px-2.5 py-1.5 text-[11px] font-semibold text-neutral-200 hover:border-red-400/60 hover:text-red-200"><Eraser size={12} /> Limpiar pantalla</button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 2xl:grid-cols-6">
        {templates.map((t) => (
          <button key={t.id} type="button" onClick={t.run} className="group rounded-xl border border-white/[0.08] bg-white/[0.02] p-1.5 text-left transition hover:border-yellow-400/60 hover:bg-yellow-400/[0.05]">
            <Thumb variant={t.thumb} fm={fm} title={t.title} />
            <span className="mt-1.5 block px-0.5 text-[12px] font-bold text-white">{t.label}</span>
            <span className="block px-0.5 text-[10.5px] leading-tight text-neutral-500">{t.hint}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
