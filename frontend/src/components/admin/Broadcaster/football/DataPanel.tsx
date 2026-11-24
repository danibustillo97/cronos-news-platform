"use client";

import { RefreshCw } from "lucide-react";
import type { GraphicVariant } from "../graphicExport";
import type { FootballMatchController } from "./useFootballMatch";

type Phase = "upcoming" | "soon" | "live" | "post";

const btn = "rounded-lg border border-white/10 bg-white/[0.05] px-2 py-2 text-[11px] font-semibold text-neutral-200 transition hover:bg-white/[0.1] active:scale-[0.98] disabled:opacity-40";
const card = "rounded-xl border border-white/[0.08] bg-[#141a22] p-2.5";
const title = "mb-1.5 text-[10px] font-bold uppercase tracking-widest text-neutral-500";

function phaseOf(period: string, kickoff?: string): { phase: Phase; label: string; hint: string } {
  if (period === "FT") return { phase: "post", label: "POSPARTIDO", hint: "Resumen final y estadísticas del partido." };
  if (period !== "PRE") return { phase: "live", label: "EN JUEGO", hint: "Estadísticas en vivo; se refrescan cada 45 s." };
  const diff = kickoff ? new Date(kickoff).getTime() - Date.now() : NaN;
  if (Number.isNaN(diff)) return { phase: "upcoming", label: "PREVIA", hint: "Sin fecha confirmada." };
  if (diff <= 3 * 3600000) return { phase: "soon", label: "INICIO INMINENTE", hint: "Buscando alineaciones oficiales cada 2 min." };
  return { phase: "upcoming", label: "PREVIA", hint: "Contexto del partido: forma, historial y probabilidades." };
}

function countdown(kickoff?: string): string {
  if (!kickoff) return "";
  const diff = new Date(kickoff).getTime() - Date.now();
  if (Number.isNaN(diff) || diff <= 0) return "";
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  return days > 0 ? `${days} d ${hours} h` : `${hours} h ${minutes} min`;
}

const visible = (hex?: string) => (/^#[0-9a-f]{6}$/i.test(hex ?? "") && parseInt((hex as string).slice(1), 16) > 0x303030 ? (hex as string) : "#e5e7eb");
const RESULT_COLOR: Record<string, string> = { W: "bg-emerald-400 text-black", D: "bg-neutral-500 text-black", L: "bg-red-400 text-black", "": "bg-white/10 text-white" };
const RESULT_LABEL: Record<string, string> = { W: "V", D: "E", L: "D", "": "-" };

export function DataPanel({ fm, onAddWidget }: { fm: FootballMatchController; onAddWidget: (variant: GraphicVariant) => void }) {
  const { match } = fm;
  const { phase, label, hint } = phaseOf(match.period, match.kickoff);
  const preview = match.preview;
  const lineups = match.lineups;
  const hasLineups = Boolean(lineups?.home?.length || lineups?.away?.length);
  const eta = countdown(match.kickoff);
  const kickoffText = match.kickoff && !Number.isNaN(new Date(match.kickoff).getTime())
    ? new Date(match.kickoff).toLocaleString("es-CO", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })
    : "";

  const previewBlock = preview ? (
    <>
      {preview.odds && (
        <div className={card}>
          <p className={title}>Probabilidades · {preview.odds.provider}</p>
          <div className="flex h-5 overflow-hidden rounded text-[10px] font-bold text-black">
            <span className="grid place-items-center" style={{ width: `${preview.odds.home}%`, background: visible(match.homeColor) }}>{preview.odds.home}%</span>
            <span className="grid place-items-center bg-neutral-400" style={{ width: `${preview.odds.draw}%` }}>{preview.odds.draw}%</span>
            <span className="grid place-items-center" style={{ width: `${preview.odds.away}%`, background: visible(match.awayColor) }}>{preview.odds.away}%</span>
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-neutral-500"><span>{match.homeShort ?? match.homeTeam}</span><span>Empate{preview.odds.overUnder ? ` · O/U ${preview.odds.overUnder}` : ""}</span><span>{match.awayShort ?? match.awayTeam}</span></div>
        </div>
      )}
      <div className={card}>
        <p className={title}>Últimos 5 partidos</p>
        {(["home", "away"] as const).map((side) => (
          <div key={side} className="mb-2 last:mb-0">
            <p className="mb-1 text-[10px] font-semibold text-neutral-300">{side === "home" ? match.homeTeam : match.awayTeam}</p>
            {preview.lastFive[side].length ? preview.lastFive[side].map((game, index) => (
              <div key={`${game.date}-${index}`} className="flex items-center gap-1.5 py-0.5 text-[10px] text-neutral-400">
                <span className={`grid h-4 w-4 place-items-center rounded text-[9px] font-black ${RESULT_COLOR[game.result]}`}>{RESULT_LABEL[game.result]}</span>
                <span className="w-9 text-neutral-500">{game.score}</span>
                <span className="flex-1 truncate text-neutral-300">{game.home ? "vs" : "@"} {game.opponent}</span>
                <span className="max-w-[88px] truncate text-neutral-600">{game.competition}</span>
              </div>
            )) : <p className="text-[10px] text-neutral-600">Sin historial disponible.</p>}
          </div>
        ))}
      </div>
      {preview.h2h.games.length > 0 && (
        <div className={card}>
          <p className={title}>Historial directo{preview.h2h.summary ? ` · ${preview.h2h.summary}` : ""}</p>
          {preview.h2h.games.map((game, index) => (
            <div key={`${game.date}-${index}`} className="flex items-center gap-1.5 py-0.5 text-[10px] text-neutral-300">
              <span className="w-14 text-neutral-500">{game.date ? new Date(game.date).toLocaleDateString("es-CO", { month: "short", year: "numeric" }) : ""}</span>
              <span className="flex-1 truncate">{game.home} <b className="text-white">{game.score}</b> {game.away}</span>
            </div>
          ))}
        </div>
      )}
      {(preview.leaders.home.length > 0 || preview.leaders.away.length > 0) && (
        <div className={card}>
          <p className={title}>Jugadores clave</p>
          {(["home", "away"] as const).map((side) => preview.leaders[side].length ? (
            <div key={side} className="mb-1.5 last:mb-0">
              <p className="text-[10px] font-semibold text-neutral-300">{side === "home" ? match.homeTeam : match.awayTeam}</p>
              {preview.leaders[side].map((item) => (
                <p key={item.label} className="flex justify-between text-[10px] text-neutral-400"><span>{item.label}</span><span className="text-neutral-200">{item.name} · {item.value}</span></p>
              ))}
            </div>
          ) : null)}
        </div>
      )}
    </>
  ) : (
    <p className="rounded-lg border border-white/10 p-2.5 text-[10px] text-neutral-500">Carga un partido de la lista para obtener forma, historial y probabilidades.</p>
  );

  const lineupBlock = (["home", "away"] as const).map((team) => lineups?.[team]?.length ? (
    <div key={team} className={card}>
      <p className={title}>{team === "home" ? match.homeTeam : match.awayTeam} {team === "home" ? match.formationHome : match.formationAway}</p>
      {lineups[team].map((item, index) => (
        <button key={`${item.name}-${index}`} type="button" onClick={() => fm.showPlayer(team, item.name, Math.floor(fm.clockNow() / 60), `${item.dorsal ?? ""} · ${item.position}`)} className="flex w-full items-center gap-2 rounded px-1 py-1 text-left text-[10px] text-neutral-200 hover:bg-white/[0.06]">
          <span className="w-5 font-mono text-neutral-500">{item.dorsal ?? "-"}</span><span className="flex-1 truncate">{item.name}{item.captain ? " (C)" : ""}</span><span className="text-neutral-500">{item.starter ? "XI" : "SUP"}</span>
        </button>
      ))}
    </div>
  ) : null);

  const statsBlock = (
    <div className={card}>
      <p className={title}>Estadísticas del partido</p>
      {match.stats?.length ? match.stats.map((row) => (
        <div key={row.label} className="mb-1.5">
          <div className="flex justify-between text-[10px] text-neutral-300"><span>{row.home}</span><span className="text-neutral-500">{row.label}</span><span>{row.away}</span></div>
          <div className="mt-0.5 flex h-1 overflow-hidden rounded bg-white/10"><i style={{ width: `${(row.home / Math.max(1, row.home + row.away)) * 100}%`, background: match.homeColor }} /><i className="flex-1" style={{ background: match.awayColor }} /></div>
        </div>
      )) : <p className="text-[10px] text-neutral-600">Disponibles cuando el partido está en juego.</p>}
      <p className="mt-2 border-t border-white/[0.06] pt-2 text-[10px] text-neutral-500">Mapas de calor: ESPN no los publica; no se muestran datos inventados.</p>
    </div>
  );

  // El orden cambia con la fase: lo más útil queda arriba.
  const order = phase === "live" || phase === "post"
    ? [statsBlock, lineupBlock, previewBlock]
    : phase === "soon"
      ? [lineupBlock, previewBlock, statsBlock]
      : [previewBlock, lineupBlock, statsBlock];

  return (
    <>
      <div className={`${card} space-y-1.5`}>
        <div className="flex items-center justify-between">
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-black tracking-wider ${phase === "live" ? "bg-red-500 text-white" : phase === "post" ? "bg-neutral-600 text-white" : "bg-yellow-300 text-black"}`}>{label}</span>
          {eta && <span className="text-[11px] font-bold text-yellow-200">Faltan {eta}</span>}
        </div>
        {kickoffText && <p className="text-[10px] capitalize text-neutral-300">{kickoffText}{match.venue ? ` · ${match.venue}` : ""}</p>}
        <p className="text-[10px] text-neutral-500">{hint}</p>
        {preview && <p className="text-[9px] text-neutral-600">Guardado en este equipo · actualizado {new Date(preview.fetchedAt).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}</p>}
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <button type="button" onClick={() => void fm.refreshDetail()} disabled={fm.loading} className={btn}><RefreshCw size={12} className="mr-1 inline" />Actualizar datos</button>
        {phase === "live" || phase === "post"
          ? <button type="button" onClick={() => onAddWidget("stats")} className={btn}>Widget estadísticas</button>
          : <button type="button" onClick={() => onAddWidget("prematch")} className={btn}>Widget previa</button>}
        <button type="button" onClick={() => onAddWidget("lineup-home")} disabled={!lineups?.home?.length} className={btn}>Alineación local</button>
        <button type="button" onClick={() => onAddWidget("lineup-away")} disabled={!lineups?.away?.length} className={btn}>Alineación visit.</button>
      </div>
      {!hasLineups && phase !== "live" && <p className="rounded-lg border border-amber-400/20 bg-amber-400/[0.06] p-2.5 text-[10px] text-amber-100/80">Alineación oficial aún no publicada: se detecta sola al acercarse el partido. Mientras tanto tienes las plantillas completas de ambos equipos en Control.</p>}
      {order.map((block, index) => <div key={index} className="space-y-3">{block}</div>)}
    </>
  );
}
