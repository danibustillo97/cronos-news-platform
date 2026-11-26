import { describe, expect, it } from "vitest";
import real from "../football/__fixtures__/ucl-detail.json";
import { MatchEventStore, type SourceDetail } from "./sportsEvents";

const detail = real as unknown as SourceDetail;
const live = (events: SourceDetail["events"], extra: Partial<SourceDetail> = {}): SourceDetail => ({ ...detail, state: "in", period: 1, statusText: "30'", events, ...extra });

describe("Sports Event Engine", () => {
  it("normalizes a real match: goals, cards and subs with team, player, minute and source", () => {
    const store = new MatchEventStore(detail.id);
    store.ingest(detail, 0);
    const evs = store.getEvents();
    const goals = evs.filter((e) => e.type === "goal");
    expect(goals.map((g) => g.minute)).toEqual(["31'", "51'", "55'", "60'", "63'"]);
    expect(goals[0]).toMatchObject({ team: "away", player: { name: "Anthony Gordon" }, source: "espn", matchId: detail.id, status: "pending", confidence: 0.5 });
    expect(evs.find((e) => e.type === "sub" && e.minute === "86'")?.playerOut).toBe("Gavi");
    expect(evs.some((e) => e.type === "full-time")).toBe(true);
  });

  it("marks what already happened at the first read as history (no late automation)", () => {
    const store = new MatchEventStore(detail.id);
    const [g1, g2] = detail.events!.filter((e) => e.type === "goal");
    store.ingest(live([g1]), 0);
    store.ingest(live([g1, g2]), 15000);
    store.ingest(live([g1, g2]), 30000);
    const evs = store.getEvents();
    expect(evs.find((e) => e.id === g1.id)).toMatchObject({ status: "confirmed", baseline: true });
    expect(evs.find((e) => e.id === g2.id)).toMatchObject({ status: "confirmed", baseline: false });
  });

  it("confirms an event only after a second read (never air pending data)", () => {
    const store = new MatchEventStore(detail.id);
    store.ingest(live([]), 0); // the studio was already following the match
    const goal = detail.events!.find((e) => e.type === "goal")!;
    const r1 = store.ingest(live([goal]), 1000);
    expect(r1.confirmed.filter((e) => e.type === "goal")).toHaveLength(0);
    expect(r1.pending.map((e) => e.id)).toContain(goal.id);
    const r2 = store.ingest(live([goal]), 16000);
    expect(r2.confirmed.filter((e) => e.type === "goal").map((e) => e.id)).toEqual([goal.id]);
    const r3 = store.ingest(live([goal]), 31000);
    expect(r3.confirmed).toHaveLength(0); // dedupe: confirmed once
  });

  it("retracts an event the source drops in two consecutive reads (goal disallowed)", () => {
    const store = new MatchEventStore(detail.id);
    const goal = detail.events!.find((e) => e.type === "goal")!;
    store.ingest(live([goal]), 0);
    store.ingest(live([goal]), 15000);
    expect(store.ingest(live([]), 30000).retracted).toHaveLength(0); // one miss is not enough
    const r = store.ingest(live([]), 45000);
    expect(r.retracted.map((e) => e.id)).toEqual([goal.id]);
    expect(store.getEvents().find((e) => e.id === goal.id)?.status).toBe("retracted");
    expect(store.ingest(live([goal]), 60000).confirmed).toHaveLength(0); // a retraction is final for that id
  });

  it("derives phase events: line-ups, kickoff, half-time, second half and full-time", () => {
    const store = new MatchEventStore(detail.id);
    store.ingest({ ...detail, state: "pre", events: [], lineups: { home: [1], away: [1] } }, 0);
    store.ingest({ ...detail, state: "pre", events: [], lineups: { home: [1], away: [1] } }, 15000);
    expect(store.getEvents().find((e) => e.type === "lineups")?.status).toBe("confirmed");
    store.ingest(live([], { statusText: "Halftime", period: 1 }), 30000);
    const ht = store.ingest(live([], { statusText: "Halftime", period: 1 }), 45000);
    expect(ht.confirmed.map((e) => e.type).sort()).toEqual(["half-time", "kickoff"]);
    store.ingest({ ...detail, state: "post", events: [] }, 60000);
    const ft = store.ingest({ ...detail, state: "post", events: [] }, 75000);
    expect(ft.confirmed.map((e) => e.type)).toContain("full-time");
  });

  it("marks data stale when the source stops answering and recovers without duplicating events (scenario H)", () => {
    const store = new MatchEventStore(detail.id, { staleAfterMs: 45000 });
    expect(store.freshness(0)).toBe("unavailable");
    const goal = detail.events!.find((e) => e.type === "goal")!;
    store.ingest(live([goal]), 0);
    store.ingest(live([goal]), 15000);
    expect(store.freshness(20000)).toBe("fresh");
    store.markFailure(30000); // source down
    expect(store.freshness(31000)).toBe("stale");
    expect(store.dataState(31000)).toBe("stale");
    expect(store.freshness(15000 + 46000)).toBe("stale");
    // recovery: same goal + a new one
    const second = detail.events!.filter((e) => e.type === "goal")[1];
    const r1 = store.ingest(live([goal, second]), 90000);
    const r2 = store.ingest(live([goal, second]), 105000);
    expect([...r1.confirmed, ...r2.confirmed].map((e) => e.id)).toEqual([second.id]);
    expect(store.freshness(106000)).toBe("fresh");
  });

  it("survives a page reload without re-emitting confirmed events", () => {
    const a = new MatchEventStore(detail.id);
    const goal = detail.events!.find((e) => e.type === "goal")!;
    a.ingest(live([goal]), 0);
    a.ingest(live([goal]), 15000);
    const b = new MatchEventStore(detail.id);
    b.restore(JSON.parse(JSON.stringify(a.serialize())));
    expect(b.freshness(16000)).toBe("unavailable");
    expect(b.ingest(live([goal]), 30000).confirmed).toHaveLength(0);
  });
});
