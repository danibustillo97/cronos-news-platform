// Matchday Rundown — the TV running order of a match: pre-match, live and
// post-match blocks generated from the REAL context of the match, editable, and
// run automatically (by time / match phase) or manually by the operator.
// A block whose data does not exist yet (line-ups, standings, final result)
// stays PENDING and never airs with invented content.

import type { MatchState } from "./sportsEvents";

export type Phase = "pre" | "live" | "post";
export type BlockStatus = "pending" | "ready" | "on-air" | "done" | "skipped" | "error";
export type Requirement = "lineups" | "stats" | "standings" | "poll" | "live" | "finished" | "insights";
export type BlockAction =
  | { type: "graphics"; variants: string[]; seconds?: number }
  | { type: "scene"; scene: string; graphics?: string[] }
  | { type: "poll"; template: "who-wins" | "figure" | "debate" }
  | { type: "show"; what: "recap" }
  | { type: "none" };

export interface Block {
  id: string;
  name: string;
  kind: string;
  phase: Phase;
  /** Minutes relative to kick-off (negative = before). Live/post blocks use minutes of the match or after the final whistle. */
  offsetMin: number;
  scheduledAt: number | null;          // epoch ms (pre-match: kickoff + offset; live/post: set when the phase starts)
  durationSec: number;
  status: BlockStatus;
  source: string;                      // where its data comes from (shown to the operator)
  graphic?: string;
  action: BlockAction;
  dependsOn: string[];
  priority: number;
  requires: Requirement[];
  error?: string;
}

export interface RundownContext {
  kickoff: number | null;              // epoch ms
  state: MatchState;
  lineupsAvailable: boolean;
  hasStats: boolean;
  hasStandings: boolean;
  hasInsights: boolean;
  pollOpen: boolean;
  homeName: string;
  awayName: string;
  competition?: string;
}

let n = 0;
const id = (kind: string) => `b-${kind}-${(n += 1).toString(36)}`;
const block = (b: Omit<Block, "id" | "scheduledAt" | "status" | "dependsOn"> & Partial<Pick<Block, "dependsOn">>): Block =>
  ({ id: id(b.kind), scheduledAt: null, status: "pending", dependsOn: [], ...b });

/** The running order for a match. Only real data sources; readiness is evaluated against the context. */
export function generateRundown(ctx: RundownContext): Block[] {
  const vs = `${ctx.homeName} vs ${ctx.awayName}`;
  const blocks: Block[] = [
    // PREVIA
    block({ name: "Apertura del programa", kind: "opening", phase: "pre", offsetMin: -30, durationSec: 20, source: "Escena", action: { type: "scene", scene: "previa" }, priority: 60, requires: [] }),
    block({ name: `Identificación · ${vs}`, kind: "match-id", phase: "pre", offsetMin: -28, durationSec: 30, source: "Partido", graphic: "pro", action: { type: "graphics", variants: ["pro"] }, priority: 70, requires: [] }),
    block({ name: "Presentación y forma de los equipos", kind: "teams", phase: "pre", offsetMin: -25, durationSec: 45, source: "ESPN · últimos partidos", graphic: "prematch", action: { type: "graphics", variants: ["prematch"], seconds: 45 }, priority: 60, requires: [] }),
    block({ name: `Contexto: ${ctx.competition ?? "competición"} y posiciones`, kind: "standings", phase: "pre", offsetMin: -20, durationSec: 30, source: "ESPN · clasificación", graphic: "standings", action: { type: "graphics", variants: ["standings"], seconds: 30 }, priority: 50, requires: ["standings"] }),
    block({ name: "Alineaciones confirmadas", kind: "lineups", phase: "pre", offsetMin: -15, durationSec: 20, source: "ESPN · alineaciones", graphic: "lineup-home", action: { type: "graphics", variants: ["lineup-home"], seconds: 20 }, priority: 80, requires: ["lineups"] }),
    block({ name: "Jugadores a seguir (duelo)", kind: "key-players", phase: "pre", offsetMin: -12, durationSec: 30, source: "ESPN · temporada", graphic: "duel", action: { type: "graphics", variants: ["duel"], seconds: 30 }, priority: 40, requires: ["lineups"] }),
    block({ name: "Encuesta: ¿quién gana?", kind: "poll", phase: "pre", offsetMin: -8, durationSec: 60, source: "Votación NEXUS", graphic: "poll", action: { type: "poll", template: "who-wins" }, priority: 50, requires: [] }),
    block({ name: "Preguntas de la audiencia", kind: "questions", phase: "pre", offsetMin: -5, durationSec: 60, source: "Comentarios moderados", action: { type: "none" }, priority: 30, requires: [] }),
    block({ name: "Cuenta regresiva y marcador", kind: "countdown", phase: "pre", offsetMin: -1, durationSec: 60, source: "Partido", graphic: "pro", action: { type: "graphics", variants: ["pro", "cinta"] }, priority: 70, requires: [] }),
    // EN VIVO
    block({ name: "Apertura de transmisión en vivo", kind: "live-open", phase: "live", offsetMin: 0, durationSec: 10, source: "Escena", action: { type: "scene", scene: "partido", graphics: ["pro"] }, priority: 90, requires: ["live"] }),
    block({ name: "Estadísticas (15')", kind: "stats", phase: "live", offsetMin: 15, durationSec: 15, source: "ESPN · estadísticas", graphic: "stats", action: { type: "graphics", variants: ["stats"], seconds: 15 }, priority: 40, requires: ["live", "stats"] }),
    block({ name: "Línea de tiempo (30')", kind: "timeline", phase: "live", offsetMin: 30, durationSec: 15, source: "ESPN · eventos", graphic: "timeline", action: { type: "graphics", variants: ["timeline"], seconds: 15 }, priority: 40, requires: ["live"] }),
    block({ name: "Resultados de la jornada (multipantalla)", kind: "multi", phase: "live", offsetMin: 40, durationSec: 20, source: "ESPN · marcadores", graphic: "multi", action: { type: "graphics", variants: ["multi"], seconds: 20 }, priority: 30, requires: ["live"] }),
    block({ name: "Estadísticas (60')", kind: "stats", phase: "live", offsetMin: 60, durationSec: 15, source: "ESPN · estadísticas", graphic: "stats", action: { type: "graphics", variants: ["stats"], seconds: 15 }, priority: 40, requires: ["live", "stats"] }),
    block({ name: "Línea de tiempo (75')", kind: "timeline", phase: "live", offsetMin: 75, durationSec: 15, source: "ESPN · eventos", graphic: "timeline", action: { type: "graphics", variants: ["timeline"], seconds: 15 }, priority: 40, requires: ["live"] }),
    // POSTPARTIDO
    block({ name: "Resultado definitivo", kind: "final", phase: "post", offsetMin: 0, durationSec: 20, source: "ESPN · resultado", graphic: "result-card", action: { type: "graphics", variants: ["result-card"], seconds: 20 }, priority: 90, requires: ["finished"] }),
    block({ name: "Cronología del partido", kind: "timeline", phase: "post", offsetMin: 1, durationSec: 20, source: "ESPN · eventos", graphic: "timeline", action: { type: "graphics", variants: ["timeline"], seconds: 20 }, priority: 70, requires: ["finished"] }),
    block({ name: "Estadísticas finales", kind: "stats", phase: "post", offsetMin: 2, durationSec: 20, source: "ESPN · estadísticas", graphic: "stats", action: { type: "graphics", variants: ["stats"], seconds: 20 }, priority: 70, requires: ["finished", "stats"] }),
    block({ name: "Así queda la tabla", kind: "standings", phase: "post", offsetMin: 3, durationSec: 25, source: "ESPN · clasificación", graphic: "standings", action: { type: "graphics", variants: ["standings"], seconds: 25 }, priority: 60, requires: ["finished", "standings"] }),
    block({ name: "Jugador destacado (datos reales)", kind: "featured", phase: "post", offsetMin: 4, durationSec: 20, source: "ESPN · goles y temporada", graphic: "player", action: { type: "graphics", variants: ["player"], seconds: 20 }, priority: 50, requires: ["finished", "insights"] }),
    block({ name: "Encuesta final: figura del partido", kind: "final-poll", phase: "post", offsetMin: 5, durationSec: 90, source: "Votación NEXUS", graphic: "poll", action: { type: "poll", template: "figure" }, priority: 50, requires: ["finished"] }),
    block({ name: "Análisis de la jornada (programa automático)", kind: "analysis", phase: "post", offsetMin: 8, durationSec: 300, source: "ESPN · jornada", action: { type: "show", what: "recap" }, priority: 30, requires: ["finished"] }),
    block({ name: "Cierre de transmisión", kind: "close", phase: "post", offsetMin: 15, durationSec: 20, source: "Escena", action: { type: "scene", scene: "camara" }, priority: 40, requires: ["finished"] }),
  ];
  // the line-ups duel depends on the line-ups block
  const lu = blocks.find((b) => b.kind === "lineups");
  const kp = blocks.find((b) => b.kind === "key-players");
  if (lu && kp) kp.dependsOn = [lu.id];
  return evaluate(schedule(blocks, ctx.kickoff), ctx);
}

/** Pre-match times hang from the kick-off. Live/post blocks get a time when their phase starts (see startPhase). */
export function schedule(blocks: Block[], kickoff: number | null): Block[] {
  return blocks.map((b) => (b.phase === "pre" && kickoff ? { ...b, scheduledAt: kickoff + b.offsetMin * 60_000 } : b));
}
export function startPhase(blocks: Block[], phase: Phase, at: number): Block[] {
  return blocks.map((b) => (b.phase === phase && (b.status === "pending" || b.status === "ready") ? { ...b, scheduledAt: at + b.offsetMin * 60_000 } : b));
}

/** pending ⇄ ready from the real data available; aired / skipped / failed blocks keep their state. */
export function evaluate(blocks: Block[], ctx: RundownContext): Block[] {
  const has: Record<Requirement, boolean> = {
    lineups: ctx.lineupsAvailable, stats: ctx.hasStats, standings: ctx.hasStandings, poll: ctx.pollOpen,
    live: ctx.state === "in" || ctx.state === "post", finished: ctx.state === "post", insights: ctx.hasInsights,
  };
  const status = new Map(blocks.map((b) => [b.id, b.status]));
  return blocks.map((b) => {
    if (b.status !== "pending" && b.status !== "ready") return b;
    const depsOk = b.dependsOn.every((d) => status.get(d) !== "skipped" && status.get(d) !== "error");
    const ok = b.requires.every((r) => has[r]) && depsOk;
    return { ...b, status: ok ? "ready" : "pending" };
  });
}

export function phaseOf(state: MatchState): Phase { return state === "in" ? "live" : state === "post" ? "post" : "pre"; }

// ---------------------------------------------------------------- editing
export const reorder = (blocks: Block[], from: number, to: number) => { const next = [...blocks]; const [b] = next.splice(from, 1); next.splice(Math.max(0, Math.min(next.length, to)), 0, b); return next; };
export const remove = (blocks: Block[], blockId: string) => blocks.filter((b) => b.id !== blockId).map((b) => ({ ...b, dependsOn: b.dependsOn.filter((d) => d !== blockId) }));
export const insert = (blocks: Block[], b: Block, index = blocks.length) => { const next = [...blocks]; next.splice(index, 0, b); return next; };
export const repeat = (blocks: Block[], blockId: string) => {
  const i = blocks.findIndex((b) => b.id === blockId);
  if (i < 0) return blocks;
  const copy: Block = { ...blocks[i], id: id(blocks[i].kind), status: "pending", scheduledAt: null, name: `${blocks[i].name} (repetición)` };
  return insert(blocks, copy, i + 1);
};
export const setStatus = (blocks: Block[], blockId: string, status: BlockStatus, error?: string) => blocks.map((b) => (b.id === blockId ? { ...b, status, error } : b));
export const update = (blocks: Block[], blockId: string, patch: Partial<Block>) => blocks.map((b) => (b.id === blockId ? { ...b, ...patch } : b));
export function custom(name: string, phase: Phase, action: BlockAction, durationSec = 20): Block {
  return { id: id("custom"), name, kind: "custom", phase, offsetMin: 0, scheduledAt: null, durationSec, status: "ready", source: "Operador", action, dependsOn: [], priority: 50, requires: [] };
}

/** Next block to air in the current phase: on-air first, then the first ready one in order. */
export function nextBlock(blocks: Block[], phase: Phase): Block | null {
  return blocks.find((b) => b.phase === phase && b.status === "ready") ?? null;
}

// ---------------------------------------------------------------- runner
export interface RunnerStep { start?: Block; finish?: Block[] }

/**
 * Auto mode: finishes the block on air when its time is over and starts the next READY block of the
 * current phase whose time has come. Manual mode only finishes blocks; the operator starts them.
 */
export function runnerStep(blocks: Block[], phase: Phase, now: number, mode: "auto" | "manual", startedAt: Record<string, number>): RunnerStep {
  const finish = blocks.filter((b) => b.status === "on-air" && startedAt[b.id] !== undefined && now - startedAt[b.id] >= b.durationSec * 1000);
  if (mode === "manual" || blocks.some((b) => b.status === "on-air" && !finish.includes(b))) return { finish };
  const due = blocks.find((b) => b.phase === phase && b.status === "ready" && b.scheduledAt !== null && b.scheduledAt <= now);
  return { start: due ?? undefined, finish };
}

export const STATUS_LABEL: Record<BlockStatus, string> = { pending: "Pendiente", ready: "Preparado", "on-air": "En emisión", done: "Completado", skipped: "Omitido", error: "Error" };
export const PHASE_LABEL: Record<Phase, string> = { pre: "Previa", live: "En vivo", post: "Postpartido" };
