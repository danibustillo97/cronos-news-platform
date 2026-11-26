import { describe, expect, it } from "vitest";
import { custom, evaluate, generateRundown, nextBlock, remove, reorder, repeat, runnerStep, setStatus, startPhase, type RundownContext } from "./rundown";

const KO = Date.UTC(2026, 10, 27, 23, 35);
const ctx = (over: Partial<RundownContext> = {}): RundownContext => ({
  kickoff: KO, state: "pre", lineupsAvailable: false, hasStats: false, hasStandings: true, hasInsights: true, pollOpen: false,
  homeName: "Deportivo Cali", awayName: "Atlético Bucaramanga", competition: "Liga BetPlay", ...over,
});

describe("Matchday Rundown", () => {
  it("generates pre / live / post from the real match context (scenario A)", () => {
    const r = generateRundown(ctx());
    expect(new Set(r.map((b) => b.phase))).toEqual(new Set(["pre", "live", "post"]));
    expect(r[1].name).toBe("Identificación · Deportivo Cali vs Atlético Bucaramanga");
    expect(r.find((b) => b.kind === "opening")?.scheduledAt).toBe(KO - 30 * 60_000);
    // no line-ups yet → that block (and the duel that depends on it) waits, never airs invented data
    expect(r.find((b) => b.kind === "lineups")?.status).toBe("pending");
    expect(r.find((b) => b.kind === "key-players")?.status).toBe("pending");
    expect(r.find((b) => b.kind === "match-id")?.status).toBe("ready");
    expect(r.filter((b) => b.phase === "post").every((b) => b.status === "pending")).toBe(true);
  });

  it("blocks become ready when their data arrives", () => {
    const r = evaluate(generateRundown(ctx()), ctx({ lineupsAvailable: true }));
    expect(r.find((b) => b.kind === "lineups")?.status).toBe("ready");
    const post = evaluate(r, ctx({ state: "post", hasStats: true }));
    expect(post.find((b) => b.kind === "final")?.status).toBe("ready");
  });

  it("edits: reorder, remove (cleans dependencies), repeat, custom block", () => {
    let r = generateRundown(ctx());
    const lu = r.find((b) => b.kind === "lineups")!;
    r = remove(r, lu.id);
    expect(r.find((b) => b.kind === "key-players")?.dependsOn).toEqual([]);
    const first = r[0].id;
    r = reorder(r, 0, 2);
    expect(r[2].id).toBe(first);
    const before = r.length;
    r = repeat(r, first);
    expect(r.length).toBe(before + 1);
    expect(r[3].name).toContain("(repetición)");
    const c = custom("Mensaje del patrocinador", "live", { type: "graphics", variants: ["ad"] });
    expect(c.status).toBe("ready");
  });

  it("auto runner starts due ready blocks in order and finishes them after their duration (scenario B)", () => {
    let r = generateRundown(ctx());
    const started: Record<string, number> = {};
    // 30 minutes before kick-off: the opening is due
    const s1 = runnerStep(r, "pre", KO - 30 * 60_000, "auto", started);
    expect(s1.start?.kind).toBe("opening");
    r = setStatus(r, s1.start!.id, "on-air");
    started[s1.start!.id] = KO - 30 * 60_000;
    expect(runnerStep(r, "pre", KO - 29.9 * 60_000, "auto", started).start).toBeUndefined(); // one at a time
    const s2 = runnerStep(r, "pre", KO - 28 * 60_000, "auto", started);
    expect(s2.finish?.map((b) => b.kind)).toEqual(["opening"]);
    // manual mode never starts by itself
    r = setStatus(r, s1.start!.id, "done");
    expect(runnerStep(r, "pre", KO, "manual", started).start).toBeUndefined();
    expect(nextBlock(r, "pre")?.kind).toBe("match-id");
  });

  it("live and post blocks get their time when the phase starts (scenario F)", () => {
    let r = evaluate(generateRundown(ctx()), ctx({ state: "post", hasStats: true }));
    const ft = KO + 115 * 60_000;
    r = startPhase(r, "post", ft);
    expect(r.find((b) => b.kind === "final")?.scheduledAt).toBe(ft);
    expect(runnerStep(r, "post", ft, "auto", {}).start?.kind).toBe("final");
  });
});
