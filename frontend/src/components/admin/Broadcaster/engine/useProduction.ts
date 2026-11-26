"use client";

// The production brain inside the studio: binds the engines together for the
// active match. Feed (15 s) → Sports Event Engine → Automation Engine (1 s
// scheduler) → executors supplied by the studio; Matchday Rundown with its
// runner (auto/manual) following the real phase; Audience (polls/messages);
// persistence; remote control (state out, commands in).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AutomationEngine, defaultRules, type EngineState, type Executor, type RuleMode } from "./automation";
import { EVENT_LABEL, MatchEventStore, mergeTimeline, type Freshness, type MatchSnapshot, type SourceDetail, type SportsEvent } from "./sportsEvents";
import { custom, evaluate, generateRundown, phaseOf, remove, reorder, repeat, runnerStep, setStatus, startPhase, type Block, type Phase, type RundownContext } from "./rundown";
import { createMatchPoll, listAudienceMessages, listMatchPolls, moderate, pollFromTemplate, setPollStatus, type AudienceMessage, type MatchPoll, type PollTemplate } from "./audience";
import { loadWorkspace, saveWorkspace, type ProductionWorkspace } from "./productionStore";
import { commandFor, createTransport, type ControlCommand, type ControlState, type Transport } from "./remoteControl";

export interface MatchRef { league: string; id: string }
type StudioPart = Pick<ControlState, "live" | "recording" | "prepare" | "signal" | "onAir" | "preview" | "graphics" | "scenes" | "matches">;

export interface ProductionOptions {
  active: boolean;
  match: MatchRef | null;
  /** Other matches followed live (selected): their events feed the timeline, each in its own store. */
  follow?: MatchRef[];
  /** What each task kind does on air (graphics, scenes…), supplied by the studio. */
  executors: Record<string, Executor>;
  /** Studio commands from the phone / other tab (take, graphic, scene…). */
  onStudioCommand: (cmd: ControlCommand) => void;
  studioState: () => StudioPart;
  onRetracted?: (event: SportsEvent) => void;
  notify?: (message: string) => void;
}

const keyOf = (m: MatchRef) => `${m.league}:${m.id}`;
const FEED_MS = 15_000;

export function useProduction(opts: ProductionOptions) {
  const o = useRef(opts);
  o.current = opts;
  const studioId = useRef(`studio-${Math.random().toString(36).slice(2, 10)}`).current;
  const matchKey = opts.match ? keyOf(opts.match) : null;

  // ---------------------------------------------------------------- engines
  const stores = useRef(new Map<string, MatchEventStore>());
  const [snapshot, setSnapshot] = useState<MatchSnapshot | null>(null);
  const [events, setEvents] = useState<SportsEvent[]>([]);
  const [freshness, setFreshness] = useState<Freshness>("unavailable");
  const [feedError, setFeedError] = useState<string | null>(null);
  const [lastOk, setLastOk] = useState(0);

  const engineRef = useRef<AutomationEngine | null>(null);
  if (!engineRef.current) engineRef.current = new AutomationEngine(defaultRules(), {}, {});
  const engine = engineRef.current;
  const [engineState, setEngineState] = useState<EngineState>(engine.getState());
  const [automationOn, setAutomationOnState] = useState(true);

  const [rundowns, setRundowns] = useState<Record<string, Block[]>>({});
  const [rundownMode, setRundownModeState] = useState<"auto" | "manual">("manual");
  const [phaseOverride, setPhaseOverride] = useState<Phase | null>(null);
  const startedAt = useRef<Record<string, number>>({});
  const phaseStarted = useRef<Record<string, boolean>>({});
  const [hasStandings, setHasStandings] = useState(false);

  const [polls, setPolls] = useState<MatchPoll[]>([]);
  const [messages, setMessages] = useState<AudienceMessage[]>([]);
  const [audienceError, setAudienceError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const blocks = useMemo(() => (matchKey ? rundowns[matchKey] ?? [] : []), [rundowns, matchKey]);
  const phase: Phase = phaseOverride ?? phaseOf(snapshot?.state ?? "pre");

  // ---------------------------------------------------------------- persistence (load once)
  useEffect(() => {
    let alive = true;
    void loadWorkspace().then((ws) => {
      if (!alive) return;
      if (ws.automation) engine.restore(ws.automation as Parameters<AutomationEngine["restore"]>[0]);
      setRundowns(ws.rundowns as Record<string, Block[]>);
      if (ws.prefs.rundownMode) setRundownModeState(ws.prefs.rundownMode);
      if (typeof ws.prefs.automationOn === "boolean") setAutomationOnState(ws.prefs.automationOn);
      Object.entries(ws.events ?? {}).forEach(([k, v]) => { const s = new MatchEventStore(k.split(":").slice(1).join(":")); s.restore(v as ReturnType<MatchEventStore["serialize"]>); stores.current.set(k, s); });
      setLoaded(true);
    });
    return () => { alive = false; };
  }, [engine]);
  const persist = useCallback((patch: Partial<ProductionWorkspace> = {}) => {
    if (!loaded) return;
    const ev: Record<string, unknown> = {};
    stores.current.forEach((s, k) => { ev[k] = s.serialize(); });
    saveWorkspace({ version: 1, savedAt: 0, rundowns, automation: engine.serialize(), events: ev, prefs: { rundownMode, automationOn }, ...patch });
  }, [loaded, rundowns, engine, rundownMode, automationOn]);
  useEffect(() => { persist(); }, [persist, engineState.history.length]);

  // ---------------------------------------------------------------- automation engine wiring
  useEffect(() => engine.subscribe(setEngineState), [engine]);
  const internalExecutors = useMemo<Record<string, Executor>>(() => ({
    "rundown:phase": async (task) => {
      const p = task.action.params?.phase as Phase;
      setPhaseOverride(null);
      if (matchKey) setRundowns((all) => ({ ...all, [matchKey]: startPhase(all[matchKey] ?? [], p, Date.now()) }));
      if (matchKey) phaseStarted.current[`${matchKey}:${p}`] = true;
      return `Escaleta → ${p === "post" ? "Postpartido" : p === "live" ? "En vivo" : "Previa"}`;
    },
    "poll:launch": async (task) => {
      const m = o.current.match;
      const snap = snapshotRef.current;
      if (!m || !snap) throw new Error("Sin partido activo");
      const scorers = eventsRef.current.filter((e) => e.status === "confirmed" && (e.type === "goal" || e.type === "penalty-goal") && e.player).map((e) => e.player!.name);
      const poll = pollFromTemplate((task.action.params?.template as PollTemplate) ?? "who-wins", { home: snap.home.name, away: snap.away.name, scorers });
      if (!poll) throw new Error("No hay suficientes jugadores reales para esa encuesta");
      const created = await createMatchPoll(m.league, m.id, poll);
      setPolls((cur) => [created, ...cur]);
      await o.current.executors["poll:air"]?.({ ...task, action: { ...task.action, params: { pollId: created.id } } });
      return `Encuesta abierta: ${created.question}`;
    },
  }), [matchKey]);
  useEffect(() => { engine.setExecutors({ ...opts.executors, ...internalExecutors }); });
  useEffect(() => {
    const t = window.setInterval(() => { if (o.current.active) void engine.tick(); }, 1000);
    return () => window.clearInterval(t);
  }, [engine]);
  const setAutomationOn = (on: boolean) => { setAutomationOnState(on); if (on) engine.resume(); else engine.pause(); };
  useEffect(() => { if (loaded) { if (automationOn) engine.resume(); else engine.pause(); } }, [loaded, automationOn, engine]);

  // ---------------------------------------------------------------- sports feed (active match)
  const snapshotRef = useRef(snapshot); snapshotRef.current = snapshot;
  const eventsRef = useRef(events); eventsRef.current = events;
  useEffect(() => {
    const m = opts.match;
    if (!opts.active || !m) { setSnapshot(null); setEvents([]); setFreshness("unavailable"); return; }
    const k = keyOf(m);
    let store = stores.current.get(k);
    if (!store) { store = new MatchEventStore(m.id); stores.current.set(k, store); }
    const s = store;
    setSnapshot(s.getSnapshot()); setEvents(s.getEvents()); setFreshness(s.freshness(Date.now()));
    let alive = true;
    const read = async () => {
      try {
        const res = await fetch(`/api/matches/${encodeURIComponent(m.league)}/${encodeURIComponent(m.id)}`);
        if (!res.ok) throw new Error(`Fuente sin respuesta (HTTP ${res.status})`);
        const detail = await res.json() as SourceDetail;
        if (!alive) return;
        const now = Date.now();
        const r = s.ingest(detail, now);
        setFeedError(null);
        setLastOk(now);
        for (const ev of r.confirmed) {
          if (ev.baseline) continue; // history at the first read: shown in the monitor, never aired late
          const label = `${EVENT_LABEL[ev.type]}${ev.player ? ` · ${ev.player.name}` : ""}${ev.minute ? ` ${ev.minute}` : ""}`;
          engine.ingest(ev.type, ev, { activeMatchId: m.id }, label);
        }
        for (const ev of r.retracted) { o.current.onRetracted?.(ev); o.current.notify?.(`Evento retirado por la fuente: ${EVENT_LABEL[ev.type]} ${ev.minute}`); }
      } catch (err) {
        s.markFailure(Date.now());
        if (alive) setFeedError(err instanceof Error ? err.message : "Fuente sin respuesta");
      }
      if (!alive) return;
      setSnapshot(s.getSnapshot()); setEvents(s.getEvents()); setFreshness(s.freshness(Date.now()));
    };
    void read();
    const t = window.setInterval(() => void read(), FEED_MS);
    const f = window.setInterval(() => setFreshness(s.freshness(Date.now())), 5000);
    return () => { alive = false; window.clearInterval(t); window.clearInterval(f); };
  }, [opts.active, matchKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------- secondary matches (selected live ones)
  const [followTick, setFollowTick] = useState(0);
  const followKey = (opts.follow ?? []).map(keyOf).filter((k) => k !== matchKey).join(",");
  useEffect(() => {
    const refs = (o.current.follow ?? []).filter((r) => keyOf(r) !== matchKey);
    if (!opts.active || !refs.length) return;
    let alive = true;
    const read = async () => {
      await Promise.all(refs.map(async (r) => {
        const k = keyOf(r);
        let s = stores.current.get(k);
        if (!s) { s = new MatchEventStore(r.id); stores.current.set(k, s); }
        try {
          const res = await fetch(`/api/matches/${encodeURIComponent(r.league)}/${encodeURIComponent(r.id)}`);
          if (!res.ok) throw new Error(String(res.status));
          s.ingest(await res.json() as SourceDetail, Date.now());
        } catch { s.markFailure(Date.now()); }
      }));
      if (alive) setFollowTick((t) => t + 1);
    };
    void read();
    const t = window.setInterval(() => void read(), FEED_MS);
    return () => { alive = false; window.clearInterval(t); };
  }, [opts.active, followKey, matchKey]); // eslint-disable-line react-hooks/exhaustive-deps

  /** One timeline for the main match + the selected live matches; finished matches go to history. */
  const timeline = useMemo(() => {
    const keys = [...new Set([...(matchKey ? [matchKey] : []), ...(opts.follow ?? []).map(keyOf)])];
    const sources = keys.map((k) => stores.current.get(k)).filter((s): s is MatchEventStore => Boolean(s)).map((s) => {
      const snap = s.getSnapshot();
      return {
        match: { matchId: s.matchId, league: snap?.league ?? "", label: snap ? `${snap.home.short} vs ${snap.away.short}` : s.matchId, homeLogo: snap?.home.logo, awayLogo: snap?.away.logo, kickoff: snap?.kickoff, finished: snap?.state === "post" },
        events: s.getEvents(),
      };
    });
    return { ...mergeTimeline(sources), matches: sources.map((x) => x.match) };
  }, [matchKey, followKey, followTick, events]); // eslint-disable-line react-hooks/exhaustive-deps

  // standings available for this match?
  useEffect(() => {
    const m = opts.match;
    setHasStandings(false);
    if (!m) return;
    void fetch(`/api/football/table?league=${encodeURIComponent(m.league)}&event=${encodeURIComponent(m.id)}`).then((r) => r.ok ? r.json() : null).then((b) => setHasStandings(Boolean(b?.available))).catch(() => undefined);
  }, [matchKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------- rundown
  const ctx = useMemo<RundownContext | null>(() => snapshot ? {
    kickoff: snapshot.kickoff ? new Date(snapshot.kickoff).getTime() : null, state: snapshot.state, lineupsAvailable: snapshot.lineupsAvailable,
    hasStats: snapshot.stats.length > 0, hasStandings, hasInsights: true, pollOpen: polls.some((p) => p.status === "open"),
    homeName: snapshot.home.name, awayName: snapshot.away.name, competition: snapshot.leagueName,
  } : null, [snapshot, hasStandings, polls]);
  const setBlocks = useCallback((fn: (b: Block[]) => Block[]) => { if (matchKey) setRundowns((all) => ({ ...all, [matchKey]: fn(all[matchKey] ?? []) })); }, [matchKey]);
  // generate once per match (kept if it was saved), then keep readiness in sync with the real data
  useEffect(() => {
    if (!matchKey || !ctx || !loaded) return;
    setRundowns((all) => ({ ...all, [matchKey]: all[matchKey]?.length ? evaluate(all[matchKey], ctx) : generateRundown(ctx) }));
  }, [matchKey, ctx, loaded]);
  // phase start (live / post) schedules its blocks
  useEffect(() => {
    if (!matchKey || !ctx || phase === "pre") return;
    const k = `${matchKey}:${phase}`;
    if (phaseStarted.current[k]) return;
    phaseStarted.current[k] = true;
    setBlocks((b) => startPhase(b, phase, Date.now()));
  }, [phase, matchKey, ctx, setBlocks]);

  const runBlock = useCallback((block: Block) => {
    setBlocks((b) => setStatus(b, block.id, "on-air"));
    startedAt.current[block.id] = Date.now();
    const label = `block:${block.id}`;
    const a = block.action;
    if (a.type === "graphics") a.variants.forEach((v) => engine.enqueueManual({ kind: `graphic:${v}`, label: `${block.name}`, params: { seconds: a.seconds, blockId: block.id } }, label));
    else if (a.type === "scene") engine.enqueueManual({ kind: "scene", label: block.name, params: { scene: a.scene, graphics: a.graphics } }, label);
    else if (a.type === "poll") engine.enqueueManual({ kind: "poll:launch", label: block.name, params: { template: a.template } }, label);
    else if (a.type === "show") engine.enqueueManual({ kind: "show:recap", label: block.name }, label);
  }, [engine, setBlocks]);
  // block errors come from failed tasks of that block
  useEffect(() => {
    const failed = engineState.history.filter((t) => t.status === "failed" && t.eventLabel.startsWith("block:"));
    if (!failed.length) return;
    setBlocks((b) => b.map((x) => { const f = failed.find((t) => t.eventLabel === `block:${x.id}`); return f && x.status === "on-air" ? { ...x, status: "error", error: f.error } : x; }));
  }, [engineState.history, setBlocks]);
  // runner
  const blocksRef = useRef(blocks); blocksRef.current = blocks;
  useEffect(() => {
    const t = window.setInterval(() => {
      if (!o.current.active) return;
      const step = runnerStep(blocksRef.current, phase, Date.now(), rundownMode, startedAt.current);
      if (step.finish?.length) setBlocks((b) => b.map((x) => (step.finish!.some((f) => f.id === x.id) ? { ...x, status: "done" } : x)));
      if (step.start && automationOn) runBlock(step.start);
    }, 1000);
    return () => window.clearInterval(t);
  }, [phase, rundownMode, automationOn, runBlock, setBlocks]);

  const rundownApi = {
    run: runBlock,
    skip: (id: string) => setBlocks((b) => setStatus(b, id, "skipped")),
    done: (id: string) => setBlocks((b) => setStatus(b, id, "done")),
    repeat: (id: string) => setBlocks((b) => repeat(b, id)),
    remove: (id: string) => setBlocks((b) => remove(b, id)),
    move: (from: number, to: number) => setBlocks((b) => reorder(b, from, to)),
    add: (name: string, p: Phase, variant: string, seconds = 15) => setBlocks((b) => [...b, custom(name, p, { type: "graphics", variants: [variant], seconds }, seconds)]),
    regenerate: () => { if (ctx) setBlocks(() => (ctx ? generateRundown(ctx) : [])); },
    next: () => { const nb = blocksRef.current.find((b) => b.phase === phase && b.status === "ready"); if (nb) runBlock(nb); },
    setMode: (m: "auto" | "manual") => setRundownModeState(m),
    setPhase: (p: Phase | null) => setPhaseOverride(p),
  };

  // ---------------------------------------------------------------- audience
  const refreshAudience = useCallback(async () => {
    const m = o.current.match;
    if (!m) { setPolls([]); setMessages([]); return; }
    try {
      const ps = await listMatchPolls(m.league, m.id);
      setPolls(ps);
      try { setMessages(await listAudienceMessages(ps.map((p) => p.id))); setAudienceError(null); }
      catch (err) { setAudienceError(err instanceof Error ? err.message : "Mensajes no disponibles"); }
    } catch (err) { setAudienceError(err instanceof Error ? err.message : "Votaciones no disponibles"); }
  }, []);
  useEffect(() => {
    if (!opts.active) return;
    void refreshAudience();
    const t = window.setInterval(() => void refreshAudience(), 15_000);
    return () => window.clearInterval(t);
  }, [opts.active, matchKey, refreshAudience]);
  const audienceApi = {
    launch: (template: PollTemplate) => engine.enqueueManual({ kind: "poll:launch", label: "Encuesta del operador", params: { template } }, "operador"),
    close: async (id: string) => { await setPollStatus(id, "closed"); await refreshAudience(); },
    moderate: async (id: string, status: "visible" | "hidden") => { await moderate(id, status); await refreshAudience(); },
    refresh: refreshAudience,
  };

  // ---------------------------------------------------------------- remote control
  const transport = useRef<Transport | null>(null);
  const [transportLabel, setTransportLabel] = useState("");
  const controlState = useCallback((): ControlState => {
    const studio = o.current.studioState();
    const snap = snapshotRef.current;
    const st = engine.getState();
    return {
      at: Date.now(), studio: studioId, ...studio, phase,
      match: snap ? { home: snap.home.name, away: snap.away.name, score: `${snap.home.score}-${snap.away.score}`, status: snap.statusText || snap.state, freshness: freshnessRef.current } : null,
      rundown: blocksRef.current.filter((b) => b.phase === phase).slice(0, 14).map((b) => ({ id: b.id, name: b.name, status: b.status, phase: b.phase, time: b.scheduledAt ? new Date(b.scheduledAt).toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" }) : "" })),
      rundownMode,
      automation: { paused: st.paused, awaiting: st.tasks.filter((t) => t.status === "awaiting-approval").map((t) => ({ id: t.id, label: t.action.label, rule: t.ruleLabel })), running: st.tasks.find((t) => t.status === "running")?.action.label ?? null, last: st.history[0] ? `${st.history[0].action.label} · ${({ done: "hecho", failed: "falló", rejected: "descartado", expired: "caducó", cancelled: "cancelado" } as Record<string, string>)[st.history[0].status] ?? st.history[0].status}` : null },
      events: eventsRef.current.slice(-12).reverse().map((e) => ({ id: e.id, label: `${e.minute} ${EVENT_LABEL[e.type]}${e.player ? ` · ${e.player.name}` : ""}`, status: e.status })),
      polls: pollsRef.current.slice(0, 4).map((p) => ({ id: p.id, question: p.question, status: p.status, total: p.total, options: p.options.map((x) => ({ label: x.label, votes: x.votes })) })),
      alerts: [feedErrorRef.current, freshnessRef.current === "stale" ? "Datos desactualizados: la fuente no responde" : null, st.history.find((t) => t.status === "failed")?.error ? `Falló: ${st.history.find((t) => t.status === "failed")!.action.label}` : null].filter(Boolean) as string[],
    };
  }, [engine, phase, rundownMode, studioId]);
  const freshnessRef = useRef(freshness); freshnessRef.current = freshness;
  const feedErrorRef = useRef(feedError); feedErrorRef.current = feedError;
  const pollsRef = useRef(polls); pollsRef.current = polls;

  const dispatch = useCallback((cmd: ControlCommand) => {
    if (cmd.type === "automation") {
      if (cmd.op === "approve" && cmd.taskId) engine.approve(cmd.taskId);
      else if (cmd.op === "reject" && cmd.taskId) engine.reject(cmd.taskId);
      else if (cmd.op === "pause") setAutomationOn(false);
      else if (cmd.op === "resume") setAutomationOn(true);
      return;
    }
    if (cmd.type === "rundown") {
      const b = blocksRef.current.find((x) => x.id === cmd.blockId);
      if (cmd.op === "run" && b) runBlock(b);
      else if (cmd.op === "skip" && b) rundownApi.skip(b.id);
      else if (cmd.op === "next") rundownApi.next();
      else if (cmd.op === "mode" && cmd.mode) setRundownModeState(cmd.mode);
      return;
    }
    if (cmd.type === "poll" && cmd.op === "launch") { audienceApi.launch(cmd.template); return; }
    if (cmd.type === "poll" && cmd.op === "close") { void audienceApi.close(cmd.pollId); return; }
    o.current.onStudioCommand(cmd);
  }, [engine, runBlock]); // eslint-disable-line react-hooks/exhaustive-deps
  const dispatchRef = useRef(dispatch); dispatchRef.current = dispatch;
  useEffect(() => {
    let closed = false;
    let off = () => {};
    void createTransport().then((t) => {
      if (closed) { t.close(); return; }
      transport.current = t;
      setTransportLabel(t.label);
      off = t.subscribe("command", (payload) => { const cmd = commandFor(payload, studioId); if (o.current.active && cmd) dispatchRef.current(cmd); });
    });
    return () => { closed = true; off(); transport.current?.close(); transport.current = null; };
  }, [studioId]);
  useEffect(() => {
    const t = window.setInterval(() => { if (o.current.active) transport.current?.publish("state", controlState()); }, 1500);
    return () => window.clearInterval(t);
  }, [controlState]);

  return {
    snapshot, events, freshness, feedError, lastOk, timeline,
    engineState, rules: engine.getRules(), setRuleMode: (id: string, m: RuleMode) => engine.setMode(id, m),
    approve: (id: string) => engine.approve(id), reject: (id: string) => engine.reject(id), cancel: (id: string) => engine.cancel(id),
    automationOn, setAutomationOn,
    blocks, phase, phaseOverride, rundownMode, rundown: rundownApi,
    polls, messages, audienceError, audience: audienceApi,
    transportLabel, controlState, dispatch, studioId,
  };
}
export type Production = ReturnType<typeof useProduction>;

/** Phone / other tab: the studio's latest state and a way to send commands. */
export function useRemoteStudio(enabled: boolean, selfId = "") {
  const [state, setState] = useState<ControlState | null>(null);
  const [label, setLabel] = useState("");
  const t = useRef<Transport | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let closed = false;
    let off = () => {};
    void createTransport().then((tr) => {
      if (closed) { tr.close(); return; }
      t.current = tr;
      setLabel(tr.label);
      off = tr.subscribe("state", (p) => { const s = p as ControlState; if (s?.studio && s.studio !== selfId) setState(s); });
    });
    return () => { closed = true; off(); t.current?.close(); t.current = null; };
  }, [enabled, selfId]);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const i = window.setInterval(() => setNow(Date.now()), 2000); return () => window.clearInterval(i); }, []);
  return { state, connected: Boolean(state && now - state.at < 6000), label, send: (cmd: ControlCommand) => { if (state) t.current?.publish("command", { to: state.studio, cmd }); } };
}
