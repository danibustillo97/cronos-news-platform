"use client";

// "Análisis": the commentator's live brain while broadcasting a match.
//  - Piloto automático: ESPN events (goals, cards, subs) applied without asking.
//  - Puntos para comentar: computed from live stats every 20 s.
//  - Datos inteligentes: when someone scores, the scorer's real recent data
//    appears at once, each fact one click away from going on screen.

import { useCallback, useEffect, useRef, useState } from "react";
import { Bot, Loader2, Radio, Sparkles, Tv2 } from "lucide-react";
import type { GraphicVariant } from "../graphicExport";
import type { AddOptions } from "./WidgetBuilder";
import type { FootballMatchController } from "./useFootballMatch";
import { GOAL_TYPES, insightLowerThird, talkingPoints, type MatchDetail, type PlayerInsights } from "./analysis";
import { useGoalAlertsPref, writeGoalAlertsPref } from "./liveBoard";

const card = "rounded-xl border border-white/[0.08] bg-[#141a22] p-2.5";
const title = "mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-neutral-500";

interface Props {
  fm: FootballMatchController;
  onAddWidget: (variant: GraphicVariant, options?: AddOptions) => void;
}

export function AnalysisPanel({ fm, onAddWidget }: Props) {
  const fixture = fm.fixture;
  const goalAlerts = useGoalAlertsPref();
  const [detail, setDetail] = useState<MatchDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [insights, setInsights] = useState<Record<string, PlayerInsights | "loading" | "error">>({});
  const requested = useRef(new Set<string>());

  const load = useCallback(async () => {
    if (!fixture) return;
    try {
      const res = await fetch(`/api/matches/${encodeURIComponent(fixture.league)}/${encodeURIComponent(fixture.id)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setDetail(await res.json());
      setError(null);
    } catch {
      setError("No se pudieron leer los datos del partido.");
    }
  }, [fixture]);

  useEffect(() => {
    setDetail(null);
    requested.current = new Set();
    setInsights({});
    if (!fixture) return;
    void load();
    const timer = window.setInterval(() => void load(), 20000);
    return () => window.clearInterval(timer);
  }, [fixture, load]);

  // Every new goal -> fetch the scorer's insights once.
  useEffect(() => {
    for (const e of detail?.events ?? []) {
      const id = e.player?.id;
      if (!GOAL_TYPES.has(e.type) || e.type === "own-goal" || !id || requested.current.has(id)) continue;
      requested.current.add(id);
      setInsights((s) => ({ ...s, [id]: "loading" }));
      fetch(`/api/matches/insights/player/${id}`)
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then((data: PlayerInsights) => setInsights((s) => ({ ...s, [id]: data })))
        .catch(() => setInsights((s) => ({ ...s, [id]: "error" })));
    }
  }, [detail]);

  const onAir = (ins: PlayerInsights, fact: string) => {
    const lt = insightLowerThird(ins, fact);
    onAddWidget("lower", { name: `Dato · ${ins.player.name}`, title: lt.title, subtitle: lt.subtitle });
  };
  const pointOnAir = (text: string) => {
    if (!detail) return;
    onAddWidget("lower", { name: "Análisis", title: `${detail.home.short || detail.home.name} ${detail.home.score ?? 0}-${detail.away.score ?? 0} ${detail.away.short || detail.away.name}`, subtitle: text.length > 90 ? `${text.slice(0, 89)}…` : text });
  };

  const multiCard = (
    <div className={card}>
      <p className={title}><Tv2 size={11} /> Multipantalla</p>
      <button type="button" onClick={() => onAddWidget("multi", { name: "Resultados en vivo", title: "Resultados en vivo" })}
        className="w-full rounded-lg border border-white/10 bg-white/[0.05] px-2 py-2 text-[11px] font-semibold text-neutral-100 hover:bg-white/[0.1]">
        Añadir «Resultados en vivo» (todos los partidos, se actualiza solo)
      </button>
      <label className="mt-2 flex items-center justify-between gap-2 text-[11px] text-neutral-300">
        <span>Alerta automática al aire cuando hay gol en otro partido</span>
        <input type="checkbox" className="accent-emerald-400" checked={goalAlerts} onChange={(e) => writeGoalAlertsPref(e.target.checked)} />
      </label>
    </div>
  );

  if (!fixture) {
    return (
      <div className="space-y-2">
        {multiCard}
        <p className={`${card} text-[11px] text-neutral-400`}>Elige un partido en la pestaña «Partido» y aquí aparecerán el análisis en vivo y los datos de cada goleador.</p>
      </div>
    );
  }

  const goals = (detail?.events ?? []).filter((e) => GOAL_TYPES.has(e.type)).reverse();
  const points = detail ? talkingPoints(detail) : [];

  return (
    <div className="space-y-2">
      {multiCard}
      <div className={card}>
        <p className={title}><Bot size={11} /> Piloto automático</p>
        <label className="flex items-center justify-between gap-2 text-[11px] text-neutral-300">
          <span>Aplicar solos los goles, tarjetas y cambios de ESPN (marcador y animaciones al aire)</span>
          <input type="checkbox" className="accent-emerald-400" checked={fm.espnSync.enabled && fm.espnSync.auto}
            onChange={(e) => fm.setEspnSync({ enabled: true, auto: e.target.checked })} />
        </label>
        <p className="mt-1 text-[10px] text-neutral-500">Tú solo comentas; con la cámara opcional en un recuadro (diseño PiP en Medios).</p>
      </div>

      <div className={card}>
        <p className={title}>
          <Radio size={11} className={detail?.state === "in" ? "text-red-400" : ""} /> Puntos para comentar
          {detail && <span className="ml-auto normal-case tracking-normal text-neutral-500">{detail.state === "in" ? `en vivo · ${detail.clock}` : detail.statusText}</span>}
        </p>
        {!detail && !error && <p className="flex items-center gap-1.5 text-[11px] text-neutral-500"><Loader2 size={12} className="animate-spin" /> Leyendo el partido…</p>}
        {error && <p className="text-[11px] text-amber-300">{error}</p>}
        <ul className="space-y-1">
          {points.map((p) => (
            <li key={p} className="group flex items-start gap-2 rounded-md px-1 py-1 text-[11.5px] leading-snug text-neutral-200 hover:bg-white/[0.04]">
              <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-emerald-400" />
              <span className="flex-1">{p}</span>
              <button type="button" title="Poner en pantalla" onClick={() => pointOnAir(p)} className="flex-shrink-0 rounded p-0.5 text-neutral-500 opacity-0 hover:text-white group-hover:opacity-100"><Tv2 size={12} /></button>
            </li>
          ))}
        </ul>
      </div>

      <div className={card}>
        <p className={title}><Sparkles size={11} className="text-yellow-300" /> Datos inteligentes de goleadores</p>
        {goals.length === 0 && <p className="text-[11px] text-neutral-500">Cuando alguien marque, aquí aparecen al instante sus últimos partidos, su racha y sus números.</p>}
        <div className="space-y-2">
          {goals.map((g) => {
            const ins = g.player ? insights[g.player.id] : undefined;
            return (
              <div key={g.id} className="rounded-lg border border-yellow-400/20 bg-yellow-400/[0.04] p-2">
                <p className="text-[11.5px] font-bold text-white">⚽ {g.minute} {g.player?.name ?? "Gol"} <span className="font-normal text-neutral-400">· {g.team === "home" ? detail?.home.name : detail?.away.name}</span></p>
                {g.type === "own-goal" && <p className="text-[11px] text-neutral-400">Gol en contra.</p>}
                {ins === "loading" && <p className="mt-1 flex items-center gap-1.5 text-[11px] text-neutral-500"><Loader2 size={12} className="animate-spin" /> Buscando sus datos…</p>}
                {ins === "error" && <p className="mt-1 text-[11px] text-neutral-500">Sin datos de este jugador.</p>}
                {ins && typeof ins === "object" && (
                  <>
                    <ul className="mt-1 space-y-0.5">
                      {ins.facts.map((f) => (
                        <li key={f} className="flex items-start gap-1.5 text-[11px] leading-snug text-neutral-200">
                          <span className="flex-1">• {f}</span>
                          <button type="button" onClick={() => onAir(ins, f)} className="flex-shrink-0 rounded border border-white/10 px-1.5 text-[9.5px] font-bold uppercase text-neutral-300 hover:border-yellow-400/60 hover:text-yellow-200">Al aire</button>
                        </li>
                      ))}
                    </ul>
                    {ins.lastGames.length > 0 && (
                      <div className="mt-1.5 flex items-end gap-1" title="Goles en sus últimos partidos (del más antiguo al más reciente)">
                        {[...ins.lastGames].reverse().map((lg) => (
                          <div key={lg.date} className="flex flex-1 flex-col items-center gap-0.5">
                            <div className="w-full rounded-sm bg-yellow-400/80" style={{ height: `${4 + lg.goals * 10}px`, opacity: lg.goals ? 1 : 0.25 }} />
                            <span className="text-[8.5px] text-neutral-500">{lg.opponent.slice(0, 3).toUpperCase()}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
