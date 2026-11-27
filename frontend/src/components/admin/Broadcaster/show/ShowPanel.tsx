"use client";

// Automatic program (NEXUS SPORT AI Broadcast).
// - In the broadcaster tab: a compact launcher (preview, status, «Emitir programa», open control room).
// - Control room: full screen, three calm zones — what is on air (big), the transport, the running
//   order. Everything else (content, set & lighting, quality, library) lives in a side drawer that
//   opens only when needed. The show keeps running when the control room is closed.

import { memo, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, ChevronUp, Download, Loader2, Lock, Maximize2, Pause, Play, Repeat, Save, Settings2, SkipBack, SkipForward, Square, Unlock, Volume2, VolumeX, X } from "lucide-react";
import { ui } from "../football/ui";
import { previewCanvas, show, useShow, type ShowState } from "./controller";
import { SHOW_LEAGUES } from "./data";
import { LIGHT_PRESETS, type Lighting } from "./studio3d";
import { MODE_LABEL, STAGE_LABEL, type DirectorMode, type Edition, type Mode, type Quality, type StageId } from "./types";

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
const STATUS: Record<string, string> = { idle: "Detenido", playing: "Al aire", paused: "En pausa", "awaiting-approval": "Esperando aprobación", "awaiting-operator": "Esperando al director", done: "Terminado" };

/** Mounts the studio's real output canvas inside `ref` (one place at a time, no copy). */
function usePreview(ref: React.RefObject<HTMLDivElement | null>, enabled: boolean, quality: Quality) {
  useEffect(() => {
    const host = ref.current;
    if (!host || !enabled) return;
    const c = previewCanvas();
    Object.assign(c.style, { width: "100%", height: "100%", display: "block", objectFit: "contain" });
    host.appendChild(c);
    return () => { if (c.parentElement === host) host.removeChild(c); };
  }, [ref, enabled, quality]);
}

const playLabel = (st: ShowState) => (st.building ? "Preparando…" : st.director?.status === "paused" ? "Reanudar" : st.director?.status === "playing" ? "Al aire" : "Emitir programa");
const playNow = (st: ShowState) => (st.director?.status === "paused" ? show.resume() : void show.play(st.director?.status === "done" ? 0 : undefined));

// ---------------------------------------------------------------- tab launcher
export function ShowPanel() {
  const st = useShow();
  const [full, setFull] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  usePreview(ref, !full, st.options.quality);
  const d = st.director, e = st.edition;
  const cur = e && d ? e.segments[d.segment] : null;

  return (
    <div className="flex flex-wrap items-center gap-4 p-3 text-[13px] text-[var(--nx-text)]">
      <div ref={ref} className="aspect-video w-[300px] overflow-hidden rounded-xl bg-black" />
      <div className="min-w-[240px] flex-1 space-y-2">
        <div className="text-[15px] font-bold">Programa automático</div>
        <p className="text-[var(--nx-muted)]">
          {st.building ?? (d && d.status !== "idle" ? `${STATUS[d.status]} · ${cur?.title ?? ""} · ${fmt(d.elapsedS)}` : e ? `Edición lista: ${e.title}` : "Recopila datos reales, arma la escaleta y emite solo.")}
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={Boolean(st.building) || d?.status === "playing"} onClick={() => playNow(st)} className={`px-4 py-2 text-[13px] ${ui.btnLive}`}>
            {st.building ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />} {playLabel(st)}
          </button>
          <button type="button" onClick={() => setFull(true)} className={`px-4 py-2 text-[13px] ${ui.btnGhost}`}><Maximize2 size={15} /> Abrir sala de control</button>
          {d?.status === "playing" && <button type="button" onClick={show.pause} className={`px-3 py-2 ${ui.btnGhost}`}><Pause size={15} /></button>}
        </div>
      </div>
      {full && <ControlRoom onClose={() => setFull(false)} />}
    </div>
  );
}

// ---------------------------------------------------------------- full-screen control room
function ControlRoom({ onClose }: { onClose: () => void }) {
  const st = useShow();
  const ref = useRef<HTMLDivElement>(null);
  const [drawer, setDrawer] = useState(false);
  usePreview(ref, true, st.options.quality);
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => { if (ev.key === "Escape") { if (drawer) setDrawer(false); else onClose(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawer, onClose]);

  const d = st.director, e = st.edition;
  const cur = e && d ? e.segments[d.segment] : null;
  const remaining = e ? e.segments.slice(d?.segment ?? 0).filter((s) => s.status !== "skipped" && s.status !== "done").reduce((t, s) => t + s.estimatedS, 0) : 0;
  const onAir = d?.status === "playing";

  return createPortal(
    <div className="nx-studio fixed inset-0 z-[200] flex flex-col bg-[#0b0c0f] text-[var(--nx-text)]">
      {/* header */}
      <header className="flex items-center gap-4 border-b border-white/5 px-6 py-3">
        <span className="text-[15px] font-extrabold tracking-wide">NEXUS <span className="text-[var(--nx-gold)]">SPORT</span></span>
        <span className="text-[13px] text-[var(--nx-muted)]">Programa automático</span>
        <span className={`rounded-full px-3 py-1 text-[12px] font-bold ${onAir ? "bg-[var(--nx-live)] text-white" : "bg-white/10 text-[var(--nx-muted)]"}`}>{d ? STATUS[d.status] : "Sin emitir"}</span>
        {d && d.status !== "idle" && <span className="tabular-nums text-[13px] text-[var(--nx-muted)]">{fmt(d.elapsedS)} · quedan {fmt(remaining)}</span>}
        <span className="ml-auto" />
        <button type="button" onClick={() => setDrawer(true)} className={`px-3 py-1.5 text-[13px] ${ui.btnGhost}`}><Settings2 size={15} /> Ajustes</button>
        <button type="button" onClick={onClose} aria-label="Cerrar sala de control" className={`px-3 py-1.5 text-[13px] ${ui.btnGhost}`}><X size={15} /> Cerrar</button>
      </header>

      <div className="flex min-h-0 flex-1 gap-6 p-6">
        {/* on air + transport */}
        <main className="flex min-w-0 flex-1 flex-col gap-4">
          <div className="flex min-h-0 flex-1 items-center justify-center">
            <div ref={ref} className="aspect-video max-h-full w-full overflow-hidden rounded-2xl bg-black shadow-[0_20px_60px_rgba(0,0,0,0.5)]" style={{ maxWidth: "calc((100vh - 290px) * 16 / 9)" }} />
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button type="button" onClick={show.previous} disabled={!d} className={`h-12 w-12 ${ui.btnGhost} rounded-full`} aria-label="Anterior"><SkipBack size={18} /></button>
            {onAir
              ? <button type="button" onClick={show.pause} className={`h-14 rounded-full px-8 text-[15px] ${ui.btnGhost}`}><Pause size={20} /> Pausa</button>
              : <button type="button" disabled={Boolean(st.building)} onClick={() => playNow(st)} className={`h-14 rounded-full px-8 text-[15px] ${ui.btnLive}`}>{st.building ? <Loader2 size={20} className="animate-spin" /> : <Play size={20} />} {playLabel(st)}</button>}
            <button type="button" onClick={show.next} disabled={!d} className={`h-12 w-12 ${ui.btnGhost} rounded-full`} aria-label="Siguiente"><SkipForward size={18} /></button>
            <span className="mx-2 h-8 w-px bg-white/10" />
            <button type="button" onClick={show.repeat} disabled={!d} className={`h-11 rounded-full px-4 text-[13px] ${ui.btnGhost}`}><Repeat size={15} /> Repetir</button>
            <button type="button" onClick={show.interrupt} disabled={!onAir} className={`h-11 rounded-full px-4 text-[13px] ${ui.btnGhost}`}><VolumeX size={15} /> Cortar voz</button>
            <button type="button" onClick={show.stop} disabled={!d || d.status === "idle"} className={`h-11 rounded-full px-4 text-[13px] ${ui.btnGhost}`}><Square size={15} /> Stop</button>
            {d?.status === "awaiting-approval" && <button type="button" onClick={() => { if (cur) show.updateSegment(cur.id, { approved: true }); show.approve(); }} className={`h-11 rounded-full px-5 text-[13px] ${ui.btnPrimary}`}><Check size={15} /> Aprobar y emitir</button>}
            {d?.status === "awaiting-operator" && <button type="button" onClick={show.next} className={`h-11 rounded-full px-5 text-[13px] ${ui.btnPrimary}`}><SkipForward size={15} /> Continuar</button>}
          </div>
          <p className="min-h-[24px] text-center text-[14px] text-[var(--nx-muted)]">
            {st.building ? st.building : d?.narrating ? <><b className="text-[var(--nx-text)]">{d.voice === "voz" ? "Narrando: " : "Subtítulo: "}</b>{d.narrating}</> : st.error ? <span className="text-red-300">{st.error}</span> : ""}
          </p>
        </main>

        {/* running order */}
        <aside className="flex w-[380px] min-w-[300px] flex-col">
          <div className="mb-3 flex items-baseline gap-2">
            <span className="text-[13px] font-bold uppercase tracking-[0.14em] text-[var(--nx-muted)]">Escaleta</span>
            {e && <span className="text-[12px] text-[var(--nx-dim)]">{fmt(e.estimatedS)} de {e.targetMin} min</span>}
          </div>
          {e?.warnings.slice(0, 2).map((w) => <p key={w} className="mb-2 rounded-lg bg-amber-500/10 px-3 py-2 text-[12px] text-amber-200">{w}</p>)}
          <Rundown edition={e} segment={d && d.status !== "idle" ? d.segment : -1} beat={d?.beat ?? -1} />
        </aside>
      </div>

      {drawer && <Drawer st={st} onClose={() => setDrawer(false)} />}
    </div>,
    document.body,
  );
}

// ---------------------------------------------------------------- running order (memoized: re-renders only when the segment/beat changes)
const Rundown = memo(function Rundown({ edition: e, segment, beat }: { edition: Edition | null; segment: number; beat: number }) {
  const [open, setOpen] = useState<string | null>(null);
  if (!e) return <p className="text-[13px] leading-relaxed text-[var(--nx-dim)]">Pulsa «Emitir programa»: se recopilan resultados, partidos en vivo, tablas, agenda, noticias publicadas y votaciones reales, y la escaleta se arma sola.</p>;
  return (
    <ol className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
      {e.segments.map((s, i) => {
        const live = i === segment, expanded = open === s.id;
        return (
          <li key={s.id} className={`rounded-xl ${live ? "bg-[color-mix(in_srgb,var(--nx-gold)_14%,transparent)] ring-1 ring-[var(--nx-gold)]" : "bg-white/[0.03]"} ${s.status === "skipped" ? "opacity-40" : ""}`}>
            <div className="flex items-center gap-3 px-3 py-2.5">
              <span className={`grid h-7 w-7 place-items-center rounded-full text-[12px] font-bold ${live ? "bg-[var(--nx-gold)] text-black" : s.status === "done" ? "bg-white/10 text-[var(--nx-dim)]" : "bg-white/5 text-[var(--nx-muted)]"}`}>{s.status === "done" ? "✓" : i + 1}</span>
              <button type="button" onClick={() => setOpen(expanded ? null : s.id)} className="min-w-0 flex-1 text-left">
                <div className="truncate text-[14px] font-semibold">{s.title}</div>
                <div className="text-[11.5px] text-[var(--nx-dim)]">{STAGE_LABEL[s.stage]} · {fmt(s.actualS ?? s.estimatedS)}{s.priority === "CRITICAL" ? " · EN VIVO" : ""}{s.ai ? <span className="ml-1.5 rounded bg-sky-500/20 px-1 text-[10px] font-bold text-sky-300">IA</span> : null}</div>
              </button>
              <button type="button" onClick={() => show.jump(i)} title="Emitir desde aquí" aria-label="Emitir desde aquí" className="rounded-full p-2 text-[var(--nx-muted)] hover:bg-white/10 hover:text-[var(--nx-text)]"><Play size={14} /></button>
            </div>
            {expanded && <SegmentEditor e={e} i={i} liveBeat={live ? beat : -1} />}
          </li>
        );
      })}
    </ol>
  );
});

function SegmentEditor({ e, i, liveBeat }: { e: Edition; i: number; liveBeat: number }) {
  const s = e.segments[i];
  return (
    <div className="space-y-2 border-t border-white/5 px-3 py-2 text-[12px]">
      <div className="flex flex-wrap items-center gap-1">
        <select value={s.stage} disabled={s.locked} onChange={(ev) => show.setStage(s.id, ev.target.value as StageId)} className="rounded-lg border border-white/10 bg-black/40 px-2 py-1">
          {(Object.keys(STAGE_LABEL) as StageId[]).map((k) => <option key={k} value={k}>{STAGE_LABEL[k]}</option>)}
        </select>
        <IconBtn on={() => show.updateSegment(s.id, { approved: !s.approved })} title={s.approved ? "Aprobado" : "Aprobar"} icon={<Check size={13} className={s.approved ? "text-[var(--nx-ok)]" : ""} />} />
        <IconBtn on={() => show.updateSegment(s.id, { locked: !s.locked })} title={s.locked ? "Bloqueado" : "Bloquear"} icon={s.locked ? <Lock size={13} className="text-[var(--nx-gold)]" /> : <Unlock size={13} />} />
        <IconBtn on={() => show.updateSegment(s.id, { status: s.status === "skipped" ? "pending" : "skipped" })} title={s.status === "skipped" ? "Reincluir" : "Omitir"} icon={<X size={13} />} />
        <IconBtn on={() => show.moveSegment(s.id, -1)} title="Subir" icon={<ChevronUp size={13} />} />
        <IconBtn on={() => show.moveSegment(s.id, 1)} title="Bajar" icon={<ChevronDown size={13} />} />
      </div>
      {s.note && <p className="text-amber-200/80">{s.note}</p>}
      <p className="text-[var(--nx-dim)]">Fuentes: {s.sources.map((x) => x.name).join(", ") || "—"}</p>
      <ol className="space-y-1">
        {s.beats.filter((b) => b.narration).map((b) => (
          <li key={b.id}>
            <textarea defaultValue={b.narration!.text} disabled={s.locked} rows={Math.min(4, Math.ceil(b.narration!.text.length / 60))} onBlur={(ev) => { if (ev.target.value !== b.narration!.text) show.editLine(s.id, b.id, ev.target.value); }}
              className={`w-full rounded-lg border px-2 py-1 text-[12.5px] ${s.beats[liveBeat]?.id === b.id ? "border-[var(--nx-gold)] bg-[color-mix(in_srgb,var(--nx-gold)_8%,transparent)]" : "border-white/10 bg-black/30"}`} />
            {b.narration!.base && <p className="px-1 text-[10.5px] text-[var(--nx-dim)]"><span className="font-bold text-sky-300">IA</span> · dato base: {b.narration!.base}</p>}
          </li>
        ))}
      </ol>
    </div>
  );
}

// ---------------------------------------------------------------- settings drawer
function Drawer({ st, onClose }: { st: ShowState; onClose: () => void }) {
  const [tab, setTab] = useState<"contenido" | "escenario" | "ediciones">("contenido");
  const [lib, setLib] = useState(() => show.library());
  const toggleMode = (m: Mode) => show.setOptions({ modes: st.options.modes.includes(m) ? st.options.modes.filter((x) => x !== m) : [...st.options.modes, m] });
  const toggleLeague = (l: string) => show.setOptions({ leagues: st.options.leagues.includes(l) ? st.options.leagues.filter((x) => x !== l) : [...st.options.leagues, l] });
  const e = st.edition;
  return (
    <div className="fixed inset-0 z-[210] flex justify-end bg-black/40" onClick={onClose}>
      <div className="flex h-full w-[440px] max-w-full flex-col bg-[#121318] shadow-2xl" onClick={(ev) => ev.stopPropagation()}>
        <div className="flex items-center gap-1 border-b border-white/5 p-3">
          {([["contenido", "Contenido"], ["escenario", "Escenario y luz"], ["ediciones", "Ediciones"]] as const).map(([id, label]) => (
            <button key={id} type="button" onClick={() => setTab(id)} className={tab === id ? ui.tabOn : ui.tab}>{label}</button>
          ))}
          <button type="button" onClick={onClose} aria-label="Cerrar ajustes" className="ml-auto rounded-full p-2 hover:bg-white/10"><X size={16} /></button>
        </div>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5 text-[13px]">
          {tab === "contenido" && <>
            <Section title="Qué cuenta el programa">
              <div className="flex flex-wrap gap-1.5">{(Object.keys(MODE_LABEL) as Mode[]).map((m) => <button key={m} type="button" onClick={() => toggleMode(m)} className={st.options.modes.includes(m) ? ui.chipOn : ui.chip}>{MODE_LABEL[m]}</button>)}</div>
            </Section>
            <Section title="Competiciones">
              <div className="flex flex-wrap gap-1.5">
                <button type="button" onClick={() => show.setOptions({ leagues: [] })} className={st.options.leagues.length === 0 ? ui.chipOn : ui.chip}>Todas</button>
                {SHOW_LEAGUES.map((l) => <button key={l.id} type="button" onClick={() => toggleLeague(l.id)} className={st.options.leagues.includes(l.id) ? ui.chipOn : ui.chip}>{l.name}</button>)}
              </div>
            </Section>
            <Section title="Inteligencia">
              <button type="button" onClick={() => show.setOptions({ ai: !st.options.ai })} className={st.options.ai ? ui.chipOn : ui.chip}>{st.options.ai ? "Narración con IA: activada" : "Narración con IA: apagada"}</button>
              <p className="text-[11.5px] leading-relaxed text-[var(--nx-dim)]">La IA configurada en el portal escribe la narración como un analista de TV a partir de los hechos verificados y de las claves calculadas (remontadas, goles agónicos, sorpresas, tabla). Cada frase se valida: si trae una cifra que no está en los datos, se descarta y queda la frase base.</p>
            </Section>
            <Section title="Duración objetivo">
              <div className="flex gap-1.5">{([15, 30, 45, 60] as const).map((m) => <button key={m} type="button" onClick={() => show.setOptions({ targetMin: m })} className={st.options.targetMin === m ? ui.chipOn : ui.chip}>{m} min</button>)}</div>
            </Section>
            <Section title="Dirección">
              <div className="flex gap-1.5">{(["AUTO", "SEMI", "MANUAL"] as DirectorMode[]).map((m) => <button key={m} type="button" disabled={!e} onClick={() => show.setMode(m)} className={(st.director?.mode ?? "AUTO") === m ? ui.chipOn : ui.chip}>{m === "SEMI" ? "Semi (aprobar cada bloque)" : m === "AUTO" ? "Automática" : "Manual"}</button>)}</div>
            </Section>
            <Section title="Música">
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => show.setMusic({ on: !st.music.on })} className={st.music.on ? ui.chipOn : ui.chip}>{st.music.on ? <Volume2 size={12} className="inline" /> : <VolumeX size={12} className="inline" />} {st.music.on ? "Con música" : "Sin música"}</button>
                <input type="range" min={0} max={0.8} step={0.05} value={st.music.volume} onChange={(ev) => show.setMusic({ volume: Number(ev.target.value) })} aria-label="Volumen de música" className="flex-1" />
              </div>
            </Section>
            <button type="button" disabled={Boolean(st.building) || !st.options.modes.length} onClick={() => void show.build()} className={`w-full py-2.5 text-[13px] ${ui.btnPrimary}`}>{st.building ? <Loader2 size={15} className="animate-spin" /> : null} Volver a generar la edición</button>
            {st.report.length > 0 && <p className="text-[11.5px] leading-relaxed text-[var(--nx-dim)]">{st.report.map((r) => `${r.ok ? "✓" : "✗"} ${r.source}`).join(" · ")}</p>}
          </>}
          {tab === "escenario" && <LightingPanel light={st.lighting} quality={st.options.quality} />}
          {tab === "ediciones" && <>
            <div className="flex gap-2">
              <button type="button" disabled={!e} onClick={() => { show.save(); setLib(show.library()); }} className={`flex-1 py-2 ${ui.btnGhost}`}><Save size={14} /> Guardar edición</button>
              <button type="button" disabled={!e} onClick={() => { const blob = new Blob([show.exportJson()], { type: "application/json" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `nexus-edicion-${e?.id}.json`; a.click(); URL.revokeObjectURL(a.href); }} className={`px-3 py-2 ${ui.btnGhost}`}><Download size={14} /></button>
            </div>
            {lib.length === 0 && <p className="text-[var(--nx-dim)]">No hay ediciones guardadas.</p>}
            <ul className="space-y-1.5">{lib.map((x) => (
              <li key={x.id}><button type="button" onClick={() => show.load(x.id)} className="w-full rounded-xl bg-white/[0.04] px-3 py-2 text-left hover:bg-white/[0.08]">
                <div className="font-semibold">{x.title}</div>
                <div className="text-[11.5px] text-[var(--nx-dim)]">{new Date(x.createdAt).toLocaleString("es-CO", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</div>
              </button></li>
            ))}</ul>
            {!e && show.recoverable() && <button type="button" onClick={() => show.recover()} className={`w-full py-2 ${ui.btnGhost}`}>Recuperar la última edición</button>}
          </>}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="space-y-2"><div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--nx-muted)]">{title}</div>{children}</section>;
}
function IconBtn({ on, title, icon }: { on: () => void; title: string; icon: React.ReactNode }) {
  return <button type="button" onClick={on} title={title} aria-label={title} className="rounded-lg p-1.5 text-[var(--nx-muted)] hover:bg-white/10 hover:text-[var(--nx-text)]">{icon}</button>;
}

// ---------------------------------------------------------------- set & lighting
const SLIDERS: { k: keyof Lighting; label: string; min: number; max: number; step: number }[] = [
  { k: "exposure", label: "Exposición", min: 0.6, max: 1.6, step: 0.02 },
  { k: "key", label: "Luz principal", min: 0, max: 2, step: 0.05 },
  { k: "ambient", label: "Relleno", min: 0, max: 1.6, step: 0.05 },
  { k: "rim", label: "Contraluz", min: 0, max: 2, step: 0.05 },
  { k: "glow", label: "Brillo de luces", min: 0, max: 1.5, step: 0.05 },
  { k: "gloss", label: "Piso brillante", min: 0, max: 1, step: 0.05 },
  { k: "haze", label: "Profundidad", min: 0, max: 1, step: 0.05 },
];
const COLORS: { k: keyof Lighting; label: string }[] = [
  { k: "accent", label: "Luz" }, { k: "backdropTop", label: "Fondo arriba" }, { k: "backdropBottom", label: "Fondo abajo" }, { k: "floor", label: "Piso" },
];

function LightingPanel({ light, quality }: { light: Lighting; quality: Quality }) {
  return (
    <>
      <Section title="Ambiente">
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(LIGHT_PRESETS).map(([name, p]) => (
            <button key={name} type="button" onClick={() => show.lightPreset(name)} className={`flex items-center gap-2 rounded-xl px-3 py-2 text-left ${light.preset === name ? "ring-2 ring-[var(--nx-gold)]" : "ring-1 ring-white/10 hover:ring-white/25"}`}
              style={{ background: `linear-gradient(135deg, ${p.backdropTop}, ${p.backdropBottom})` }}>
              <span className="h-3 w-3 rounded-full" style={{ background: p.accent, boxShadow: `0 0 10px ${p.accent}` }} />
              <span className={`text-[12.5px] font-semibold ${p.backdropBottom > "#999999" ? "text-black" : "text-white"}`}>{name}</span>
            </button>
          ))}
        </div>
      </Section>
      <Section title="Ver escenario">
        <div className="flex flex-wrap gap-1.5">{(Object.keys(STAGE_LABEL) as StageId[]).map((k) => <button key={k} type="button" onClick={() => show.previewStage(k)} className={ui.chip}>{STAGE_LABEL[k]}</button>)}</div>
      </Section>
      <Section title="Luces">
        <div className="space-y-1.5">
          {SLIDERS.map(({ k, label, min, max, step }) => (
            <label key={k} className="grid grid-cols-[110px_1fr] items-center gap-3 text-[12.5px] text-[var(--nx-muted)]">
              {label}
              <input type="range" min={min} max={max} step={step} value={Number(light[k])} onChange={(ev) => show.setLighting({ [k]: Number(ev.target.value), preset: "Personalizado" } as Partial<Lighting>)} />
            </label>
          ))}
        </div>
      </Section>
      <Section title="Colores">
        <div className="flex flex-wrap gap-4 text-[12.5px] text-[var(--nx-muted)]">
          {COLORS.map(({ k, label }) => (
            <label key={k} className="inline-flex items-center gap-2">
              <input type="color" value={String(light[k])} onChange={(ev) => show.setLighting({ [k]: ev.target.value, preset: "Personalizado" } as Partial<Lighting>)} className="h-7 w-9 cursor-pointer rounded-lg border border-white/10 bg-transparent" />
              {label}
            </label>
          ))}
        </div>
      </Section>
      <Section title="Cámara y calidad">
        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={() => show.setLighting({ drift: !light.drift })} className={light.drift ? ui.chipOn : ui.chip}>Movimiento suave de cámara</button>
          {(["LOW", "MEDIUM", "HIGH"] as Quality[]).map((q) => <button key={q} type="button" onClick={() => show.setOptions({ quality: q })} className={quality === q ? ui.chipOn : ui.chip}>{q === "LOW" ? "Ligera" : q === "MEDIUM" ? "Normal" : "Alta"}</button>)}
        </div>
        <p className="text-[11.5px] text-[var(--nx-dim)]">El movimiento de cámara redibuja continuamente; apágalo si el PC va justo. «Ligera» es la más rápida.</p>
      </Section>
      <button type="button" onClick={() => show.lightPreset("Nexus noche")} className={`w-full py-2 ${ui.btnGhost}`}>Restablecer</button>
    </>
  );
}
