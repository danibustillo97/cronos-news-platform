"use client";

// Production-room panels (design system football/ui.ts): status strip, rundown,
// automation console, sports data centre, audience desk and the mobile control.
// They only read the production state and send actions; the engines do the work.

import { useState, type ReactNode } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, Bot, Check, ChevronRight, CircleDot, Clock, Copy, Database, ListChecks, MessageSquare, Pause, Play, Plus, Radio, RefreshCw, SkipForward, Trash2, Vote, X } from "lucide-react";
import { ui } from "../football/ui";
import { EVENT_LABEL } from "./sportsEvents";
import { PHASE_LABEL, STATUS_LABEL, type Block, type Phase } from "./rundown";
import type { Production } from "./useProduction";
import type { ControlCommand, ControlState } from "./remoteControl";
import type { RuleMode } from "./automation";

const FRESH: Record<string, { label: string; cls: string }> = {
  fresh: { label: "Datos confirmados", cls: "bg-[var(--nx-ok)] text-black" },
  stale: { label: "Datos desactualizados", cls: "bg-[var(--nx-live)] text-white" },
  unavailable: { label: "Sin datos", cls: "bg-[var(--nx-s3)] text-[var(--nx-muted)]" },
};
const BLOCK_CLS: Record<string, string> = {
  pending: "text-[var(--nx-dim)] border-[var(--nx-line-2)]", ready: "text-[var(--nx-ok)] border-[var(--nx-ok)]",
  "on-air": "text-white bg-[var(--nx-live)] border-[var(--nx-live)]", done: "text-[var(--nx-muted)] border-[var(--nx-line)]",
  skipped: "text-[var(--nx-dim)] border-[var(--nx-line)] line-through", error: "text-[var(--nx-live)] border-[var(--nx-live)]",
};
const EV_CLS: Record<string, string> = { confirmed: "text-[var(--nx-ok)]", pending: "text-[var(--nx-gold)]", retracted: "text-[var(--nx-live)] line-through" };
const timeOf = (b: Block) => (b.scheduledAt ? new Date(b.scheduledAt).toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" }) : b.phase === "pre" ? `T${b.offsetMin}'` : b.phase === "live" ? `${b.offsetMin}'` : `FT+${b.offsetMin}'`);

function Panel({ title, icon, extra, children, className = "" }: { title: string; icon: ReactNode; extra?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`${ui.panel} ${className}`}>
      <div className="flex items-center gap-1.5 border-b border-[var(--nx-line)] px-2 py-1.5"><span className={ui.title}>{icon} {title}</span><span className="ml-auto flex items-center gap-1">{extra}</span></div>
      <div className="p-2">{children}</div>
    </section>
  );
}

// ---------------------------------------------------------------- status strip
export function StatusStrip({ p, live, recording, cameras }: { p: Production; live: boolean; recording: boolean; cameras: number }) {
  const f = FRESH[p.freshness];
  const awaiting = p.engineState.tasks.filter((t) => t.status === "awaiting-approval").length;
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[10.5px] font-bold">
      <span className="rounded bg-[var(--nx-s2)] px-2 py-0.5 uppercase tracking-wider text-[var(--nx-gold)]">{PHASE_LABEL[p.phase]}</span>
      <span className={`rounded px-2 py-0.5 ${f.cls}`} title={p.lastOk ? `Última lectura ${new Date(p.lastOk).toLocaleTimeString("es-CO")}` : ""}>{f.label}</span>
      <span className={`rounded px-2 py-0.5 ${p.automationOn ? "bg-[var(--nx-s2)] text-[var(--nx-text)]" : "bg-[var(--nx-gold)] text-[var(--nx-gold-ink)]"}`}>{p.automationOn ? "Automatización activa" : "Automatización en pausa"}{awaiting ? ` · ${awaiting} por aprobar` : ""}</span>
      <span className="rounded border border-[var(--nx-line-2)] px-2 py-0.5 text-[var(--nx-muted)]">Entrada {cameras ? `${cameras} cámara${cameras > 1 ? "s" : ""}` : "sin cámara"}</span>
      <span className={`rounded px-2 py-0.5 ${recording ? "border border-[var(--nx-live)] text-[var(--nx-live)]" : "border border-[var(--nx-line-2)] text-[var(--nx-dim)]"}`}>{recording ? "Grabando" : "Sin grabar"}</span>
      <span className={`rounded px-2 py-0.5 ${live ? "bg-[var(--nx-live)] text-white" : "border border-[var(--nx-line-2)] text-[var(--nx-dim)]"}`}>{live ? "Transmitiendo" : "Sin transmisión"}</span>
      {p.feedError && <span className="inline-flex items-center gap-1 text-[var(--nx-live)]"><AlertTriangle size={11} /> {p.feedError}</span>}
    </div>
  );
}

// ---------------------------------------------------------------- rundown
export function RundownPanel({ p, compact = false }: { p: Production; compact?: boolean }) {
  const [view, setView] = useState<Phase | null>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [variant, setVariant] = useState("stats");
  const shown = view ?? p.phase;
  const list = p.blocks.map((b, i) => ({ b, i })).filter(({ b }) => b.phase === shown);
  return (
    <Panel title="Escaleta" icon={<ListChecks size={12} className="text-[var(--nx-gold)]" />}
      extra={<>
        <span className="inline-flex rounded border border-[var(--nx-line-2)] p-0.5">
          {(["auto", "manual"] as const).map((m) => <button key={m} type="button" onClick={() => p.rundown.setMode(m)} className={`rounded px-1.5 text-[10px] font-bold ${p.rundownMode === m ? "bg-[var(--nx-gold)] text-[var(--nx-gold-ink)]" : "text-[var(--nx-muted)]"}`}>{m === "auto" ? "Auto" : "Manual"}</button>)}
        </span>
        <button type="button" onClick={p.rundown.next} title="Ejecutar el siguiente bloque preparado" className="rounded p-1 text-[var(--nx-muted)] hover:text-[var(--nx-text)]"><SkipForward size={13} /></button>
        <button type="button" onClick={p.rundown.regenerate} title="Regenerar desde el partido" className="rounded p-1 text-[var(--nx-muted)] hover:text-[var(--nx-text)]"><RefreshCw size={12} /></button>
      </>}>
      <div className="mb-1.5 flex gap-1">
        {(["pre", "live", "post"] as const).map((ph) => (
          <button key={ph} type="button" onClick={() => setView(ph === p.phase ? null : ph)} className={`${shown === ph ? ui.chipOn : ui.chip} !px-2 !py-0.5 !text-[10px]`}>{PHASE_LABEL[ph]}{ph === p.phase ? " ●" : ""}</button>
        ))}
      </div>
      {!p.blocks.length && <p className="px-1 text-[11px] text-[var(--nx-dim)]">Elige un partido activo (número, «Partidos de hoy» o un resultado) para generar su escaleta.</p>}
      <ol className={`space-y-1 ${compact ? "" : "max-h-[46vh] overflow-y-auto pr-0.5"}`}>
        {list.map(({ b, i }) => (
          <li key={b.id} className={`rounded-[var(--nx-r-sm)] border-l-2 bg-[var(--nx-s2)] px-2 py-1 ${b.status === "on-air" ? "border-[var(--nx-live)]" : b.status === "ready" ? "border-[var(--nx-ok)]" : "border-transparent"}`}>
            <div className="flex items-center gap-1.5">
              <span className="w-12 flex-shrink-0 font-mono text-[10px] text-[var(--nx-dim)]">{timeOf(b)}</span>
              <span className={`min-w-0 flex-1 truncate text-[11.5px] font-semibold ${b.status === "done" || b.status === "skipped" ? "text-[var(--nx-dim)]" : "text-[var(--nx-text)]"}`} title={`${b.name} · ${b.source}`}>{b.name}</span>
              <span className={`flex-shrink-0 rounded border px-1 text-[9px] font-bold uppercase ${BLOCK_CLS[b.status]}`}>{STATUS_LABEL[b.status]}</span>
            </div>
            <div className="mt-0.5 flex items-center gap-1 text-[9.5px] text-[var(--nx-dim)]">
              <span className="truncate">{b.source}{b.error ? ` · ${b.error}` : ""} · {b.durationSec}s · P{b.priority}</span>
              <span className="ml-auto flex flex-shrink-0 items-center gap-0.5">
                <button type="button" disabled={b.status === "pending" || b.status === "on-air"} onClick={() => p.rundown.run(b)} title="Al aire" className={`rounded ${compact ? "p-2" : "p-0.5"} text-[var(--nx-ok)] hover:bg-white/10 disabled:opacity-30`}><Play size={11} /></button>
                <button type="button" onClick={() => p.rundown.skip(b.id)} title="Omitir" className={`rounded ${compact ? "p-2" : "p-0.5"} hover:bg-white/10 hover:text-[var(--nx-text)]`}><SkipForward size={11} /></button>
                <button type="button" onClick={() => p.rundown.repeat(b.id)} title="Repetir" className={`rounded ${compact ? "p-2" : "p-0.5"} hover:bg-white/10 hover:text-[var(--nx-text)]`}><Copy size={11} /></button>
                <button type="button" onClick={() => p.rundown.move(i, i - 1)} title="Subir" className={`rounded ${compact ? "p-2" : "p-0.5"} hover:bg-white/10 hover:text-[var(--nx-text)]`}><ArrowUp size={11} /></button>
                <button type="button" onClick={() => p.rundown.move(i, i + 1)} title="Bajar" className={`rounded ${compact ? "p-2" : "p-0.5"} hover:bg-white/10 hover:text-[var(--nx-text)]`}><ArrowDown size={11} /></button>
                <button type="button" onClick={() => p.rundown.remove(b.id)} title="Eliminar" className={`rounded ${compact ? "p-2" : "p-0.5"} hover:bg-white/10 hover:text-[var(--nx-live)]`}><Trash2 size={11} /></button>
              </span>
            </div>
          </li>
        ))}
      </ol>
      {p.blocks.length > 0 && (adding ? (
        <div className="mt-1.5 space-y-1 rounded-[var(--nx-r-sm)] bg-[var(--nx-s2)] p-1.5">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre del bloque" className="w-full rounded border border-[var(--nx-line-2)] bg-black/40 px-1.5 py-1 text-[11px] text-white" />
          <select value={variant} onChange={(e) => setVariant(e.target.value)} className="w-full rounded border border-[var(--nx-line-2)] bg-black/40 px-1.5 py-1 text-[11px] text-white">
            {[["stats", "Estadísticas"], ["timeline", "Cronología"], ["standings", "Tabla"], ["multi", "Multipantalla"], ["prematch", "Previa"], ["pro", "Marcador"], ["cinta", "Cinta"], ["ad", "Publicidad"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <div className="flex gap-1"><button type="button" disabled={!name.trim()} onClick={() => { p.rundown.add(name.trim(), shown, variant); setName(""); setAdding(false); }} className={`${ui.btnPrimary} flex-1 py-1 text-[11px]`}><Plus size={11} /> Añadir</button><button type="button" onClick={() => setAdding(false)} className={`${ui.btnGhost} px-2 py-1 text-[11px]`}>Cancelar</button></div>
        </div>
      ) : <button type="button" onClick={() => setAdding(true)} className={`${ui.btnGhost} mt-1.5 w-full py-1 text-[10.5px]`}><Plus size={11} /> Añadir bloque a {PHASE_LABEL[shown]}</button>)}
    </Panel>
  );
}

// ---------------------------------------------------------------- automation console
export function AutomationConsole({ p }: { p: Production }) {
  const [showRules, setShowRules] = useState(false);
  const awaiting = p.engineState.tasks.filter((t) => t.status === "awaiting-approval");
  const active = p.engineState.tasks.filter((t) => t.status !== "awaiting-approval");
  return (
    <Panel title="Automatización" icon={<Bot size={12} className="text-[var(--nx-gold)]" />}
      extra={<>
        <button type="button" onClick={() => setShowRules((s) => !s)} className="rounded px-1.5 text-[10px] font-semibold text-[var(--nx-muted)] hover:text-[var(--nx-text)]">Reglas</button>
        <button type="button" onClick={() => p.setAutomationOn(!p.automationOn)} className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold ${p.automationOn ? "bg-[var(--nx-s3)] text-[var(--nx-text)]" : "bg-[var(--nx-gold)] text-[var(--nx-gold-ink)]"}`}>{p.automationOn ? <><Pause size={10} /> Pausar</> : <><Play size={10} /> Reanudar</>}</button>
      </>}>
      {showRules && (
        <ul className="mb-2 space-y-1">
          {p.rules.map((r) => (
            <li key={r.id} className="flex items-center gap-1.5 text-[10.5px]">
              <span className="min-w-0 flex-1 truncate text-[var(--nx-text)]">{r.label}</span>
              <select value={r.mode} onChange={(e) => p.setRuleMode(r.id, e.target.value as RuleMode)} className="rounded border border-[var(--nx-line-2)] bg-black/40 px-1 py-0.5 text-[10px] text-white">
                <option value="auto">Automático</option><option value="approval">Con aprobación</option><option value="manual">Manual</option>
              </select>
            </li>
          ))}
        </ul>
      )}
      <p className="mb-1 text-[10px] font-semibold text-[var(--nx-dim)]">Por aprobar ({awaiting.length})</p>
      {!awaiting.length && <p className="mb-1.5 px-1 text-[11px] text-[var(--nx-dim)]">Nada pendiente. Las propuestas llegan con los eventos confirmados.</p>}
      <ul className="mb-2 space-y-1">
        {awaiting.map((t) => (
          <li key={t.id} className="rounded-[var(--nx-r-sm)] border border-[var(--nx-gold)]/50 bg-[var(--nx-s2)] p-1.5">
            <p className="truncate text-[11.5px] font-semibold text-[var(--nx-text)]">{t.action.label}</p>
            <p className="truncate text-[9.5px] text-[var(--nx-dim)]">{t.ruleLabel}{t.eventLabel ? ` · ${t.eventLabel}` : ""}{t.expiresAt ? ` · caduca ${new Date(t.expiresAt).toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" })}` : ""}</p>
            <div className="mt-1 flex gap-1"><button type="button" onClick={() => p.approve(t.id)} className={`${ui.btnPrimary} flex-1 py-1 text-[10.5px]`}><Check size={11} /> Aprobar</button><button type="button" onClick={() => p.reject(t.id)} className={`${ui.btnGhost} px-2 py-1 text-[10.5px]`}><X size={11} /> Descartar</button></div>
          </li>
        ))}
      </ul>
      {active.length > 0 && <>
        <p className="mb-1 text-[10px] font-semibold text-[var(--nx-dim)]">En cola</p>
        <ul className="mb-2 space-y-0.5">{active.map((t) => (
          <li key={t.id} className="flex items-center gap-1.5 text-[10.5px] text-[var(--nx-text)]">
            {t.status === "running" ? <CircleDot size={10} className="animate-pulse text-[var(--nx-live)]" /> : <Clock size={10} className="text-[var(--nx-muted)]" />}
            <span className="min-w-0 flex-1 truncate">{t.action.label}{t.error ? ` · reintento (${t.error})` : ""}</span>
            {t.status !== "running" && <button type="button" onClick={() => p.cancel(t.id)} className="text-[var(--nx-dim)] hover:text-[var(--nx-live)]" aria-label="Cancelar"><X size={11} /></button>}
          </li>))}</ul>
      </>}
      <p className="mb-1 text-[10px] font-semibold text-[var(--nx-dim)]">Historial</p>
      <ul className="max-h-36 space-y-0.5 overflow-y-auto">{p.engineState.history.slice(0, 20).map((t) => (
        <li key={t.id} className="flex items-center gap-1.5 text-[10px]">
          <span className={`w-14 flex-shrink-0 font-bold uppercase ${t.status === "done" ? "text-[var(--nx-ok)]" : t.status === "failed" ? "text-[var(--nx-live)]" : "text-[var(--nx-dim)]"}`}>{({ done: "hecho", failed: "falló", rejected: "descart.", expired: "caducó", cancelled: "cancel." } as Record<string, string>)[t.status] ?? t.status}</span>
          <span className="min-w-0 flex-1 truncate text-[var(--nx-muted)]" title={t.error ?? t.result}>{t.action.label}</span>
          <span className="text-[var(--nx-dim)]">{t.finishedAt ? new Date(t.finishedAt).toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" }) : ""}</span>
        </li>))}</ul>
    </Panel>
  );
}

// ---------------------------------------------------------------- sports data centre
export function DataCenter({ p }: { p: Production }) {
  const s = p.snapshot;
  const f = FRESH[p.freshness];
  return (
    <div className="grid gap-2 p-2 lg:grid-cols-[1fr_1.2fr]">
      <Panel title="Partido activo" icon={<Database size={12} className="text-[var(--nx-gold)]" />} extra={<span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${f.cls}`}>{f.label}</span>}>
        {!s && <p className="text-[11px] text-[var(--nx-dim)]">Sin partido activo o la fuente aún no respondió.</p>}
        {s && <>
          <div className="flex items-center gap-2 text-[13px] font-bold text-[var(--nx-text)]">
            <span className="min-w-0 flex-1 truncate text-right">{s.home.name}</span>
            <span className="rounded bg-[var(--nx-gold)] px-2 font-black text-[var(--nx-gold-ink)]">{p.freshness === "unavailable" ? "–" : `${s.home.score}-${s.away.score}`}</span>
            <span className="min-w-0 flex-1 truncate">{s.away.name}</span>
          </div>
          <p className="mt-1 text-center text-[10.5px] text-[var(--nx-muted)]">{s.leagueName} · {s.statusText || s.state}{p.lastOk ? ` · leído ${new Date(p.lastOk).toLocaleTimeString("es-CO")}` : ""}</p>
          <p className="mt-1 text-center text-[10px] text-[var(--nx-dim)]">Alineaciones: {s.lineupsAvailable ? "confirmadas" : "no disponibles aún"} · Estadísticas: {s.stats.length ? "disponibles" : "no disponibles"}</p>
          {s.stats.slice(0, 6).map((st) => (
            <div key={st.key} className="mt-1 grid grid-cols-[40px_1fr_40px] items-center gap-2 text-[10.5px] text-[var(--nx-text)]">
              <span className="text-right font-bold tabular-nums">{st.home}{st.percent ? "%" : ""}</span>
              <div><p className="text-center text-[9px] uppercase tracking-wider text-[var(--nx-dim)]">{st.label}</p><div className="flex h-1.5 overflow-hidden rounded bg-white/10"><div style={{ width: `${(st.home / ((st.home + st.away) || 1)) * 100}%` }} className="bg-[var(--nx-gold)]" /></div></div>
              <span className="font-bold tabular-nums">{st.away}{st.percent ? "%" : ""}</span>
            </div>
          ))}
        </>}
      </Panel>
      <Panel title="Monitor de eventos" icon={<Radio size={12} className="text-[var(--nx-live)]" />}>
        {!p.events.length && <p className="text-[11px] text-[var(--nx-dim)]">Sin acontecimientos todavía.</p>}
        <ul className="max-h-64 space-y-0.5 overflow-y-auto">
          {[...p.events].reverse().map((e) => (
            <li key={e.id} className="flex items-center gap-2 text-[11px]">
              <span className="w-10 flex-shrink-0 font-mono text-[var(--nx-dim)]">{e.minute}</span>
              <span className="min-w-0 flex-1 truncate text-[var(--nx-text)]">{EVENT_LABEL[e.type]}{e.player ? ` · ${e.player.name}` : ""}{e.playerOut ? ` (sale ${e.playerOut})` : ""}</span>
              <span className={`flex-shrink-0 text-[9.5px] font-bold uppercase ${EV_CLS[e.status]}`}>{e.status === "confirmed" ? "confirmado" : e.status === "pending" ? "pendiente" : "retirado"}</span>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

// ---------------------------------------------------------------- audience desk
export function AudienceDesk({ p, onAirPoll, onResult, onMessage }: { p: Production; onAirPoll: (id: string) => void; onResult: (id: string) => void; onMessage: (author: string, body: string) => void }) {
  return (
    <div className="grid gap-2 p-2 lg:grid-cols-2">
      <Panel title="Encuestas y debates del partido" icon={<Vote size={12} className="text-[var(--nx-gold)]" />} extra={<button type="button" onClick={() => void p.audience.refresh()} className="rounded p-1 text-[var(--nx-muted)] hover:text-[var(--nx-text)]"><RefreshCw size={12} /></button>}>
        <div className="mb-2 flex flex-wrap gap-1">
          {([["who-wins", "¿Quién gana?"], ["figure", "Figura del partido"], ["debate", "Debate"]] as const).map(([t, l]) => <button key={t} type="button" onClick={() => p.audience.launch(t)} className={`${ui.btnGhost} px-2 py-1 text-[10.5px]`}><Plus size={11} /> {l}</button>)}
        </div>
        {p.audienceError && <p className="mb-1 text-[10.5px] text-[var(--nx-live)]">{p.audienceError}</p>}
        {!p.polls.length && <p className="text-[11px] text-[var(--nx-dim)]">Este partido no tiene votaciones. Crea una con las plantillas (opciones con equipos y jugadores reales).</p>}
        <ul className="space-y-1.5">{p.polls.map((poll) => (
          <li key={poll.id} className="rounded-[var(--nx-r-sm)] bg-[var(--nx-s2)] p-1.5">
            <p className="text-[11.5px] font-semibold text-[var(--nx-text)]">{poll.question}</p>
            <p className="text-[9.5px] text-[var(--nx-dim)]">{poll.kind === "debate" ? "Debate" : "Encuesta"} · {poll.status === "open" ? "abierta" : poll.status === "closed" ? "cerrada" : "borrador"} · {poll.total} {poll.total === 1 ? "voto" : "votos"}</p>
            {poll.options.map((o) => { const pct = poll.total ? Math.round((o.votes / poll.total) * 100) : 0; return (
              <div key={o.label} className="mt-0.5"><div className="flex justify-between text-[10px] text-[var(--nx-muted)]"><span className="truncate">{o.label}</span><span className="tabular-nums">{pct}% · {o.votes}</span></div><div className="h-1 overflow-hidden rounded bg-white/10"><div className="h-full bg-[var(--nx-gold)]" style={{ width: `${pct}%` }} /></div></div>
            ); })}
            <div className="mt-1 flex gap-1">
              {poll.status === "open" && <button type="button" onClick={() => onAirPoll(poll.id)} className={`${ui.btnPrimary} flex-1 py-1 text-[10.5px]`}><Radio size={11} /> En vivo</button>}
              <button type="button" onClick={() => onResult(poll.id)} className={`${ui.btnGhost} flex-1 py-1 text-[10.5px]`}>Resultado</button>
              {poll.status === "open" && <button type="button" onClick={() => void p.audience.close(poll.id)} className={`${ui.btnGhost} px-2 py-1 text-[10.5px]`}>Cerrar</button>}
            </div>
          </li>))}</ul>
      </Panel>
      <Panel title="Mensajes de la audiencia (moderados)" icon={<MessageSquare size={12} className="text-[var(--nx-gold)]" />}>
        <p className="mb-1 text-[10px] text-[var(--nx-dim)]">Comentarios reales en las votaciones del partido. Nada sale al aire sin que lo elijas.</p>
        {!p.messages.length && <p className="text-[11px] text-[var(--nx-dim)]">Sin mensajes todavía.</p>}
        <ul className="max-h-72 space-y-1 overflow-y-auto">{p.messages.map((m) => (
          <li key={m.id} className={`rounded-[var(--nx-r-sm)] bg-[var(--nx-s2)] p-1.5 ${m.status === "pending" ? "border border-[var(--nx-gold)]/50" : ""}`}>
            <p className="text-[10px] font-bold text-[var(--nx-gold)]">{m.author}{m.status === "pending" ? " · pendiente" : ""}</p>
            <p className="text-[11px] text-[var(--nx-text)]">{m.body}</p>
            <div className="mt-1 flex gap-1">
              {m.status === "pending" && <button type="button" onClick={() => void p.audience.moderate(m.id, "visible")} className={`${ui.btnGhost} flex-1 py-0.5 text-[10px]`}><Check size={10} /> Aprobar</button>}
              {m.status === "visible" && <button type="button" onClick={() => onMessage(m.author, m.body)} className={`${ui.btnPrimary} flex-1 py-0.5 text-[10px]`}><ChevronRight size={10} /> A pantalla</button>}
              <button type="button" onClick={() => void p.audience.moderate(m.id, "hidden")} className={`${ui.btnGhost} px-2 py-0.5 text-[10px]`}>Ocultar</button>
            </div>
          </li>))}</ul>
      </Panel>
    </div>
  );
}

// ---------------------------------------------------------------- mobile control
export function MobileControl({ state, send, source, onSource, remoteAvailable }: { state: ControlState | null; send: (c: ControlCommand) => void; source: "local" | "remote"; onSource: (s: "local" | "remote") => void; remoteAvailable: boolean }) {
  const [tab, setTab] = useState<"inicio" | "escaleta" | "eventos" | "graficos" | "audiencia">("inicio");
  if (!state) return <div className="p-4 text-center text-[13px] text-[var(--nx-muted)]">Conectando con el estudio…</div>;
  const btn = "min-h-[44px] rounded-[var(--nx-r)] px-3 text-[13px] font-bold";
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[var(--nx-bg)]">
      <div className="flex-none space-y-1.5 border-b border-[var(--nx-line-2)] bg-[var(--nx-s1)] p-2.5">
        <div className="flex items-center gap-2">
          <span className={`rounded px-2 py-1 text-[11px] font-black ${state.live ? "bg-[var(--nx-live)] text-white" : "border border-[var(--nx-line-2)] text-[var(--nx-dim)]"}`}>{state.live ? "● AL AIRE" : "SIN TRANSMISIÓN"}</span>
          {state.recording && <span className="rounded border border-[var(--nx-live)] px-2 py-1 text-[11px] font-black text-[var(--nx-live)]">REC</span>}
          <span className="rounded bg-[var(--nx-s2)] px-2 py-1 text-[11px] font-bold text-[var(--nx-gold)]">{PHASE_LABEL[state.phase]}</span>
          <span className="ml-auto inline-flex rounded border border-[var(--nx-line-2)] p-0.5 text-[11px]">
            <button type="button" onClick={() => onSource("local")} className={`rounded px-2 py-1 font-bold ${source === "local" ? "bg-[var(--nx-text)] text-black" : "text-[var(--nx-muted)]"}`}>Este equipo</button>
            <button type="button" disabled={!remoteAvailable} onClick={() => onSource("remote")} className={`rounded px-2 py-1 font-bold disabled:opacity-40 ${source === "remote" ? "bg-[var(--nx-gold)] text-black" : "text-[var(--nx-muted)]"}`}>Estudio PC</button>
          </span>
        </div>
        {state.match && (
          <div className="flex items-center gap-2 text-[15px] font-bold text-[var(--nx-text)]">
            <span className="min-w-0 flex-1 truncate">{state.match.home}</span>
            <span className="rounded bg-[var(--nx-gold)] px-2 font-black text-black">{state.match.freshness === "unavailable" ? "–" : state.match.score}</span>
            <span className="min-w-0 flex-1 truncate text-right">{state.match.away}</span>
          </div>
        )}
        {state.match && <p className="text-[11px] text-[var(--nx-muted)]">{state.match.status} · {FRESH[state.match.freshness].label}</p>}
        {state.alerts.map((a) => <p key={a} className="flex items-center gap-1 text-[12px] font-semibold text-[var(--nx-live)]"><AlertTriangle size={13} /> {a}</p>)}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2.5">
        {tab === "inicio" && (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => send({ type: "prepare", on: !state.prepare })} className={`${btn} ${state.prepare ? "bg-[var(--nx-ok)] text-black" : "border border-[var(--nx-line-2)] text-[var(--nx-text)]"}`}>{state.prepare ? "Modo Preparar" : "Modo Directo"}</button>
              <button type="button" disabled={!state.prepare} onClick={() => send({ type: "take" })} className={`${btn} bg-[var(--nx-gold)] text-black disabled:opacity-40`}>TAKE</button>
              <button type="button" onClick={() => send({ type: "hide-all" })} className={`${btn} col-span-2 border border-[var(--nx-live)] text-[var(--nx-live)]`}>Ocultar todo</button>
            </div>
            <div className="rounded-[var(--nx-r)] bg-[var(--nx-s1)] p-2">
              <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-[var(--nx-muted)]">Al aire</p>
              {!state.onAir.length && <p className="text-[12px] text-[var(--nx-dim)]">Nada encima</p>}
              {state.onAir.map((g) => <p key={g.id} className="truncate text-[13px] text-[var(--nx-text)]">● {g.name}</p>)}
            </div>
            <div className="rounded-[var(--nx-r)] bg-[var(--nx-s1)] p-2">
              <p className="mb-1 flex items-center text-[11px] font-bold uppercase tracking-wider text-[var(--nx-muted)]">Automatización
                <button type="button" onClick={() => send({ type: "automation", op: state.automation.paused ? "resume" : "pause" })} className="ml-auto rounded bg-[var(--nx-s3)] px-2 py-1 text-[11px] normal-case text-[var(--nx-text)]">{state.automation.paused ? "Reanudar" : "Pausar"}</button>
              </p>
              {state.automation.running && <p className="text-[12px] text-[var(--nx-text)]">Ejecutando: {state.automation.running}</p>}
              {state.automation.awaiting.map((t) => (
                <div key={t.id} className="mt-1 rounded bg-[var(--nx-s2)] p-2">
                  <p className="text-[13px] font-semibold text-[var(--nx-text)]">{t.label}</p><p className="text-[11px] text-[var(--nx-dim)]">{t.rule}</p>
                  <div className="mt-1 grid grid-cols-2 gap-1.5"><button type="button" onClick={() => send({ type: "automation", op: "approve", taskId: t.id })} className={`${btn} bg-[var(--nx-gold)] text-black`}>Aprobar</button><button type="button" onClick={() => send({ type: "automation", op: "reject", taskId: t.id })} className={`${btn} border border-[var(--nx-line-2)] text-[var(--nx-text)]`}>Descartar</button></div>
                </div>
              ))}
              {!state.automation.awaiting.length && !state.automation.running && <p className="text-[12px] text-[var(--nx-dim)]">{state.automation.last ?? "Sin actividad"}</p>}
            </div>
            <div className="grid grid-cols-2 gap-2">{state.scenes.map((s) => <button key={s.id} type="button" onClick={() => send({ type: "scene", id: s.id })} className={`${btn} border border-[var(--nx-line-2)] text-left text-[12px] text-[var(--nx-text)]`}>{s.label}</button>)}</div>
          </div>
        )}
        {tab === "escaleta" && (
          <div className="space-y-1.5">
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => send({ type: "rundown", op: "mode", mode: state.rundownMode === "auto" ? "manual" : "auto" })} className={`${btn} border border-[var(--nx-line-2)] text-[var(--nx-text)]`}>Escaleta: {state.rundownMode === "auto" ? "Automática" : "Manual"}</button>
              <button type="button" onClick={() => send({ type: "rundown", op: "next" })} className={`${btn} bg-[var(--nx-gold)] text-black`}>Siguiente bloque</button>
            </div>
            {state.rundown.map((b) => (
              <div key={b.id} className="flex items-center gap-2 rounded-[var(--nx-r)] bg-[var(--nx-s1)] p-2">
                <span className="w-14 text-[11px] text-[var(--nx-dim)]">{b.time}</span>
                <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-semibold text-[var(--nx-text)]">{b.name}</span><span className="text-[10.5px] uppercase text-[var(--nx-muted)]">{STATUS_LABEL[b.status as keyof typeof STATUS_LABEL] ?? b.status}</span></span>
                <button type="button" disabled={b.status !== "ready"} onClick={() => send({ type: "rundown", op: "run", blockId: b.id })} className="min-h-[44px] rounded bg-[var(--nx-ok)] px-3 text-[12px] font-bold text-black disabled:opacity-30">Al aire</button>
              </div>
            ))}
          </div>
        )}
        {tab === "eventos" && (
          <ul className="space-y-1">{state.events.map((e) => <li key={e.id} className="flex items-center gap-2 rounded bg-[var(--nx-s1)] p-2 text-[13px] text-[var(--nx-text)]"><span className="min-w-0 flex-1 truncate">{e.label}</span><span className={`text-[10.5px] font-bold uppercase ${EV_CLS[e.status]}`}>{e.status === "confirmed" ? "confirmado" : e.status === "pending" ? "pendiente" : "retirado"}</span></li>)}
            {!state.events.length && <p className="text-[12px] text-[var(--nx-dim)]">Sin acontecimientos.</p>}</ul>
        )}
        {tab === "graficos" && (
          <div className="grid grid-cols-2 gap-2">{state.graphics.map((g) => <button key={g.variant} type="button" onClick={() => send({ type: "graphic", variant: g.variant })} className={`${btn} ${g.on ? "bg-[var(--nx-gold)] text-black" : "border border-[var(--nx-line-2)] text-[var(--nx-text)]"}`}>{g.on ? "● " : ""}{g.label}</button>)}</div>
        )}
        {tab === "audiencia" && (
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-1.5">{([["who-wins", "¿Quién gana?"], ["figure", "Figura"], ["debate", "Debate"]] as const).map(([t, l]) => <button key={t} type="button" onClick={() => send({ type: "poll", op: "launch", template: t })} className={`${btn} border border-[var(--nx-line-2)] text-[12px] text-[var(--nx-text)]`}>{l}</button>)}</div>
            {state.polls.map((poll) => (
              <div key={poll.id} className="rounded-[var(--nx-r)] bg-[var(--nx-s1)] p-2">
                <p className="text-[13px] font-semibold text-[var(--nx-text)]">{poll.question}</p>
                <p className="text-[11px] text-[var(--nx-dim)]">{poll.status} · {poll.total} votos</p>
                {poll.options.map((o) => <p key={o.label} className="text-[12px] text-[var(--nx-muted)]">{o.label}: {poll.total ? Math.round((o.votes / poll.total) * 100) : 0}%</p>)}
                <div className="mt-1 grid grid-cols-3 gap-1.5">
                  <button type="button" onClick={() => send({ type: "poll", op: "show", pollId: poll.id })} className={`${btn} bg-[var(--nx-gold)] text-[12px] text-black`}>En vivo</button>
                  <button type="button" onClick={() => send({ type: "poll", op: "result", pollId: poll.id })} className={`${btn} border border-[var(--nx-line-2)] text-[12px] text-[var(--nx-text)]`}>Resultado</button>
                  <button type="button" onClick={() => send({ type: "poll", op: "close", pollId: poll.id })} className={`${btn} border border-[var(--nx-line-2)] text-[12px] text-[var(--nx-text)]`}>Cerrar</button>
                </div>
              </div>
            ))}
            {!state.polls.length && <p className="text-[12px] text-[var(--nx-dim)]">Sin votaciones en este partido.</p>}
          </div>
        )}
      </div>
      <nav className="grid flex-none grid-cols-5 border-t border-[var(--nx-line-2)] bg-[var(--nx-s1)] pb-[env(safe-area-inset-bottom)]">
        {([["inicio", "Control"], ["escaleta", "Escaleta"], ["eventos", "Eventos"], ["graficos", "Gráficos"], ["audiencia", "Audiencia"]] as const).map(([id, label]) => (
          <button key={id} type="button" onClick={() => setTab(id)} className={`min-h-[52px] text-[11px] font-bold ${tab === id ? "text-[var(--nx-gold)]" : "text-[var(--nx-muted)]"}`}>{label}</button>
        ))}
      </nav>
    </div>
  );
}
