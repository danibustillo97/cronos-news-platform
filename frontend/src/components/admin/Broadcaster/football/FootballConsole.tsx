"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Download, Eye, Plus, RefreshCw, Trash2, Tv2, Undo2 } from "lucide-react";
import type { BroadcastGraphic, GraphicVariant } from "../graphicExport";
import { COMPETITIONS, getCompetition } from "./competitions";
import { DataPanel } from "./DataPanel";
import { MatchClock } from "./MatchClock";
import { FOOTBALL_VARIANTS, FOOTBALL_VARIANT_LABEL } from "./designs";
import { WidgetBuilder, type AddOptions } from "./WidgetBuilder";
import type { Fixture, FootballMatchController } from "./useFootballMatch";

type Tab = "partido" | "control" | "widgets" | "datos" | "plantillas";

const TABS: Array<[Tab, string]> = [["partido", "Partido"], ["control", "Control"], ["widgets", "Widgets"], ["datos", "Datos"], ["plantillas", "Plantillas"]];
const PERIODS = ["PRE", "1T", "HT", "2T", "ET", "PEN", "FT"] as const;
const RANGES: Array<[string, number]> = [["Hoy", 0], ["7 días", 7], ["14 días", 14], ["30 días", 30]];

const ymd = (date: Date) => `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;

function countdown(kickoff?: string): string {
  if (!kickoff) return "";
  const diff = new Date(kickoff).getTime() - Date.now();
  if (Number.isNaN(diff)) return "";
  if (diff <= 0) return "Ya comenzó o está por comenzar";
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  return days > 0 ? `Faltan ${days} d ${hours} h` : `Faltan ${hours} h ${minutes} min`;
}

interface Props {
  fm: FootballMatchController;
  graphics: BroadcastGraphic[];
  previewGraphicIds: string[];
  programGraphicIds: string[];
  onAddWidget: (variant: GraphicVariant, options?: AddOptions) => void;
  onUpdateGraphic: (graphicId: string, patch: Partial<BroadcastGraphic>) => void;
  onTogglePreview: (graphicId: string) => void;
  onToggleProgram: (graphicId: string) => void;
  onRemove: (graphicId: string) => void;
  onDownload: (graphic: BroadcastGraphic) => void;
  onApplyTemplate: (competitionId: string) => void;
}

const btn = "rounded-lg border border-white/10 bg-white/[0.05] px-2 py-2 text-[11px] font-semibold text-neutral-200 transition hover:bg-white/[0.1] active:scale-[0.98]";

export function FootballConsole({ fm, graphics, previewGraphicIds, programGraphicIds, onAddWidget, onUpdateGraphic, onTogglePreview, onToggleProgram, onRemove, onDownload, onApplyTemplate }: Props) {
  const { match } = fm;
  const [tab, setTab] = useState<Tab>("partido");
  const [competitionId, setCompetitionId] = useState(match.competitionId ?? "libertadores");
  const [range, setRange] = useState(14);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [searching, setSearching] = useState(false);
  const [player, setPlayer] = useState("");
  const [subOut, setSubOut] = useState("");
  const [subIn, setSubIn] = useState("");
  const [, setTick] = useState(0);
  const theme = getCompetition(competitionId);

  useEffect(() => {
    const timer = window.setInterval(() => setTick((value) => value + 1), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const search = useCallback(async () => {
    if (!theme.espn) {
      toast.info("Esta competición es manual", { description: "Escribe los equipos en la pestaña Control." });
      setFixtures([]);
      return;
    }
    setSearching(true);
    try {
      const from = new Date();
      from.setDate(from.getDate() - 2);
      const to = new Date();
      to.setDate(to.getDate() + range);
      const response = await fetch(`/api/football/fixtures?league=${encodeURIComponent(theme.espn)}&dates=${ymd(from)}-${ymd(to)}`);
      if (!response.ok) throw new Error("ESPN no respondió");
      const data = await response.json() as { fixtures: Fixture[] };
      setFixtures(data.fixtures);
      if (!data.fixtures.length) toast.info("No hay partidos en ese rango", { description: "Prueba con un rango mayor." });
    } catch (error) {
      toast.error("No se pudieron buscar partidos", { description: error instanceof Error ? error.message : undefined });
    } finally {
      setSearching(false);
    }
  }, [range, theme.espn]);

  const sceneWidgets = useMemo(() => graphics.filter((graphic) => graphic.mode === "football"), [graphics]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="grid grid-cols-5 gap-0.5 border-b border-white/[0.07] bg-[#0a0e14] p-1">
        {TABS.map(([id, label]) => (
          <button key={id} type="button" onClick={() => setTab(id)} className={`rounded-md px-1 py-2 text-[10px] font-bold uppercase tracking-wide ${tab === id ? "bg-emerald-400/15 text-emerald-200" : "text-neutral-500 hover:text-neutral-200"}`}>{label}</button>
        ))}
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3" style={{ scrollbarWidth: "none" }}>
        {tab === "partido" && (
          <>
            <div className="rounded-xl border border-white/[0.08] bg-[#141a22] p-3">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-neutral-500">Buscar partido real</p>
              <div className="grid grid-cols-2 gap-1.5">
                <select aria-label="Competición" value={competitionId} onChange={(event) => { setCompetitionId(event.target.value); setFixtures([]); }} className="h-9 rounded-lg border border-white/10 bg-[#101114] px-2 text-xs text-neutral-200 outline-none">
                  {COMPETITIONS.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
                <select aria-label="Rango de fechas" value={range} onChange={(event) => setRange(Number(event.target.value))} className="h-9 rounded-lg border border-white/10 bg-[#101114] px-2 text-xs text-neutral-200 outline-none">
                  {RANGES.map(([label, days]) => <option key={label} value={days}>{label}</option>)}
                </select>
              </div>
              <button type="button" onClick={() => void search()} disabled={searching} className="mt-2 w-full rounded-lg bg-emerald-400 py-2 text-xs font-bold text-[#07120d] disabled:opacity-50">{searching ? "Buscando…" : "Buscar partidos"}</button>
            </div>
            <div className="space-y-1.5">
              {fixtures.map((fixture) => (
                <button key={fixture.id} type="button" onClick={() => void fm.loadFixture(fixture, competitionId)} className="flex w-full items-center gap-2 rounded-xl border border-white/[0.08] bg-[#141a22] p-2 text-left transition hover:border-emerald-400/40">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-semibold text-white">{fixture.home.name} <span className="text-neutral-500">vs</span> {fixture.away.name}</p>
                    <p className="truncate text-[10px] text-neutral-500">{new Date(fixture.date).toLocaleString("es", { dateStyle: "medium", timeStyle: "short" })} · {fixture.venue || "Sede por confirmar"}</p>
                  </div>
                  <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${fixture.state === "in" ? "bg-red-500/20 text-red-300" : fixture.state === "post" ? "bg-white/10 text-neutral-400" : "bg-emerald-400/15 text-emerald-200"}`}>{fixture.state === "in" ? "EN VIVO" : fixture.state === "post" ? `${fixture.home.score}-${fixture.away.score}` : "PRÓXIMO"}</span>
                </button>
              ))}
            </div>
            <div className="rounded-xl border border-white/[0.08] bg-[#141a22] p-3 text-[11px] text-neutral-300">
              <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">Partido cargado</p>
              <p className="mt-1 text-sm font-bold text-white">{match.homeTeam} vs {match.awayTeam}</p>
              <p className="text-[10px] text-neutral-400">{match.competition}</p>
              {match.kickoff && <p className="mt-1 text-emerald-300">{new Date(match.kickoff).toLocaleString("es", { dateStyle: "full", timeStyle: "short" })} · {countdown(match.kickoff)}</p>}
              {match.venue && <p className="text-neutral-400">{match.venue}{match.city ? ` · ${match.city}` : ""}</p>}
              {match.referee && <p className="text-neutral-400">Árbitro: {match.referee}</p>}
              <p className={`mt-1 text-[10px] ${fm.cloud.status === "error" ? "text-amber-300" : "text-neutral-500"}`}>
                {fm.cloud.status === "checking" ? "Nube: comprobando…"
                  : fm.cloud.status === "saving" ? "Nube: guardando…"
                    : fm.cloud.status === "saved" ? `Nube: guardado${fm.cloud.savedAt ? ` ${new Date(fm.cloud.savedAt).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}` : ""}`
                      : fm.cloud.status === "off" ? "Nube: sin sesión; solo en este navegador"
                        : "Nube: no disponible; guardado solo en este navegador"}
              </p>
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                <button type="button" onClick={() => void fm.refreshDetail()} disabled={fm.loading} className={btn}><RefreshCw size={12} className="mr-1 inline" />Actualizar datos</button>
                <button type="button" onClick={() => onAddWidget("prematch")} className={btn}>Añadir previa</button>
              </div>
            </div>
          </>
        )}

        {tab === "control" && (
          <>
            <div className="rounded-xl border border-white/[0.08] bg-black/30 p-3 text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">{match.competition}</p>
              <div className="mt-1 flex items-center justify-center gap-4">
                <span className="max-w-[90px] truncate text-xs font-bold text-neutral-200">{match.homeShort || match.homeTeam}</span>
                <span className="font-mono text-4xl font-black text-white">{match.homeScore} : {match.awayScore}</span>
                <span className="max-w-[90px] truncate text-xs font-bold text-neutral-200">{match.awayShort || match.awayTeam}</span>
              </div>
              <p className="font-mono text-lg text-emerald-300">{match.period} · <MatchClock fm={fm} />{match.addedTime ? ` +${match.addedTime}` : ""}</p>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <button type="button" onClick={fm.toggleClock} className={`${btn} ${fm.running ? "border-amber-400/40 text-amber-200" : "border-emerald-400/40 text-emerald-200"}`}>{fm.running ? "Pausar" : "Iniciar"}</button>
              <button type="button" onClick={fm.resetClock} className={btn}>Reiniciar</button>
              <label className="flex items-center rounded-lg border border-white/10 bg-white/[0.05] px-2 text-[11px] text-neutral-400">+<input aria-label="Tiempo añadido" type="number" min={0} max={30} value={match.addedTime} onChange={(event) => fm.setMatch({ addedTime: Math.min(30, Math.max(0, Number(event.target.value) || 0)) })} className="h-9 w-full bg-transparent pl-1 text-neutral-100 outline-none" /></label>
            </div>
            <div className="grid grid-cols-7 gap-0.5">
              {PERIODS.map((period) => <button key={period} type="button" onClick={() => fm.setPeriod(period)} className={`rounded-md py-1.5 text-[10px] font-bold ${match.period === period ? "bg-emerald-400 text-[#07120d]" : "bg-white/[0.05] text-neutral-400 hover:text-white"}`}>{period}</button>)}
            </div>
            <input aria-label="Jugador del evento" value={player} onChange={(event) => setPlayer(event.target.value)} placeholder="Jugador (opcional)" className="h-9 w-full rounded-lg border border-white/10 bg-[#101114] px-3 text-xs text-white outline-none" />
            <div className="grid grid-cols-2 gap-1.5">
              <button type="button" onClick={() => { fm.addGoal("home", player); setPlayer(""); }} className="rounded-lg bg-emerald-400 py-3 text-xs font-black text-[#07120d]">⚽ GOL {match.homeShort || "LOCAL"}</button>
              <button type="button" onClick={() => { fm.addGoal("away", player); setPlayer(""); }} className="rounded-lg bg-emerald-400 py-3 text-xs font-black text-[#07120d]">⚽ GOL {match.awayShort || "VISIT."}</button>
              <button type="button" onClick={fm.undoGoal} className="col-span-2 rounded-lg border border-red-400/40 bg-red-500/10 py-2.5 text-xs font-bold text-red-200"><Undo2 size={13} className="mr-1 inline" />Anular último gol</button>
              <button type="button" onClick={() => { fm.addCard("home", "yellow", player); setPlayer(""); }} className={btn}>🟨 {match.homeShort || "Local"}</button>
              <button type="button" onClick={() => { fm.addCard("away", "yellow", player); setPlayer(""); }} className={btn}>🟨 {match.awayShort || "Visit."}</button>
              <button type="button" onClick={() => { fm.addCard("home", "red", player); setPlayer(""); }} className={btn}>🟥 {match.homeShort || "Local"}</button>
              <button type="button" onClick={() => { fm.addCard("away", "red", player); setPlayer(""); }} className={btn}>🟥 {match.awayShort || "Visit."}</button>
            </div>
            <div className="rounded-xl border border-white/[0.08] bg-[#141a22] p-2.5">
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-neutral-500">Sustitución</p>
              <div className="grid grid-cols-2 gap-1.5">
                <input aria-label="Sale" value={subOut} onChange={(event) => setSubOut(event.target.value)} placeholder="Sale" className="h-8 rounded border border-white/10 bg-[#101114] px-2 text-xs text-white outline-none" />
                <input aria-label="Entra" value={subIn} onChange={(event) => setSubIn(event.target.value)} placeholder="Entra" className="h-8 rounded border border-white/10 bg-[#101114] px-2 text-xs text-white outline-none" />
                {(["home", "away"] as const).map((team) => (
                  <button key={team} type="button" onClick={() => {
                    if (!subIn.trim()) { toast.error("Indica quién entra"); return; }
                    fm.addSubstitution(team, subOut.trim(), subIn.trim());
                    setSubOut(""); setSubIn("");
                  }} className={btn}>Cambio {team === "home" ? match.homeShort || "local" : match.awayShort || "visit."}</button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <input aria-label="Equipo local" value={match.homeTeam} onChange={(event) => fm.setMatch({ homeTeam: event.target.value })} className="h-8 rounded border border-white/10 bg-[#101114] px-2 text-xs text-white outline-none" />
              <input aria-label="Equipo visitante" value={match.awayTeam} onChange={(event) => fm.setMatch({ awayTeam: event.target.value })} className="h-8 rounded border border-white/10 bg-[#101114] px-2 text-xs text-white outline-none" />
              <input aria-label="Sigla local" maxLength={4} value={match.homeShort ?? ""} onChange={(event) => fm.setMatch({ homeShort: event.target.value.toUpperCase() })} className="h-8 rounded border border-white/10 bg-[#101114] px-2 text-xs text-white outline-none" />
              <input aria-label="Sigla visitante" maxLength={4} value={match.awayShort ?? ""} onChange={(event) => fm.setMatch({ awayShort: event.target.value.toUpperCase() })} className="h-8 rounded border border-white/10 bg-[#101114] px-2 text-xs text-white outline-none" />
              <label className="flex items-center justify-between rounded border border-white/10 bg-[#101114] px-2 text-[10px] text-neutral-400">Color local<input type="color" value={/^#[0-9a-f]{6}$/i.test(match.homeColor ?? "") ? match.homeColor : "#1d4ed8"} onChange={(event) => fm.setMatch({ homeColor: event.target.value })} className="h-6 w-8 bg-transparent" /></label>
              <label className="flex items-center justify-between rounded border border-white/10 bg-[#101114] px-2 text-[10px] text-neutral-400">Color visit.<input type="color" value={/^#[0-9a-f]{6}$/i.test(match.awayColor ?? "") ? match.awayColor : "#b91c1c"} onChange={(event) => fm.setMatch({ awayColor: event.target.value })} className="h-6 w-8 bg-transparent" /></label>
            </div>
            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-neutral-500">Eventos ({fm.events.length})</p>
              <div className="max-h-40 space-y-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
                {[...fm.events].reverse().map((event) => (
                  <div key={event.id} className={`flex items-center gap-2 rounded-lg bg-black/25 px-2 py-1.5 text-[10px] ${event.voided ? "text-neutral-600 line-through" : "text-neutral-200"}`}>
                    <span className="font-mono text-neutral-500">{event.minute}&apos;</span>
                    <span>{event.kind === "goal" ? "⚽" : event.kind === "yellow" ? "🟨" : event.kind === "red" ? "🟥" : "🔁"}</span>
                    <span className="min-w-0 flex-1 truncate">{event.player}{event.detail ? ` · ${event.detail}` : ""}</span>
                    <span className="text-neutral-500">{event.team === "home" ? match.homeShort : match.awayShort}</span>
                    {!event.voided && <button type="button" onClick={() => fm.voidEvent(event.id)} aria-label={`Anular ${event.player} ${event.minute}'`} title="Anular este evento" className="rounded p-0.5 text-neutral-500 hover:bg-red-500/15 hover:text-red-300"><Undo2 size={11} /></button>}
                  </div>
                ))}
                {!fm.events.length && <p className="py-3 text-center text-[10px] text-neutral-600">Sin eventos todavía.</p>}
              </div>
            </div>
            {fm.hasFixture && (
              <div className="rounded-xl border border-sky-400/20 bg-sky-400/[0.04] p-2.5">
                <div className="flex items-center gap-2">
                  <p className="flex-1 text-[10px] font-bold uppercase tracking-widest text-sky-200">ESPN en vivo</p>
                  <label className="flex items-center gap-1 text-[10px] text-neutral-300"><input type="checkbox" checked={fm.espnSync.enabled} onChange={(event) => fm.setEspnSync({ ...fm.espnSync, enabled: event.target.checked })} className="accent-sky-400" /> Seguir</label>
                  <label title="Goles y tarjetas sin duplicados se aplican solos; autogoles y cambios siempre se revisan" className="flex items-center gap-1 text-[10px] text-neutral-300"><input type="checkbox" checked={fm.espnSync.auto} disabled={!fm.espnSync.enabled} onChange={(event) => fm.setEspnSync({ ...fm.espnSync, auto: event.target.checked })} className="accent-sky-400" /> Auto</label>
                </div>
                {fm.espnPending.length === 0 ? (
                  <p className="mt-1.5 text-[10px] text-neutral-500">{fm.espnSync.enabled ? (match.period === "PRE" || match.period === "FT" ? "Se activa cuando el partido está en juego." : "Sin eventos nuevos de ESPN.") : "Seguimiento pausado."}</p>
                ) : (
                  <>
                    <div className="mt-1.5 max-h-40 space-y-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
                      {fm.espnPending.map((item) => (
                        <div key={item.event.id} className="flex items-center gap-1.5 rounded-lg bg-black/25 px-2 py-1.5 text-[10px] text-neutral-200">
                          <span className="font-mono text-neutral-500">{item.action.minute}&apos;</span>
                          <span>{item.action.type === "goal" ? "⚽" : item.action.type === "sub" ? "🔁" : item.action.card === "yellow" ? "🟨" : "🟥"}</span>
                          <span className="min-w-0 flex-1 truncate">
                            {item.action.type === "sub" ? `${item.action.playerIn} por ${item.action.playerOut}` : item.action.player}
                            {item.action.type === "goal" && item.action.detail ? ` · ${item.action.detail}` : ""}
                            <span className="text-neutral-500"> · {item.action.team === "home" ? match.homeShort || "LOC" : match.awayShort || "VIS"}</span>
                          </span>
                          {item.duplicate && <span title="Ya cargaste un evento igual a mano" className="rounded bg-amber-400/15 px-1 text-[9px] font-bold text-amber-200">¿DUPLICADO?</span>}
                          <button type="button" onClick={() => fm.applySuggestion(item.event.id)} className="rounded border border-sky-400/40 px-1.5 py-0.5 text-[9px] font-bold text-sky-100 hover:bg-sky-400/15">Aplicar</button>
                          <button type="button" onClick={() => fm.dismissSuggestion(item.event.id)} aria-label="Ignorar" className="rounded px-1 text-neutral-500 hover:text-white">✕</button>
                        </div>
                      ))}
                    </div>
                    {fm.espnPending.length > 1 && <button type="button" onClick={fm.applyAllSuggestions} className={`${btn} mt-1.5 w-full`}>Aplicar todos ({fm.espnPending.length})</button>}
                  </>
                )}
              </div>
            )}
            <button type="button" onClick={() => { if (window.confirm("¿Reiniciar el partido y borrar eventos?")) fm.newMatch(); }} className="w-full rounded-lg border border-white/10 py-2 text-[10px] text-neutral-500 hover:text-red-300">Nuevo partido (reiniciar todo)</button>
          </>
        )}

        {tab === "widgets" && (
          <>
            <div className="grid grid-cols-3 gap-1.5">
              {FOOTBALL_VARIANTS.map((variant) => (
                <button key={variant} type="button" onClick={() => onAddWidget(variant)} className="rounded-lg border border-emerald-400/20 bg-emerald-400/[0.06] px-1 py-2.5 text-[10px] font-semibold text-emerald-100 hover:bg-emerald-400/15"><Plus size={11} className="mr-0.5 inline" />{FOOTBALL_VARIANT_LABEL[variant]}</button>
              ))}
            </div>
            <WidgetBuilder
              graphics={sceneWidgets}
              defaults={{ accent: theme.accent, home: match.homeColor || "#1f3a8a", away: match.awayColor || "#7f1d1d" }}
              onUpdate={onUpdateGraphic}
              onAddWidget={onAddWidget}
            />
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">Widgets del modo fútbol ({sceneWidgets.length})</p>
              {sceneWidgets.map((graphic) => {
                const inPreview = previewGraphicIds.includes(graphic.id);
                const inProgram = programGraphicIds.includes(graphic.id);
                return (
                  <div key={graphic.id} className="rounded-xl border border-white/[0.08] bg-[#141a22] p-2">
                    <div className="flex items-center gap-1.5">
                      <span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-neutral-100">{graphic.name}</span>
                      {inProgram && <span className="rounded bg-red-500/20 px-1.5 text-[9px] font-bold text-red-300">AL AIRE</span>}
                      <button type="button" onClick={() => onDownload(graphic)} aria-label={`Descargar ${graphic.name}`} className="p-1 text-neutral-500 hover:text-white"><Download size={13} /></button>
                      <button type="button" onClick={() => onRemove(graphic.id)} aria-label={`Eliminar ${graphic.name}`} className="p-1 text-neutral-500 hover:text-red-300"><Trash2 size={13} /></button>
                    </div>
                    <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                      <button type="button" onClick={() => onTogglePreview(graphic.id)} className={`${btn} ${inPreview ? "border-emerald-400/50 text-emerald-200" : ""}`}><Eye size={12} className="mr-1 inline" />{inPreview ? "Quitar de Preview" : "A Preview"}</button>
                      <button type="button" onClick={() => onToggleProgram(graphic.id)} className={`${btn} ${inProgram ? "border-red-400/50 bg-red-500/15 text-red-200" : ""}`}><Tv2 size={12} className="mr-1 inline" />{inProgram ? "Retirar del aire" : "Sacar al aire"}</button>
                    </div>
                  </div>
                );
              })}
              {!sceneWidgets.length && <p className="py-4 text-center text-[11px] text-neutral-600">Añade un widget con los botones de arriba.</p>}
            </div>
          </>
        )}

        {tab === "datos" && <DataPanel fm={fm} onAddWidget={onAddWidget} />}

        {tab === "plantillas" && (
          <div className="grid grid-cols-2 gap-1.5">
            {COMPETITIONS.map((item) => (
              <button key={item.id} type="button" onClick={() => onApplyTemplate(item.id)} className={`overflow-hidden rounded-xl border text-left transition hover:scale-[1.02] ${match.competitionId === item.id ? "border-emerald-400" : "border-white/10"}`}>
                <div className="h-10" style={{ background: `linear-gradient(110deg, ${item.bg} 55%, ${item.accent} 55%)` }} />
                <div className="bg-[#141a22] p-2"><p className="truncate text-[11px] font-bold text-white">{item.name}</p><p className="text-[9px] text-neutral-500">{match.competitionId === item.id ? "Activa" : "Aplicar tema y widgets"}</p></div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
