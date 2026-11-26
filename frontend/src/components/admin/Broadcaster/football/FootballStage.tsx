"use client";

// THE football studio. The program screen sits in the middle with the tools on
// each side, all at full height:
//   left  : complete scenes (with / without camera), virtual sets, backgrounds
//   center: PROGRAM (tap a graphic to hide it; quick buttons on its edges),
//           number bar 1-9 (each number = one match), tabs below it
//   right : graphics as ON/OFF switches with their keys + what is on air
// Keys: 1-9 = scoreboard of that match (press again = hide) and it becomes the
// "active" match for line-ups / stats; 0 = hide everything; letters assignable.
// On phones the program stays on top and the tools become tabs.

import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { BarChart3, Camera, Play, Check, Clapperboard, EyeOff, Hash, Image as ImageIcon, Keyboard, ListOrdered, Lock, Maximize2, Minimize2, Radio, Sparkles, ToggleRight, Unlock, Upload, X } from "lucide-react";
import type { GraphicVariant } from "../graphicExport";
import type { FootballMatchController } from "./useFootballMatch";
import { SET_THEME_LABEL, VIRTUAL_SETS, drawVirtualSet, type SetTheme, type VirtualSet } from "./virtualSets";
import { BACKGROUND_LABEL, type BackgroundTheme } from "./backgrounds";
import { readMultiSelection, writeMultiSelection, type BoardMatch } from "./liveBoard";
import { MatchRail } from "./MatchRail";
import { DataDeck } from "./DataDeck";
import { AutoShowPanel, type AutoShowHandlers } from "./AutoShowPanel";
import { yyyymmdd } from "./recap";

export interface MatchRef { league: string; id: string }
export type MatchWhat = "pro" | "lineups" | "stats";

export interface StageScene { id: string; label: string; hint: string; camera: boolean; set?: VirtualSet["layout"] | null; graphics: GraphicVariant[]; background?: BackgroundTheme }

export const STAGE_SCENES: StageScene[] = [
  { id: "partido", label: "Partido en vivo", hint: "Cámara al lado + marcador + resultados", camera: true, set: "set-left", graphics: ["pro", "multi"] },
  { id: "debate", label: "Debate", hint: "2 cámaras + votación + marcador", camera: true, set: "set-duo", graphics: ["poll", "pro"] },
  { id: "previa", label: "Previa", hint: "Cámara al centro + previa + cinta", camera: true, set: "set-center", graphics: ["prematch", "cinta"] },
  { id: "entretiempo", label: "Entretiempo", hint: "Mesa de análisis + estadísticas", camera: true, set: "set-desk", graphics: ["stats", "pro"] },
  { id: "camara", label: "Solo cámara", hint: "Cámara completa + marcador + cinta", camera: true, set: null, graphics: ["pro", "cinta"] },
  { id: "jornada-led", label: "Jornada en pantalla LED", hint: "Todos los partidos elegidos + cinta", camera: false, set: "set-wall", graphics: ["multi", "cinta"] },
  { id: "estadio", label: "Estadio · partido", hint: "Marcador + estadísticas + cinta", camera: false, set: "set-arena", graphics: ["pro", "stats", "cinta"] },
  { id: "previa-led", label: "Previa sin cámara", hint: "Pantalla LED + previa + marcador", camera: false, set: "set-wall", graphics: ["prematch", "pro"] },
  { id: "jornada", label: "Jornada clásica", hint: "Fondo de jornada + resultados", camera: false, set: null, background: "jornada", graphics: ["multi"] },
];

type Action = "pro" | "multi" | "lineup-home" | "stats" | "prematch" | "poll" | "events" | "cinta" | "hide";

const TOGGLES: { variant: Exclude<Action, "hide">; label: string; hint: string }[] = [
  { variant: "pro", label: "Marcador", hint: "partido activo" },
  { variant: "multi", label: "Multipantalla", hint: "partidos elegidos" },
  { variant: "cinta", label: "Cinta de datos", hint: "resultados corriendo abajo" },
  { variant: "lineup-home", label: "Alineaciones", hint: "20 s y se van solas" },
  { variant: "stats", label: "Estadísticas", hint: "15 s · partido activo" },
  { variant: "prematch", label: "Previa", hint: "forma y datos" },
  { variant: "poll", label: "Votación", hint: "última lanzada" },
  { variant: "events", label: "Último evento", hint: "tarjeta / cambio" },
];

const DEFAULT_KEYS: Record<Action, string> = { pro: "m", multi: "j", cinta: "c", "lineup-home": "a", stats: "e", prematch: "p", poll: "o", events: "k", hide: "0" };
const KEYS_STORE = "nexus.broadcast.keys";
const SLOTS_STORE = "nexus.broadcast.slots";

function readKeys(): Record<Action, string> {
  try { return { ...DEFAULT_KEYS, ...(JSON.parse(localStorage.getItem(KEYS_STORE) || "{}") as Partial<Record<Action, string>>) }; } catch { return DEFAULT_KEYS; }
}
function readSlots(): MatchRef[] {
  try { return (JSON.parse(localStorage.getItem(SLOTS_STORE) || "[]") as MatchRef[]).slice(0, 9); } catch { return []; }
}

interface Props {
  fm: FootballMatchController;
  monitor: ReactNode;
  live: boolean;
  /** Keys only work while the studio is the visible screen. */
  keysActive: boolean;
  board: BoardMatch[];
  onAir: { id: string; name: string; variant?: string }[];
  isOn: (variant: GraphicVariant) => boolean;
  onToggle: (variant: GraphicVariant, target: MatchRef | null) => void;
  isMatchOn: (ref: MatchRef, what: MatchWhat) => boolean;
  onMatch: (ref: MatchRef, what: MatchWhat) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  onMonitorTap: (x: number, y: number) => void;
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
  onDataAir: (variant: GraphicVariant, options?: { title?: string; subtitle?: string }, seconds?: number) => void;
  onAdvanced: () => void;
  autoShow: AutoShowHandlers;
}

function themeFor(league?: string, teams: string[] = []): SetTheme {
  if (teams.some((t) => /junior/i.test(t))) return "junior";
  if (league === "uefa.champions") return "champions";
  if (league === "col.1") return "betplay";
  if (league === "conmebol.libertadores") return "libertadores";
  return "nexus";
}

const isLive = (m: BoardMatch) => m.status === "live" || m.status === "halftime";
const short = (name: string) => (name.length > 13 ? `${name.slice(0, 12)}…` : name);
const refOf = (m: BoardMatch): MatchRef => ({ league: m.league ?? "", id: m.id });

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

function Crest({ src, name }: { src?: string; name: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img src={src} alt="" className="h-4 w-4 flex-shrink-0 object-contain" /> : <span className="grid h-4 w-4 flex-shrink-0 place-items-center rounded-full bg-white/10 text-[7px] font-bold">{name.slice(0, 2)}</span>;
}

const panel = "rounded-xl border border-white/[0.07] bg-[#0f141c] p-2";
const head = "mb-1.5 flex items-center gap-1.5 px-0.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-neutral-400";
const keyCap = "inline-grid min-w-[18px] place-items-center rounded border border-white/20 bg-black/40 px-1 font-mono text-[10px] font-bold uppercase text-neutral-200";

export function FootballStage(props: Props) {
  const { fm, monitor, live, board } = props;
  const [mobileTab, setMobileTab] = useState<"graficos" | "hoy" | "escenas" | "fondos" | "calendario" | "datos" | "auto">("graficos");
  const [showDate, setShowDate] = useState<string | null>(null);
  const [bottomTab, setBottomTab] = useState<"hoy" | "calendario" | "datos" | "auto">("hoy");
  const [theme, setTheme] = useState<SetTheme>("nexus");
  const [desktop, setDesktop] = useState(true);
  const [keys, setKeys] = useState<Record<Action, string>>(DEFAULT_KEYS);
  const [assigning, setAssigning] = useState<Action | null>(null);
  const [slots, setSlots] = useState<MatchRef[]>([]);
  const [target, setTarget] = useState<MatchRef | null>(null);
  const [multiSel, setMultiSel] = useState<string[]>([]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1280px)");
    const update = () => setDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    setKeys(readKeys());
    setSlots(readSlots());
    setMultiSel(readMultiSelection());
    const onSel = (e: Event) => setMultiSel((e as CustomEvent).detail as string[]);
    window.addEventListener("nexus:multi-selection", onSel);
    return () => { mq.removeEventListener("change", update); window.removeEventListener("nexus:multi-selection", onSel); };
  }, []);
  useEffect(() => { setTheme(themeFor(fm.fixture?.league, [fm.match.homeTeam, fm.match.awayTeam])); }, [fm.fixture?.league, fm.match.homeTeam, fm.match.awayTeam]);
  // Program size on computers: the tabs below must always be visible.
  const [size, setSize] = useState<"s" | "m" | "l">("m");
  useEffect(() => { try { const v = localStorage.getItem("nexus.broadcast.monitor"); if (v === "s" || v === "m" || v === "l") setSize(v); } catch { /* ignore */ } }, []);
  const pickSize = (v: "s" | "m" | "l") => { setSize(v); try { localStorage.setItem("nexus.broadcast.monitor", v); } catch { /* ignore */ } };
  const monitorH = size === "s" ? "max(160px, calc(100dvh - 620px))" : size === "m" ? "max(200px, calc(100dvh - 520px))" : "max(240px, calc(100dvh - 380px))";

  // Local calendar day relative to today: 0 today, -1 yesterday, 1 tomorrow…
  const dayDiff = (m: BoardMatch) => {
    if (!m.date) return 0;
    const d = new Date(m.date);
    const a = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const n = new Date();
    return Math.round((a - new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime()) / 86400000);
  };
  const todayBoard = useMemo(() => board.filter((m) => isLive(m) || dayDiff(m) === 0), [board]); // eslint-disable-line react-hooks/exhaustive-deps
  const upcomingBoard = useMemo(() => board.filter((m) => !isLive(m) && dayDiff(m) > 0), [board]); // eslint-disable-line react-hooks/exhaustive-deps
  const yesterdayBoard = useMemo(() => board.filter((m) => !isLive(m) && dayDiff(m) === -1), [board]); // eslint-disable-line react-hooks/exhaustive-deps
  const byId = useMemo(() => new Map(board.map((m) => [m.id, m])), [board]);
  const saveSlots = (next: MatchRef[]) => { setSlots(next); try { localStorage.setItem(SLOTS_STORE, JSON.stringify(next)); } catch { /* ignore */ } };
  // Numbers: matches that no longer exist drop out; with none assigned, the live games (then today's next ones) get 1, 2, 3…
  useEffect(() => {
    if (!board.length) return;
    const kept = slots.filter((s) => byId.has(s.id)); // numbers given by hand stay, even after the final whistle
    if (kept.length) { if (kept.length !== slots.length) saveSlots(kept); return; }
    const auto = [...todayBoard.filter(isLive), ...todayBoard.filter((m) => m.status === "scheduled"), ...upcomingBoard.sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""))].slice(0, 9).map(refOf);
    if (auto.length) saveSlots(auto);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board]);

  const slotOf = (id: string) => slots.findIndex((s) => s.id === id);
  const toggleSlot = (id: string) => {
    const i = slotOf(id);
    if (i >= 0) { saveSlots(slots.filter((_, k) => k !== i)); return; }
    const m = byId.get(id);
    if (m && slots.length < 9) saveSlots([...slots, refOf(m)]);
  };
  const setMulti = (ids: string[]) => { setMultiSel(ids); writeMultiSelection(ids); };
  const toggleMulti = (id: string) => setMulti(multiSel.includes(id) ? multiSel.filter((x) => x !== id) : [...multiSel, id]);

  const mainRef: MatchRef | null = fm.fixture ? { league: fm.fixture.league, id: fm.fixture.id } : null;
  const active = target ?? mainRef;
  const activeMatch = active ? byId.get(active.id) : undefined;
  const activeName = activeMatch ? `${activeMatch.homeTeam} vs ${activeMatch.awayTeam}` : fm.fixture ? `${fm.match.homeTeam} vs ${fm.match.awayTeam}` : "Ninguno (elige un número)";

  const pressSlot = useCallback((n: number) => {
    const ref = slots[n - 1];
    if (!ref) return;
    setTarget(ref);
    props.onMatch(ref, "pro");
  }, [slots, props]);
  const runAction = useCallback((action: Action) => {
    if (action === "hide") { props.onClear(); return; }
    props.onToggle(action, active);
  }, [props, active]);

  // Keyboard: capture phase, so these keys never reach the older studio shortcuts.
  const latest = useRef({ keys, assigning, pressSlot, runAction, active: props.keysActive });
  latest.current = { keys, assigning, pressSlot, runAction, active: props.keysActive };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const cur = latest.current;
      if (!cur.active || event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
      const el = event.target;
      if (el instanceof HTMLElement && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName))) return;
      const key = event.key.toLowerCase();
      if (cur.assigning) {
        event.preventDefault(); event.stopImmediatePropagation();
        if (key === "escape") { setAssigning(null); return; }
        if (!/^[a-z0]$/.test(key)) return;
        const next = { ...cur.keys };
        (Object.keys(next) as Action[]).forEach((a) => { if (next[a] === key) next[a] = ""; });
        next[cur.assigning] = key;
        setKeys(next);
        try { localStorage.setItem(KEYS_STORE, JSON.stringify(next)); } catch { /* ignore */ }
        setAssigning(null);
        return;
      }
      if (/^[1-9]$/.test(key)) { event.preventDefault(); event.stopImmediatePropagation(); cur.pressSlot(Number(key)); return; }
      const action = (Object.keys(cur.keys) as Action[]).find((a) => cur.keys[a] === key);
      if (action) { event.preventDefault(); event.stopImmediatePropagation(); cur.runAction(action); }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  const keyBadge = (action: Action) => (
    <span role="button" tabIndex={0} title="Cambiar tecla" onClick={(e) => { e.stopPropagation(); setAssigning(action); }}
      onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); setAssigning(action); } }}
      className={`${keyCap} cursor-pointer ${assigning === action ? "animate-pulse border-yellow-400 text-yellow-300" : "hover:border-white/50"}`}>
      {assigning === action ? "?" : keys[action] || "–"}
    </span>
  );

  // ---------------------------------------------------------------- panels
  const scenesPanel = (
    <div className="space-y-2">
      {[true, false].map((cam) => (
        <div key={String(cam)} className={panel}>
          <p className={head}><Clapperboard size={12} className="text-yellow-300" /> {cam ? "Escenas con cámara" : "Escenas sin cámara"}</p>
          <div className="grid grid-cols-2 gap-1.5 xl:grid-cols-1">
            {STAGE_SCENES.filter((sc) => sc.camera === cam).map((sc) => (
              <button key={sc.id} type="button" onClick={() => props.onScene(sc, theme)} className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-left hover:border-yellow-400/60 hover:bg-yellow-400/[0.06]">
                <span className="block text-[12px] font-bold text-white">{sc.label}</span>
                <span className="block text-[10px] leading-tight text-neutral-500">{sc.hint}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
      <div className={panel}>
        <p className={head}><Sparkles size={12} className="text-sky-300" /> Escenarios virtuales</p>
        <div className="mb-1.5 flex flex-wrap gap-1">
          {(Object.keys(SET_THEME_LABEL) as SetTheme[]).map((t) => (
            <button key={t} type="button" onClick={() => setTheme(t)} className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${theme === t ? "bg-white text-black" : "border border-white/10 text-neutral-400"}`}>{SET_THEME_LABEL[t]}</button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {VIRTUAL_SETS.map((set) => (
            <button key={set.id} type="button" onClick={() => props.onSet(set, theme)} title={set.hint} className="rounded-lg border border-white/[0.08] p-1 text-left hover:border-sky-400/60">
              <SetThumb set={set} theme={theme} />
              <span className="mt-1 block px-0.5 text-[10px] font-semibold leading-tight text-neutral-200">{set.label}</span>
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
        <p className={head}><ToggleRight size={12} className="text-red-300" /> Gráficos · toca o usa la tecla</p>
        <p className="mb-1.5 truncate rounded-md bg-white/[0.04] px-2 py-1 text-[10.5px] text-neutral-400">Partido activo: <b className="text-white">{activeName}</b></p>
        <div className="grid grid-cols-2 gap-1.5 xl:grid-cols-1">
          {TOGGLES.map((t) => {
            const on = props.isOn(t.variant);
            return (
              <button key={t.variant} type="button" onClick={() => runAction(t.variant)} aria-pressed={on}
                className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 text-left transition ${on ? "border-red-500 bg-red-500/15" : "border-white/[0.08] bg-white/[0.03] hover:border-white/25"}`}>
                <span className={`flex h-5 w-9 flex-shrink-0 items-center rounded-full p-0.5 transition ${on ? "justify-end bg-red-500" : "justify-start bg-white/15"}`}><span className="h-4 w-4 rounded-full bg-white" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[12px] font-bold text-white">{t.label}</span>
                  <span className="block truncate text-[10px] text-neutral-500">{on ? "AL AIRE" : t.hint}</span>
                </span>
                {desktop && keyBadge(t.variant)}
              </button>
            );
          })}
        </div>
        {desktop && (
          <p className="mt-1.5 flex flex-wrap items-center gap-1 px-0.5 text-[10px] text-neutral-500">
            <Keyboard size={11} /> <span className={keyCap}>1</span>–<span className={keyCap}>9</span> marcador de ese partido · {keyBadge("hide")} ocultar todo · toca una tecla para cambiarla
          </p>
        )}
      </div>
      <div className={panel}>
        <p className={head}><Radio size={12} className="text-red-400" /> Al aire ahora
          {props.onAir.length > 0 && <button type="button" onClick={props.onClear} className="ml-auto inline-flex items-center gap-1 normal-case tracking-normal text-neutral-300 hover:text-red-300"><EyeOff size={11} /> Ocultar todo</button>}
        </p>
        {props.onAir.length === 0 && <p className="px-1 text-[11px] text-neutral-500">Nada encima. Toca un gráfico en la pantalla para quitarlo.</p>}
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

  // Number bar: 1-9, each one a match with its score and minute (data at hand for the narration too).
  const slotBar = (
    <div className="flex w-full gap-1 overflow-x-auto py-1">
      {slots.length === 0 && <p className="px-1 py-1.5 text-[11px] text-neutral-500">Sin partidos numerados. Asígnalos en «Partidos de hoy».</p>}
      {slots.map((ref, i) => {
        const m = byId.get(ref.id);
        const on = props.isMatchOn(ref, "pro");
        const isTarget = active?.id === ref.id;
        return (
          <button key={ref.id} type="button" onClick={() => pressSlot(i + 1)} title={m ? `${m.homeTeam} vs ${m.awayTeam} · ${m.leagueName ?? ""}` : ""}
            className={`flex min-w-[124px] flex-shrink-0 items-center gap-1.5 rounded-lg border px-1.5 py-0.5 text-left ${on ? "border-red-500 bg-red-500/15" : isTarget ? "border-emerald-400/70 bg-emerald-400/[0.07]" : "border-white/[0.08] bg-white/[0.03] hover:border-white/25"}`}>
            <span className={`grid h-6 w-6 flex-shrink-0 place-items-center rounded-md text-[13px] font-black ${on ? "bg-red-500 text-white" : "bg-white text-black"}`}>{i + 1}</span>
            {m ? (
              <span className="min-w-0 flex-1 leading-tight">
                <span className="flex items-center gap-1 text-[10.5px] font-semibold text-white"><Crest src={m.homeLogo} name={m.homeTeam} />{short(m.homeTeam)}<b className="ml-auto tabular-nums">{m.status === "scheduled" ? "" : m.homeScore ?? 0}</b></span>
                <span className="flex items-center gap-1 text-[10.5px] font-semibold text-white"><Crest src={m.awayLogo} name={m.awayTeam} />{short(m.awayTeam)}<b className="ml-auto tabular-nums">{m.status === "scheduled" ? "" : m.awayScore ?? 0}</b></span>
                <span className={`block text-[9px] leading-none ${isLive(m) ? "text-red-400" : "text-neutral-500"}`}>{isLive(m) ? `● ${m.statusDetail ?? "En vivo"}` : m.status === "scheduled" && m.date ? new Date(m.date).toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" }) : m.statusDetail}</span>
              </span>
            ) : <span className="text-[10px] text-neutral-500">Partido no disponible</span>}
          </button>
        );
      })}
    </div>
  );

  // Today's matches: number them, choose the multi-screen (one or many), and air any template of any of them.
  const todayList = useMemo(() => {
    const order = (m: BoardMatch) => (isLive(m) ? 0 : m.status === "scheduled" ? 1 : 2);
    const byDate = (a: BoardMatch, b: BoardMatch) => (a.date ?? "").localeCompare(b.date ?? "");
    return [...[...todayBoard].sort((a, b) => order(a) - order(b) || byDate(a, b)), ...[...upcomingBoard].sort(byDate)];
  }, [todayBoard, upcomingBoard]);
  const openShow = (date: string) => { setShowDate(date); setBottomTab("auto"); setMobileTab("auto"); };
  const todayPanel = (
    <div className="p-2">
      <div className="mb-2 flex flex-wrap items-center gap-1.5 text-[10.5px]">
        <span className="font-semibold text-neutral-400">Multipantalla:</span>
        <button type="button" onClick={() => setMulti([])} className={`rounded-md border px-2 py-1 font-semibold ${multiSel.length === 0 ? "border-yellow-400 bg-yellow-400/15 text-yellow-200" : "border-white/10 text-neutral-300"}`}>Automática (en vivo)</button>
        <button type="button" onClick={() => setMulti(slots.map((s) => s.id))} disabled={!slots.length} className="rounded-md border border-white/10 px-2 py-1 font-semibold text-neutral-300 disabled:opacity-30">Los numerados</button>
        {active && <button type="button" onClick={() => setMulti([active.id])} className="rounded-md border border-white/10 px-2 py-1 font-semibold text-neutral-300">Solo el activo</button>}
        <span className="ml-auto text-neutral-500">{multiSel.length ? `${multiSel.length} elegidos` : "sin terminados"}</span>
        <button type="button" onClick={() => saveSlots(todayList.filter(isLive).slice(0, 9).map(refOf))} className="rounded-md border border-white/10 px-2 py-1 font-semibold text-neutral-300"><Hash size={10} className="inline" /> Numerar los en vivo</button>
      </div>
      {todayBoard.length === 0 && <p className="p-3 text-[12px] text-neutral-500">{board.length ? "Hoy no hay partidos en las ligas seguidas." : "Cargando partidos de hoy…"}</p>}
      <ul className="grid gap-1.5 sm:grid-cols-2 2xl:grid-cols-3">
        {todayList.map((m, i) => {
          const ref = refOf(m);
          const firstUpcoming = dayDiff(m) > 0 && (i === 0 || dayDiff(todayList[i - 1]) <= 0 || isLive(todayList[i - 1]));
          const n = slotOf(m.id);
          const inMulti = multiSel.includes(m.id);
          return (
            <Fragment key={m.id}>
            {firstUpcoming && <li className="col-span-full pt-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-neutral-400">Próximos días</li>}
            <li className={`rounded-xl border p-2 ${active?.id === m.id ? "border-emerald-400/60 bg-emerald-400/[0.05]" : "border-white/[0.06] bg-white/[0.02]"} ${m.status === "finished" ? "opacity-60" : ""}`}>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => toggleSlot(m.id)} title={n >= 0 ? "Quitar el número" : "Asignar el siguiente número"}
                  className={`grid h-7 w-7 flex-shrink-0 place-items-center rounded-md text-[13px] font-black ${n >= 0 ? "bg-white text-black" : "border border-dashed border-white/20 text-neutral-500 hover:text-white"}`}>{n >= 0 ? n + 1 : "#"}</button>
                <div className="min-w-0 flex-1 leading-tight">
                  <p className="flex items-center gap-1.5 text-[12px] font-semibold text-white"><Crest src={m.homeLogo} name={m.homeTeam} /><span className="truncate">{m.homeTeam}</span><b className="ml-auto tabular-nums">{m.status === "scheduled" ? "" : m.homeScore ?? 0}</b></p>
                  <p className="flex items-center gap-1.5 text-[12px] font-semibold text-white"><Crest src={m.awayLogo} name={m.awayTeam} /><span className="truncate">{m.awayTeam}</span><b className="ml-auto tabular-nums">{m.status === "scheduled" ? "" : m.awayScore ?? 0}</b></p>
                </div>
              </div>
              <p className="mt-1 flex items-center gap-2 text-[10px] text-neutral-500">
                <span className="truncate">{m.leagueName}</span>
                <span className={`ml-auto flex-shrink-0 font-semibold ${isLive(m) ? "text-red-400" : ""}`}>{isLive(m) ? `● ${m.statusDetail ?? ""}` : m.status === "finished" ? "Final" : m.date ? new Date(m.date).toLocaleString("es-CO", dayDiff(m) > 0 ? { weekday: "short", hour: "numeric", minute: "2-digit" } : { hour: "numeric", minute: "2-digit" }) : ""}</span>
              </p>
              <div className="mt-1.5 grid grid-cols-4 gap-1">
                {([["pro", "Marcador"], ["lineups", "Alineac."], ["stats", "Stats"]] as const).map(([w, label]) => {
                  const on = props.isMatchOn(ref, w);
                  return (
                    <button key={w} type="button" onClick={() => { setTarget(ref); props.onMatch(ref, w); }}
                      className={`rounded-md px-1 py-1 text-[10.5px] font-bold ${on ? "bg-red-500 text-white ring-2 ring-red-300" : "bg-white/[0.08] text-white hover:bg-white/[0.15]"}`}>{on ? `✕ ${label}` : label}</button>
                  );
                })}
                <button type="button" onClick={() => toggleMulti(m.id)} aria-pressed={inMulti}
                  className={`rounded-md px-1 py-1 text-[10.5px] font-bold ${inMulti ? "bg-yellow-400 text-black" : "border border-white/10 text-neutral-400 hover:text-white"}`}>{inMulti ? "Multi ✓" : "Multi"}</button>
              </div>
            </li>
            </Fragment>
          );
        })}
      </ul>
      <div className="mt-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-neutral-400">Jornada de ayer · {yesterdayBoard.length} {yesterdayBoard.length === 1 ? "resultado" : "resultados"}</p>
          <button type="button" onClick={() => openShow(yyyymmdd(new Date(Date.now() - 86400000)))} className="ml-auto inline-flex items-center gap-1 rounded-lg bg-red-500 px-2.5 py-1.5 text-[11px] font-black text-white hover:bg-red-400">▶ Programa automático con la jornada de ayer</button>
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {yesterdayBoard.slice(0, 16).map((m) => (
            <span key={m.id} className="inline-flex items-center gap-1 rounded-md bg-white/[0.04] px-1.5 py-0.5 text-[10.5px] text-neutral-300">
              <Crest src={m.homeLogo} name={m.homeTeam} />{short(m.homeTeam)} <b className="tabular-nums text-white">{m.homeScore ?? 0}-{m.awayScore ?? 0}</b> {short(m.awayTeam)}<Crest src={m.awayLogo} name={m.awayTeam} />
            </span>
          ))}
        </div>
      </div>
    </div>
  );

  const calendar = <MatchRail fm={fm} onAirMatch={(ref, what) => { setTarget(ref); props.onMatch(ref, what); }} embedded />;
  const data = <DataDeck fm={fm} onAir={props.onDataAir} embedded />;
  const autoPanel = <AutoShowPanel handlers={props.autoShow} presetDate={showDate} />;

  // The program monitor: tap a graphic to hide it; quick buttons on its edges.
  const quick: { label: string; action: Action }[] = [
    { label: "Marcador", action: "pro" }, { label: "Jornada", action: "multi" }, { label: "Cinta", action: "cinta" },
    { label: "Alineac.", action: "lineup-home" }, { label: "Stats", action: "stats" },
  ];
  const screen = (
    <div className="group relative aspect-video w-full overflow-hidden rounded-lg bg-black"
      style={desktop ? { maxHeight: monitorH, maxWidth: `calc(${monitorH} * 16 / 9)` } : undefined}>
      <div className="h-full w-full cursor-pointer" title="Toca un gráfico para ocultarlo"
        onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); props.onMonitorTap((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height); }}>
        {monitor}
      </div>
      {/* edges: quick access */}
      <div className="pointer-events-none absolute inset-y-0 left-0 hidden flex-col xl:flex justify-center gap-1 p-1.5 opacity-70 transition group-hover:opacity-100">
        {quick.map((q) => (
          <button key={q.action} type="button" onClick={() => runAction(q.action)}
            className={`pointer-events-auto rounded-md px-2 py-1 text-[10px] font-bold backdrop-blur ${props.isOn(q.action as GraphicVariant) ? "bg-red-500 text-white" : "bg-black/60 text-white hover:bg-black/80"}`}>{q.label}</button>
        ))}
      </div>
      <button type="button" onClick={props.onClear} title="Ocultar todo (tecla 0)"
        className="absolute right-1 top-1 inline-flex items-center gap-1 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] xl:right-1.5 xl:top-1.5 xl:px-2 xl:py-1 xl:text-[10.5px] font-bold text-white opacity-80 backdrop-blur hover:bg-red-500 group-hover:opacity-100">
        <EyeOff size={12} /> Ocultar todo
      </button>
    </div>
  );

  const programHeader = (
    <div className="flex w-full items-center gap-2 pb-1 text-[11px]">
      <span className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 font-black uppercase tracking-wider ${live ? "bg-red-500 text-white" : "bg-white/10 text-neutral-300"}`}>{live && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />}{live ? "En vivo" : "Programa"}</span>
      <span className="truncate text-neutral-400">Activo: {activeName}</span>
      {desktop && (
        <span className="ml-auto inline-flex items-center gap-0.5 rounded-md border border-white/10 p-0.5" title="Tamaño de la pantalla">
          <Minimize2 size={11} className="mx-0.5 text-neutral-500" />
          {(["s", "m", "l"] as const).map((v) => (
            <button key={v} type="button" onClick={() => pickSize(v)} className={`rounded px-1.5 text-[10px] font-bold ${size === v ? "bg-white text-black" : "text-neutral-400 hover:text-white"}`}>{v === "s" ? "S" : v === "m" ? "M" : "L"}</button>
          ))}
          <Maximize2 size={11} className="mx-0.5 text-neutral-500" />
        </span>
      )}
      <span className={`${desktop ? "" : "ml-auto"} rounded-full px-2 py-0.5 text-[10px] font-bold ${fm.autoMode ? "bg-emerald-400 text-black" : "bg-neutral-700 text-neutral-200"}`}>{fm.autoMode ? "AUTO" : "MANUAL"}</span>
    </div>
  );

  const bottomTabs = (
    <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-white/[0.07] bg-[#0b0f15]">
      <div className="flex gap-1 border-b border-white/[0.07] p-1">
        {([["hoy", "Partidos de hoy"], ["auto", "▶ Programa automático"], ["calendario", "Calendario"], ["datos", "Datos para narrar y debatir"]] as const).map(([id, label]) => (
          <button key={id} type="button" onClick={() => setBottomTab(id)} className={`rounded-lg px-3 py-1 text-[12px] font-semibold ${bottomTab === id ? "bg-white text-black" : "text-neutral-400 hover:text-white"}`}>{label}</button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">{bottomTab === "hoy" ? todayPanel : bottomTab === "auto" ? autoPanel : bottomTab === "calendario" ? calendar : data}</div>
    </div>
  );

  // The canvas is rendered ONCE (it is what goes on air); only the tools around it change.
  if (desktop) {
    return (
      <div className="grid min-h-0 flex-1 grid-cols-[260px_minmax(0,1fr)_270px] gap-2 overflow-hidden p-2">
        <div className="min-h-0 space-y-2 overflow-y-auto pr-0.5">{scenesPanel}{backgroundsPanel}</div>
        <div className="flex min-h-0 flex-col gap-1.5">
          <div className="flex flex-none flex-col items-center rounded-xl border border-white/[0.07] bg-black/60 px-2 pb-1 pt-1.5">
            {programHeader}
            {screen}
            {slotBar}
          </div>
          <div className="flex min-h-[230px] flex-1 flex-col">{bottomTabs}</div>
        </div>
        <div className="min-h-0 overflow-y-auto pl-0.5">{graphicsPanel}</div>
      </div>
    );
  }
  const tabs = [
    ["graficos", "Gráficos", ToggleRight], ["hoy", "Partidos", ListOrdered], ["escenas", "Escenas", Clapperboard],
    ["auto", "Auto", Play], ["fondos", "Fondos", ImageIcon], ["datos", "Datos", BarChart3],
  ] as const;
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-black">
      <div className="flex-none px-1.5 pt-1">
        {programHeader}
        {screen}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="px-1.5">{slotBar}</div>
        <div className="px-1.5 pb-3">
          {mobileTab === "graficos" && graphicsPanel}
          {mobileTab === "hoy" && todayPanel}
          {mobileTab === "escenas" && <div className="space-y-2">{scenesPanel}</div>}
          {mobileTab === "fondos" && backgroundsPanel}
          {mobileTab === "calendario" && calendar}
          {mobileTab === "datos" && data}
          {mobileTab === "auto" && autoPanel}
          {mobileTab === "hoy" && <div className="mt-2 rounded-xl border border-white/[0.07]"><p className="px-3 pt-2 text-[10.5px] font-bold uppercase tracking-[0.14em] text-neutral-500">Calendario</p>{calendar}</div>}
        </div>
      </div>
      <nav className="grid flex-none grid-cols-6 border-t border-white/10 bg-[#07090d] pb-[env(safe-area-inset-bottom)]">
        {tabs.map(([id, label, Icon]) => (
          <button key={id} type="button" onClick={() => setMobileTab(id)} className={`flex flex-col items-center gap-0.5 py-2 text-[10.5px] font-semibold ${mobileTab === id ? "text-yellow-300" : "text-neutral-400"}`}>
            <Icon size={18} />{label}
          </button>
        ))}
      </nav>
    </div>
  );
}
