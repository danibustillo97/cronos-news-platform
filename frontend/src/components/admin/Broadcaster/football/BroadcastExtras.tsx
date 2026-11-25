"use client";

// Extra live-show tools for the "Análisis" tab:
//  - MultiPicker:   which matches the "Resultados en vivo" panel shows (default: every live one)
//  - PollPicker:    put a portal poll / debate on air with live results ("vota en el portal")
//  - MatchBriefing: the antesala data of the match on air (favorite, key players, facts) to narrate

import { useEffect, useState } from "react";
import { BarChart3, ListChecks, MessageSquareQuote, Star } from "lucide-react";
import type { GraphicVariant } from "../graphicExport";
import type { AddOptions } from "./WidgetBuilder";
import { readMultiSelection, writeMultiSelection, type BoardMatch } from "./liveBoard";
import { onAirPollId, startPollBoard, stopPollBoard } from "./pollBoard";

const card = "rounded-xl border border-white/[0.08] bg-[#141a22] p-2.5";
const title = "mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-neutral-500";
const chip = "rounded border border-white/10 px-1.5 text-[9.5px] font-bold uppercase text-neutral-300 hover:border-yellow-400/60 hover:text-yellow-200";

type Add = (variant: GraphicVariant, options?: AddOptions) => void;

export function MultiPicker() {
  const [matches, setMatches] = useState<BoardMatch[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  useEffect(() => {
    setSelected(readMultiSelection());
    fetch("/api/sports/scoreboard").then((r) => (r.ok ? r.json() : [])).then((rows) => setMatches(Array.isArray(rows) ? rows : [])).catch(() => setMatches([]));
  }, []);
  const toggle = (id: string) => {
    const next = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
    setSelected(next);
    writeMultiSelection(next);
  };
  const order = { live: 0, halftime: 1, scheduled: 2, finished: 3 } as Record<string, number>;
  return (
    <div className="mt-2">
      <p className="mb-1 flex items-center gap-1.5 text-[10.5px] text-neutral-400"><ListChecks size={11} /> Partidos en pantalla
        <button type="button" onClick={() => { setSelected([]); writeMultiSelection([]); }} className="ml-auto text-[10px] text-emerald-300 hover:underline">Todos los en vivo</button>
      </p>
      <ul className="max-h-40 space-y-0.5 overflow-y-auto pr-1">
        {[...matches].sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9)).map((m) => (
          <li key={m.id}>
            <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-[11px] text-neutral-300 hover:bg-white/[0.04]">
              <input type="checkbox" className="accent-emerald-400" checked={selected.includes(m.id)} onChange={() => toggle(m.id)} />
              <span className="min-w-0 flex-1 truncate">{m.homeTeam} {m.status === "scheduled" ? "vs" : `${m.homeScore ?? 0}-${m.awayScore ?? 0}`} {m.awayTeam}</span>
              <span className={`flex-shrink-0 text-[10px] ${m.status === "live" ? "text-red-400" : "text-neutral-500"}`}>{m.status === "live" ? m.statusDetail : m.status === "finished" ? "Final" : m.status === "halftime" ? "ET" : ""}</span>
            </label>
          </li>
        ))}
      </ul>
      <p className="mt-1 text-[10px] text-neutral-500">{selected.length ? `${selected.length} elegido(s)` : "Sin elegir: salen todos los partidos en vivo"} · 2 partidos = marcadores grandes; 3-10 = cuadrícula.</p>
    </div>
  );
}

interface ApiPoll { id: string; kind: "poll" | "debate"; question: string; totalVotes: number; newsId: string | null; status: string }

export function PollPicker({ fixture, onAddWidget }: { fixture: { league: string; id: string } | null; onAddWidget: Add }) {
  const [polls, setPolls] = useState<ApiPoll[]>([]);
  const [onAir, setOnAir] = useState<string | null>(onAirPollId());
  useEffect(() => {
    const urls = ["/api/polls?placement=pulse&limit=20", "/api/polls?placement=home&limit=20"];
    if (fixture) urls.unshift(`/api/polls?newsId=${encodeURIComponent(`match:${fixture.league}:${fixture.id}`)}`);
    Promise.all(urls.map((u) => fetch(u).then((r) => (r.ok ? r.json() : { polls: [] })).catch(() => ({ polls: [] }))))
      .then((lists) => {
        const seen = new Set<string>();
        setPolls(lists.flatMap((l) => (l.polls ?? []) as ApiPoll[]).filter((p) => p.status === "open" && !seen.has(p.id) && seen.add(p.id)));
      });
  }, [fixture]);
  const air = (p: ApiPoll) => {
    startPollBoard(p.id);
    setOnAir(p.id);
    onAddWidget("poll", { name: `Votación · ${p.question.slice(0, 30)}`, title: `Vota en ${typeof window !== "undefined" ? window.location.host : "nuestro portal"}` });
  };
  return (
    <div className={card}>
      <p className={title}><BarChart3 size={11} /> Votación en pantalla</p>
      {polls.length === 0 && <p className="text-[11px] text-neutral-500">No hay encuestas abiertas. Crea una en Editorial → Encuestas (las de «¿Quién gana?» se crean solas para los partidos grandes).</p>}
      <ul className="space-y-1">
        {polls.slice(0, 8).map((p) => (
          <li key={p.id} className="flex items-start gap-2 text-[11px] text-neutral-200">
            <span className="min-w-0 flex-1">{p.kind === "debate" ? "⚔️ " : ""}{p.question}<span className="text-neutral-500"> · {p.totalVotes} votos{p.newsId?.startsWith("match:") ? " · de este partido" : ""}</span></span>
            <button type="button" onClick={() => air(p)} className={chip}>{onAir === p.id ? "Al aire ✓" : "Al aire"}</button>
          </li>
        ))}
      </ul>
      {onAir && <button type="button" onClick={() => { stopPollBoard(); setOnAir(null); }} className="mt-1.5 text-[10px] text-neutral-400 hover:text-red-300">Dejar de actualizar la votación</button>}
      <p className="mt-1 text-[10px] text-neutral-500">Los porcentajes se actualizan solos cada 10 s mientras tu audiencia vota en el portal.</p>
    </div>
  );
}

interface Insight {
  matchId: string; headline: string; facts: string[];
  favorite?: { label: string | null; side: "home" | "away" | null; probability: number | null };
  keyPlayers?: { id: string; name: string; team: "home" | "away"; stat: string }[];
  home: { name: string }; away: { name: string };
}

export function MatchBriefing({ fixture, onAddWidget }: { fixture: { league: string; id: string } | null; onAddWidget: Add }) {
  const [insight, setInsight] = useState<Insight | null | "none">(null);
  useEffect(() => {
    if (!fixture) return;
    fetch("/api/insights/feed").then((r) => (r.ok ? r.json() : { insights: [] }))
      .then((d) => setInsight(((d.insights ?? []) as Insight[]).find((i) => i.matchId === fixture.id) ?? "none"))
      .catch(() => setInsight("none"));
  }, [fixture]);
  if (!fixture || insight === null) return null;
  if (insight === "none") return null;
  const lower = (t: string, s: string) => onAddWidget("lower", { name: "Dato", title: t, subtitle: s.length > 90 ? `${s.slice(0, 89)}…` : s });
  const big = (s: string) => onAddWidget("dato", { name: "Dato grande", title: "Dato NEXUS", subtitle: s });
  const fav = insight.favorite?.side ? `${insight.favorite.label}: ${insight.favorite.side === "home" ? insight.home.name : insight.away.name} (${insight.favorite.probability}%)` : insight.favorite?.label;
  return (
    <div className={card}>
      <p className={title}><MessageSquareQuote size={11} /> Para narrar y debatir</p>
      {fav && (
        <div className="mb-1.5 flex items-center gap-2 text-[11.5px] text-yellow-200"><Star size={12} fill="currentColor" /> <span className="flex-1">{fav}</span>
          <button type="button" onClick={() => big(fav)} className={chip}>Grande</button></div>
      )}
      <ul className="space-y-1">
        {insight.facts.map((f) => (
          <li key={f} className="flex items-start gap-1.5 text-[11px] leading-snug text-neutral-200">
            <span className="flex-1">• {f}</span>
            <button type="button" onClick={() => lower(`${insight.home.name} vs ${insight.away.name}`, f)} className={chip}>Al aire</button>
            <button type="button" onClick={() => big(f)} className={chip}>Grande</button>
          </li>
        ))}
      </ul>
      {!!insight.keyPlayers?.length && (
        <>
          <p className="mb-1 mt-2 text-[10px] font-bold uppercase tracking-widest text-neutral-500">Jugadores a tener en cuenta</p>
          <ul className="space-y-1">
            {insight.keyPlayers.map((k) => (
              <li key={k.id} className="flex items-center gap-1.5 text-[11px] text-neutral-200">
                <span className="flex-1">{k.name} <span className="text-neutral-500">· {k.stat}</span></span>
                <button type="button" onClick={() => lower(k.name.toUpperCase(), k.stat)} className={chip}>Al aire</button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
