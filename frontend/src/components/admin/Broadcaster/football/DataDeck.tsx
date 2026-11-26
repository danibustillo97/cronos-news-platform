"use client";

// Right column of the studio: the DATA, prioritized by match phase.
//  - Previa (not started): favorite + market, form, table position, key players.
//  - En vivo / final: live stats, talking points, scorer insights as they happen.
//  - Always: debate questions -> one tap = vote on the portal + on air.
// Every item goes on air with one tap (big card or lower third).

import { useCallback, useEffect, useMemo, useState } from "react";
import { Flame, Loader2, MessagesSquare, Star, Trophy, Tv2, Vote } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/studio/lab/api-client";
import type { GraphicVariant } from "../graphicExport";
import type { FootballMatchController } from "./useFootballMatch";
import { GOAL_TYPES, talkingPoints, type MatchDetail, type PlayerInsights } from "./analysis";
import { debatePrompts, type DebatePrompt, type InsightLite } from "./debate";
import { startPollBoard } from "./pollBoard";

type AirFn = (variant: GraphicVariant, options?: { title?: string; subtitle?: string }, seconds?: number) => void;

interface Insight extends InsightLite {
  matchId: string; facts: string[]; market?: { home: number; draw: number; away: number } | null;
  home: { name: string; form?: string | null; position?: number | null; points?: number | null };
  away: { name: string; form?: string | null; position?: number | null; points?: number | null };
}

export const LAUNCH_DEBATE_EVENT = "nexus:launch-debate";

const airBtn = "inline-flex flex-shrink-0 items-center gap-1 rounded-lg bg-red-500 px-2 py-1 text-[10.5px] font-bold text-white hover:bg-red-400";
const ghost = "flex-shrink-0 rounded-lg border border-white/12 px-2 py-1 text-[10.5px] font-semibold text-neutral-300 hover:border-white/40";
const block = "rounded-2xl border border-white/[0.08] bg-[#0f141c] p-3";
const title = "mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-neutral-400";

function FormChips({ form }: { form?: string | null }) {
  if (!form) return null;
  const tone: Record<string, string> = { W: "bg-emerald-500", D: "bg-neutral-500", L: "bg-red-500" };
  const label: Record<string, string> = { W: "G", D: "E", L: "P" };
  return <span className="inline-flex gap-0.5">{form.slice(-5).split("").map((c, i) => <i key={i} className={`grid h-4 w-4 place-items-center rounded text-[9px] font-bold not-italic text-white ${tone[c] ?? "bg-white/10"}`}>{label[c] ?? c}</i>)}</span>;
}

export function DataDeck({ fm, onAir, embedded = false }: { fm: FootballMatchController; onAir: AirFn; embedded?: boolean }) {
  const fixture = fm.fixture;
  const [detail, setDetail] = useState<MatchDetail | null>(null);
  const [insight, setInsight] = useState<Insight | null>(null);
  const [scorers, setScorers] = useState<Record<string, PlayerInsights>>({});
  const [launching, setLaunching] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!fixture) return;
    try {
      const res = await fetch(`/api/matches/${encodeURIComponent(fixture.league)}/${encodeURIComponent(fixture.id)}`);
      if (res.ok) setDetail(await res.json());
    } catch { /* next tick */ }
  }, [fixture]);

  useEffect(() => {
    setDetail(null);
    setInsight(null);
    setScorers({});
    if (!fixture) return;
    void load();
    fetch("/api/insights/feed").then((r) => (r.ok ? r.json() : { insights: [] }))
      .then((d) => setInsight(((d.insights ?? []) as Insight[]).find((i) => i.matchId === fixture.id) ?? null)).catch(() => undefined);
    const timer = window.setInterval(() => void load(), 20000);
    return () => window.clearInterval(timer);
  }, [fixture, load]);

  useEffect(() => {
    for (const e of detail?.events ?? []) {
      const id = e.player?.id;
      if (!GOAL_TYPES.has(e.type) || e.type === "own-goal" || !id || scorers[id]) continue;
      fetch(`/api/matches/insights/player/${id}`).then((r) => (r.ok ? r.json() : null)).then((d) => d && setScorers((s) => ({ ...s, [id]: d }))).catch(() => undefined);
    }
  }, [detail, scorers]);

  const home = detail?.home.name ?? fm.match.homeTeam;
  const away = detail?.away.name ?? fm.match.awayTeam;
  const phase = detail?.state ?? "pre";
  const prompts = useMemo(() => (fixture ? debatePrompts(home, away, detail, insight) : []), [fixture, home, away, detail, insight]);
  const host = typeof window !== "undefined" ? window.location.host : "nuestro portal";

  const launch = useCallback(async (p: DebatePrompt) => {
    setLaunching(p.id);
    try {
      const res = await apiFetch("/api/admin/polls", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: p.kind, question: p.question, context: p.context, status: "open", placement: ["pulse", "home"],
          newsId: fixture ? `match:${fixture.league}:${fixture.id}` : null, options: p.options.map((o) => ({ label: o.label, argument: o.argument ?? null })) }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(typeof body?.detail === "string" ? body.detail : `HTTP ${res.status}`);
      startPollBoard(body.id);
      onAir("poll", { title: `Vota en ${host}` }, 60);
      toast.success("Votación al aire y abierta en el portal");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo lanzar la votación");
    } finally {
      setLaunching(null);
    }
  }, [fixture, host, onAir]);

  // "Debate en vivo" template launches the first question.
  useEffect(() => {
    const handler = () => { if (prompts[0]) void launch(prompts[0]); else toast.info("Elige un partido para armar el debate"); };
    window.addEventListener(LAUNCH_DEBATE_EVENT, handler);
    return () => window.removeEventListener(LAUNCH_DEBATE_EVENT, handler);
  }, [prompts, launch]);

  const item = (kicker: string, text: string) => (
    <li key={kicker + text} className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-2">
      <p className="text-[12.5px] leading-snug text-neutral-100">{text}</p>
      <div className="mt-1.5 flex items-center gap-1.5">
        <span className="mr-auto truncate text-[9.5px] font-bold uppercase tracking-[0.14em] text-yellow-300/80">{kicker}</span>
        <button type="button" className={airBtn} onClick={() => onAir("dato", { title: kicker, subtitle: text }, 10)}><Tv2 size={11} /> AL AIRE</button>
        <button type="button" className={ghost} onClick={() => onAir("lower", { title: kicker.toUpperCase(), subtitle: text.length > 90 ? `${text.slice(0, 89)}…` : text }, 8)}>Rótulo</button>
      </div>
    </li>
  );

  const stat = (key: string) => detail?.stats.find((s) => s.key === key);
  const pos = stat("possessionPct");
  const shots = stat("totalShots");
  const onTarget = stat("shotsOnTarget");

  return (
    <aside className={embedded ? "w-full" : "flex min-h-0 w-full flex-col border-t border-white/[0.08] bg-[#0b0f15] xl:h-full xl:w-[400px] xl:flex-shrink-0 xl:border-l xl:border-t-0"}>
      <div className={embedded ? "grid gap-3 p-3 xl:grid-cols-3" : "min-h-0 flex-1 space-y-3 overflow-y-auto p-3"}>
        {/* Match header */}
        <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.06] to-transparent p-3">
          <div className="flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-[0.14em]">
            <span className={phase === "in" ? "text-red-400" : phase === "post" ? "text-neutral-400" : "text-sky-300"}>
              {phase === "in" ? `● En vivo · ${detail?.clock ?? ""}` : phase === "post" ? "Final" : "Previa"}
            </span>
            <span className={`ml-auto rounded-full px-2 py-0.5 text-[9.5px] ${fm.autoMode ? "bg-emerald-400 text-black" : "bg-neutral-700 text-neutral-200"}`}>{fm.autoMode ? "AUTOMÁTICO" : "MANUAL"}</span>
          </div>
          {fixture ? (
            <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <div className="min-w-0"><p className="truncate text-[14px] font-bold text-white">{home}</p><FormChips form={insight?.home.form} /></div>
              <p className="text-[26px] font-black tabular-nums text-white">{phase === "pre" ? "vs" : `${detail?.home.score ?? 0}-${detail?.away.score ?? 0}`}</p>
              <div className="min-w-0 text-right"><p className="truncate text-[14px] font-bold text-white">{away}</p><span className="inline-flex justify-end"><FormChips form={insight?.away.form} /></span></div>
            </div>
          ) : <p className="mt-2 text-[12.5px] text-neutral-400">Elige un partido en la columna «Partidos» y pulsa <b className="text-white">Transmitir</b>: los datos llegan solos.</p>}
        </div>

        {fixture && phase === "pre" && (
          <div className={block}>
            <p className={title}><Star size={12} className="text-yellow-300" /> Previa</p>
            {insight?.market && (
              <div className="mb-2">
                <div className="flex h-5 overflow-hidden rounded text-[10px] font-bold text-black">
                  <span className="grid place-items-center bg-sky-400" style={{ width: `${insight.market.home}%` }}>{insight.market.home}%</span>
                  <span className="grid place-items-center bg-neutral-400" style={{ width: `${insight.market.draw}%` }}>{insight.market.draw}%</span>
                  <span className="grid place-items-center bg-rose-400" style={{ width: `${insight.market.away}%` }}>{insight.market.away}%</span>
                </div>
                <p className="mt-1 text-[10.5px] text-neutral-500">Probabilidad según el mercado</p>
              </div>
            )}
            <ul className="space-y-1.5">
              {insight?.favorite?.label && item("Favorito", insight.favorite.side ? `${insight.favorite.label}: ${insight.favorite.side === "home" ? home : away} (${insight.favorite.probability}%)` : insight.favorite.label)}
              {(insight?.facts ?? []).map((f) => item("Antesala", f))}
              {(insight?.keyPlayers ?? []).map((k) => item("Jugador a tener en cuenta", `${k.name}: ${k.stat}`))}
              {!insight && <li className="text-[12px] text-neutral-500">Buscando datos de previa…</li>}
            </ul>
          </div>
        )}

        {fixture && phase !== "pre" && (
          <div className={block}>
            <p className={title}><Trophy size={12} className="text-yellow-300" /> {phase === "in" ? "En vivo" : "Así terminó"}</p>
            {pos && (
              <div className="mb-2 space-y-1.5">
                {[pos, shots, onTarget].filter(Boolean).map((s) => (
                  <div key={s!.key}>
                    <div className="flex justify-between text-[10.5px] text-neutral-400"><span className="tabular-nums">{Math.round(s!.home)}{s!.percent ? "%" : ""}</span><span>{s!.label}</span><span className="tabular-nums">{Math.round(s!.away)}{s!.percent ? "%" : ""}</span></div>
                    <div className="mt-0.5 flex h-1.5 overflow-hidden rounded bg-rose-400/70"><span className="bg-sky-400" style={{ width: `${s!.home + s!.away ? (s!.home / (s!.home + s!.away)) * 100 : 50}%` }} /></div>
                  </div>
                ))}
              </div>
            )}
            <ul className="space-y-1.5">
              {(detail ? talkingPoints(detail) : []).map((p) => item("Análisis", p))}
              {Object.values(scorers).flatMap((sc) => sc.facts.slice(0, 3).map((f) => item(`Goleador · ${sc.player.name}`, f)))}
            </ul>
          </div>
        )}

        {fixture && (
          <div className={block}>
            <p className={title}><MessagesSquare size={12} className="text-pink-300" /> Para debatir · vota tu audiencia</p>
            <ul className="space-y-1.5">
              {prompts.map((p) => (
                <li key={p.id} className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-2">
                  <div className="flex items-start gap-2">
                    {p.kind === "debate" ? <Flame size={13} className="mt-0.5 flex-shrink-0 text-pink-300" /> : <Vote size={13} className="mt-0.5 flex-shrink-0 text-sky-300" />}
                    <div className="min-w-0 flex-1">
                      <p className="text-[12.5px] font-semibold leading-snug text-white">{p.question}</p>
                      <p className="text-[10.5px] text-neutral-500">{p.context}</p>
                    </div>
                  </div>
                  <button type="button" className={`${airBtn} mt-1.5 w-full justify-center py-1.5`} disabled={launching !== null} onClick={() => void launch(p)}>
                    {launching === p.id ? <Loader2 size={11} className="animate-spin" /> : <Vote size={11} />} Lanzar votación al aire
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </aside>
  );
}
