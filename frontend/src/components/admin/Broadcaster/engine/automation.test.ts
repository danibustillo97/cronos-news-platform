import { describe, expect, it, vi } from "vitest";
import { AutomationEngine, defaultRules, type Rule } from "./automation";
import type { SportsEvent } from "./sportsEvents";

const ev = (over: Partial<SportsEvent> = {}): SportsEvent => ({
  id: "e1", matchId: "m1", league: "uefa.champions", type: "goal", team: "home", player: { id: "p1", name: "Díaz" }, minute: "23'", minuteValue: 23,
  source: "espn", firstSeen: 0, lastSeen: 0, observations: 2, misses: 0, status: "confirmed", confidence: 1, ...over,
});
const ctx = { activeMatchId: "m1" };

function setup(rules: Rule[], executors: Record<string, () => Promise<string | void>> = {}) {
  let t = 0;
  const engine = new AutomationEngine(rules, executors, { now: () => t, backoffMs: 1000 });
  return { engine, advance: (ms: number) => { t += ms; }, at: () => t };
}

describe("Automation Engine", () => {
  it("runs a confirmed goal end to end and never twice (scenario C)", async () => {
    const goal = vi.fn(async () => "Tarjeta de gol al aire");
    const scorer = vi.fn(async () => "Ficha");
    const { engine, advance } = setup(defaultRules(), { "graphic:goal": goal, "graphic:scorer": scorer });
    const created = engine.ingest("goal", ev(), ctx);
    expect(created.map((t) => [t.action.kind, t.status])).toEqual([
      ["graphic:goal", "queued"], ["graphic:scorer", "queued"], ["graphic:timeline", "awaiting-approval"], ["poll:launch", "awaiting-approval"],
    ]);
    await engine.tick();
    expect(goal).toHaveBeenCalledOnce();
    await engine.tick(); // scorer waits its delay
    expect(scorer).not.toHaveBeenCalled();
    advance(14_000);
    await engine.tick();
    expect(scorer).toHaveBeenCalledOnce();
    expect(engine.ingest("goal", ev(), ctx)).toHaveLength(0); // dedupe
    expect(engine.getState().history.map((h) => h.status)).toEqual(["done", "done"]);
  });

  it("ignores unconfirmed or retracted events and other matches", () => {
    const { engine } = setup(defaultRules());
    expect(engine.ingest("goal", ev({ status: "pending" }), ctx)).toHaveLength(0);
    expect(engine.ingest("goal", ev({ status: "retracted" }), ctx)).toHaveLength(0);
    expect(engine.ingest("goal", ev({ matchId: "other" }), ctx)).toHaveLength(0);
  });

  it("waits for approval, expires stale proposals, rejects and cancels", async () => {
    const timeline = vi.fn(async () => undefined);
    const { engine, advance } = setup(defaultRules(), { "graphic:goal": async () => undefined, "graphic:scorer": async () => undefined, "graphic:timeline": timeline, "poll:launch": async () => undefined });
    const tasks = engine.ingest("goal", ev(), ctx);
    const tl = tasks.find((t) => t.action.kind === "graphic:timeline")!;
    const poll = tasks.find((t) => t.action.kind === "poll:launch")!;
    engine.approve(tl.id);
    await engine.tick(); await engine.tick(); // goal, then the approved timeline (higher priority first)
    expect(timeline).toHaveBeenCalledOnce();
    engine.reject(poll.id);
    expect(engine.getState().history.find((h) => h.id === poll.id)?.status).toBe("rejected");
    const again = engine.ingest("goal", ev({ id: "e2" }), ctx).find((t) => t.action.kind === "graphic:timeline")!;
    advance(300_000);
    await engine.tick();
    expect(engine.getState().history.find((h) => h.id === again.id)?.status).toBe("expired");
  });

  it("retries with backoff and records the failure", async () => {
    const flaky = vi.fn().mockRejectedValueOnce(new Error("sin datos")).mockResolvedValueOnce("ok");
    const { engine, advance } = setup([{ id: "r", label: "r", on: ["yellow"], mode: "auto", priority: 1, actions: [{ kind: "x", label: "x" }] }], { x: flaky });
    engine.ingest("yellow", ev({ type: "yellow" }), ctx);
    await engine.tick();
    expect(engine.getState().tasks[0]).toMatchObject({ status: "queued", attempts: 1, error: "sin datos" });
    await engine.tick(); // backoff not elapsed
    expect(flaky).toHaveBeenCalledTimes(1);
    advance(1000);
    await engine.tick();
    expect(engine.getState().history[0]).toMatchObject({ status: "done", attempts: 2 });
  });

  it("pause stops execution, resume continues; manual mode creates nothing", async () => {
    const exec = vi.fn(async () => undefined);
    const rules: Rule[] = [{ id: "r", label: "r", on: ["sub"], mode: "auto", priority: 1, actions: [{ kind: "x", label: "x" }] }];
    const { engine } = setup(rules, { x: exec });
    engine.pause();
    engine.ingest("sub", ev({ type: "sub", id: "s1" }), ctx);
    await engine.tick();
    expect(exec).not.toHaveBeenCalled();
    engine.resume();
    await engine.tick();
    expect(exec).toHaveBeenCalledOnce();
    engine.setMode("r", "manual");
    expect(engine.ingest("sub", ev({ type: "sub", id: "s2" }), ctx)).toHaveLength(0);
  });

  it("full-time switches the rundown to post-match automatically (scenario F)", async () => {
    const phase = vi.fn(async () => undefined);
    const { engine, advance } = setup(defaultRules(), { "graphic:result": async () => undefined, "rundown:phase": phase });
    engine.ingest("full-time", ev({ id: "m1:full-time", type: "full-time" }), ctx);
    await engine.tick();
    advance(5000);
    await engine.tick();
    expect(phase).toHaveBeenCalledOnce();
    expect(engine.getState().tasks.some((t) => t.action.kind === "poll:launch" && t.status === "awaiting-approval")).toBe(true);
  });

  it("persists dedupe and modes across sessions", () => {
    const a = setup(defaultRules()).engine;
    a.ingest("goal", ev(), ctx);
    a.setMode("yellow", "manual");
    const b = setup(defaultRules()).engine;
    b.restore(JSON.parse(JSON.stringify(a.serialize())));
    expect(b.ingest("goal", ev(), ctx)).toHaveLength(0);
    expect(b.getRules().find((r) => r.id === "yellow")?.mode).toBe("manual");
  });
});
