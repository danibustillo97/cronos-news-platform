// Automation Engine — WHEN an event happens → evaluate conditions → create tasks
// (content / graphic / scene / poll) → run them automatically or ask the operator,
// depending on each rule's mode. Pure and deterministic (clock injected); the
// executors (what a task actually does on air) are supplied by the studio.
//
// Guarantees:
//  - only CONFIRMED sports events trigger rules (pending/retracted are ignored);
//  - dedupe: one task per (rule, event, action) — re-ingesting never repeats;
//  - "approval" tasks wait for ✔ and expire if nobody approves in time;
//  - failures retry with backoff up to maxAttempts, then FAILED (kept in history);
//  - pause stops execution (tasks keep queuing), resume continues; manual mode
//    rules create no tasks; the operator can cancel any queued/awaiting task.

import type { EventType, SportsEvent } from "./sportsEvents";

export type RuleMode = "auto" | "approval" | "manual";
export type Trigger = EventType | "phase:pre" | "phase:live" | "phase:post" | "manual";
export type TaskStatus = "awaiting-approval" | "queued" | "running" | "done" | "failed" | "cancelled" | "expired" | "rejected";

export interface ActionSpec {
  kind: string;                       // executor key, e.g. "graphic:goal"
  label: string;                      // what the operator reads in the console
  params?: Record<string, unknown>;
  delayMs?: number;                   // wait before running (lets the goal card breathe before stats)
  expiresMs?: number;                 // approval/queue lifetime (stale content is never aired late)
  maxAttempts?: number;
}
export interface Rule {
  id: string;
  label: string;
  on: Trigger[];
  mode: RuleMode;
  priority: number;                   // higher runs first
  when?: (event: SportsEvent | null, ctx: AutomationContext) => boolean;
  actions: ActionSpec[];
}
export interface AutomationContext { activeMatchId: string | null }

export interface Task {
  id: string; ruleId: string; ruleLabel: string; eventId: string | null; eventLabel: string; dedupeKey: string;
  action: ActionSpec; mode: RuleMode; priority: number; status: TaskStatus;
  createdAt: number; runAt: number; expiresAt: number | null; attempts: number; finishedAt: number | null;
  result?: string; error?: string;
}
export type Executor = (task: Task) => Promise<string | void>;

export interface EngineState { paused: boolean; tasks: Task[]; history: Task[]; modes: Record<string, RuleMode> }
export interface EngineOptions { now?: () => number; historyMax?: number; backoffMs?: number }

const ACTIVE: TaskStatus[] = ["awaiting-approval", "queued", "running"];
let seq = 0;

export class AutomationEngine {
  private tasks: Task[] = [];
  private history: Task[] = [];
  private seen = new Set<string>();
  private paused = false;
  private running = false;
  private modes: Record<string, RuleMode> = {};
  private listeners = new Set<(s: EngineState) => void>();
  private readonly now: () => number;
  private readonly historyMax: number;
  private readonly backoffMs: number;

  constructor(private rules: Rule[], private executors: Record<string, Executor>, opts: EngineOptions = {}) {
    this.now = opts.now ?? (() => Date.now());
    this.historyMax = opts.historyMax ?? 200;
    this.backoffMs = opts.backoffMs ?? 2000;
    rules.forEach((r) => { this.modes[r.id] = r.mode; });
  }

  setExecutors(executors: Record<string, Executor>) { this.executors = executors; }
  setRules(rules: Rule[]) { this.rules = rules; rules.forEach((r) => { this.modes[r.id] ??= r.mode; }); this.emit(); }
  getRules() { return this.rules.map((r) => ({ ...r, mode: this.modes[r.id] ?? r.mode })); }
  setMode(ruleId: string, mode: RuleMode) { this.modes[ruleId] = mode; this.emit(); }

  /** A sports event (or a phase change / manual trigger). Returns the tasks created. */
  ingest(trigger: Trigger, event: SportsEvent | null, ctx: AutomationContext, label = ""): Task[] {
    if (event && event.status !== "confirmed") return [];
    const created: Task[] = [];
    const now = this.now();
    for (const rule of [...this.rules].sort((a, b) => b.priority - a.priority)) {
      const mode = this.modes[rule.id] ?? rule.mode;
      if (mode === "manual" || !rule.on.includes(trigger)) continue;
      if (rule.when && !rule.when(event, ctx)) continue;
      rule.actions.forEach((action, index) => {
        const dedupeKey = `${rule.id}:${event?.id ?? trigger}:${index}`;
        if (this.seen.has(dedupeKey)) return;
        this.seen.add(dedupeKey);
        const task: Task = {
          id: `t${now.toString(36)}${(seq += 1).toString(36)}`, ruleId: rule.id, ruleLabel: rule.label, eventId: event?.id ?? null,
          eventLabel: label, dedupeKey, action, mode, priority: rule.priority,
          status: mode === "approval" ? "awaiting-approval" : "queued",
          createdAt: now, runAt: now + (action.delayMs ?? 0), expiresAt: action.expiresMs ? now + action.expiresMs : null,
          attempts: 0, finishedAt: null,
        };
        this.tasks.push(task);
        created.push(task);
      });
    }
    if (created.length) this.emit();
    return created;
  }

  /** Operator-made task (from the rundown or the console), runs through the same queue. */
  enqueueManual(action: ActionSpec, label: string): Task {
    const now = this.now();
    const task: Task = { id: `m${now.toString(36)}${(seq += 1).toString(36)}`, ruleId: "manual", ruleLabel: "Operador", eventId: null, eventLabel: label,
      dedupeKey: `manual:${now}:${seq}`, action, mode: "auto", priority: 1000, status: "queued", createdAt: now, runAt: now, expiresAt: null, attempts: 0, finishedAt: null };
    this.tasks.push(task);
    this.emit();
    return task;
  }

  approve(id: string) { this.update(id, (t) => (t.status === "awaiting-approval" ? { ...t, status: "queued", runAt: Math.max(this.now(), t.runAt) } : t)); }
  reject(id: string) { this.finish(id, "rejected"); }
  cancel(id: string) { const t = this.tasks.find((x) => x.id === id); if (t && t.status !== "running") this.finish(id, "cancelled"); }
  pause() { this.paused = true; this.emit(); }
  resume() { this.paused = false; this.emit(); }
  isPaused() { return this.paused; }

  /** Scheduler step: expire, then run the most urgent due task (one at a time). */
  async tick(): Promise<void> {
    const now = this.now();
    for (const t of this.tasks) if ((t.status === "awaiting-approval" || t.status === "queued") && t.expiresAt !== null && now > t.expiresAt) this.finish(t.id, "expired", false);
    if (this.paused || this.running) { this.emit(); return; }
    const due = this.tasks.filter((t) => t.status === "queued" && t.runAt <= now).sort((a, b) => b.priority - a.priority || a.runAt - b.runAt)[0];
    if (!due) { this.emit(); return; }
    const exec = this.executors[due.action.kind];
    this.running = true;
    this.update(due.id, (t) => ({ ...t, status: "running", attempts: t.attempts + 1 }));
    try {
      if (!exec) throw new Error(`Sin ejecutor para «${due.action.kind}»`);
      const result = await exec(this.tasks.find((t) => t.id === due.id)!);
      this.finish(due.id, "done", true, typeof result === "string" ? result : undefined);
    } catch (err) {
      const t = this.tasks.find((x) => x.id === due.id)!;
      const message = err instanceof Error ? err.message : String(err);
      if (t.attempts < (t.action.maxAttempts ?? 3)) this.update(due.id, (x) => ({ ...x, status: "queued", error: message, runAt: this.now() + this.backoffMs * 2 ** (x.attempts - 1) }));
      else this.finish(due.id, "failed", true, undefined, message);
    } finally {
      this.running = false;
    }
  }

  getState(): EngineState {
    return { paused: this.paused, tasks: this.tasks.filter((t) => ACTIVE.includes(t.status)), history: [...this.history], modes: { ...this.modes } };
  }
  subscribe(fn: (s: EngineState) => void) { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; }

  serialize() { return { paused: this.paused, modes: this.modes, seen: [...this.seen].slice(-500), history: this.history.slice(0, 100) }; }
  restore(data: Partial<ReturnType<AutomationEngine["serialize"]>>) {
    if (data.modes) this.modes = { ...this.modes, ...data.modes };
    if (data.seen) data.seen.forEach((k) => this.seen.add(k));
    if (data.history) this.history = data.history;
    if (typeof data.paused === "boolean") this.paused = data.paused;
    this.emit();
  }

  private update(id: string, fn: (t: Task) => Task) { this.tasks = this.tasks.map((t) => (t.id === id ? fn(t) : t)); this.emit(); }
  private finish(id: string, status: TaskStatus, emit = true, result?: string, error?: string) {
    const t = this.tasks.find((x) => x.id === id);
    if (!t) return;
    const done = { ...t, status, finishedAt: this.now(), result, error: error ?? t.error };
    this.tasks = this.tasks.filter((x) => x.id !== id);
    this.history = [done, ...this.history].slice(0, this.historyMax);
    if (emit) this.emit();
  }
  private emit() { const s = this.getState(); this.listeners.forEach((fn) => fn(s)); }
}

/** Default production rules (editable per rule in the console: auto / approval / manual). */
export function defaultRules(): Rule[] {
  const main = (e: SportsEvent | null, ctx: AutomationContext) => Boolean(e && ctx.activeMatchId && e.matchId === ctx.activeMatchId);
  return [
    { id: "goal", label: "Gol confirmado", on: ["goal", "penalty-goal", "own-goal"], mode: "auto", priority: 100, when: main, actions: [
      { kind: "graphic:goal", label: "Tarjeta de gol (escudo, autor, minuto, dato)", expiresMs: 120_000 },
      { kind: "graphic:scorer", label: "Ficha del anotador (temporada)", delayMs: 14_000, expiresMs: 180_000 },
    ] },
    { id: "goal-analysis", label: "Análisis tras el gol", on: ["goal", "penalty-goal", "own-goal"], mode: "approval", priority: 70, when: main, actions: [
      { kind: "graphic:timeline", label: "Línea de tiempo del partido", expiresMs: 240_000 },
      { kind: "poll:launch", label: "Encuesta «¿Quién gana ahora?»", params: { template: "who-wins" }, expiresMs: 300_000 },
    ] },
    { id: "red", label: "Tarjeta roja", on: ["red"], mode: "auto", priority: 90, when: main, actions: [
      { kind: "graphic:card", label: "Gráfico de expulsión", expiresMs: 120_000 },
      { kind: "graphic:stats", label: "Estadísticas del partido", delayMs: 12_000, expiresMs: 240_000 },
    ] },
    { id: "yellow", label: "Tarjeta amarilla", on: ["yellow"], mode: "auto", priority: 60, when: main, actions: [{ kind: "graphic:card", label: "Gráfico de amonestación", expiresMs: 90_000 }] },
    { id: "sub", label: "Sustitución", on: ["sub"], mode: "auto", priority: 50, when: main, actions: [
      { kind: "graphic:sub", label: "Gráfico de cambio", expiresMs: 90_000 },
      { kind: "graphic:player-in", label: "Ficha del jugador que entra", delayMs: 10_000, expiresMs: 180_000 },
    ] },
    { id: "lineups", label: "Alineaciones confirmadas", on: ["lineups"], mode: "approval", priority: 40, when: main, actions: [{ kind: "graphic:lineups", label: "Alineaciones (20 s)", expiresMs: 1_800_000 }] },
    { id: "kickoff", label: "Inicio del partido", on: ["kickoff"], mode: "auto", priority: 80, when: main, actions: [{ kind: "rundown:phase", label: "Escaleta → En vivo", params: { phase: "live" } }, { kind: "graphic:scoreboard", label: "Marcador al aire" }] },
    { id: "half-time", label: "Descanso", on: ["half-time"], mode: "auto", priority: 80, when: main, actions: [
      { kind: "graphic:result", label: "Resultado al descanso", params: { label: "DESCANSO" }, expiresMs: 600_000 },
      { kind: "graphic:stats", label: "Estadísticas del primer tiempo", delayMs: 15_000, expiresMs: 600_000 },
    ] },
    { id: "full-time", label: "Final del partido", on: ["full-time"], mode: "auto", priority: 95, when: main, actions: [
      { kind: "graphic:result", label: "Resultado final", params: { label: "FINAL" } },
      { kind: "rundown:phase", label: "Escaleta → Postpartido", params: { phase: "post" }, delayMs: 5_000 },
    ] },
    { id: "final-poll", label: "Encuesta final", on: ["full-time"], mode: "approval", priority: 60, when: main, actions: [{ kind: "poll:launch", label: "Encuesta «Figura del partido»", params: { template: "figure" }, expiresMs: 1_800_000 }] },
  ];
}
