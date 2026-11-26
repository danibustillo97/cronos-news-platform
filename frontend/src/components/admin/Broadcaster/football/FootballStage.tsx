"use client";

// THE football control room (design system: football/ui.ts + --nx-* tokens).
//   left  : PRODUCTION LIBRARY — scenes (match / debate & analysis / no camera),
//           camera sources, virtual studios, graphic packages, backgrounds
//   center: PROGRAM canvas (tap a graphic to hide it, quick access on its edge,
//           fullscreen) + number bar 1-9 (each number = one match) + data tabs
//   right : CONTEXTUAL CONTROL — graphics as ON/OFF switches with their keys,
//           what is on air
// (The top production bar and the bottom production deck live in BroadcasterView.)
// Keys: 1-9 = scoreboard of that match (press again = hide) and it becomes the
// "active" match for line-ups / stats; 0 = hide everything; letters assignable.
// On phones the program stays on top and the tools become tabs.

import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowRightLeft, BarChart3, Check, Swords, Shirt, ListOrdered as Timeline, Trophy, Square, Camera, ChevronDown, Copy, Trash2, Clapperboard, Expand, EyeOff, Hash, Image as ImageIcon, Keyboard, ListOrdered, Lock, Maximize2, Minimize2, MonitorUp, Palette, Play, Radio, Sparkles, ToggleRight, Unlock, Upload, UserPlus, Video, X } from "lucide-react";
import type { GraphicVariant } from "../graphicExport";
import type { TransitionMode } from "../compositor";
import type { FootballMatchController } from "./useFootballMatch";
import { SET_THEME_LABEL, VIRTUAL_SETS, drawVirtualSet, type SetTheme, type VirtualSet } from "./virtualSets";
import { BACKGROUND_LABEL, type BackgroundTheme } from "./backgrounds";
import type { BoardMatch } from "./liveBoard";
import { MatchRail } from "./MatchRail";
import { DataDeck } from "./DataDeck";
import { AutoShowPanel, type AutoShowHandlers } from "./AutoShowPanel";
import { yyyymmdd } from "./recap";
import { duelDefault } from "./eventGraphics";
import type { MatchCenter } from "../engine/useMatchCenter";
import { STATUS_LABEL as MATCH_STATUS_LABEL, USAGE_LABEL, bogotaDate, bogotaTime, liveEligible, liveLabel, usageOf, type CenterMatch } from "../engine/matchStatus";
import { clear as clearSel, move as moveSel, selectAll as selectAllSel, toggle as toggleSel, updateSelection, type SelectionState } from "../engine/matchSelection";
import type { Production } from "../engine/useProduction";
import { useRemoteStudio } from "../engine/useProduction";
import { AudienceDesk, AutomationConsole, DataCenter, MobileControl, RundownPanel, StatusStrip } from "../engine/ProductionRoom";
import { ui } from "./ui";

export interface MatchRef { league: string; id: string }
export type MatchWhat = "pro" | "lineups" | "stats";

export interface StageScene { id: string; label: string; hint: string; camera: boolean; group: "partido" | "analisis" | "sin-camara"; set?: VirtualSet["layout"] | null; graphics: GraphicVariant[]; background?: BackgroundTheme }

export const STAGE_SCENES: StageScene[] = [
  { id: "partido", group: "partido", label: "Partido en vivo", hint: "Cámara al lado + marcador + resultados", camera: true, set: "set-left", graphics: ["pro", "multi"] },
  { id: "debate", group: "analisis", label: "Debate", hint: "2 cámaras + votación + marcador", camera: true, set: "set-duo", graphics: ["poll", "pro"] },
  { id: "previa", group: "partido", label: "Previa", hint: "Cámara al centro + previa + cinta", camera: true, set: "set-center", graphics: ["prematch", "cinta"] },
  { id: "entretiempo", group: "analisis", label: "Entretiempo", hint: "Mesa de análisis + estadísticas", camera: true, set: "set-desk", graphics: ["stats", "pro"] },
  { id: "camara", group: "partido", label: "Solo cámara", hint: "Cámara completa + marcador + cinta", camera: true, set: null, graphics: ["pro", "cinta"] },
  { id: "jornada-led", group: "sin-camara", label: "Jornada en pantalla LED", hint: "Todos los partidos elegidos + cinta", camera: false, set: "set-wall", graphics: ["multi", "cinta"] },
  { id: "estadio", group: "sin-camara", label: "Estadio · partido", hint: "Marcador + estadísticas + cinta", camera: false, set: "set-arena", graphics: ["pro", "stats", "cinta"] },
  { id: "previa-led", group: "sin-camara", label: "Previa sin cámara", hint: "Pantalla LED + previa + marcador", camera: false, set: "set-wall", graphics: ["prematch", "pro"] },
  { id: "jornada", group: "sin-camara", label: "Jornada clásica", hint: "Fondo de jornada + resultados", camera: false, set: null, background: "jornada", graphics: ["multi"] },
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
  /** On Program right now (for the red AL AIRE mark while preparing). */
  isLive: (variant: GraphicVariant) => boolean;
  /** Preview / Program: false = "Directo" (acts on air), true = "Preparar" (acts on Preview, TAKE sends it). */
  prepare: boolean;
  onPrepare: (on: boolean) => void;
  previewMonitor: ReactNode;
  previewList: { id: string; name: string; variant?: string }[];
  onRemovePreview: (id: string) => void;
  onPreviewTap: (x: number, y: number) => void;
  onTake: (mode?: TransitionMode) => void;
  transition: TransitionMode;
  onTransition: (mode: TransitionMode) => void;
  onCopyToPreview: () => void;
  onClearPreview: () => void;
  /** Phase 3 graphics from real data (any match; honours Directo / Preparar). */
  onMatchGraphic: (ref: MatchRef | null, what: "sub" | "card" | "timeline") => void;
  loadLineups: (ref: MatchRef) => Promise<{ home: string; away: string; homePlayers: { id: string; name: string; starter?: boolean; position?: string | null }[]; awayPlayers: { id: string; name: string; starter?: boolean; position?: string | null }[] }>;
  onDuel: (playerA: string, playerB: string) => void;
  onPollResult: () => void;
  /** Live Match Engine: real states and categories of the Colombia day. */
  center: MatchCenter;
  /** Central selection: main match + matches selected for the live production. */
  selection: SelectionState;
  activeRef: MatchRef | null;
  /** Production engines (event engine, automation, rundown, audience, remote). */
  production: Production;
  onActiveChange: (ref: MatchRef | null) => void;
  onAirPoll: (pollId: string) => void;
  onPollResultById: (pollId: string) => void;
  onAudienceMessage: (author: string, body: string) => void;
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
  /** Camera sources (cameras, screens, guests) for the library. */
  sources: { id: string; name: string; kind: string }[];
  onScreen: () => void;
  onInvite: () => void;
  inviteLabel: string;
  recording: boolean;
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

const panel = ui.panelPad;
const head = `mb-1.5 ${ui.title}`;
const keyCap = ui.kbd;
const GROUP_LABEL: Record<StageScene["group"], string> = { partido: "Partido", analisis: "Debate y análisis", "sin-camara": "Sin cámara" };
const CONTEXT_LABEL: Record<StageScene["group"] | "show", string> = { ...GROUP_LABEL, show: "Programa automático" };
/** Graphics most useful first, depending on the kind of scene on screen. */
const CONTEXT_ORDER: Record<StageScene["group"] | "show", string[]> = {
  partido: ["pro", "events", "stats", "lineup-home", "multi", "cinta", "prematch", "poll"],
  analisis: ["poll", "stats", "pro", "prematch", "lineup-home", "events", "multi", "cinta"],
  "sin-camara": ["multi", "cinta", "pro", "stats", "prematch", "lineup-home", "poll", "events"],
  show: ["cinta", "multi", "pro", "stats", "poll", "prematch", "lineup-home", "events"],
};

/** Collapsible library section (remembers open/closed). */
function Section({ id, title, icon, children, defaultOpen = true, extra }: { id: string; title: string; icon: ReactNode; children: ReactNode; defaultOpen?: boolean; extra?: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => { try { const v = localStorage.getItem(`nexus.lib.${id}`); if (v) setOpen(v === "1"); } catch { /* ignore */ } }, [id]);
  const toggle = () => setOpen((o) => { try { localStorage.setItem(`nexus.lib.${id}`, o ? "0" : "1"); } catch { /* ignore */ } return !o; });
  return (
    <section className={ui.panel}>
      <div className="flex items-center gap-1 px-2 py-1.5">
        <button type="button" onClick={toggle} aria-expanded={open} className={`${ui.title} flex-1 text-left hover:text-[var(--nx-text)]`}>
          {icon} {title}
          <ChevronDown size={12} className={`ml-auto transition ${open ? "" : "-rotate-90"}`} />
        </button>
        {extra}
      </div>
      {open && <div className="px-2 pb-2">{children}</div>}
    </section>
  );
}

export function FootballStage(props: Props) {
  const { fm, monitor, live, board } = props;
  const [mobileTab, setMobileTab] = useState<"graficos" | "hoy" | "escenas" | "fondos" | "calendario" | "datos" | "auto">("graficos");
  const [showDate, setShowDate] = useState<string | null>(null);
  const [bottomTab, setBottomTab] = useState<"centro" | "audiencia" | "hoy" | "calendario" | "datos" | "auto">("centro");
  const [tablet, setTablet] = useState(false);
  const [sideTab, setSideTab] = useState<"escaleta" | "auto" | "graficos" | "escenas">("escaleta");
  const [mobileSource, setMobileSource] = useState<"local" | "remote">("local");
  const [theme, setTheme] = useState<SetTheme>("nexus");
  const [desktop, setDesktop] = useState(true);
  const [keys, setKeys] = useState<Record<Action, string>>(DEFAULT_KEYS);
  const [assigning, setAssigning] = useState<Action | null>(null);
  const [slots, setSlots] = useState<MatchRef[]>([]);
  // main match: central selection (never overwritten by data refreshes; survives panels and reloads)
  const target = props.activeRef;
  const setTarget = (ref: MatchRef | null) => props.onActiveChange(ref);
  const [context, setContext] = useState<StageScene["group"] | "show">("partido");
  const [duelOpen, setDuelOpen] = useState(false);
  const [lineups, setLineups] = useState<Awaited<ReturnType<Props["loadLineups"]>> | null>(null);
  const [duelPick, setDuelPick] = useState<{ a: string; b: string }>({ a: "", b: "" });

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1280px)");
    const mt = window.matchMedia("(min-width: 768px)");
    const update = () => { setDesktop(mq.matches); setTablet(mt.matches && !mq.matches); };
    mt.addEventListener("change", update);
    update();
    mq.addEventListener("change", update);
    setKeys(readKeys());
    setSlots(readSlots());
    return () => { mq.removeEventListener("change", update); mt.removeEventListener("change", update); };
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



  const byId = useMemo(() => new Map(board.map((m) => [m.id, m])), [board]);
  const saveSlots = (next: MatchRef[]) => { setSlots(next); try { localStorage.setItem(SLOTS_STORE, JSON.stringify(next)); } catch { /* ignore */ } };
  // Numbers: matches that no longer exist drop out; with none assigned, the live games (then today's next ones) get 1, 2, 3…
  useEffect(() => {
    if (!board.length) return;
    const kept = slots.filter((s) => byId.has(s.id)); // numbers given by hand stay, even after the final whistle
    if (kept.length) { if (kept.length !== slots.length) saveSlots(kept); return; }
    const auto = [...cats.live, ...cats.upcoming.filter((m) => m.status === "SCHEDULED")].slice(0, 9).map((m) => ({ league: m.league, id: m.id }));
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
  const cats = props.center.categories;
  const sel = props.selection;

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
  const latest = useRef({ keys, assigning, pressSlot, runAction, active: props.keysActive, prepare: props.prepare, take: props.onTake });
  latest.current = { keys, assigning, pressSlot, runAction, active: props.keysActive, prepare: props.prepare, take: props.onTake };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const cur = latest.current;
      if (!cur.active || event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
      const el = event.target;
      if (el instanceof HTMLElement && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName))) return;
      const key = event.key.toLowerCase();
      // Preparing in Preview: Space = TAKE with the chosen transition, Enter = TAKE with a fade (same keys as the studio).
      if (cur.prepare && !cur.assigning && (event.code === "Space" || event.key === "Enter")) {
        event.preventDefault(); event.stopImmediatePropagation();
        cur.take(event.key === "Enter" ? "fade" : undefined);
        return;
      }
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
      className={`${keyCap} cursor-pointer ${assigning === action ? "animate-pulse !border-[var(--nx-gold)] !text-[var(--nx-gold)]" : "hover:!border-[var(--nx-muted)]"}`}>
      {assigning === action ? "?" : keys[action] || "–"}
    </span>
  );

  // ---------------------------------------------------------------- LEFT: production library
  const sceneButtons = (group: StageScene["group"]) => (
    <div className="grid grid-cols-2 gap-1.5 xl:grid-cols-1">
      {STAGE_SCENES.filter((sc) => sc.group === group).map((sc) => (
        <button key={sc.id} type="button" onClick={() => { setContext(sc.group); props.onScene(sc, theme); }} className={`${ui.card} px-2.5 py-1.5 text-left`}>
          <span className="block text-[12px] font-bold text-[var(--nx-text)]">{sc.label}</span>
          <span className="block text-[10px] leading-tight text-[var(--nx-dim)]">{sc.hint}</span>
        </button>
      ))}
    </div>
  );
  const scenesPanel = (
    <Section id="escenas" title="Escenas" icon={<Clapperboard size={12} className="text-[var(--nx-gold)]" />}>
      <div className="space-y-2">
        {(["partido", "analisis", "sin-camara"] as const).map((g) => (
          <div key={g}>
            <p className="mb-1 px-0.5 text-[10px] font-semibold text-[var(--nx-dim)]">{GROUP_LABEL[g]}</p>
            {sceneButtons(g)}
          </div>
        ))}
      </div>
    </Section>
  );
  const sourcesPanel = (
    <Section id="fuentes" title="Fuentes de cámara" icon={<Video size={12} className="text-[var(--nx-ok)]" />}>
      <ul className="mb-1.5 space-y-1">
        {props.sources.length === 0 && <li className="px-1 text-[11px] text-[var(--nx-dim)]">Sin cámaras conectadas.</li>}
        {props.sources.map((src) => (
          <li key={src.id} className="flex items-center gap-2 rounded-[var(--nx-r-sm)] bg-[var(--nx-s2)] px-2 py-1 text-[11px] text-[var(--nx-text)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--nx-ok)]" />
            <span className="min-w-0 flex-1 truncate">{src.name}</span>
            <span className="text-[9.5px] uppercase text-[var(--nx-dim)]">{src.kind === "screen" ? "pantalla" : src.kind === "camera" ? "cámara" : src.kind}</span>
          </li>
        ))}
      </ul>
      <div className="grid grid-cols-3 gap-1">
        <button type="button" onClick={props.onCamera} className={`${ui.btnGhost} py-1.5 text-[10.5px]`}><Camera size={12} /> Cámara</button>
        <button type="button" onClick={props.onScreen} className={`${ui.btnGhost} py-1.5 text-[10.5px]`}><MonitorUp size={12} /> Pantalla</button>
        <button type="button" onClick={props.onInvite} className={`${ui.btnGhost} py-1.5 text-[10.5px]`} title={props.inviteLabel}><UserPlus size={12} /> Invitado</button>
      </div>
    </Section>
  );
  const studiosPanel = (
    <Section id="estudios" title="Estudios virtuales" icon={<Sparkles size={12} className="text-[var(--nx-gold)]" />}>
      <div className="grid grid-cols-2 gap-1.5">
        {VIRTUAL_SETS.map((set) => (
          <button key={set.id} type="button" onClick={() => props.onSet(set, theme)} title={set.hint} className={`${ui.card} p-1 text-left`}>
            <SetThumb set={set} theme={theme} />
            <span className="mt-1 block px-0.5 text-[10px] font-semibold leading-tight text-[var(--nx-text)]">{set.label}</span>
          </button>
        ))}
      </div>
    </Section>
  );
  const packagesPanel = (
    <Section id="paquetes" title="Paquete gráfico" icon={<Palette size={12} className="text-[var(--nx-gold)]" />}>
      <div className="flex flex-wrap gap-1">
        {(Object.keys(SET_THEME_LABEL) as SetTheme[]).map((t) => (
          <button key={t} type="button" onClick={() => setTheme(t)} className={theme === t ? ui.chipOn : ui.chip}>{SET_THEME_LABEL[t]}</button>
        ))}
      </div>
      <p className="mt-1.5 px-0.5 text-[10px] text-[var(--nx-dim)]">Se elige solo según la liga del partido principal; los estudios y escenas usan este paquete.</p>
    </Section>
  );
  const backgroundsPanel = (
    <Section id="fondos" title="Fondos" icon={<ImageIcon size={12} className="text-[var(--nx-ok)]" />} defaultOpen={false}
      extra={(
        <button type="button" onClick={props.onToggleBgLock} title={props.bgLocked ? "Fondo bloqueado: las escenas no lo cambian" : "Bloquear fondo"} className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] ${props.bgLocked ? "bg-[var(--nx-gold)] text-[var(--nx-gold-ink)]" : "text-[var(--nx-dim)] hover:text-[var(--nx-text)]"}`}>
          {props.bgLocked ? <Lock size={11} /> : <Unlock size={11} />} {props.bgLocked ? "Bloqueado" : "Libre"}
        </button>
      )}>
      <div className="grid grid-cols-3 gap-1">
        {props.backgrounds.map((b) => (
          <button key={b.id} type="button" onClick={() => props.onBackgroundItem(b.id)} title={b.name} className="overflow-hidden rounded-[var(--nx-r-sm)] border border-[var(--nx-line-2)] hover:border-[var(--nx-gold)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={b.url} alt={b.name} className="aspect-video w-full object-cover" />
          </button>
        ))}
        <label className="grid aspect-video cursor-pointer place-items-center rounded-[var(--nx-r-sm)] border border-dashed border-[var(--nx-line-2)] text-[var(--nx-muted)] hover:border-[var(--nx-gold)] hover:text-[var(--nx-text)]" title="Subir tu fondo (1920×1080)">
          <Upload size={14} />
          <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) props.onUploadBackground(f); e.target.value = ""; }} />
        </label>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1">
        {(Object.keys(BACKGROUND_LABEL) as BackgroundTheme[]).map((t) => (
          <button key={t} type="button" onClick={() => props.onThemeBackground(t)} className={ui.chip}>{BACKGROUND_LABEL[t].split(" · ")[0]}</button>
        ))}
        <button type="button" onClick={props.onNoBackground} className={ui.chip}>Sin fondo</button>
      </div>
    </Section>
  );
  const libraryPanel = <div className="space-y-2">{scenesPanel}{sourcesPanel}{studiosPanel}{packagesPanel}{backgroundsPanel}</div>;

  const graphicsPanel = (
    <div className="space-y-2">
      <div className={panel}>
        <p className={head}><ToggleRight size={12} className="text-[var(--nx-gold)]" /> Gráficos · {props.prepare ? "se preparan en Preview" : "salen al aire"}</p>
        <div className="mb-1.5 flex flex-wrap items-center gap-1 rounded-[var(--nx-r-sm)] bg-[var(--nx-s2)] px-2 py-1 text-[10.5px] text-[var(--nx-muted)]">
          <span>Contexto:</span><b className="text-[var(--nx-text)]">{CONTEXT_LABEL[context]}</b>
          {context === "analisis" && <button type="button" onClick={() => { setBottomTab("datos"); setMobileTab("datos"); }} className="ml-auto text-[var(--nx-gold)] hover:underline">Lanzar debate / votación</button>}
          {(context === "sin-camara" || context === "show") && <button type="button" onClick={() => { setContext("show"); setBottomTab("auto"); setMobileTab("auto"); }} className="ml-auto text-[var(--nx-gold)] hover:underline">Programa automático</button>}
          {context === "partido" && <button type="button" onClick={() => { setBottomTab("hoy"); setMobileTab("hoy"); }} className="ml-auto text-[var(--nx-gold)] hover:underline">Elegir partido</button>}
        </div>
        <p className="mb-1.5 truncate rounded-[var(--nx-r-sm)] bg-[var(--nx-s2)] px-2 py-1 text-[10.5px] text-[var(--nx-muted)]">Partido activo: <b className="text-[var(--nx-text)]">{activeName}</b></p>
        <div className="grid grid-cols-2 gap-1.5 xl:grid-cols-1">
          {[...TOGGLES].sort((a, b) => CONTEXT_ORDER[context].indexOf(a.variant) - CONTEXT_ORDER[context].indexOf(b.variant)).map((t) => {
            const on = props.isOn(t.variant);
            const liveNow = props.isLive(t.variant);
            return (
              <button key={t.variant} type="button" onClick={() => runAction(t.variant)} aria-pressed={on}
                className={`flex items-center gap-2 px-2 py-1.5 text-left transition ${on ? ui.cardOn : ui.card}`}>
                <span className={`flex h-5 w-9 flex-shrink-0 items-center rounded-full p-0.5 transition ${on ? "justify-end bg-[var(--nx-gold)]" : "justify-start bg-white/15"}`}><span className="h-4 w-4 rounded-full bg-white" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[12px] font-bold text-[var(--nx-text)]">{t.label}</span>
                  <span className="flex items-center gap-1.5 truncate text-[10px]">
                    {props.prepare && on && <span className="font-bold text-[var(--nx-ok)]">EN PREVIEW</span>}
                    {liveNow && <span className="inline-flex items-center gap-1 font-bold text-[var(--nx-live)]"><span className={ui.liveDot} />AL AIRE</span>}
                    {!on && !liveNow && <span className="text-[var(--nx-dim)]">{t.hint}</span>}
                  </span>
                </span>
                {desktop && keyBadge(t.variant)}
              </button>
            );
          })}
        </div>
        {desktop && (
          <p className="mt-1.5 flex flex-wrap items-center gap-1 px-0.5 text-[10px] text-[var(--nx-dim)]">
            <Keyboard size={11} /> <span className={keyCap}>1</span>–<span className={keyCap}>9</span> marcador de ese partido · {keyBadge("hide")} ocultar todo · toca una tecla para cambiarla
          </p>
        )}
      </div>
      <div className={panel}>
        <p className={head}><Shirt size={12} className="text-[var(--nx-gold)]" /> Gráficos del partido</p>
        <p className="mb-1.5 px-0.5 text-[10px] text-[var(--nx-dim)]">Del partido activo, con datos reales{props.prepare ? " · van a Preview" : ""}.</p>
        <div className="grid grid-cols-2 gap-1">
          <button type="button" onClick={() => props.onMatchGraphic(active, "sub")} className={`${ui.btnGhost} py-1.5 text-[11px]`}><ArrowRightLeft size={12} /> Último cambio</button>
          <button type="button" onClick={() => props.onMatchGraphic(active, "card")} className={`${ui.btnGhost} py-1.5 text-[11px]`}><Square size={11} className="fill-[var(--nx-gold)] text-[var(--nx-gold)]" /> Última tarjeta</button>
          <button type="button" onClick={() => props.onMatchGraphic(active, "timeline")} className={`${ui.btnGhost} py-1.5 text-[11px]`}><Timeline size={12} /> Línea de tiempo</button>
          <button type="button" onClick={() => {
            if (!active) return;
            setDuelOpen((o) => !o);
            if (!duelOpen) void props.loadLineups(active).then((l) => { setLineups(l); setDuelPick({ a: duelDefault(l.homePlayers), b: duelDefault(l.awayPlayers) }); }).catch(() => setLineups(null));
          }} disabled={!active} className={`${duelOpen ? ui.cardOn : ui.btnGhost} inline-flex items-center justify-center gap-1.5 py-1.5 text-[11px]`}><Swords size={12} /> Duelo</button>
          <button type="button" onClick={props.onPollResult} className={`${ui.btnGhost} col-span-2 py-1.5 text-[11px]`}><Trophy size={12} /> Resultado del debate / votación</button>
        </div>
        {duelOpen && (
          <div className="mt-1.5 space-y-1 rounded-[var(--nx-r-sm)] bg-[var(--nx-s2)] p-1.5">
            {!lineups && <p className="text-[10.5px] text-[var(--nx-dim)]">Cargando alineaciones…</p>}
            {lineups && !lineups.homePlayers.length && <p className="text-[10.5px] text-[var(--nx-dim)]">Las alineaciones de ese partido aún no están publicadas.</p>}
            {lineups && lineups.homePlayers.length > 0 && (["a", "b"] as const).map((k) => (
              <label key={k} className="block text-[10px] text-[var(--nx-muted)]">{k === "a" ? lineups.home : lineups.away}
                <select value={duelPick[k]} onChange={(e) => setDuelPick({ ...duelPick, [k]: e.target.value })} className="mt-0.5 w-full rounded border border-[var(--nx-line-2)] bg-black/40 px-1.5 py-1 text-[11px] text-[var(--nx-text)]">
                  {(k === "a" ? lineups.homePlayers : lineups.awayPlayers).map((pl) => <option key={pl.id} value={pl.id}>{pl.name}{pl.starter ? "" : " (suplente)"}</option>)}
                </select>
              </label>
            ))}
            {lineups && lineups.homePlayers.length > 0 && (
              <button type="button" disabled={!duelPick.a || !duelPick.b} onClick={() => props.onDuel(duelPick.a, duelPick.b)} className={`${ui.btnPrimary} w-full py-1.5 text-[11px]`}><Swords size={12} /> {props.prepare ? "Preparar duelo" : "Duelo al aire"}</button>
            )}
          </div>
        )}
      </div>
      {props.prepare && (
        <div className={panel}>
          <p className={head}><span className="h-2 w-2 rounded-full bg-[var(--nx-ok)]" /> En preview
            <button type="button" onClick={props.onCopyToPreview} title="Copiar lo que está al aire a Preview" className="ml-auto inline-flex items-center gap-1 normal-case tracking-normal text-[var(--nx-muted)] hover:text-[var(--nx-text)]"><Copy size={11} /> Igualar</button>
            <button type="button" onClick={props.onClearPreview} title="Vaciar Preview" className="inline-flex items-center gap-1 normal-case tracking-normal text-[var(--nx-muted)] hover:text-[var(--nx-live)]"><Trash2 size={11} /></button>
          </p>
          {props.previewList.length === 0 && <p className="px-1 text-[11px] text-[var(--nx-dim)]">Preview sin gráficos. Enciende uno o elige una escena.</p>}
          <ul className="space-y-1">
            {props.previewList.map((g) => (
              <li key={g.id} className="flex items-center gap-1.5 rounded-[var(--nx-r-sm)] bg-[var(--nx-s2)] py-1 pl-2 pr-1 text-[11px] text-[var(--nx-text)]">
                <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[var(--nx-ok)]" />
                <span className="min-w-0 flex-1 truncate">{g.name}</span>
                <button type="button" onClick={() => props.onRemovePreview(g.id)} aria-label={`Quitar ${g.name} de Preview`} className="rounded p-0.5 text-[var(--nx-dim)] hover:bg-white/10 hover:text-white"><X size={12} /></button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className={panel}>
        <p className={head}><Radio size={12} className="text-[var(--nx-live)]" /> Al aire ahora
          {props.onAir.length > 0 && <button type="button" onClick={props.onClear} className="ml-auto inline-flex items-center gap-1 normal-case tracking-normal text-[var(--nx-muted)] hover:text-[var(--nx-live)]"><EyeOff size={11} /> Ocultar todo</button>}
        </p>
        {props.onAir.length === 0 && <p className="px-1 text-[11px] text-[var(--nx-dim)]">Nada encima. Toca un gráfico en la pantalla para quitarlo.</p>}
        <ul className="space-y-1">
          {props.onAir.map((g) => (
            <li key={g.id} className="flex items-center gap-1.5 rounded-[var(--nx-r-sm)] bg-[var(--nx-s2)] py-1 pl-2 pr-1 text-[11px] text-[var(--nx-text)]">
              <span className={`${ui.liveDot} flex-shrink-0`} />
              <span className="min-w-0 flex-1 truncate">{g.name}</span>
              <button type="button" onClick={() => props.onRemove(g.id)} aria-label={`Quitar ${g.name}`} className="rounded p-0.5 text-neutral-500 hover:bg-white/10 hover:text-white"><X size={12} /></button>
            </li>
          ))}
        </ul>
      </div>
      <button type="button" onClick={props.onAdvanced} className={`${ui.btnGhost} w-full py-1.5 text-[10.5px] !text-[var(--nx-muted)]`}>Controles avanzados (manual, widgets, medios)</button>
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
            className={`flex min-w-[124px] flex-shrink-0 items-center gap-1.5 px-1.5 py-0.5 text-left ${on ? ui.cardOn : isTarget ? "rounded-[var(--nx-r)] border border-[var(--nx-ok)] bg-[var(--nx-s2)]" : ui.card}`}>
            <span className={`grid h-6 w-6 flex-shrink-0 place-items-center rounded-md text-[13px] font-black ${on ? "bg-[var(--nx-gold)] text-[var(--nx-gold-ink)]" : "bg-[var(--nx-text)] text-black"}`}>{i + 1}</span>
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

  // Matches of the Colombia day by REAL state: EN VIVO AHORA · PRÓXIMOS · FINALIZADOS HOY · ANTERIORES.
  // Only live matches can be selected for the live production; upcoming → previa, finished → post-match.
  const refOfC = (m: CenterMatch): MatchRef => ({ league: m.league, id: m.id });
  const crest = (src: string | undefined, name: string) => <Crest src={src} name={name} />;
  const matchRow = (m: CenterMatch) => {
    const ref = refOfC(m);
    const usage = usageOf(m.status);
    const selected = sel.selectedMatchIds.includes(m.id);
    const order = sel.selectedMatchIds.indexOf(m.id);
    const isMain = active?.id === m.id;
    const n = slotOf(m.id);
    const started = usage === "live" || usage === "post";
    return (
      <li key={m.id} className={`rounded-[var(--nx-r)] border p-2 ${selected ? "border-[var(--nx-live)] bg-[color-mix(in_srgb,var(--nx-live)_10%,var(--nx-s2))]" : isMain ? "border-[var(--nx-gold)] bg-[var(--nx-s2)]" : "border-[var(--nx-line)] bg-[var(--nx-s2)]"}`}>
        <div className="flex items-center gap-2">
          {usage === "live" ? (
            <button type="button" aria-pressed={selected} onClick={() => updateSelection((x) => toggleSel(x, m.id, liveEligible(m)))} title={selected ? "Quitar de la producción en vivo" : "Seleccionar para la producción en vivo"}
              className={`grid h-8 w-8 flex-shrink-0 place-items-center rounded-md text-[13px] font-black ${selected ? "bg-[var(--nx-live)] text-white" : "border border-[var(--nx-line-2)] text-[var(--nx-muted)] hover:text-white"}`}>{selected ? order + 1 : <Check size={14} />}</button>
          ) : (
            <span className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-md border border-dashed border-[var(--nx-line)] text-[9px] font-bold uppercase text-[var(--nx-dim)]" title="Solo los partidos en juego se seleccionan para el directo">{usage === "preview" ? "PRE" : usage === "post" ? "FIN" : "—"}</span>
          )}
          <div className="min-w-0 flex-1 leading-tight">
            <p className="flex items-center gap-1.5 text-[12px] font-semibold text-[var(--nx-text)]">{crest(m.home.logo, m.home.name)}<span className="truncate">{m.home.name}</span><b className="ml-auto tabular-nums">{m.status === "SCHEDULED" ? "" : m.home.score}</b></p>
            <p className="flex items-center gap-1.5 text-[12px] font-semibold text-[var(--nx-text)]">{crest(m.away.logo, m.away.name)}<span className="truncate">{m.away.name}</span><b className="ml-auto tabular-nums">{m.status === "SCHEDULED" ? "" : m.away.score}</b></p>
          </div>
        </div>
        <p className="mt-1 flex items-center gap-1.5 text-[10px] text-[var(--nx-dim)]">
          <span className="truncate">{m.leagueName}</span>
          {m.stale && <span className="rounded bg-[var(--nx-live)]/20 px-1 font-bold text-[var(--nx-live)]" title="La fuente no confirmó este dato en la última lectura">desactualizado</span>}
          <span className={`ml-auto flex-shrink-0 font-bold ${usage === "live" ? "text-[var(--nx-live)]" : ""}`}>
            {usage === "live" ? `● ${liveLabel(m)}` : m.status === "SCHEDULED" ? `${bogotaDate(m.kickoff)} · ${bogotaTime(m.kickoff)}` : MATCH_STATUS_LABEL[m.status]}
          </span>
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          <button type="button" onClick={() => setTarget(ref)} className={`rounded-md px-2 py-1 text-[10.5px] font-bold ${isMain ? "bg-[var(--nx-gold)] text-[var(--nx-gold-ink)]" : "border border-[var(--nx-line-2)] text-[var(--nx-text)] hover:bg-[var(--nx-s3)]"}`}>{isMain ? "★ Principal" : `Principal (${USAGE_LABEL[usage]})`}</button>
          {selected && <>
            <button type="button" onClick={() => updateSelection((x) => moveSel(x, m.id, -1))} title="Antes en la multipantalla" className="rounded border border-[var(--nx-line-2)] p-1 text-[var(--nx-muted)] hover:text-white"><ChevronDown size={11} className="rotate-180" /></button>
            <button type="button" onClick={() => updateSelection((x) => moveSel(x, m.id, 1))} title="Después en la multipantalla" className="rounded border border-[var(--nx-line-2)] p-1 text-[var(--nx-muted)] hover:text-white"><ChevronDown size={11} /></button>
          </>}
          <button type="button" onClick={() => toggleSlot(m.id)} title={n >= 0 ? "Quitar su número" : "Asignar el siguiente número (tecla)"} className={`rounded px-1.5 py-1 text-[10px] font-black ${n >= 0 ? "bg-[var(--nx-text)] text-black" : "border border-dashed border-[var(--nx-line-2)] text-[var(--nx-dim)]"}`}>{n >= 0 ? `#${n + 1}` : "#"}</button>
          {usage !== "none" && ([["pro", usage === "preview" ? "Marcador previa" : "Marcador"], ["lineups", "Alineac."], ["stats", "Stats"]] as const).map(([w, label]) => {
            const on = props.isMatchOn(ref, w);
            const blocked = w === "stats" && !started;
            return <button key={w} type="button" disabled={blocked} title={blocked ? "El partido no ha comenzado" : undefined} onClick={() => { setTarget(ref); props.onMatch(ref, w); }}
              className={`rounded-md px-1.5 py-1 text-[10.5px] font-bold disabled:opacity-30 ${on ? "bg-[var(--nx-gold)] text-[var(--nx-gold-ink)]" : "bg-[var(--nx-s3)] text-[var(--nx-text)]"}`}>{on ? `✕ ${label}` : label}</button>;
          })}
        </div>
      </li>
    );
  };
  const section = (title: string, list: CenterMatch[], empty: string, extra?: ReactNode, tone = "") => (
    <section className="mb-3">
      <div className="mb-1.5 flex flex-wrap items-center gap-2">
        <h4 className={`text-[11px] font-black uppercase tracking-[0.16em] ${tone || "text-[var(--nx-muted)]"}`}>{title} ({list.length})</h4>
        {extra}
      </div>
      {list.length === 0 ? <p className="rounded-[var(--nx-r-sm)] border border-dashed border-[var(--nx-line)] px-3 py-2 text-[11.5px] text-[var(--nx-dim)]">{empty}</p>
        : <ul className="grid gap-1.5 sm:grid-cols-2 2xl:grid-cols-3">{list.map(matchRow)}</ul>}
    </section>
  );
  const mainMatch = active ? props.center.matches.get(active.id) : undefined;
  const todayPanel = (
    <div className="p-2">
      <div className="mb-2 flex flex-wrap items-center gap-1.5 rounded-[var(--nx-r-sm)] bg-[var(--nx-s2)] px-2 py-1.5 text-[11px] text-[var(--nx-muted)]">
        <span><b className="text-[var(--nx-text)]">{sel.selectedMatchIds.length}</b> seleccionados para el directo</span>
        <span>· Principal: <b className="text-[var(--nx-gold)]">{mainMatch ? `${mainMatch.home.name} vs ${mainMatch.away.name} (${USAGE_LABEL[usageOf(mainMatch.status)]})` : active ? activeName : "ninguno"}</b></span>
        <span className="ml-auto">{props.center.error ? <span className="font-bold text-[var(--nx-live)]">{props.center.error}</span> : props.center.lastOk ? `Actualizado ${bogotaTime(props.center.lastOk)} (hora Colombia)` : "Cargando…"}</span>
      </div>
      {section("En vivo ahora", cats.live, props.center.lastOk ? "No hay partidos en vivo ahora mismo en las ligas seguidas." : "Consultando la fuente…", cats.live.length > 0 && (
        <span className="ml-auto flex gap-1">
          <button type="button" onClick={() => updateSelection((x) => selectAllSel(x, cats.live.map((m) => m.id)))} className={`${ui.btnGhost} px-2 py-0.5 text-[10.5px]`}>Seleccionar todos</button>
          <button type="button" onClick={() => updateSelection(clearSel)} disabled={!sel.selectedMatchIds.length} className={`${ui.btnGhost} px-2 py-0.5 text-[10.5px]`}>Ninguno</button>
        </span>
      ), "text-[var(--nx-live)]")}
      <p className="-mt-2 mb-3 px-0.5 text-[10px] text-[var(--nx-dim)]">La multipantalla muestra los seleccionados en ese orden (o todos los en vivo si no eliges). Cada gráfico queda asociado a su partido.</p>
      {section("Próximos", cats.upcoming, "No hay más partidos programados.")}
      {section("Finalizados hoy", cats.finishedToday, "Ningún partido ha terminado hoy.")}
      <section className="mb-1">
        <div className="mb-1.5 flex flex-wrap items-center gap-2">
          <h4 className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--nx-muted)]">Partidos anteriores ({cats.previous.length})</h4>
          <button type="button" onClick={() => openShow(yyyymmdd(new Date(Date.now() - 86400000)))} className={`ml-auto ${ui.btnPrimary} px-2.5 py-1 text-[11px]`}>▶ Programa automático con la jornada de ayer</button>
        </div>
        <div className="flex flex-wrap gap-1">
          {cats.previous.slice(0, 18).map((m) => (
            <button key={m.id} type="button" onClick={() => { setTarget(refOfC(m)); setContext("partido"); }} title="Hacerlo el partido principal (postpartido: cronología, tarjetas, duelo, estadísticas)"
              className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] ${active?.id === m.id ? "bg-[var(--nx-gold)] text-[var(--nx-gold-ink)]" : "bg-[var(--nx-s3)] text-[var(--nx-muted)] hover:text-[var(--nx-text)]"}`}>
              {crest(m.home.logo, m.home.name)}{short(m.home.name)} <b className="tabular-nums">{m.home.score}-{m.away.score}</b> {short(m.away.name)}{crest(m.away.logo, m.away.name)}
              <span className="text-[9px] opacity-70">{bogotaDate(m.kickoff)}</span>
            </button>
          ))}
          {!cats.previous.length && <p className="text-[11px] text-[var(--nx-dim)]">Sin partidos anteriores recientes.</p>}
        </div>
      </section>
    </div>
  );
  const openShow = (date: string) => { setShowDate(date); setBottomTab("auto"); setMobileTab("auto"); };

  const calendar = <MatchRail fm={fm} onAirMatch={(ref, what) => { setTarget(ref); props.onMatch(ref, what); }} embedded />;
  const data = <DataDeck fm={fm} onAir={props.onDataAir} embedded />;
  const autoPanel = <AutoShowPanel handlers={props.autoShow} presetDate={showDate} />;
  const P = props.production;
  const dataCenter = <DataCenter p={P} />;
  const audienceDesk = <AudienceDesk p={P} onAirPoll={props.onAirPoll} onResult={props.onPollResultById} onMessage={props.onAudienceMessage} />;
  const remote = useRemoteStudio(!desktop && !tablet, P.studioId);

  // The program monitor: tap a graphic to hide it; quick buttons on its edges.
  const quick: { label: string; action: Action }[] = [
    { label: "Marcador", action: "pro" }, { label: "Jornada", action: "multi" }, { label: "Cinta", action: "cinta" },
    { label: "Alineac.", action: "lineup-home" }, { label: "Stats", action: "stats" },
  ];
  const screenRef = useRef<HTMLDivElement>(null);
  const fullscreen = () => { const el = screenRef.current; if (!el) return; if (document.fullscreenElement) void document.exitFullscreen(); else void el.requestFullscreen?.(); };
  const twoUp = props.prepare && desktop;
  const monitorStyle = desktop ? (twoUp
    ? { maxHeight: monitorH, maxWidth: `calc(${monitorH} * 16 / 9)` }
    : { maxHeight: monitorH, maxWidth: `calc(${monitorH} * 16 / 9)` }) : undefined;
  const previewScreen = (
    <div className="relative aspect-video w-full overflow-hidden rounded-[var(--nx-r)] bg-black ring-2 ring-[var(--nx-ok)]" style={monitorStyle}>
      <div className="h-full w-full cursor-pointer" title="Toca un gráfico para quitarlo de Preview"
        onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); props.onPreviewTap((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height); }}>
        {props.previewMonitor}
      </div>
      <span className="pointer-events-none absolute left-1.5 top-1.5 rounded bg-[var(--nx-ok)] px-1.5 py-0.5 text-[10px] font-black tracking-[0.16em] text-black">PREVIEW</span>
    </div>
  );
  const transitions: [TransitionMode, string][] = [["cut", "Corte"], ["fade", "Fundido"], ["wipe", "Barrido"], ["dip", "A negro"]];
  const takeBar = props.prepare && (
    <div className="flex w-full flex-wrap items-center gap-1.5 pt-1.5">
      <span className={ui.title}><ArrowRightLeft size={12} /> Transición</span>
      {transitions.map(([mode, label]) => (
        <button key={mode} type="button" onClick={() => props.onTransition(mode)} className={props.transition === mode ? ui.chipOn : ui.chip}>{label}</button>
      ))}
      <button type="button" onClick={() => props.onTake()} className={`ml-auto px-5 py-2 text-[13px] font-black tracking-wider ${ui.btnPrimary}`}>
        TAKE <kbd className="rounded bg-black/20 px-1 text-[10px]">Espacio</kbd>
      </button>
    </div>
  );
  const screen = (
    <div ref={screenRef} className="group relative aspect-video w-full overflow-hidden rounded-[var(--nx-r)] bg-black ring-1 ring-[var(--nx-line-2)]"
      style={monitorStyle}>
      <div className="h-full w-full cursor-pointer" title="Toca un gráfico para ocultarlo"
        onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); props.onMonitorTap((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height); }}>
        {monitor}
      </div>
      {props.prepare && <span className="pointer-events-none absolute left-1.5 top-1.5 rounded bg-[var(--nx-live)] px-1.5 py-0.5 text-[10px] font-black tracking-[0.16em] text-white">PROGRAM</span>}
      {/* edges: quick access */}
      <div className={`pointer-events-none absolute inset-y-0 left-0 hidden flex-col justify-center gap-1 p-1.5 opacity-70 transition group-hover:opacity-100 ${props.prepare ? "" : "xl:flex"}`}>
        {quick.map((q) => (
          <button key={q.action} type="button" onClick={() => runAction(q.action)}
            className={`pointer-events-auto rounded-md px-2 py-1 text-[10px] font-bold backdrop-blur ${props.isOn(q.action as GraphicVariant) ? "bg-[var(--nx-gold)] text-[var(--nx-gold-ink)]" : "bg-black/60 text-white hover:bg-black/80"}`}>{q.label}</button>
        ))}
      </div>
      <button type="button" onClick={props.onClear} title="Ocultar todo (tecla 0)"
        className="absolute right-1 top-1 inline-flex items-center gap-1 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] xl:right-1.5 xl:top-1.5 xl:px-2 xl:py-1 xl:text-[10.5px] font-bold text-white opacity-80 backdrop-blur hover:bg-[var(--nx-live)] group-hover:opacity-100">
        <EyeOff size={12} /> Ocultar todo
      </button>
      <button type="button" onClick={fullscreen} title="Pantalla completa" aria-label="Pantalla completa"
        className="absolute bottom-1.5 right-1.5 hidden rounded-md bg-black/70 p-1.5 text-white opacity-0 backdrop-blur transition hover:bg-black group-hover:opacity-100 xl:block">
        <Expand size={13} />
      </button>
    </div>
  );

  const programHeader = (
    <div className="flex w-full items-center gap-2 pb-1 text-[11px]">
      <span className="inline-flex flex-shrink-0 rounded-[var(--nx-r-sm)] border border-[var(--nx-line-2)] p-0.5" role="group" aria-label="Modo de trabajo">
        <button type="button" onClick={() => props.onPrepare(false)} aria-pressed={!props.prepare} title="Lo que tocas sale al aire de inmediato" className={`rounded px-2 py-0.5 text-[10.5px] font-bold ${!props.prepare ? "bg-[var(--nx-live)] text-white" : "text-[var(--nx-muted)] hover:text-[var(--nx-text)]"}`}>Directo</button>
        <button type="button" onClick={() => props.onPrepare(true)} aria-pressed={props.prepare} title="Arma la escena en Preview y sácala con TAKE" className={`rounded px-2 py-0.5 text-[10.5px] font-bold ${props.prepare ? "bg-[var(--nx-ok)] text-black" : "text-[var(--nx-muted)] hover:text-[var(--nx-text)]"}`}>Preparar</button>
      </span>
      <span className={`inline-flex flex-shrink-0 items-center gap-1.5 whitespace-nowrap rounded px-2 py-0.5 font-black uppercase tracking-wider ${live ? "bg-[var(--nx-live)] text-white" : "border border-[var(--nx-line-2)] text-[var(--nx-dim)]"}`}>{live && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />}{live ? "Al aire" : "Fuera del aire"}</span>
      {props.recording && <span className="inline-flex items-center gap-1 rounded border border-[var(--nx-live)] px-1.5 py-0.5 font-bold text-[var(--nx-live)]"><span className={ui.liveDot} /> REC</span>}
      <span className="truncate text-[var(--nx-muted)]">Activo: {activeName}</span>
      {desktop && (
        <span className="ml-auto inline-flex items-center gap-0.5 rounded-md border border-[var(--nx-line-2)] p-0.5" title="Tamaño de la pantalla">
          <Minimize2 size={11} className="mx-0.5 text-[var(--nx-dim)]" />
          {(["s", "m", "l"] as const).map((v) => (
            <button key={v} type="button" onClick={() => pickSize(v)} className={`rounded px-1.5 text-[10px] font-bold ${size === v ? "bg-[var(--nx-text)] text-black" : "text-[var(--nx-muted)] hover:text-[var(--nx-text)]"}`}>{v === "s" ? "S" : v === "m" ? "M" : "L"}</button>
          ))}
          <Maximize2 size={11} className="mx-0.5 text-[var(--nx-dim)]" />
        </span>
      )}
      <span className={`${desktop ? "" : "ml-auto"} rounded-full px-2 py-0.5 text-[10px] font-bold ${fm.autoMode ? "bg-[var(--nx-ok)] text-black" : "bg-[var(--nx-s3)] text-[var(--nx-muted)]"}`}>{fm.autoMode ? "AUTO" : "MANUAL"}</span>
    </div>
  );

  const statusStrip = <div className="w-full pb-1"><StatusStrip p={P} live={live} recording={props.recording} cameras={props.sources.length} /></div>;
  const bottomTabs = (
    <div className={`flex min-h-0 flex-1 flex-col ${ui.panel}`}>
      <div className="flex gap-1 overflow-x-auto whitespace-nowrap border-b border-[var(--nx-line)] p-1 [scrollbar-width:none]">
        {([["centro", "Centro de datos"], ["audiencia", "Audiencia"], ["hoy", "Partidos de hoy"], ["auto", "▶ Programa automático"], ["calendario", "Calendario"], ["datos", "Datos para narrar"]] as const).map(([id, label]) => (
          <button key={id} type="button" onClick={() => setBottomTab(id)} className={bottomTab === id ? ui.tabOn : ui.tab}>{label}</button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">{bottomTab === "centro" ? dataCenter : bottomTab === "audiencia" ? audienceDesk : bottomTab === "hoy" ? todayPanel : bottomTab === "auto" ? autoPanel : bottomTab === "calendario" ? calendar : data}</div>
    </div>
  );

  // The canvas is rendered ONCE (it is what goes on air); only the tools around it change.
  if (desktop) {
    return (
      <div className="grid min-h-0 flex-1 grid-cols-[280px_minmax(0,1fr)_300px] gap-2 overflow-hidden bg-[var(--nx-bg)] p-2">
        <div className="min-h-0 space-y-2 overflow-y-auto pr-0.5"><RundownPanel p={P} />{libraryPanel}</div>
        <div className="flex min-h-0 flex-col gap-1.5">
          <div className={`flex flex-none flex-col items-center px-2 pb-1 pt-1.5 ${ui.panel}`}>
            {programHeader}
            {statusStrip}
            {twoUp ? <div className="grid w-full grid-cols-2 items-center gap-2">{previewScreen}{screen}</div> : screen}
            {takeBar}
            {slotBar}
          </div>
          <div className="flex min-h-[230px] flex-1 flex-col">{bottomTabs}</div>
        </div>
        <div className="min-h-0 space-y-2 overflow-y-auto pl-0.5"><AutomationConsole p={P} />{graphicsPanel}</div>
      </div>
    );
  }
  // TABLET: monitors first, one touch side panel with tabs, data below
  if (tablet) {
    const sideTabs = [["escaleta", "Escaleta"], ["auto", "Automat."], ["graficos", "Gráficos"], ["escenas", "Escenas"]] as const;
    return (
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_330px] gap-2 overflow-hidden bg-[var(--nx-bg)] p-2">
        <div className="flex min-h-0 flex-col gap-1.5 overflow-y-auto">
          <div className={`flex flex-none flex-col items-center px-2 pb-1 pt-1.5 ${ui.panel}`}>
            {programHeader}
            {statusStrip}
            {props.prepare ? <div className="grid w-full grid-cols-2 gap-1.5">{previewScreen}{screen}</div> : screen}
            {takeBar}
            {slotBar}
          </div>
          <div className="flex min-h-[320px] flex-1 flex-col">{bottomTabs}</div>
        </div>
        <div className="flex min-h-0 flex-col gap-1.5">
          <div className="grid flex-none grid-cols-4 gap-1">
            {sideTabs.map(([id, label]) => <button key={id} type="button" onClick={() => setSideTab(id)} className={`min-h-[40px] rounded-[var(--nx-r-sm)] text-[11.5px] font-bold ${sideTab === id ? "bg-[var(--nx-text)] text-black" : "bg-[var(--nx-s1)] text-[var(--nx-muted)]"}`}>{label}</button>)}
          </div>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
            {sideTab === "escaleta" && <RundownPanel p={P} compact />}
            {sideTab === "auto" && <AutomationConsole p={P} />}
            {sideTab === "graficos" && graphicsPanel}
            {sideTab === "escenas" && libraryPanel}
          </div>
        </div>
      </div>
    );
  }
  // PHONE: production remote control (this device's studio, or the studio running on the PC)
  {
    const useRemote = mobileSource === "remote" && remote.connected;
    const state = useRemote ? remote.state : P.controlState();
    const send = useRemote ? remote.send : P.dispatch;
    return (
      <div className="flex min-h-0 flex-1 flex-col bg-[var(--nx-bg)]">
        <div className={useRemote ? "hidden" : "flex-none px-1.5 pt-1"}>{screen}</div>
        <MobileControl state={state} send={send} source={useRemote ? "remote" : "local"} onSource={setMobileSource} remoteAvailable={remote.connected} />
      </div>
    );
  }
}
