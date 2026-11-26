// Remote control of the studio: the studio publishes its state and executes the
// commands it receives; a phone (or another tab) shows the state and sends commands.
// Transport: Supabase Realtime broadcast on a per-user channel when signed in
// (works across devices, no table), else BroadcastChannel (same device, other tabs).

import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";

export type ControlCommand =
  | { type: "take" } | { type: "hide-all" } | { type: "prepare"; on: boolean }
  | { type: "graphic"; variant: string } | { type: "scene"; id: string } | { type: "slot"; n: number }
  | { type: "rundown"; op: "run" | "skip" | "next" | "mode"; blockId?: string; mode?: "auto" | "manual" }
  | { type: "automation"; op: "approve" | "reject" | "pause" | "resume"; taskId?: string }
  | { type: "poll"; op: "launch"; template: "who-wins" | "figure" | "debate" } | { type: "poll"; op: "close" | "show" | "result"; pollId: string };

export interface ControlState {
  at: number;
  /** Id of the studio instance that published it (commands are addressed to it). */
  studio: string;
  live: boolean; recording: boolean; prepare: boolean;
  signal: { cameras: number; program: boolean; preview: boolean; stream: "off" | "live" };
  phase: "pre" | "live" | "post";
  match: { home: string; away: string; score: string; status: string; freshness: "fresh" | "stale" | "unavailable" } | null;
  onAir: { id: string; name: string }[];
  preview: { id: string; name: string }[];
  graphics: { variant: string; label: string; on: boolean }[];
  scenes: { id: string; label: string }[];
  rundown: { id: string; name: string; status: string; phase: string; time: string }[];
  rundownMode: "auto" | "manual";
  automation: { paused: boolean; awaiting: { id: string; label: string; rule: string }[]; running: string | null; last: string | null };
  events: { id: string; label: string; status: string }[];
  polls: { id: string; question: string; status: string; total: number; options: { label: string; votes: number }[] }[];
  alerts: string[];
}

export interface Transport { label: string; publish(kind: "state" | "command", payload: unknown): void; subscribe(kind: "state" | "command", cb: (payload: unknown) => void): () => void; close(): void }

export async function createTransport(): Promise<Transport> {
  let userId: string | null = null;
  if (isSupabaseConfigured) {
    try { userId = (await supabase.auth.getUser()).data.user?.id ?? null; } catch { userId = null; }
  }
  if (userId) {
    const channel = supabase.channel(`nexus-control-${userId}`, { config: { broadcast: { self: false } } });
    const handlers = { state: new Set<(p: unknown) => void>(), command: new Set<(p: unknown) => void>() };
    channel.on("broadcast", { event: "state" }, ({ payload }) => handlers.state.forEach((cb) => cb(payload)))
      .on("broadcast", { event: "command" }, ({ payload }) => handlers.command.forEach((cb) => cb(payload)))
      .subscribe();
    return {
      label: "Supabase Realtime",
      publish: (kind, payload) => { void channel.send({ type: "broadcast", event: kind, payload }); },
      subscribe: (kind, cb) => { handlers[kind].add(cb); return () => { handlers[kind].delete(cb); }; },
      close: () => { void supabase.removeChannel(channel); },
    };
  }
  const bc = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("nexus-control-local") : null;
  const handlers = { state: new Set<(p: unknown) => void>(), command: new Set<(p: unknown) => void>() };
  if (bc) bc.onmessage = (e: MessageEvent<{ kind: "state" | "command"; payload: unknown }>) => handlers[e.data.kind]?.forEach((cb) => cb(e.data.payload));
  return {
    label: "Este dispositivo",
    publish: (kind, payload) => bc?.postMessage({ kind, payload }),
    subscribe: (kind, cb) => { handlers[kind].add(cb); return () => { handlers[kind].delete(cb); }; },
    close: () => bc?.close(),
  };
}

export interface Envelope { to: string; cmd: ControlCommand }
/** Accepts only well-formed commands addressed to this studio (remote input is untrusted). */
export function commandFor(payload: unknown, studio: string): ControlCommand | null {
  const e = payload as Envelope | null;
  return e && e.to === studio && isCommand(e.cmd) ? e.cmd : null;
}

/** A command is only accepted when it has a known shape (remote input is untrusted). */
export function isCommand(x: unknown): x is ControlCommand {
  if (!x || typeof x !== "object") return false;
  const c = x as { type?: unknown };
  return typeof c.type === "string" && ["take", "hide-all", "prepare", "graphic", "scene", "slot", "rundown", "automation", "poll"].includes(c.type);
}
