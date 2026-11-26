"use client";

// THE football studio. The program screen sits in the middle with the tools on
// each side, so everything is one tap away and visible:
//   left  : virtual sets (studio with your camera framed), complete scenes, backgrounds
//   center: PROGRAM (what goes on air)
//   right : graphics as ON/OFF switches + what is on air
//   below : Partidos / Datos tabs
// On phones the program stays on top and the tools become tabs.

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Camera, Check, Clapperboard, Eraser, Image as ImageIcon, Lock, Radio, Sparkles, ToggleRight, Unlock, Upload, X } from "lucide-react";
import type { GraphicVariant } from "../graphicExport";
import type { FootballMatchController } from "./useFootballMatch";
import { VIRTUAL_SETS, drawVirtualSet, type SetTheme, type VirtualSet } from "./virtualSets";
import { BACKGROUND_LABEL, type BackgroundTheme } from "./backgrounds";
import { MatchRail } from "./MatchRail";
import { DataDeck } from "./DataDeck";

export interface StageScene { id: string; label: string; hint: string; set?: VirtualSet["layout"] | null; graphics: GraphicVariant[]; background?: BackgroundTheme }

export const STAGE_SCENES: StageScene[] = [
  { id: "partido", label: "Partido en vivo", hint: "Estudio lateral + marcador + resultados", set: "set-left", graphics: ["pro", "multi"] },
  { id: "jornada", label: "Jornada completa", hint: "Sin cámara: todos los partidos en grande", set: null, background: "jornada", graphics: ["multi"] },
  { id: "debate", label: "Debate", hint: "2 cámaras + votación del partido", set: "set-duo", graphics: ["poll", "pro"] },
  { id: "previa", label: "Previa", hint: "Cámara al centro + previa del partido", set: "set-center", graphics: ["prematch"] },
  { id: "entretiempo", label: "Entretiempo", hint: "Mesa de análisis + estadísticas", set: "set-desk", graphics: ["stats", "pro"] },
  { id: "camara", label: "Solo cámara", hint: "Tu cámara a pantalla completa + marcador", set: null, graphics: ["pro"] },
];

const TOGGLES: { variant: GraphicVariant; label: string; hint: string }[] = [
  { variant: "pro", label: "Marcador", hint: "del partido principal" },
  { variant: "multi", label: "Multipantalla", hint: "partidos elegidos" },
  { variant: "lineup-home", label: "Alineaciones", hint: "20 s y se van solas" },
  { variant: "stats", label: "Estadísticas", hint: "posesión, remates…" },
  { variant: "prematch", label: "Previa", hint: "forma y datos" },
  { variant: "poll", label: "Votación", hint: "última votación lanzada" },
  { variant: "events", label: "Último evento", hint: "tarjeta / cambio" },
];

interface Props {
  fm: FootballMatchController;
  monitor: ReactNode;
  live: boolean;
  onAir: { id: string; name: string; variant?: string }[];
  isOn: (variant: GraphicVariant) => boolean;
  onToggle: (variant: GraphicVariant) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  onScene: (scene: StageScene, theme: SetTheme) => void;
  onSet: (set: VirtualSet, theme: SetTheme) => void;
  onThemeBackground: (theme: BackgroundTheme) => void;
  backgrounds: { id: string; name: string; url: string }[];
  onBackgroundItem: (id: string) => void;
  onUploadBackground: (file: File) => void;
  onNoBackground: () => void;
  bgLocked: boolean;
  onToggleBgLock: () => void;
  onCamera: () => void;
  cameraCount: number;
  onAirMatch: (ref: { league: string; id: string }, what: "pro" | "lineups" | "stats") => void;
  onDataAir: (variant: GraphicVariant, options?: { title?: string; subtitle?: string }, seconds?: number) => void;
  onAdvanced: () => void;
}

function themeFor(league?: string): SetTheme {
  if (league === "uefa.champions") return "champions";
  if (league === "col.1") return "betplay";
  if (league === "conmebol.libertadores") return "libertadores";
  return "nexus";
}

function SetThumb({ set, theme }: { set: VirtualSet; theme: SetTheme }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    let made: string | null = null;
    void drawVirtualSet(set.layout, theme).then((blob) => { if (!alive) return; made = URL.createObjectURL(blob); setUrl(made); });
    return () => { alive = false; if (made) URL.revokeObjectURL(made); };
  }, [set.layout, theme]);
  // eslint-disable-next-line @next/next/no-img-element
  return url ? <img src={url} alt="" className="aspect-video w-full rounded-md object-cover" /> : <div className="aspect-video w-full animate-pulse rounded-md bg-white/5" />;
}

const panel = "rounded-xl border border-white/[0.07] bg-[#0f141c] p-2";
const head = "mb-1.5 flex items-center gap-1.5 px-0.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-neutral-400";

export function FootballStage(props: Props) {
  const { fm, monitor, live } = props;
  const [mobileTab, setMobileTab] = useState<"graficos" | "escenas" | "fondos" | "partidos" | "datos">("graficos");
  const [bottomTab, setBottomTab] = useState<"partidos" | "datos">("partidos");
  const [theme, setTheme] = useState<SetTheme>("nexus");
  const [desktop, setDesktop] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1280px)");
    const update = () => setDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  useEffect(() => { setTheme(themeFor(fm.fixture?.league)); }, [fm.fixture?.league]);

  const scenesPanel = (
    <div className="space-y-2">
      <div className={panel}>
        <p className={head}><Clapperboard size={12} className="text-yellow-300" /> Escenas completas</p>
        <div className="grid grid-cols-2 gap-1.5 xl:grid-cols-1">
          {STAGE_SCENES.map((sc) => (
            <button key={sc.id} type="button" onClick={() => props.onScene(sc, theme)} className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-2 text-left hover:border-yellow-400/60 hover:bg-yellow-400/[0.06]">
              <span className="block text-[12px] font-bold text-white">{sc.label}</span>
              <span className="block text-[10px] leading-tight text-neutral-500">{sc.hint}</span>
            </button>
          ))}
        </div>
      </div>
      <div className={panel}>
        <p className={head}><Sparkles size={12} className="text-sky-300" /> Escenarios virtuales</p>
        <div className="mb-1.5 flex flex-wrap gap-1">
          {(["nexus", "champions", "betplay", "libertadores"] as SetTheme[]).map((t) => (
            <button key={t} type="button" onClick={() => setTheme(t)} className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${theme === t ? "bg-white text-black" : "border border-white/10 text-neutral-400"}`}>{t === "nexus" ? "NEXUS" : t === "betplay" ? "BetPlay" : t[0].toUpperCase() + t.slice(1)}</button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {VIRTUAL_SETS.map((set) => (
            <button key={set.id} type="button" onClick={() => props.onSet(set, theme)} className="rounded-lg border border-white/[0.08] p-1 text-left hover:border-sky-400/60">
              <SetThumb set={set} theme={theme} />
              <span className="mt-1 block px-0.5 text-[10.5px] font-semibold leading-tight text-neutral-200">{set.label.replace("Estudio · ", "")}</span>
            </button>
          ))}
        </div>
        {props.cameraCount === 0 && (
          <button type="button" onClick={props.onCamera} className="mt-1.5 inline-flex w-full items-center justify-center gap-1 rounded-lg bg-white/[0.08] py-1.5 text-[11px] font-semibold text-white hover:bg-white/[0.14]"><Camera size={12} /> Conectar mi cámara</button>
        )}
      </div>
    </div>
  );

  const backgroundsPanel = (
    <div className={panel}>
      <p className={head}><ImageIcon size={12} className="text-emerald-300" /> Fondos
        <button type="button" onClick={props.onToggleBgLock} title={props.bgLocked ? "Fondo bloqueado: las escenas no lo cambian" : "Bloquear fondo"} className={`ml-auto inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 normal-case tracking-normal ${props.bgLocked ? "bg-yellow-400 text-black" : "text-neutral-500 hover:text-white"}`}>
          {props.bgLocked ? <Lock size={11} /> : <Unlock size={11} />} {props.bgLocked ? "Bloqueado" : "Libre"}
        </button>
      </p>
      <div className="grid grid-cols-3 gap-1">
        {props.backgrounds.map((b) => (
          <button key={b.id} type="button" onClick={() => props.onBackgroundItem(b.id)} title={b.name} className="overflow-hidden rounded-md border border-white/10 hover:border-emerald-400/70">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={b.url} alt={b.name} className="aspect-video w-full object-cover" />
          </button>
        ))}
        <label className="grid aspect-video cursor-pointer place-items-center rounded-md border border-dashed border-white/15 text-neutral-400 hover:border-emerald-400/60 hover:text-white" title="Subir tu fondo (1920×1080)">
          <Upload size={14} />
          <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) props.onUploadBackground(f); e.target.value = ""; }} />
        </label>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1">
        {(Object.keys(BACKGROUND_LABEL) as BackgroundTheme[]).map((t) => (
          <button key={t} type="button" onClick={() => props.onThemeBackground(t)} className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-neutral-300 hover:border-white/30">{BACKGROUND_LABEL[t].split(" · ")[0]}</button>
        ))}
        <button type="button" onClick={props.onNoBackground} className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-neutral-500 hover:text-white">Sin fondo</button>
      </div>
    </div>
  );

  const graphicsPanel = (
    <div className="space-y-2">
      <div className={panel}>
        <p className={head}><ToggleRight size={12} className="text-red-300" /> Gráficos · toca para poner o quitar</p>
        <div className="grid grid-cols-2 gap-1.5 xl:grid-cols-1">
          {TOGGLES.map((t) => {
            const on = props.isOn(t.variant);
            return (
              <button key={t.variant} type="button" onClick={() => props.onToggle(t.variant)} aria-pressed={on}
                className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition ${on ? "border-red-500 bg-red-500/15" : "border-white/[0.08] bg-white/[0.03] hover:border-white/25"}`}>
                <span className={`flex h-5 w-9 flex-shrink-0 items-center rounded-full p-0.5 transition ${on ? "justify-end bg-red-500" : "justify-start bg-white/15"}`}><span className="h-4 w-4 rounded-full bg-white" /></span>
                <span className="min-w-0">
                  <span className="block text-[12px] font-bold text-white">{t.label}</span>
                  <span className="block truncate text-[10px] text-neutral-500">{on ? "AL AIRE" : t.hint}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <div className={panel}>
        <p className={head}><Radio size={12} className="text-red-400" /> Al aire ahora
          {props.onAir.length > 0 && <button type="button" onClick={props.onClear} className="ml-auto inline-flex items-center gap-1 normal-case tracking-normal text-neutral-400 hover:text-red-300"><Eraser size={11} /> Limpiar</button>}
        </p>
        {props.onAir.length === 0 && <p className="px-1 text-[11px] text-neutral-500">Nada encima. Enciende un gráfico o una escena.</p>}
        <ul className="space-y-1">
          {props.onAir.map((g) => (
            <li key={g.id} className="flex items-center gap-1.5 rounded-md bg-white/[0.04] py-1 pl-2 pr-1 text-[11px] text-neutral-200">
              <Check size={11} className="flex-shrink-0 text-red-400" />
              <span className="min-w-0 flex-1 truncate">{g.name}</span>
              <button type="button" onClick={() => props.onRemove(g.id)} aria-label={`Quitar ${g.name}`} className="rounded p-0.5 text-neutral-500 hover:bg-white/10 hover:text-white"><X size={12} /></button>
            </li>
          ))}
        </ul>
      </div>
      <button type="button" onClick={props.onAdvanced} className="w-full rounded-lg border border-white/10 py-1.5 text-[10.5px] text-neutral-500 hover:border-white/30 hover:text-white">Controles avanzados (manual, widgets, medios)</button>
    </div>
  );

  const matches = <MatchRail fm={fm} onAirMatch={props.onAirMatch} embedded />;
  const data = <DataDeck fm={fm} onAir={props.onDataAir} embedded />;
  const mainName = useMemo(() => (fm.fixture ? `${fm.match.homeTeam} vs ${fm.match.awayTeam}` : "Sin partido principal"), [fm.fixture, fm.match.homeTeam, fm.match.awayTeam]);

  const tabsBottom = (
    <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-white/[0.07] bg-[#0b0f15]">
      <div className="flex gap-1 border-b border-white/[0.07] p-1.5">
        {([["partidos", "Partidos"], ["datos", "Datos para narrar y debatir"]] as const).map(([id, label]) => (
          <button key={id} type="button" onClick={() => setBottomTab(id)} className={`rounded-lg px-3 py-1.5 text-[12px] font-semibold ${bottomTab === id ? "bg-white text-black" : "text-neutral-400 hover:text-white"}`}>{label}</button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">{bottomTab === "partidos" ? matches : data}</div>
    </div>
  );

  // The program monitor is rendered ONCE (it holds the canvas that goes on air); only the tools around it change.
  return (
    <div className={`min-h-0 flex-1 ${desktop ? "grid grid-cols-[280px_minmax(0,1fr)_280px] grid-rows-[minmax(0,62vh)_minmax(0,1fr)] gap-2 overflow-hidden p-2" : "flex flex-col overflow-y-auto"}`}>
      {desktop && <div className="min-h-0 space-y-2 overflow-y-auto">{scenesPanel}{backgroundsPanel}</div>}

      <div className={desktop ? "flex min-h-0 flex-col items-center justify-center rounded-xl border border-white/[0.07] bg-black/60 p-2" : "sticky top-0 z-20 bg-black p-1.5"}>
        <div className="flex w-full items-center gap-2 pb-1.5 text-[11px]">
          <span className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 font-black uppercase tracking-wider ${live ? "bg-red-500 text-white" : "bg-white/10 text-neutral-300"}`}>{live && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />}{live ? "En vivo" : "Programa"}</span>
          <span className="truncate text-neutral-400">{mainName}</span>
          <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold ${fm.autoMode ? "bg-emerald-400 text-black" : "bg-neutral-700 text-neutral-200"}`}>{fm.autoMode ? "AUTOMÁTICO" : "MANUAL"}</span>
        </div>
        <div className="aspect-video w-full overflow-hidden rounded-lg bg-black" style={desktop ? { maxHeight: "calc(62vh - 44px)", maxWidth: "calc((62vh - 44px) * 16 / 9)" } : undefined}>{monitor}</div>
        {!desktop && (
          <div className="mt-1.5 flex gap-1 overflow-x-auto">
            {([["graficos", "Gráficos"], ["escenas", "Escenas"], ["fondos", "Fondos"], ["partidos", "Partidos"], ["datos", "Datos"]] as const).map(([id, label]) => (
              <button key={id} type="button" onClick={() => setMobileTab(id)} className={`flex-shrink-0 rounded-full px-3 py-1.5 text-[12px] font-semibold ${mobileTab === id ? "bg-white text-black" : "bg-white/[0.06] text-neutral-300"}`}>{label}</button>
            ))}
          </div>
        )}
      </div>

      {desktop && <div className="min-h-0 overflow-y-auto">{graphicsPanel}</div>}
      {desktop && <div className="col-span-3 flex min-h-0 flex-col">{tabsBottom}</div>}

      {!desktop && (
        <>
          <div className="p-2 pb-24">
            {mobileTab === "graficos" && graphicsPanel}
            {mobileTab === "escenas" && scenesPanel}
            {mobileTab === "fondos" && backgroundsPanel}
            {mobileTab === "partidos" && matches}
            {mobileTab === "datos" && data}
          </div>
        </>
      )}
    </div>
  );
}
