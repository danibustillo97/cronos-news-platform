"use client";

// "Programa automático": a show that runs by itself — no presenter needed.
// It loads a matchday (yesterday, today or any date), and goes league by league,
// match by match: result → stats → analysis → how the table looks, with the
// background music and the data ticker. Pause, skip or jump at any time.

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, Megaphone, Music, Pause, Play, Repeat, Square, Upload, X } from "lucide-react";
import { buildRundown, yyyymmdd, type RecapLeague, type Slide } from "./recap";
import { logoToDataUrl } from "./raster";
import { generateNexusLoop, music } from "./music";
import { setAdImage, setCintaExtra } from "./designs";

const LEAGUE_ORDER = ["uefa.champions", "conmebol.libertadores", "conmebol.sudamericana", "col.1", "uefa.europa", "esp.1", "eng.1", "ita.1", "ger.1", "fra.1"];
const SHORT: Record<string, string> = {
  "uefa.champions": "Champions", "conmebol.libertadores": "Libertadores", "conmebol.sudamericana": "Sudamericana", "col.1": "Liga BetPlay",
  "uefa.europa": "Europa League", "esp.1": "LaLiga", "eng.1": "Premier", "ita.1": "Serie A", "ger.1": "Bundesliga", "fra.1": "Ligue 1",
};
const KIND_LABEL: Record<Slide["kind"], string> = { intro: "Apertura", league: "Liga", result: "Resultado", stats: "Estadísticas", analysis: "Análisis", impact: "Tabla", numbers: "En números", parlays: "Parleys", outro: "Cierre" };

export interface AutoShowHandlers {
  onStart: (firstLeague: string | undefined, withAd: boolean) => void;
  onAd: (on: boolean) => void;
  onSlide: (slide: Slide, logos: Record<string, string>, step: string, leagueChanged: boolean) => void;
  onEnd: () => void;
  attachMusic: () => void;
}

export function AutoShowPanel({ handlers, presetDate }: { handlers: AutoShowHandlers; presetDate?: string | null }) {
  const today = new Date();
  const yesterday = new Date(Date.now() - 86400000);
  const [date, setDate] = useState(presetDate ?? yyyymmdd(yesterday));
  const [leagues, setLeagues] = useState<RecapLeague[] | null>(null);
  const [chosen, setChosen] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [opts, setOpts] = useState({ stats: true, analysis: true, impact: true, numbers: true, parlays: true, speed: 1, loop: false });
  // advertising (rotates every 15 s) and own ticker messages
  const [ads, setAds] = useState<{ src: string; name: string }[]>([]);
  const [adOn, setAdOn] = useState(true);
  const [messages, setMessages] = useState("");
  useEffect(() => { try { const v = localStorage.getItem("nexus.show.messages"); if (v) { setMessages(v); setCintaExtra(v.split(/\r?\n/)); } } catch { /* ignore */ } }, []);
  const saveMessages = (v: string) => { setMessages(v); setCintaExtra(v.split(/\r?\n/)); try { localStorage.setItem("nexus.show.messages", v); } catch { /* ignore */ } };
  useEffect(() => {
    if (!ads.length) { setAdImage(null); return; }
    let i = 0;
    setAdImage(ads[0]);
    const t = window.setInterval(() => { i = (i + 1) % ads.length; setAdImage(ads[i]); }, 15000);
    return () => window.clearInterval(t);
  }, [ads]);
  const addAds = async (files: FileList) => {
    const read = (f: File) => new Promise<{ src: string; name: string }>((resolve) => { const r = new FileReader(); r.onload = () => resolve({ src: String(r.result), name: f.name }); r.readAsDataURL(f); });
    const list = await Promise.all([...files].filter((f) => f.type.startsWith("image/")).slice(0, 8).map(read));
    setAds((cur) => [...cur, ...list]);
  };
  const [slides, setSlides] = useState<Slide[]>([]);
  const [index, setIndex] = useState(-1);
  const [paused, setPaused] = useState(false);
  const [musicName, setMusicName] = useState(music.name);
  const [musicOn, setMusicOn] = useState(music.playing);
  const [volume, setVolume] = useState(0.35);
  const logos = useRef<Record<string, string>>({});
  const timer = useRef<number | null>(null);
  const h = useRef(handlers);
  h.current = handlers;

  useEffect(() => { if (presetDate) setDate(presetDate); }, [presetDate]);

  const load = async (d = date) => {
    setLoading(true);
    setLeagues(null);
    try {
      const res = await fetch(`/api/football/recap?date=${d}`);
      const data = await res.json() as { leagues: RecapLeague[] };
      const list = [...(data.leagues ?? [])].sort((a, b) => LEAGUE_ORDER.indexOf(a.league) - LEAGUE_ORDER.indexOf(b.league));
      setLeagues(list);
      setChosen(list.map((l) => l.league));
      // crests as data URLs (the raster can't load remote images)
      const urls = [...new Set(list.flatMap((l) => l.matches.flatMap((m) => [m.home.logo, m.away.logo])).filter((u): u is string => Boolean(u)))];
      await Promise.all(urls.map(async (u) => { if (!logos.current[u]) { try { logos.current[u] = await logoToDataUrl(u, 220); } catch { /* monogram */ } } }));
    } catch { setLeagues([]); }
    setLoading(false);
  };
  useEffect(() => { void load(); }, [date]); // eslint-disable-line react-hooks/exhaustive-deps

  const label = (d: string) => new Date(+d.slice(0, 4), +d.slice(4, 6) - 1, +d.slice(6, 8)).toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" });
  const rundown = useMemo(() => buildRundown((leagues ?? []).filter((l) => chosen.includes(l.league)), {
    ...opts, title: date === yyyymmdd(yesterday) ? "La jornada de ayer" : date === yyyymmdd(today) ? "La jornada de hoy" : `Jornada del ${label(date)}`,
  }), [leagues, chosen, opts, date]); // eslint-disable-line react-hooks/exhaustive-deps

  const show = (list: Slide[], i: number, prev: number) => {
    const slide = list[i];
    if (!slide) return;
    const changed = prev < 0 || list[prev]?.league !== slide.league;
    h.current.onSlide(slide, logos.current, `${i + 1}/${list.length}`, changed);
  };
  const stopTimer = () => { if (timer.current) window.clearTimeout(timer.current); timer.current = null; };
  const go = (list: Slide[], i: number, prev: number) => {
    stopTimer();
    if (i >= list.length) {
      if (opts.loop) { go(list, 0, prev); return; }
      stop();
      return;
    }
    setIndex(i);
    show(list, i, prev);
    timer.current = window.setTimeout(() => go(list, i + 1, i), list[i].seconds * 1000);
  };
  const start = () => {
    if (!rundown.length) return;
    setSlides(rundown);
    setPaused(false);
    h.current.onStart(rundown.find((s) => s.league)?.league, adOn);
    if (musicOn) h.current.attachMusic();
    window.setTimeout(() => go(rundown, 0, -1), 150);
  };
  const stop = () => { stopTimer(); setIndex(-1); setPaused(false); h.current.onEnd(); };
  const pause = () => {
    if (paused) { setPaused(false); go(slides, index, index - 1); } else { stopTimer(); setPaused(true); }
  };
  const jump = (i: number) => { if (!slides.length) return; const n = Math.max(0, Math.min(slides.length - 1, i)); if (paused) { setIndex(n); show(slides, n, index); } else go(slides, n, index); };
  useEffect(() => () => stopTimer(), []);

  const toggleMusic = async () => {
    if (music.playing) { music.pause(); setMusicOn(false); return; }
    if (!music.loaded) { music.load(await generateNexusLoop(), "Música NEXUS (generada)"); setMusicName(music.name); }
    h.current.attachMusic();
    await music.play();
    setMusicOn(true);
  };
  const upload = async (file: File) => {
    music.load(file, file.name);
    setMusicName(file.name);
    h.current.attachMusic();
    await music.play();
    setMusicOn(true);
  };

  const running = index >= 0;
  const current = running ? slides[index] : null;
  const chip = (on: boolean) => `rounded-full px-2.5 py-1 text-[11px] font-semibold ${on ? "bg-white text-black" : "border border-white/10 text-neutral-300 hover:border-white/30"}`;

  return (
    <div className="space-y-2 p-2">
      {/* transport */}
      <div className={`rounded-xl border p-2 ${running ? "border-red-500/60 bg-red-500/[0.06]" : "border-white/[0.08] bg-white/[0.02]"}`}>
        <div className="flex flex-wrap items-center gap-1.5">
          {!running ? (
            <button type="button" onClick={start} disabled={!rundown.length} className="inline-flex items-center gap-1.5 rounded-lg bg-red-500 px-3 py-2 text-[12.5px] font-black text-white hover:bg-red-400 disabled:opacity-40">
              <Play size={14} fill="currentColor" /> Iniciar programa ({rundown.length} pantallas · {Math.round(rundown.reduce((n, s) => n + s.seconds, 0) / 60)} min)
            </button>
          ) : (
            <>
              <button type="button" onClick={() => jump(index - 1)} className="rounded-lg bg-white/[0.08] p-2 text-white" aria-label="Anterior"><ChevronLeft size={15} /></button>
              <button type="button" onClick={pause} className="inline-flex items-center gap-1 rounded-lg bg-white px-3 py-2 text-[12px] font-bold text-black">{paused ? <><Play size={13} fill="currentColor" /> Seguir</> : <><Pause size={13} /> Pausa</>}</button>
              <button type="button" onClick={() => jump(index + 1)} className="rounded-lg bg-white/[0.08] p-2 text-white" aria-label="Siguiente"><ChevronRight size={15} /></button>
              <button type="button" onClick={stop} className="inline-flex items-center gap-1 rounded-lg border border-red-400/60 px-3 py-2 text-[12px] font-bold text-red-200"><Square size={12} /> Terminar</button>
              <span className="min-w-0 flex-1 truncate text-[11.5px] text-neutral-300"><b className="text-red-300">● AL AIRE</b> {index + 1}/{slides.length} · {current ? KIND_LABEL[current.kind] : ""}{current?.match ? ` · ${current.match.home.short} ${current.match.home.score}-${current.match.away.score} ${current.match.away.short}` : current?.leagueName ? ` · ${current.leagueName}` : ""}</span>
            </>
          )}
          <label className="ml-auto inline-flex items-center gap-1 text-[11px] text-neutral-400"><input type="checkbox" className="accent-red-500" checked={opts.loop} onChange={(e) => setOpts({ ...opts, loop: e.target.checked })} /><Repeat size={12} /> Repetir</label>
        </div>
        {running && <div className="mt-2 h-1 overflow-hidden rounded bg-white/10"><div className="h-full bg-red-500 transition-all" style={{ width: `${((index + 1) / slides.length) * 100}%` }} /></div>}
      </div>

      <div className="grid gap-2 lg:grid-cols-2">
        {/* what */}
        <div className="space-y-2 rounded-xl border border-[var(--nx-line)] bg-[var(--nx-s1)] p-2">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-neutral-400">Jornada</p>
          <div className="flex flex-wrap items-center gap-1">
            <button type="button" onClick={() => setDate(yyyymmdd(yesterday))} className={chip(date === yyyymmdd(yesterday))}>Ayer</button>
            <button type="button" onClick={() => setDate(yyyymmdd(today))} className={chip(date === yyyymmdd(today))}>Hoy</button>
            <input type="date" value={`${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`} onChange={(e) => e.target.value && setDate(e.target.value.replace(/-/g, ""))}
              className="rounded-md border border-white/10 bg-black/40 px-2 py-1 text-[11px] text-white [color-scheme:dark]" />
          </div>
          <p className="text-[11px] capitalize text-neutral-500">{label(date)}</p>
          {loading && <p className="flex items-center gap-1.5 text-[11.5px] text-neutral-400"><Loader2 size={12} className="animate-spin" /> Buscando resultados y armando el análisis…</p>}
          {leagues && !leagues.length && !loading && <p className="text-[11.5px] text-neutral-500">No hay partidos terminados ese día en las ligas seguidas.</p>}
          <div className="flex flex-wrap gap-1">
            {(leagues ?? []).map((l) => {
              const on = chosen.includes(l.league);
              return <button key={l.league} type="button" onClick={() => setChosen(on ? chosen.filter((x) => x !== l.league) : [...chosen, l.league])} className={chip(on)}>{SHORT[l.league] ?? l.leagueName} · {l.matches.length}</button>;
            })}
          </div>
          <p className="pt-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-neutral-400">Por cada partido</p>
          <div className="flex flex-wrap gap-1">
            <span className={chip(true)}>Resultado</span>
            {([["stats", "Estadísticas"], ["analysis", "Análisis"], ["impact", "Tabla / impacto"], ["numbers", "Jornada en números"], ["parlays", "Parleys ganadores"]] as const).map(([k, t]) => (
              <button key={k} type="button" onClick={() => setOpts({ ...opts, [k]: !opts[k] })} className={chip(opts[k])}>{t}</button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-[11px] text-neutral-400">Ritmo:</span>
            {([[0.7, "Rápido"], [1, "Normal"], [1.4, "Lento"]] as const).map(([v, t]) => (
              <button key={t} type="button" onClick={() => setOpts({ ...opts, speed: v })} className={chip(opts.speed === v)}>{t}</button>
            ))}
          </div>
        </div>

        {/* music + rundown */}
        <div className="space-y-2 rounded-xl border border-[var(--nx-line)] bg-[var(--nx-s1)] p-2">
          <p className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-neutral-400"><Music size={12} /> Música de fondo</p>
          <div className="flex flex-wrap items-center gap-1.5">
            <button type="button" onClick={() => void toggleMusic()} className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11.5px] font-bold ${musicOn ? "bg-emerald-400 text-black" : "bg-white/[0.08] text-white"}`}>
              {musicOn ? <><Pause size={12} /> Sonando</> : <><Play size={12} /> Música NEXUS</>}
            </button>
            <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1.5 text-[11.5px] text-neutral-300 hover:text-white">
              <Upload size={12} /> Mi canción
              <input type="file" accept="audio/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ""; }} />
            </label>
            <input type="range" min={0} max={1} step={0.05} value={volume} onChange={(e) => { const v = Number(e.target.value); setVolume(v); music.setVolume(v); }} className="w-24 accent-emerald-400" aria-label="Volumen de la música" />
          </div>
          {musicName && <p className="truncate text-[10.5px] text-neutral-500">{musicName}</p>}
          <p className="flex items-center gap-1.5 pt-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-neutral-400"><Megaphone size={12} /> Publicidad (torre derecha)
            <label className="ml-auto inline-flex items-center gap-1 normal-case tracking-normal"><input type="checkbox" className="accent-yellow-400" checked={adOn} onChange={(e) => { setAdOn(e.target.checked); if (running) h.current.onAd(e.target.checked); }} /> Mostrar</label>
          </p>
          <div className="flex flex-wrap items-center gap-1">
            {ads.map((a, i) => (
              <span key={i} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.src} alt={a.name} className="h-12 w-9 rounded object-cover" />
                <button type="button" onClick={() => setAds(ads.filter((_, k) => k !== i))} className="absolute -right-1 -top-1 rounded-full bg-black p-0.5 text-white" aria-label="Quitar"><X size={9} /></button>
              </span>
            ))}
            <label className="inline-flex h-12 cursor-pointer items-center gap-1 rounded border border-dashed border-white/20 px-2 text-[10.5px] text-neutral-400 hover:text-white">
              <Upload size={12} /> Subir (400×560)
              <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { if (e.target.files) void addAds(e.target.files); e.target.value = ""; }} />
            </label>
          </div>
          {!ads.length && <p className="text-[10px] text-neutral-500">Sin imágenes muestra «Tu marca aquí». Varias imágenes rotan cada 15 s.</p>}
          <p className="pt-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-neutral-400">Mensajes en la cinta (uno por línea)</p>
          <textarea value={messages} onChange={(e) => saveMessages(e.target.value)} rows={2} placeholder={"Síguenos en Kick: nexus\nVota en nexus.news"} className="w-full rounded-md border border-white/10 bg-black/40 px-2 py-1 text-[11px] text-white placeholder:text-neutral-600" />
          <p className="pt-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-neutral-400">Guion ({rundown.length})</p>
          <ol className="max-h-48 space-y-0.5 overflow-y-auto pr-1">
            {(running ? slides : rundown).map((s, i) => (
              <li key={i}>
                <button type="button" onClick={() => running && jump(i)} className={`flex w-full items-center gap-2 rounded px-1.5 py-0.5 text-left text-[11px] ${i === index ? "bg-red-500/20 text-white" : "text-neutral-400 hover:bg-white/[0.04]"}`}>
                  <span className="w-5 text-right tabular-nums text-neutral-600">{i + 1}</span>
                  <span className="w-20 flex-shrink-0 font-semibold">{KIND_LABEL[s.kind]}</span>
                  <span className="truncate">{s.match ? `${s.match.home.name} ${s.match.home.score}-${s.match.away.score} ${s.match.away.name}` : s.leagueName ?? s.title}</span>
                  <span className="ml-auto tabular-nums text-neutral-600">{s.seconds}s</span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
