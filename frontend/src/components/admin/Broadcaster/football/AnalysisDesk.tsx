"use client";

// MESA DE ANÁLISIS — the first thing in football mode. Data first, controls later:
//  - En vivo ahora: every match at once (multi-scoreboard) with a real preview.
//  - Para debatir: questions built from the real data -> one tap launches the vote
//    on the portal AND puts it on air with live results.
//  - Datos para narrar: antesala facts, live talking points, scorer insights,
//    each card shows the exact on-air graphic and goes live with one tap.
//  - Escenas: one-tap show segments with generated backgrounds.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Flame, Image as ImageIcon, Loader2, MessagesSquare, Radio, Sparkles, Trophy, Tv2, Vote } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/studio/lab/api-client";
import type { GraphicVariant } from "../graphicExport";
import type { FootballMatchController } from "./useFootballMatch";
import { renderFootballDesign } from "./designs";
import { GOAL_TYPES, talkingPoints, type MatchDetail, type PlayerInsights } from "./analysis";
import { debatePrompts, type DebatePrompt, type InsightLite } from "./debate";
import { startPollBoard } from "./pollBoard";
import { BACKGROUND_LABEL, drawBackground, type BackgroundTheme } from "./backgrounds";

type AirFn = (variant: GraphicVariant, options?: { title?: string; subtitle?: string }, seconds?: number) => void;
type PreviewFn = (variant: GraphicVariant, options?: { name?: string; title?: string; subtitle?: string }) => void;

interface Props {
  fm: FootballMatchController;
  onAir: AirFn;
  onPreview: PreviewFn;
  onBackground: (blob: Blob, name: string) => void;
}

interface InsightFeedItem extends InsightLite { matchId: string; facts: string[]; home: { name: string }; away: { name: string } }

/** Live miniature of an on-air graphic: the same HTML the compositor rasterizes, scaled down. */
function Mini({ variant, fm, title = "", subtitle = "", width = 300 }: { variant: GraphicVariant; fm: FootballMatchController; title?: string; subtitle?: string; width?: number }) {
  const design = renderFootballDesign(variant, fm.match, title, subtitle);
  const scale = Math.min(1, width / design.width);
  return (
    <div className="relative overflow-hidden rounded-lg bg-[radial-gradient(120%_120%_at_20%_0%,#1d4f2c,#0b2414)]" style={{ width, height: Math.max(60, design.height * scale + 16) }}>
      <div className="absolute left-2 top-2 origin-top-left" style={{ transform: `scale(${scale * ((width - 16) / width)})`, width: design.width }} dangerouslySetInnerHTML={{ __html: design.html }} />
    </div>
  );
}

const section = "rounded-2xl border border-white/[0.08] bg-[#0f141c] p-3";
const head = "mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-neutral-400";
const airBtn = "inline-flex items-center gap-1 rounded-lg bg-red-500 px-2.5 py-1.5 text-[11px] font-bold text-white shadow shadow-red-500/30 hover:bg-red-400";
const ghostBtn = "rounded-lg border border-white/15 px-2.5 py-1.5 text-[11px] font-semibold text-neutral-200 hover:border-white/40";

export function AnalysisDesk({ fm, onAir, onPreview, onBackground }: Props) {
  const fixture = fm.fixture;
  const [detail, setDetail] = useState<MatchDetail | null>(null);
  const [insight, setInsight] = useState<InsightFeedItem | null>(null);
  const [scorers, setScorers] = useState<Record<string, PlayerInsights>>({});
  const [launching, setLaunching] = useState<string | null>(null);
  const [making, setMaking] = useState<BackgroundTheme | null>(null);
  const [, setTick] = useState(0);
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async () => {
    if (!fixture) return;
    try {
      const res = await fetch(`/api/matches/${encodeURIComponent(fixture.league)}/${encodeURIComponent(fixture.id)}`);
      if (res.ok) setDetail(await res.json());
    } catch { /* retry next tick */ }
  }, [fixture]);

  useEffect(() => {
    setDetail(null);
    setInsight(null);
    if (!fixture) return;
    void load();
    fetch("/api/insights/feed").then((r) => (r.ok ? r.json() : { insights: [] }))
      .then((d) => setInsight(((d.insights ?? []) as InsightFeedItem[]).find((i) => i.matchId === fixture.id) ?? null)).catch(() => undefined);
    const timer = window.setInterval(() => void load(), 20000);
    return () => window.clearInterval(timer);
  }, [fixture, load]);

  // refresh miniatures (multi-scoreboard data changes in the background)
  useEffect(() => { const t = window.setInterval(() => setTick((n) => n + 1), 15000); return () => window.clearInterval(t); }, []);

  useEffect(() => {
    for (const e of detail?.events ?? []) {
      const id = e.player?.id;
      if (!GOAL_TYPES.has(e.type) || e.type === "own-goal" || !id || scorers[id]) continue;
      fetch(`/api/matches/insights/player/${id}`).then((r) => (r.ok ? r.json() : null)).then((d) => d && setScorers((s) => ({ ...s, [id]: d }))).catch(() => undefined);
    }
  }, [detail, scorers]);

  const home = detail?.home.name ?? fm.match.homeTeam;
  const away = detail?.away.name ?? fm.match.awayTeam;
  const prompts = useMemo(() => (fixture ? debatePrompts(home, away, detail, insight) : []), [fixture, home, away, detail, insight]);
  const points = detail ? talkingPoints(detail) : [];
  const facts = insight?.facts ?? [];
  const host = typeof window !== "undefined" ? window.location.host : "nuestro portal";

  const launch = async (p: DebatePrompt) => {
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
      onAir("poll", { title: `Vota en ${host}` }, 45);
      toast.success("Votación al aire y abierta en el portal", { description: "Los porcentajes se actualizan solos mientras la gente vota." });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo lanzar la votación");
    } finally {
      setLaunching(null);
    }
  };

  const makeBackground = async (theme: BackgroundTheme) => {
    setMaking(theme);
    try {
      onBackground(await drawBackground(theme), `Fondo · ${BACKGROUND_LABEL[theme]}`);
      toast.success(`Fondo «${BACKGROUND_LABEL[theme]}» aplicado a la escena en Preview`);
    } finally {
      setMaking(null);
    }
  };

  const scorerCards = Object.values(scorers);
  const allData: { kicker: string; text: string }[] = [
    ...(insight?.favorite?.label ? [{ kicker: "Favorito", text: insight.favorite.side ? `${insight.favorite.label}: ${insight.favorite.side === "home" ? home : away} (${insight.favorite.probability}%)` : insight.favorite.label }] : []),
    ...points.map((p) => ({ kicker: "En vivo", text: p })),
    ...facts.map((f) => ({ kicker: "Antesala", text: f })),
    ...(insight?.keyPlayers ?? []).map((k) => ({ kicker: "Jugador a tener en cuenta", text: `${k.name}: ${k.stat}` })),
    ...scorerCards.flatMap((sc) => sc.facts.slice(0, 2).map((f) => ({ kicker: `Goleador · ${sc.player.name}`, text: f }))),
  ];

  return (
    <section className="space-y-3 p-2">
      <header className="flex flex-wrap items-center gap-2 rounded-2xl border border-yellow-400/25 bg-gradient-to-r from-yellow-400/[0.08] to-transparent px-4 py-3">
        <Sparkles size={18} className="text-yellow-300" />
        <div className="mr-auto">
          <h2 className="text-[15px] font-bold text-white">Mesa de análisis</h2>
          <p className="text-[11.5px] text-neutral-400">{fixture ? `${home} vs ${away} · ${fm.autoStatus?.text ?? "sincronizando…"} · todo se actualiza solo` : "Elige un partido (pestaña Partido de la consola) y la mesa se llena sola con datos, debates y escenas."}</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[10.5px] font-bold ${fm.autoMode ? "bg-emerald-400 text-black" : "bg-neutral-700 text-neutral-200"}`}>{fm.autoMode ? "AUTOMÁTICO" : "MANUAL"}</span>
      </header>

      <div className="grid gap-3 xl:grid-cols-2">
        {/* EN VIVO AHORA */}
        <div className={section}>
          <p className={head}><Radio size={13} className="text-red-400" /> En vivo ahora · todos los partidos</p>
          <Mini variant="multi" fm={fm} title="Resultados en vivo" width={520} />
          <div className="mt-2 flex flex-wrap gap-1.5">
            <button type="button" className={airBtn} onClick={() => onAir("multi", { title: "Resultados en vivo" }, 20)}><Tv2 size={12} /> AL AIRE 20 s</button>
            <button type="button" className={ghostBtn} onClick={() => onPreview("multi", { name: "Resultados en vivo", title: "Resultados en vivo" })}>Fijar en Preview</button>
            <span className="self-center text-[10.5px] text-neutral-500">Gol u roja en cualquier partido = recuadro iluminado + alerta automática.</span>
          </div>
        </div>

        {/* PARA DEBATIR */}
        <div className={section}>
          <p className={head}><MessagesSquare size={13} className="text-pink-300" /> Para debatir · la audiencia vota en el portal</p>
          {prompts.length === 0 && <p className="text-[12px] text-neutral-500">Aparecen al elegir un partido: quién gana, batacazo, posesión, figura, duelo de cracks…</p>}
          <ul className="space-y-1.5">
            {prompts.map((p) => (
              <li key={p.id} className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-2.5">
                <div className="flex items-start gap-2">
                  {p.kind === "debate" ? <Flame size={14} className="mt-0.5 flex-shrink-0 text-pink-300" /> : <Vote size={14} className="mt-0.5 flex-shrink-0 text-sky-300" />}
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold leading-snug text-white">{p.question}</p>
                    <p className="text-[11px] text-neutral-500">{p.context} · {p.options.map((o) => o.label).join(" / ")}</p>
                  </div>
                  <button type="button" className={airBtn} disabled={launching !== null} onClick={() => void launch(p)}>
                    {launching === p.id ? <Loader2 size={12} className="animate-spin" /> : <Vote size={12} />} Lanzar votación
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* DATOS PARA NARRAR */}
      <div className={section}>
        <p className={head}><Trophy size={13} className="text-yellow-300" /> Datos para narrar · toca AL AIRE y sale en pantalla</p>
        {!fixture && <p className="text-[12px] text-neutral-500">Sin partido elegido.</p>}
        {allData.length > 0 && (
          <div className="mb-2 flex flex-wrap items-end gap-3">
            <Mini variant="dato" fm={fm} title={allData[0].kicker} subtitle={allData[0].text} width={380} />
            <p className="max-w-[260px] text-[11px] text-neutral-500">Así sale cada dato en pantalla (tarjeta grande). «Como rótulo» lo pone abajo, discreto.</p>
          </div>
        )}
        <div className="grid gap-2 sm:grid-cols-2 2xl:grid-cols-3">
          {(showAll ? allData : allData.slice(0, 9)).map((d) => <DataCard key={d.kicker + d.text} kicker={d.kicker} text={d.text} onAir={onAir} />)}
        </div>
        {allData.length > 9 && (
          <button type="button" onClick={() => setShowAll((v) => !v)} className="mt-2 text-[11.5px] font-semibold text-yellow-300 hover:underline">
            {showAll ? "Ver menos" : `Ver ${allData.length - 9} datos más`}
          </button>
        )}
      </div>

      {/* ESCENAS Y FONDOS */}
      <div className={section}>
        <p className={head}><ImageIcon size={13} className="text-sky-300" /> Escenas y fondos · un toque</p>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <SceneCard title="Jornada en vivo" desc="Fondo verde + multipantalla fija" onClick={() => { void makeBackground("jornada"); onPreview("multi", { name: "Resultados en vivo", title: "Resultados en vivo" }); }} />
          <SceneCard title="Mesa de debate" desc="Fondo debate + votación del partido" onClick={() => { void makeBackground("debate"); if (prompts[0]) void launch(prompts[0]); }} />
          <SceneCard title="Entretiempo" desc="Fondo análisis + estadísticas" onClick={() => { void makeBackground("entretiempo"); onPreview("stats", { name: "Estadísticas" }); }} />
          <SceneCard title="Previa" desc="Fondo de la competición + previa" onClick={() => { void makeBackground(themeFor(fixture?.league)); onPreview("prematch", { name: "Previa" }); }} />
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {(Object.keys(BACKGROUND_LABEL) as BackgroundTheme[]).map((t) => (
            <button key={t} type="button" onClick={() => void makeBackground(t)} disabled={making !== null}
              className="rounded-full border border-white/10 px-2.5 py-1 text-[10.5px] text-neutral-300 hover:border-white/30">
              {making === t ? "Generando…" : BACKGROUND_LABEL[t]}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function themeFor(league?: string): BackgroundTheme {
  if (league === "uefa.champions") return "champions";
  if (league === "conmebol.libertadores") return "libertadores";
  if (league === "col.1") return "betplay";
  if (league === "eng.1") return "premier";
  return "jornada";
}

function DataCard({ kicker, text, onAir }: { kicker: string; text: string; onAir: AirFn }) {
  return (
    <div className="flex flex-col rounded-xl border border-white/[0.07] bg-white/[0.03] p-2.5">
      <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-yellow-300">{kicker}</span>
      <p className="mt-1 flex-1 text-[12.5px] leading-snug text-neutral-100">{text}</p>
      <div className="mt-2 flex gap-1.5">
        <button type="button" className={airBtn} onClick={() => onAir("dato", { title: kicker, subtitle: text }, 10)}><Tv2 size={12} /> AL AIRE</button>
        <button type="button" className={ghostBtn} onClick={() => onAir("lower", { title: kicker.toUpperCase(), subtitle: text.length > 90 ? `${text.slice(0, 89)}…` : text }, 8)}>Como rótulo</button>
      </div>
    </div>
  );
}

function SceneCard({ title, desc, onClick }: { title: string; desc: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-white/[0.06] to-transparent p-3 text-left hover:border-yellow-400/50">
      <span className="block text-[13px] font-bold text-white">{title}</span>
      <span className="mt-0.5 block text-[11px] text-neutral-400">{desc}</span>
    </button>
  );
}
