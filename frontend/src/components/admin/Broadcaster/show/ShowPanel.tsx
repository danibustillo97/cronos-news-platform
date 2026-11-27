"use client";

// Control room + rundown editor of the AI program (NEXUS SPORT AI Broadcast).
// Left: edition setup (modes, competitions, duration, quality), live preview of the
// Virtual Studio and the director controls. Right: the running order — every segment
// with its stage, durations (min / recommended / max, estimated, real), priority,
// sources, approval, lock, reorder, duration edit, stage change and script editing.

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, ChevronUp, Download, Loader2, Lock, MonitorPlay, Pause, Play, RefreshCw, Repeat, Save, SkipBack, SkipForward, Square, StepForward, Unlock, Volume2, VolumeX, X } from "lucide-react";
import { ui } from "../football/ui";
import { previewCanvas, show, useShow } from "./controller";
import { SHOW_LEAGUES } from "./data";
import { MODE_LABEL, STAGE_LABEL, type DirectorMode, type Mode, type Quality, type StageId } from "./types";

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
const STATUS: Record<string, string> = { idle: "Detenido", playing: "Al aire", paused: "En pausa", "awaiting-approval": "Esperando aprobación", "awaiting-operator": "Esperando al director", done: "Terminado" };
const PRIORITY_CLS: Record<string, string> = { CRITICAL: "bg-red-500/20 text-red-300", HIGH: "bg-amber-500/20 text-amber-200", MEDIUM: "bg-white/10 text-[var(--nx-muted)]", LOW: "bg-white/5 text-[var(--nx-dim)]" };

export function ShowPanel() {
  const st = useShow();
  const previewRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [recover, setRecover] = useState<{ title: string; segment: number } | null>(null);
  const [lib, setLib] = useState<{ id: string; title: string; createdAt: number }[]>([]);

  // the studio's real output canvas, shown scaled (no copy, no extra render)
  useEffect(() => {
    const host = previewRef.current;
    if (!host) return;
    const c = previewCanvas();
    c.style.width = "100%"; c.style.height = "auto"; c.style.display = "block"; c.style.aspectRatio = "16 / 9";
    host.appendChild(c);
    return () => { if (c.parentElement === host) host.removeChild(c); };
  }, [st.options.quality]);
  useEffect(() => { if (!st.edition) setRecover(show.recoverable()); setLib(show.library()); }, [st.edition]);

  const d = st.director, e = st.edition;
  const cur = e && d ? e.segments[d.segment] : null;
  const nxt = e && d ? e.segments.slice(d.segment + 1).find((s) => s.status !== "skipped") : null;
  const remaining = e ? e.segments.slice(d?.segment ?? 0).filter((s) => s.status !== "skipped" && s.status !== "done").reduce((t, s) => t + s.estimatedS, 0) : 0;
  const voiceOk = Boolean(st.narrator?.reachable && st.narrator.providers?.[st.voice.provider]?.ready);
  const toggleMode = (m: Mode) => show.setOptions({ modes: st.options.modes.includes(m) ? st.options.modes.filter((x) => x !== m) : [...st.options.modes, m] });
  const toggleLeague = (l: string) => show.setOptions({ leagues: st.options.leagues.includes(l) ? st.options.leagues.filter((x) => x !== l) : [...st.options.leagues, l] });

  return (
    <div className="grid gap-2 p-2 text-[12px] text-[var(--nx-text)] xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.25fr)]">
      {/* ------------------------------------------------ setup, preview, controls */}
      <section className="space-y-2">
        <div className={`${ui.panelPad} space-y-2`}>
          <div className={ui.title}>Nueva edición · datos reales</div>
          <div className="flex flex-wrap gap-1">{(Object.keys(MODE_LABEL) as Mode[]).map((m) => <button key={m} type="button" onClick={() => toggleMode(m)} className={st.options.modes.includes(m) ? ui.chipOn : ui.chip}>{MODE_LABEL[m]}</button>)}</div>
          <div className="flex flex-wrap gap-1">
            <button type="button" onClick={() => show.setOptions({ leagues: [] })} className={st.options.leagues.length === 0 ? ui.chipOn : ui.chip}>Todas</button>
            {SHOW_LEAGUES.map((l) => <button key={l.id} type="button" onClick={() => toggleLeague(l.id)} className={st.options.leagues.includes(l.id) ? ui.chipOn : ui.chip}>{l.name}</button>)}
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-[var(--nx-muted)]">Duración</span>
            {([15, 30, 45, 60] as const).map((m) => <button key={m} type="button" onClick={() => show.setOptions({ targetMin: m })} className={st.options.targetMin === m ? ui.chipOn : ui.chip}>{m} min</button>)}
            <span className="ml-2 text-[var(--nx-muted)]">Calidad 3D</span>
            {(["LOW", "MEDIUM", "HIGH"] as Quality[]).map((q) => <button key={q} type="button" onClick={() => show.setOptions({ quality: q })} className={st.options.quality === q ? ui.chipOn : ui.chip}>{q === "LOW" ? "Baja" : q === "MEDIUM" ? "Media" : "Alta"}</button>)}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" disabled={!st.options.modes.length || Boolean(st.building)} onClick={() => void show.build()} className={`px-3 py-1.5 ${ui.btnPrimary}`}>{st.building ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Generar edición</button>
            {st.building && <span className="text-[var(--nx-muted)]">{st.building}</span>}
            {recover && !e && <button type="button" onClick={() => { show.recover(); setRecover(null); }} className={`px-2 py-1 ${ui.btnGhost}`}>Recuperar «{recover.title}» (segmento {recover.segment + 1})</button>}
            {lib.length > 0 && (
              <select onChange={(ev) => { if (ev.target.value) show.load(ev.target.value); }} value="" className="rounded border border-[var(--nx-line-2)] bg-black/40 px-1.5 py-1 text-[11px]">
                <option value="">Ediciones guardadas…</option>
                {lib.map((x) => <option key={x.id} value={x.id}>{x.title} · {new Date(x.createdAt).toLocaleString("es-CO", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</option>)}
              </select>
            )}
          </div>
          {st.error && <p className="rounded bg-red-500/10 px-2 py-1 text-red-300">{st.error}</p>}
          {st.report.length > 0 && <p className="text-[var(--nx-dim)]">{st.report.map((r) => `${r.ok ? "✓" : "✗"} ${r.source}: ${r.detail}`).join(" · ")}</p>}
        </div>

        <div className={`${ui.panel} overflow-hidden`}>
          <div ref={previewRef} className="bg-black" />
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-2 py-1.5 text-[11px] text-[var(--nx-muted)]">
            <span>Estudio {st.renderer ? (st.renderer.mode === "3d" ? `3D · ${st.renderer.quality}` : "2D (sin WebGL)") : "—"}{st.renderer ? ` · ${st.renderer.framesPerSecond} cuadros/s` : ""}</span>
            <span className={voiceOk ? "text-[var(--nx-ok)]" : "text-amber-300"}>{voiceOk ? `Voz: ${st.voice.voice} (provisional)` : "Voz: sin narrador local → subtítulos"}</span>
            <button type="button" onClick={() => void show.refreshNarrator()} className="underline">comprobar</button>
            <button type="button" onClick={() => show.air(!st.onAir)} className={`ml-auto px-2.5 py-1 ${st.onAir ? ui.btnLive : ui.btnPrimary}`}><MonitorPlay size={13} /> {st.onAir ? "En Program" : "Poner en Program"}</button>
          </div>
        </div>

        <div className={`${ui.panelPad} space-y-2`}>
          <div className="flex flex-wrap items-center gap-1">
            {(["AUTO", "SEMI", "MANUAL"] as DirectorMode[]).map((m) => <button key={m} type="button" disabled={!e} onClick={() => show.setMode(m)} className={(d?.mode ?? "AUTO") === m ? ui.chipOn : ui.chip}>{m === "SEMI" ? "SEMI-AUTO" : m}</button>)}
            <span className="ml-auto font-bold">{d ? STATUS[d.status] : "Sin edición en marcha"}</span>
          </div>
          <div className="flex flex-wrap gap-1">
            <Btn on={() => void show.play(d?.status === "paused" ? undefined : d?.status === "done" ? 0 : undefined)} disabled={!e || d?.status === "playing"} label={d?.status === "paused" ? "Reanudar" : "Play"} icon={<Play size={13} />} primary />
            <Btn on={show.pause} disabled={d?.status !== "playing"} label="Pausa" icon={<Pause size={13} />} />
            <Btn on={show.stop} disabled={!d || d.status === "idle"} label="Stop" icon={<Square size={13} />} />
            <Btn on={show.previous} disabled={!d} label="Anterior" icon={<SkipBack size={13} />} />
            <Btn on={show.next} disabled={!d} label={d?.status === "awaiting-operator" ? "Continuar" : "Siguiente"} icon={<SkipForward size={13} />} />
            <Btn on={show.repeat} disabled={!d} label="Repetir" icon={<Repeat size={13} />} />
            <Btn on={show.skip} disabled={d?.status !== "playing"} label="Saltar bloque" icon={<StepForward size={13} />} />
            <Btn on={show.interrupt} disabled={d?.status !== "playing"} label="Cortar voz" icon={<VolumeX size={13} />} />
            {d?.status === "awaiting-approval" && <Btn on={() => { if (cur) show.updateSegment(cur.id, { approved: true }); show.approve(); }} label="Aprobar y emitir" icon={<Check size={13} />} primary />}
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px]">
            <span className="text-[var(--nx-muted)]">Ahora: <b className="text-[var(--nx-text)]">{cur ? `${cur.title} · ${STAGE_LABEL[cur.stage]}` : "—"}</b></span>
            <span className="text-[var(--nx-muted)]">Siguiente: <b className="text-[var(--nx-text)]">{nxt ? nxt.title : "—"}</b></span>
            <span className="text-[var(--nx-muted)]">Transcurrido <b className="text-[var(--nx-text)]">{fmt(d?.elapsedS ?? 0)}</b></span>
            <span className="text-[var(--nx-muted)]">Restante estimado <b className="text-[var(--nx-text)]">{fmt(remaining)}</b> · total {fmt(e?.estimatedS ?? 0)}</span>
          </div>
          {d?.narrating && <p className="rounded bg-[color-mix(in_srgb,var(--nx-gold)_10%,transparent)] px-2 py-1"><b>{d.voice === "voz" ? "🎙" : "CC"}</b> {d.narrating}</p>}
          {d?.nextNarration && <p className="px-2 text-[var(--nx-dim)]">Después: {d.nextNarration}</p>}
          {d?.error && <p className="rounded bg-red-500/10 px-2 py-1 text-red-300">Voz: {d.error} (sigue con subtítulos)</p>}
          <div className="flex items-center gap-2 text-[11px]">
            <button type="button" onClick={() => show.setMusic({ on: !st.music.on })} className={st.music.on ? ui.chipOn : ui.chip}>{st.music.on ? <Volume2 size={11} className="inline" /> : <VolumeX size={11} className="inline" />} Música</button>
            <input type="range" min={0} max={0.8} step={0.05} value={st.music.volume} onChange={(ev) => show.setMusic({ volume: Number(ev.target.value) })} aria-label="Volumen de música" />
            <span className="text-[var(--nx-dim)]">baja sola mientras habla el narrador</span>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------ rundown */}
      <section className={`${ui.panelPad} min-h-0 space-y-1.5`}>
        <div className="flex items-center gap-2">
          <div className={ui.title}>Escaleta {e ? `· ${e.title}` : ""}</div>
          {e && <span className="text-[var(--nx-muted)]">{e.segments.length} segmentos · {fmt(e.estimatedS)} estimado de {e.targetMin} min</span>}
          {e && <button type="button" onClick={() => { show.save(); setLib(show.library()); }} className={`ml-auto px-2 py-0.5 ${ui.btnGhost}`}><Save size={12} /> Guardar</button>}
          {e && <button type="button" onClick={() => { const blob = new Blob([show.exportJson()], { type: "application/json" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `nexus-edicion-${e.id}.json`; a.click(); URL.revokeObjectURL(a.href); }} className={`px-2 py-0.5 ${ui.btnGhost}`}><Download size={12} /></button>}
        </div>
        {e?.warnings.map((w) => <p key={w} className="rounded bg-amber-500/10 px-2 py-1 text-amber-200">{w}</p>)}
        {!e && <p className="text-[var(--nx-dim)]">Elige modalidades y competiciones y pulsa «Generar edición». La escaleta se arma solo con datos verificados: resultados y análisis de ESPN, partidos en juego confirmados, calendario en hora de Colombia, tablas, noticias publicadas y votaciones reales.</p>}
        <ol className="max-h-[70vh] space-y-1 overflow-y-auto pr-1">
          {e?.segments.map((s, i) => {
            const live = d && d.segment === i && d.status !== "idle" && d.status !== "done";
            const expanded = open === s.id;
            return (
              <li key={s.id} className={`rounded border ${live ? "border-[var(--nx-gold)]" : "border-[var(--nx-line)]"} ${s.status === "skipped" ? "opacity-45" : ""}`}>
                <div className="flex flex-wrap items-center gap-1.5 px-2 py-1.5">
                  <span className="w-5 text-right font-mono text-[var(--nx-dim)]">{i + 1}</span>
                  <button type="button" onClick={() => setOpen(expanded ? null : s.id)} className="font-bold hover:underline">{s.title}</button>
                  <select value={s.stage} disabled={s.locked} onChange={(ev) => show.setStage(s.id, ev.target.value as StageId)} className="rounded border border-[var(--nx-line-2)] bg-black/40 px-1 text-[10.5px]">
                    {(Object.keys(STAGE_LABEL) as StageId[]).map((k) => <option key={k} value={k}>{STAGE_LABEL[k]}</option>)}
                  </select>
                  <span className={`rounded px-1.5 text-[10px] font-bold ${PRIORITY_CLS[s.priority]}`}>{s.priority}</span>
                  <span className="tabular-nums text-[var(--nx-muted)]" title="estimado (real) · mínimo / recomendado / máximo">{fmt(s.estimatedS)}{s.actualS !== undefined ? ` (${fmt(s.actualS)})` : ""} · {fmt(s.minS)}/{fmt(s.recS)}/{fmt(s.maxS)}</span>
                  <span className="text-[10px] uppercase text-[var(--nx-dim)]">{s.status === "on-air" ? "" : s.status === "done" ? "emitido" : s.status === "skipped" ? "omitido" : ""}</span>
                  <span className="ml-auto flex items-center gap-0.5">
                    <IconBtn on={() => show.jump(i)} title="Ir a este segmento" icon={<Play size={12} />} />
                    <IconBtn on={() => show.updateSegment(s.id, { approved: !s.approved })} title={s.approved ? "Aprobado" : "Aprobar"} icon={<Check size={12} className={s.approved ? "text-[var(--nx-ok)]" : ""} />} />
                    <IconBtn on={() => show.updateSegment(s.id, { locked: !s.locked })} title={s.locked ? "Bloqueado (no se edita)" : "Bloquear"} icon={s.locked ? <Lock size={12} className="text-[var(--nx-gold)]" /> : <Unlock size={12} />} />
                    <IconBtn on={() => show.updateSegment(s.id, { status: s.status === "skipped" ? "pending" : "skipped" })} title={s.status === "skipped" ? "Reincluir" : "Omitir"} icon={<X size={12} />} />
                    <IconBtn on={() => show.moveSegment(s.id, -1)} title="Subir" icon={<ChevronUp size={12} />} />
                    <IconBtn on={() => show.moveSegment(s.id, 1)} title="Bajar" icon={<ChevronDown size={12} />} />
                  </span>
                </div>
                {s.note && <p className="px-8 pb-1 text-[10.5px] text-amber-200/80">{s.note}</p>}
                {expanded && (
                  <div className="space-y-1 border-t border-[var(--nx-line)] px-2 py-1.5">
                    <div className="flex items-center gap-2 text-[11px]">
                      <span className="text-[var(--nx-muted)]">Duración</span>
                      <input type="range" min={20} max={Math.max(s.maxS, s.estimatedS) + 120} step={10} defaultValue={s.estimatedS} disabled={s.locked} onMouseUp={(ev) => show.setDuration(s.id, Number((ev.target as HTMLInputElement).value))} onTouchEnd={(ev) => show.setDuration(s.id, Number((ev.target as HTMLInputElement).value))} />
                      <span className="text-[var(--nx-dim)]">recorta bloques reales; nunca agrega contenido inventado</span>
                    </div>
                    <p className="text-[10.5px] text-[var(--nx-dim)]">Fuentes: {s.sources.map((x) => x.name).join(", ") || "—"} {s.itemIds.length ? `· ${s.itemIds.map((id) => e.items[id]?.reason).filter(Boolean).slice(0, 3).join(" | ")}` : ""}</p>
                    <ol className="space-y-1">
                      {s.beats.map((b, bi) => (
                        <li key={b.id} className={`grid grid-cols-[auto_1fr] gap-2 rounded px-1 ${live && d?.beat === bi ? "bg-[color-mix(in_srgb,var(--nx-gold)_12%,transparent)]" : ""}`}>
                          <span className="pt-1 text-[10px] uppercase text-[var(--nx-dim)]">{[b.stage && STAGE_LABEL[b.stage], b.shot, b.screen?.type].filter(Boolean).join(" · ") || "·"}</span>
                          {b.narration ? (
                            <textarea defaultValue={b.narration.text} disabled={s.locked} rows={Math.min(4, Math.ceil(b.narration.text.length / 90))} onBlur={(ev) => { if (ev.target.value !== b.narration!.text) show.editLine(s.id, b.id, ev.target.value); }}
                              className="w-full rounded border border-[var(--nx-line)] bg-black/30 px-1.5 py-0.5 text-[11.5px]" />
                          ) : <span className="text-[var(--nx-dim)]">(pausa visual {Math.round((b.holdMs ?? 0) / 100) / 10} s)</span>}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}

function Btn({ on, label, icon, disabled, primary }: { on: () => void; label: string; icon: React.ReactNode; disabled?: boolean; primary?: boolean }) {
  return <button type="button" onClick={on} disabled={disabled} className={`px-2.5 py-1 text-[11.5px] ${primary ? ui.btnPrimary : ui.btnGhost}`}>{icon} {label}</button>;
}
function IconBtn({ on, title, icon }: { on: () => void; title: string; icon: React.ReactNode }) {
  return <button type="button" onClick={on} title={title} aria-label={title} className="rounded p-1 text-[var(--nx-muted)] hover:bg-white/10 hover:text-[var(--nx-text)]">{icon}</button>;
}
