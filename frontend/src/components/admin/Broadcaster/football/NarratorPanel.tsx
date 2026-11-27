"use client";

// Narrador IA: provider status, voice choice, pronunciation dictionary and the 60-second
// listening test (real matches of the day, synthesized line by line with the next line
// prepared while the current one plays — the same pipeline the show will use).
// The test plays on the operator's speakers only; it never goes on air.

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Play, Plus, RefreshCw, Save, Square, Trash2, Volume2 } from "lucide-react";
import { ui } from "./ui";
import type { Categories } from "../engine/matchStatus";
import { LocalNarrator, loadNarratorSettings, NarrationQueue, PROFILES, saveNarratorSettings, type LexiconEntry, type NarrationLine, type NarrationProfile, type NarratorSettings, type ProviderStatus } from "../engine/narration";
import { voiceTestScript } from "../engine/narratorScript";

type LineState = { state: "waiting" | "preparing" | "playing" | "done" | "error"; startedAt?: number; durationS?: number; error?: string };

export function NarratorPanel({ categories }: { categories: Categories }) {
  const [settings, setSettings] = useState<NarratorSettings>(() => (typeof window === "undefined" ? { url: "http://127.0.0.1:8802", voice: { provider: "kokoro", voice: "em_santa" }, volume: 1 } : loadNarratorSettings()));
  const provider = useMemo(() => new LocalNarrator(settings.url), [settings.url]);
  const [status, setStatus] = useState<ProviderStatus | null>(null);
  const [lexicon, setLexicon] = useState<LexiconEntry[] | null>(null);
  const [lexDirty, setLexDirty] = useState(false);
  const [sampleText, setSampleText] = useState("¡Gol! ¡Gol de Millonarios! Un remate cruzado que se mete junto al palo.");
  const [sampleProfile, setSampleProfile] = useState<NarrationProfile>("EPIC");
  const [script, setScript] = useState<NarrationLine[]>([]);
  const [lines, setLines] = useState<Record<string, LineState>>({});
  const [run, setRun] = useState<{ running: boolean; startedAt: number; firstAudioMs?: number; gapsMs: number; endedAt?: number; error?: string } | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const queueRef = useRef<NarrationQueue | null>(null);
  const lastEndRef = useRef(0);

  useEffect(() => { saveNarratorSettings(settings); queueRef.current?.setVoice(settings.voice); queueRef.current?.setVolume(settings.volume); }, [settings]);

  // provider status (reachability, models, RTF, cache, last error)
  useEffect(() => {
    let alive = true;
    const read = async () => { const s = await provider.status(); if (alive) setStatus(s); };
    void read();
    const t = window.setInterval(read, 5000);
    return () => { alive = false; window.clearInterval(t); };
  }, [provider]);

  useEffect(() => {
    if (!status?.reachable || lexicon) return;
    provider.lexicon().then(setLexicon).catch(() => setLexicon([]));
  }, [status?.reachable, lexicon, provider]);

  useEffect(() => () => { queueRef.current?.dispose(); void ctxRef.current?.close(); }, []);

  const queue = () => {
    if (!ctxRef.current) ctxRef.current = new AudioContext();
    void ctxRef.current.resume();
    if (!queueRef.current) {
      queueRef.current = new NarrationQueue(provider, ctxRef.current, ctxRef.current.destination, settings.voice, (e) => {
        const now = performance.now();
        if (e.type === "preparing") setLines((s) => ({ ...s, [e.line.id]: { ...s[e.line.id], state: s[e.line.id]?.state === "playing" ? "playing" : "preparing" } }));
        if (e.type === "start") {
          setLines((s) => ({ ...s, [e.line.id]: { state: "playing", startedAt: now, durationS: e.durationS } }));
          setRun((r) => {
            if (!r) return r;
            const gap = lastEndRef.current ? Math.max(0, now - lastEndRef.current) : 0;
            return { ...r, firstAudioMs: r.firstAudioMs ?? Math.round(now - r.startedAt), gapsMs: r.gapsMs + (gap > 60 ? gap : 0) };
          });
        }
        if (e.type === "end") { lastEndRef.current = now; setLines((s) => ({ ...s, [e.line.id]: { ...s[e.line.id], state: "done" } })); }
        if (e.type === "error") setLines((s) => ({ ...s, [e.line.id]: { state: "error", error: e.message } }));
        if (e.type === "idle") setRun((r) => (r ? { ...r, running: false, endedAt: now } : r));
      });
      queueRef.current.setVolume(settings.volume);
    }
    return queueRef.current;
  };

  // a new provider URL needs a fresh queue
  useEffect(() => { queueRef.current?.dispose(); queueRef.current = null; }, [provider]);

  const startTest = () => {
    const s = voiceTestScript(categories);
    setScript(s);
    setLines(Object.fromEntries(s.map((l) => [l.id, { state: "waiting" as const }])));
    lastEndRef.current = 0;
    setRun({ running: true, startedAt: performance.now(), gapsMs: 0 });
    queue().enqueue(s);
  };
  const stop = () => { queueRef.current?.interrupt(); setRun((r) => (r ? { ...r, running: false, endedAt: performance.now() } : r)); };
  const playSample = () => { queue().enqueue([{ id: `s${Date.now()}`, text: sampleText, profile: sampleProfile }]); };

  const saveLexicon = async () => {
    if (!lexicon) return;
    try { await provider.saveLexicon(lexicon); setLexDirty(false); } catch (err) { setStatus((s) => (s ? { ...s, lastError: { at: Date.now() / 1000, message: err instanceof Error ? err.message : String(err) } } : s)); }
  };

  const voices = status?.providers ? (Object.entries(status.providers) as [("kokoro" | "piper"), NonNullable<ProviderStatus["providers"]>["kokoro"]][]) : [];
  const totalS = script.reduce((t, l) => t + (lines[l.id]?.durationS ?? 0), 0);

  return (
    <div className="grid gap-2 p-2 text-[12px] text-[var(--nx-text)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      {/* ---------------- provider */}
      <section className={`${ui.panelPad} space-y-2`}>
        <div className={ui.title}>Proveedor de voz · local</div>
        <div className="flex items-center gap-2">
          {status === null ? <Loader2 size={14} className="animate-spin" /> : status.reachable ? <CheckCircle2 size={14} className="text-[var(--nx-ok)]" /> : <AlertTriangle size={14} className="text-amber-400" />}
          <span className="font-semibold">{status === null ? "Comprobando…" : status.reachable ? (status.busy ? "Conectado · generando" : "Conectado") : "Sin servicio"}</span>
          <input value={settings.url} onChange={(e) => setSettings((s) => ({ ...s, url: e.target.value.trim() }))} className="ml-auto w-44 rounded border border-[var(--nx-line-2)] bg-black/30 px-2 py-0.5 font-mono text-[11px]" aria-label="URL del servicio de narración" />
        </div>
        {status && !status.reachable && <p className="rounded bg-amber-500/10 px-2 py-1.5 text-amber-200">{status.error} Comando: <code className="font-mono">automation\narrator\venv\Scripts\python -m uvicorn app:app --host 127.0.0.1 --port 8802</code></p>}
        {voices.map(([id, p]) => (
          <div key={id} className="rounded border border-[var(--nx-line)] p-2">
            <div className="flex items-center gap-2">
              <span className="font-bold uppercase">{id === "kokoro" ? "Kokoro 82M" : "Piper"}</span>
              <span className={p.ready ? "text-[var(--nx-ok)]" : "text-red-400"}>{p.ready ? "listo" : "no disponible"}</span>
              {id === "kokoro" && <span className="text-[var(--nx-dim)]">principal</span>}
              {id === "piper" && <span className="text-[var(--nx-dim)]">alternativa</span>}
              {p.lastRtf !== null && <span className="ml-auto text-[var(--nx-muted)]" title="Tiempo de generación ÷ duración del audio (menor que 1 = más rápido que tiempo real)">RTF {p.lastRtf}</span>}
            </div>
            {p.error && <p className="mt-1 text-red-300">{p.error}</p>}
            <div className="mt-1.5 flex flex-wrap gap-1">
              {Object.entries(p.voices).map(([v, label]) => {
                const on = settings.voice.provider === id && settings.voice.voice === v;
                return <button key={v} type="button" disabled={!p.ready} onClick={() => setSettings((s) => ({ ...s, voice: { provider: id, voice: v } }))} className={on ? ui.chipOn : ui.chip}>{label}</button>;
              })}
            </div>
          </div>
        ))}
        {status?.reachable && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[var(--nx-muted)]">
            <span>Caché {status.cache?.files} audios · {status.cache?.mb} MB</span>
            <span>Diccionario {status.lexiconEntries} entradas</span>
            <label className="ml-auto flex items-center gap-1"><Volume2 size={12} /><input type="range" min={0} max={1.5} step={0.05} value={settings.volume} onChange={(e) => setSettings((s) => ({ ...s, volume: Number(e.target.value) }))} /></label>
          </div>
        )}
        {status?.lastError && <p className="rounded bg-red-500/10 px-2 py-1 text-red-300">Último error: {status.lastError.message}</p>}

        <div className={ui.title}>Probar un perfil</div>
        <textarea value={sampleText} onChange={(e) => setSampleText(e.target.value)} rows={2} className="w-full rounded border border-[var(--nx-line-2)] bg-black/30 p-1.5" />
        <div className="flex flex-wrap items-center gap-1">
          {(Object.keys(PROFILES) as NarrationProfile[]).map((p) => <button key={p} type="button" onClick={() => setSampleProfile(p)} className={sampleProfile === p ? ui.chipOn : ui.chip}>{PROFILES[p].label}</button>)}
          <button type="button" disabled={!status?.reachable} onClick={playSample} className={`ml-auto px-3 py-1 ${ui.btnGhost}`}><Play size={12} /> Escuchar</button>
        </div>
        <p className="text-[var(--nx-dim)]">Kokoro no tiene control de emoción: cada perfil cambia la velocidad, las pausas y la intensidad; la emoción la pone también el texto.</p>
      </section>

      {/* ---------------- 60 s test + lexicon */}
      <section className={`${ui.panelPad} space-y-2`}>
        <div className="flex items-center gap-2">
          <div className={ui.title}>Prueba de 60 s · partidos reales de hoy</div>
          {run?.running
            ? <button type="button" onClick={stop} className={`ml-auto px-3 py-1 ${ui.btnGhost}`}><Square size={12} /> Detener</button>
            : <button type="button" disabled={!status?.reachable} onClick={startTest} className={`ml-auto px-3 py-1 ${ui.btnPrimary}`}><Play size={12} /> Generar y escuchar</button>}
        </div>
        <p className="text-[var(--nx-dim)]">Se genera frase por frase; mientras suena una, ya se prepara la siguiente. Suena solo en este equipo y no sale al aire. Aún no está conectado al programa automático.</p>
        {run && (
          <div className="flex flex-wrap gap-x-3 text-[var(--nx-muted)]">
            <span>Primer audio en {run.firstAudioMs !== undefined ? `${(run.firstAudioMs / 1000).toFixed(1)} s` : "…"}</span>
            <span>Silencios por espera {(run.gapsMs / 1000).toFixed(1)} s</span>
            <span>Audio {totalS.toFixed(1)} s</span>
            {!run.running && run.endedAt && <span>Total {((run.endedAt - run.startedAt) / 1000).toFixed(1)} s</span>}
          </div>
        )}
        <ol className="max-h-56 space-y-0.5 overflow-y-auto">
          {script.map((l) => {
            const st = lines[l.id]?.state ?? "waiting";
            return (
              <li key={l.id} className={`flex gap-2 rounded px-1.5 py-1 ${st === "playing" ? "bg-[color-mix(in_srgb,var(--nx-gold)_14%,transparent)]" : ""}`}>
                <span className="w-16 flex-shrink-0 text-[10px] font-bold uppercase text-[var(--nx-dim)]">{PROFILES[l.profile].label}</span>
                <span className={st === "done" ? "text-[var(--nx-muted)]" : ""}>{l.text}</span>
                <span className="ml-auto flex-shrink-0 text-[10px] text-[var(--nx-dim)]">{st === "preparing" ? "generando" : st === "playing" ? "▶" : st === "error" ? <span className="text-red-400" title={lines[l.id]?.error}>error</span> : st === "done" ? `${lines[l.id]?.durationS?.toFixed(1)} s` : ""}</span>
              </li>
            );
          })}
        </ol>

        <div className="flex items-center gap-2">
          <div className={ui.title}>Diccionario de pronunciación</div>
          <button type="button" onClick={() => { setLexicon((l) => [...(l ?? []), { term: "", say: "" }]); setLexDirty(true); }} className={`ml-auto px-2 py-0.5 ${ui.btnGhost}`}><Plus size={12} /> Añadir</button>
          <button type="button" disabled={!lexDirty || !status?.reachable} onClick={() => void saveLexicon()} className={`px-2 py-0.5 ${ui.btnPrimary}`}><Save size={12} /> Guardar</button>
          <button type="button" onClick={() => { setLexicon(null); setLexDirty(false); }} title="Recargar" className={`px-1.5 py-0.5 ${ui.btnGhost}`}><RefreshCw size={12} /></button>
        </div>
        <p className="text-[var(--nx-dim)]">«Se dice» reescribe el nombre como suena en español (Kokoro y Piper). «IPA» fija los fonemas exactos (solo Kokoro).</p>
        <div className="max-h-48 space-y-1 overflow-y-auto">
          {(lexicon ?? []).map((e, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_0.8fr_auto] gap-1">
              {(["term", "say", "ipa"] as const).map((f) => (
                <input key={f} value={e[f] ?? ""} placeholder={f === "term" ? "Nombre" : f === "say" ? "Se dice" : "IPA"} onChange={(ev) => { const v = ev.target.value; setLexicon((l) => l!.map((x, j) => (j === i ? { ...x, [f]: v || undefined } : x))); setLexDirty(true); }}
                  className="min-w-0 rounded border border-[var(--nx-line-2)] bg-black/30 px-1.5 py-0.5" />
              ))}
              <button type="button" onClick={() => { setLexicon((l) => l!.filter((_, j) => j !== i)); setLexDirty(true); }} aria-label="Quitar" className="px-1 text-[var(--nx-dim)] hover:text-red-400"><Trash2 size={12} /></button>
            </div>
          ))}
          {lexicon === null && status?.reachable && <Loader2 size={14} className="animate-spin" />}
        </div>
      </section>
    </div>
  );
}
