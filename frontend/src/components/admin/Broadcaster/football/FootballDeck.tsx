"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Pause, Play, Undo2 } from "lucide-react";
import type { FootballTeamPlayer, GraphicVariant } from "../graphicExport";
import type { FootballMatchController } from "./useFootballMatch";
import { MatchClock } from "./MatchClock";

interface Props {
  /** False while the studio is hidden behind another admin view: shortcuts must not reach the air. */
  enabled?: boolean;
  fm: FootballMatchController;
  airGraphics: Array<{ id: string; name: string }>;
  onRetire: (graphicId: string) => void;
  onRetireAll: () => void;
  onAirTemp: (variant: GraphicVariant, options: { title?: string; subtitle?: string }) => void;
}

type Team = "home" | "away";

const PERIODS = ["PRE", "1T", "HT", "2T", "ET", "PEN", "FT"] as const;
const key = "rounded bg-black/40 px-1 text-[9px] font-semibold text-white/60";
const big = "rounded-lg border px-2 py-2.5 text-[11px] font-bold transition active:scale-[0.97]";

const THEME: Record<Team, { text: string; border: string; btn: string; keys: [string, string, string]; focusKey: string }> = {
  home: { text: "text-sky-200", border: "border-sky-400/30", btn: "border-sky-400/40 bg-sky-400/10 text-sky-100 hover:bg-sky-400/20", keys: ["G", "Y", "B"], focusKey: "D" },
  away: { text: "text-rose-200", border: "border-rose-400/30", btn: "border-rose-400/40 bg-rose-400/10 text-rose-100 hover:bg-rose-400/20", keys: ["H", "U", "N"], focusKey: "F" },
};

export function FootballDeck({ enabled = true, fm, airGraphics, onRetire, onRetireAll, onAirTemp }: Props) {
  const { match } = fm;
  const [picked, setPicked] = useState<Record<Team, FootballTeamPlayer | null>>({ home: null, away: null });
  const [dorsal, setDorsal] = useState<Record<Team, string>>({ home: "", away: "" });
  const [entering, setEntering] = useState<Record<Team, string>>({ home: "", away: "" });
  const [subMode, setSubMode] = useState<Team | null>(null);
  const dorsalRefs = { home: useRef<HTMLInputElement>(null), away: useRef<HTMLInputElement>(null) };

  const roster = useMemo(() => {
    const sorted = (team: Team) => [...(match.lineups?.[team]?.length ? match.lineups[team] : match.squads?.[team] ?? [])].sort((a, b) => Number(b.starter) - Number(a.starter));
    return { home: sorted("home"), away: sorted("away") };
  }, [match.lineups, match.squads]);

  const latest = useRef({ enabled, fm, picked, dorsal, entering, roster, airGraphics, onRetire, onRetireAll, onAirTemp });
  latest.current = { enabled, fm, picked, dorsal, entering, roster, airGraphics, onRetire, onRetireAll, onAirTemp };

  // Todo jugador sale únicamente de la columna de su equipo: nunca se mezclan.
  const resolve = (team: Team) => {
    const current = latest.current;
    if (current.picked[team]) return current.picked[team];
    const number = Number(current.dorsal[team]);
    return current.dorsal[team].trim() && Number.isFinite(number) ? current.roster[team].find((player) => player.dorsal === number) ?? null : null;
  };
  const clear = (team: Team) => {
    setPicked((state) => ({ ...state, [team]: null }));
    setDorsal((state) => ({ ...state, [team]: "" }));
  };

  const act = {
    goal: (team: Team) => { latest.current.fm.addGoal(team, resolve(team)?.name ?? ""); clear(team); },
    card: (team: Team, kind: "yellow" | "red") => { latest.current.fm.addCard(team, kind, resolve(team)?.name ?? ""); clear(team); },
    sub: (team: Team) => {
      const out = resolve(team);
      const typed = latest.current.entering[team].trim();
      const number = Number(typed);
      const incoming = (typed && Number.isFinite(number) ? latest.current.roster[team].find((player) => player.dorsal === number)?.name : undefined) ?? typed;
      if (!out || !incoming) {
        toast.error("Cambio: elige al que sale y escribe nombre o dorsal del que entra");
        return;
      }
      latest.current.fm.addSubstitution(team, out.name, incoming);
      clear(team);
      setEntering((state) => ({ ...state, [team]: "" }));
    },
    lower: (team: Team) => {
      const player = resolve(team);
      if (!player) { toast.error("Elige un jugador o escribe su dorsal en la columna del equipo"); return; }
      const teamName = team === "home" ? latest.current.fm.match.homeTeam : latest.current.fm.match.awayTeam;
      latest.current.onAirTemp("lower", { title: player.name, subtitle: `${player.dorsal ?? ""} · ${player.position ?? teamName}` });
      clear(team);
    },
    varReview: (text: string) => latest.current.fm.showVar(text),
    varOverturn: () => {
      latest.current.fm.undoGoal();
      window.setTimeout(() => latest.current.fm.showVar("GOL ANULADO"), 60);
    },
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return;
      if (!latest.current.enabled || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
      // Holding a key would otherwise add a goal or a card per auto-repeat.
      if (event.repeat) return;
      // While a dialog or menu is open, its keys (Escape above all) belong to it, not to the air.
      if (document.querySelector('[data-broadcaster-root] :is([role="dialog"], [role="menu"])')) return;
      const current = latest.current;
      const run = (fn: () => void) => { event.preventDefault(); fn(); };
      switch (event.key.toLowerCase()) {
        case "d": run(() => dorsalRefs.home.current?.focus()); break;
        case "f": run(() => dorsalRefs.away.current?.focus()); break;
        case "g": run(() => act.goal("home")); break;
        case "h": run(() => act.goal("away")); break;
        case "y": run(() => act.card("home", "yellow")); break;
        case "u": run(() => act.card("away", "yellow")); break;
        case "b": run(() => act.card("home", "red")); break;
        case "n": run(() => act.card("away", "red")); break;
        case "z": run(() => current.fm.undoGoal()); break;
        case "v": run(() => act.varReview("REVISIÓN EN CURSO")); break;
        case "p": run(() => current.fm.toggleClock()); break;
        case "l": run(() => act.lower(current.picked.away && !current.picked.home ? "away" : "home")); break;
        case "x": run(() => { const last = current.airGraphics[current.airGraphics.length - 1]; if (last) current.onRetire(last.id); }); break;
        case "escape": run(current.onRetireAll); break;
        default:
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleSub = (team: Team) => {
    if (subMode === team) { setSubMode(null); return; }
    if (!resolve(team)) { toast.error("Primero elige al jugador que sale"); return; }
    if (entering[team].trim()) { act.sub(team); return; }
    setSubMode(team);
  };
  const clickPlayer = (team: Team, player: FootballTeamPlayer) => {
    if (subMode === team) {
      const out = resolve(team);
      if (out && out.name !== player.name) {
        latest.current.fm.addSubstitution(team, out.name, player.name);
        clear(team);
      }
      setSubMode(null);
      return;
    }
    setPicked((state) => ({ ...state, [team]: state[team]?.name === player.name ? null : player }));
  };

  const column = (team: Team) => {
    const theme = THEME[team];
    const name = team === "home" ? match.homeTeam : match.awayTeam;
    const short = team === "home" ? match.homeShort || "LOC" : match.awayShort || "VIS";
    const color = team === "home" ? match.homeColor : match.awayColor;
    const logo = team === "home" ? match.homeLogo : match.awayLogo;
    const target = resolve(team);
    return (
      <div className={`flex min-w-0 flex-col gap-2 rounded-xl border bg-[#11161e] p-2.5 ${theme.border}`}>
        <div className="flex items-center gap-2.5">
          {logo ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={logo} alt="" className="h-11 w-11 flex-shrink-0 object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,.6)]" /> : <span className="h-11 w-11 flex-shrink-0 rounded-full border border-white/10" style={{ background: color || "#334155" }} />}
          <div className="min-w-0 flex-1 leading-tight">
            <span className={`block truncate text-base font-black uppercase tracking-wide ${theme.text}`}>{name}</span>
            <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-neutral-500">{team === "home" ? "Local" : "Visitante"} · {short}</span>
          </div>
          <span className="text-4xl font-black tabular-nums text-white">{team === "home" ? match.homeScore : match.awayScore}</span>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          <button type="button" onClick={() => act.goal(team)} className={`${big} ${theme.btn}`}>⚽ GOL <span className={key}>{theme.keys[0]}</span></button>
          <button type="button" onClick={() => act.card(team, "yellow")} className={`${big} border-yellow-400/40 bg-yellow-400/10 text-yellow-100 hover:bg-yellow-400/20`}>🟨 <span className={key}>{theme.keys[1]}</span></button>
          <button type="button" onClick={() => act.card(team, "red")} className={`${big} border-red-500/40 bg-red-500/10 text-red-100 hover:bg-red-500/20`}>🟥 <span className={key}>{theme.keys[2]}</span></button>
          <button type="button" onClick={() => toggleSub(team)} className={`${big} ${subMode === team ? "border-emerald-300 bg-emerald-400/20 text-emerald-100" : "border-white/10 bg-white/[0.05] text-neutral-200 hover:bg-white/10"}`}>{subMode === team ? "Elige quién entra" : "⇄ Cambio"}</button>
        </div>
        <div className="flex max-h-[96px] min-h-[48px] flex-col gap-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
          {roster[team].length === 0 && <span className="text-[10px] text-neutral-600">Sin jugadores de {short}: carga un partido o plantilla</span>}
          {[true, false].map((starter) => {
            const group = roster[team].filter((player) => player.starter === starter);
            if (!group.length) return null;
            return (
              <div key={String(starter)}>
                <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-neutral-600">{starter ? "Titulares" : "Banco"}</span>
                <div className="mt-0.5 grid grid-cols-[repeat(auto-fill,minmax(88px,1fr))] gap-1">
                  {group.map((player, index) => {
                    const active = picked[team]?.name === player.name;
                    return (
                      <button
                        key={`${player.name}-${index}`}
                        type="button"
                        onClick={() => clickPlayer(team, player)}
                        onDoubleClick={() => { if (subMode !== team) { setPicked((state) => ({ ...state, [team]: player })); window.setTimeout(() => act.goal(team), 0); } }}
                        title="Clic: seleccionar · doble clic: gol"
                        className={`flex items-center gap-1 rounded-md border px-1.5 py-1 text-left text-[10px] leading-tight ${active ? "border-emerald-300 bg-emerald-400/20 text-emerald-100" : subMode === team && !starter ? "border-emerald-400/40 text-emerald-200 hover:bg-emerald-400/10" : "border-white/10 text-neutral-200 hover:bg-white/10"}`}
                      >
                        <b className="w-5 text-center text-[13px] text-yellow-200">{player.dorsal}</b>
                        <span className="min-w-0 flex-1 truncate">{player.name.split(" ").slice(-1)[0]}{player.captain ? " ©" : ""}<i className="block text-[8px] not-italic text-neutral-500">{player.position}</i></span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-auto flex items-center gap-1.5">
          <input ref={dorsalRefs[team]} aria-label={`Dorsal ${short}`} inputMode="numeric" maxLength={2} value={dorsal[team]} onChange={(event) => setDorsal((state) => ({ ...state, [team]: event.target.value.replace(/\D/g, "") }))} onKeyDown={(event) => { if (event.key === "Enter" || event.key === "Escape") event.currentTarget.blur(); }} placeholder={`# ${theme.focusKey}`} className="h-8 w-14 rounded-md border border-yellow-300/40 bg-[#0a0d12] px-2 text-center text-[12px] font-bold text-yellow-200 outline-none focus:border-yellow-300" />
          <span className="min-w-0 flex-1 truncate rounded-md bg-black/40 px-2 py-2 text-[11px] text-neutral-300">{target ? `${target.dorsal ?? ""} ${target.name}` : "Elige jugador o dorsal"}</span>
          <input aria-label={`Entra por ${short}`} value={entering[team]} onChange={(event) => setEntering((state) => ({ ...state, [team]: event.target.value }))} placeholder="Entra" className="h-8 w-20 rounded-md border border-white/10 bg-[#0a0d12] px-2 text-[11px] text-white outline-none" />
          <button type="button" onClick={() => act.lower(team)} className="rounded-md border border-emerald-400/40 bg-emerald-400/10 px-2 py-2 text-[10px] font-bold text-emerald-100 hover:bg-emerald-400/20">Lower {team === "home" ? <span className={key}>L</span> : null}</button>
        </div>
      </div>
    );
  };

  return (
    <section aria-label="Tablero de control del partido" className="grid flex-none grid-cols-1 gap-2 border-t border-white/[0.08] bg-[#0b0f15] p-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,1fr)]">
      {column("home")}
      <div className="flex flex-col gap-2 rounded-xl border border-white/[0.08] bg-[#11161e] p-2.5">
        <div className="flex items-center justify-center gap-3 rounded-lg bg-black/50 px-3 py-2">
          <span className="text-3xl font-black tabular-nums text-white">{match.homeScore}<span className="px-1 text-emerald-300">:</span>{match.awayScore}</span>
          <span className="rounded-lg bg-black/60 px-3 py-1 text-xl font-black tabular-nums text-emerald-300"><MatchClock fm={fm} /></span>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <button type="button" onClick={fm.toggleClock} className={`${big} flex items-center justify-center gap-1.5 ${fm.running ? "border-amber-400/40 bg-amber-400/10 text-amber-200" : "border-emerald-400/40 bg-emerald-400/10 text-emerald-200"}`}>
            {fm.running ? <Pause size={13} /> : <Play size={13} />}{fm.running ? "Pausar" : "Iniciar"} <span className={key}>P</span>
          </button>
          <button type="button" onClick={fm.undoGoal} className={`${big} flex items-center justify-center gap-1.5 border-white/10 bg-white/[0.05] text-neutral-200 hover:bg-white/10`}><Undo2 size={13} />Anular gol <span className={key}>Z</span></button>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {PERIODS.map((period) => (
            <button key={period} type="button" onClick={() => fm.setPeriod(period)} className={`rounded-md border py-1.5 text-[10px] font-bold ${match.period === period ? "border-emerald-300 bg-emerald-400/20 text-emerald-100" : "border-white/10 text-neutral-400 hover:text-white"}`}>{period}</button>
          ))}
        </div>
        <div className="mt-auto grid grid-cols-3 gap-1.5">
          <button type="button" onClick={() => act.varReview("REVISIÓN EN CURSO")} className="rounded-md border border-sky-400/40 bg-sky-400/10 py-2 text-[10px] font-bold text-sky-100 hover:bg-sky-400/20">VAR <span className={key}>V</span></button>
          <button type="button" onClick={() => act.varReview("GOL VÁLIDO")} className="rounded-md border border-emerald-400/40 bg-emerald-400/10 py-2 text-[10px] font-bold text-emerald-100 hover:bg-emerald-400/20">Gol válido</button>
          <button type="button" onClick={act.varOverturn} className="rounded-md border border-red-400/40 bg-red-500/10 py-2 text-[10px] font-bold text-red-100 hover:bg-red-500/20">Gol anulado</button>
        </div>
      </div>
      {column("away")}
    </section>
  );
}
