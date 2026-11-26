import { describe, expect, it } from "vitest";
import real from "../football/__fixtures__/ucl-detail.json";
import { toMultiScores, type BoardMatch } from "../football/liveBoard";
import { bogotaDay, bogotaYmd, checkTake, classify, graphicAllowed, liveEligible, liveLabel, normalizeStatus, reconcile, type CenterMatch } from "./matchStatus";
import { clear, deselect, move, prune, select, selectAll, setActive, toggle, type SelectionState } from "./matchSelection";
import { MatchEventStore, mergeTimeline, type SourceDetail } from "./sportsEvents";

// 26-nov-2026 15:00 in Colombia (20:00 UTC)
const NOW = Date.UTC(2026, 10, 26, 20, 0);
const m = (id: string, kickoff: string, status: CenterMatch["status"], over: Partial<CenterMatch> = {}): CenterMatch => ({
  id, league: "col.1", leagueName: "BetPlay", kickoff, status, statusName: "", detail: "", clock: "", period: 0,
  home: { id: "h", name: `H${id}`, short: "H", score: 0 }, away: { id: "a", name: `A${id}`, short: "A", score: 0 }, seenAt: NOW, missing: 0, stale: false, ...over,
});

describe("Live Match Engine — states, days, eligibility (required cases)", () => {
  it("maps the provider's real states", () => {
    expect(normalizeStatus({ name: "STATUS_FIRST_HALF", state: "in" })).toBe("LIVE");
    expect(normalizeStatus({ name: "STATUS_HALFTIME", state: "in" })).toBe("HT");
    expect(normalizeStatus({ name: "STATUS_END_PERIOD", state: "in" })).toBe("BREAK");
    expect(normalizeStatus({ name: "STATUS_FULL_TIME", state: "post", completed: true })).toBe("FINISHED");
    expect(normalizeStatus({ name: "STATUS_POSTPONED", state: "post" })).toBe("POSTPONED");
    expect(normalizeStatus({ name: "STATUS_CANCELED", state: "post" })).toBe("CANCELLED");
    expect(normalizeStatus({ name: "STATUS_SCHEDULED", state: "pre" })).toBe("SCHEDULED");
    expect(normalizeStatus({ name: "STATUS_WEIRD" })).toBe("UNKNOWN");
    expect(normalizeStatus({ state: "post", completed: false })).toBe("UNKNOWN"); // a score alone never means anything
  });

  it("1 · a finished match from yesterday never appears in EN VIVO", () => {
    const c = classify([m("y", "2026-11-25T20:00Z", "FINISHED")], NOW);
    expect(c.live).toHaveLength(0);
    expect(c.previous.map((x) => x.id)).toEqual(["y"]);
  });
  it("2 · a scheduled match appears in PRÓXIMOS", () => {
    expect(classify([m("s", "2026-11-26T23:35Z", "SCHEDULED")], NOW).upcoming.map((x) => x.id)).toEqual(["s"]);
  });
  it("3 · a match being played appears in EN VIVO", () => {
    expect(classify([m("l", "2026-11-26T19:00Z", "LIVE")], NOW).live.map((x) => x.id)).toEqual(["l"]);
  });
  it("4 · a match at half-time stays eligible and shows DESCANSO (no running clock)", () => {
    const ht = m("h", "2026-11-26T19:00Z", "HT", { clock: "45:00" });
    expect(classify([ht], NOW).live).toHaveLength(1);
    expect(liveEligible(ht)).toBe(true);
    expect(liveLabel(ht)).toBe("DESCANSO");
  });
  it("5 · a match that finishes leaves EN VIVO", () => {
    const before = classify([m("x", "2026-11-26T18:00Z", "LIVE")], NOW);
    const after = classify([m("x", "2026-11-26T18:00Z", "FINISHED")], NOW);
    expect(before.live).toHaveLength(1);
    expect(after.live).toHaveLength(0);
    expect(after.finishedToday.map((x) => x.id)).toEqual(["x"]);
  });
  it("11 · Colombia's time zone defines the day (not UTC, not the device)", () => {
    // 27-nov 01:40 UTC is still 26-nov 20:40 in Bogotá
    expect(bogotaDay("2026-11-27T01:40:00Z")).toBe("2026-11-26");
    expect(classify([m("n", "2026-11-27T01:40Z", "SCHEDULED")], NOW).upcoming).toHaveLength(1);
    // 23:30 in Bogotá on the 25th is already the 26th in UTC — it is yesterday here
    expect(classify([m("o", "2026-11-26T04:30Z", "FINISHED")], NOW).previous).toHaveLength(1);
    expect(bogotaYmd(NOW)).toBe("20261126");
    expect(bogotaYmd(Date.UTC(2026, 10, 27, 3, 0))).toBe("20261126"); // 22:00 of the 26th in Bogotá
  });
  it("13 · a non-eligible match cannot reach Program through TAKE", () => {
    const status = { live: "LIVE", sched: "SCHEDULED", post: "POSTPONED" } as const;
    const ok = checkTake([{ name: "Stats", variant: "stats", matchRef: { id: "live" } }], (id) => status[id as keyof typeof status]);
    expect(ok.ok).toBe(true);
    const bad = checkTake([
      { name: "Stats", variant: "stats", matchRef: { id: "sched" } },          // not started
      { name: "Marcador", variant: "pro", matchRef: { id: "post" } },          // postponed
      { name: "Previa", variant: "prematch", matchRef: { id: "sched" } },      // allowed for previa
    ], (id) => status[id as keyof typeof status]);
    expect(bad.ok).toBe(false);
    expect(bad.problems).toHaveLength(2);
    expect(graphicAllowed("timeline", "UNKNOWN").ok).toBe(false);
    expect(graphicAllowed("stats", "FINISHED").ok).toBe(true); // post-match use
  });
  it("14 · a temporary disconnection never turns an old match into a live one", () => {
    let known = reconcile(new Map(), [m("old", "2026-11-25T20:00Z", "FINISHED"), m("live", "2026-11-26T19:00Z", "LIVE")], NOW);
    known = reconcile(known, null, NOW + 30_000); // source down
    const c = classify(known.values(), NOW + 30_000);
    expect(c.live.map((x) => x.id)).toEqual(["live"]);
    expect(c.live[0].stale).toBe(true);
    expect(known.get("old")?.status).toBe("FINISHED");
    // a live match missing from a successful response is kept (to be verified), not dropped
    known = reconcile(known, [m("old", "2026-11-25T20:00Z", "FINISHED")], NOW + 60_000);
    expect(known.get("live")).toMatchObject({ status: "LIVE", missing: 1, stale: true });
  });
});

describe("Selection of several live matches (required cases)", () => {
  const empty: SelectionState = { activeMatchId: null, selectedMatchIds: [] };
  it("6 · three simultaneous matches can be selected, one removed, order changed", () => {
    let s = selectAll(empty, ["a", "b", "c"]);
    expect(s.selectedMatchIds).toEqual(["a", "b", "c"]);
    s = deselect(s, "b");
    expect(s.selectedMatchIds).toEqual(["a", "c"]);
    s = move(toggle(s, "b", true), "b", -1);
    expect(s.selectedMatchIds).toEqual(["a", "b", "c"]);
    expect(select(s, "sched", false)).toBe(s); // a non-eligible match is never selected
    expect(clear(s).selectedMatchIds).toEqual([]);
  });
  it("7 · changing the main match keeps the secondary ones", () => {
    const s = setActive(selectAll(empty, ["a", "b", "c"]), "b");
    expect(setActive(s, "c")).toEqual({ activeMatchId: "c", selectedMatchIds: ["a", "b", "c"] });
  });
  it("12 · selection survives data refreshes; matches that finish leave the live selection, the main one stays", () => {
    const s: SelectionState = { activeMatchId: "a", selectedMatchIds: ["a", "b", "c"] };
    expect(prune(s, new Set(["a", "b", "c"]), new Set(["a", "b", "c"]))).toBe(s); // a refresh changes nothing
    expect(prune(s, new Set(["b", "c"]), new Set(["a", "b", "c"]))).toEqual({ activeMatchId: "a", selectedMatchIds: ["b", "c"] });
    expect(prune(s, new Set(["b"]), new Set(["b"]))).toBe(s); // unknown (not loaded yet) is not removed
  });
  it("8 · the multi-screen shows exactly the selected live matches, in the chosen order", () => {
    const board: BoardMatch[] = [
      { id: "a", homeTeam: "Barcelona", awayTeam: "Atlético", status: "live", statusDetail: "67'" },
      { id: "b", homeTeam: "Liverpool", awayTeam: "Arsenal", status: "live", statusDetail: "32'" },
      { id: "c", homeTeam: "Junior", awayTeam: "Nacional", status: "halftime" },
      { id: "d", homeTeam: "Ayer", awayTeam: "Ayer", status: "finished" },
    ];
    expect(toMultiScores(board, 10, { selected: ["c", "a"] }).map((x) => x.id)).toEqual(["c", "a"]);
    expect(toMultiScores(board, 10, { selected: ["c", "a"] })[0].detail).toBe("DESCANSO");
    expect(toMultiScores(board).map((x) => x.id)).toEqual(["a", "b", "c"]);
  });
});

describe("Timeline per match (required cases)", () => {
  const detail = real as unknown as SourceDetail;
  const other: SourceDetail = { ...detail, id: "999", events: detail.events!.map((e) => ({ ...e, id: `x${e.id}` })) };
  it("9 · events of different matches never mix; 10 · refreshing never duplicates", () => {
    const a = new MatchEventStore(detail.id);
    const b = new MatchEventStore("999");
    for (const t of [0, 15000, 30000]) { a.ingest({ ...detail, state: "in" }, t); b.ingest({ ...other, state: "in" }, t); }
    const merged = mergeTimeline([
      { match: { matchId: detail.id, league: detail.league, label: "SAB vs BAR", kickoff: "2026-11-25T17:45Z", finished: false }, events: a.getEvents() },
      { match: { matchId: "999", league: detail.league, label: "Otro", kickoff: "2026-11-25T20:00Z", finished: false }, events: b.getEvents() },
    ]);
    expect(merged.active.every((e) => e.matchId === e.match.matchId)).toBe(true);
    const ids = merged.active.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(merged.active.filter((e) => e.match.matchId === "999").length).toBe(b.getEvents().length);
    // chronological (latest first)
    expect([...merged.active].sort((x, y) => y.at - x.at).map((e) => e.id)).toEqual(ids);
    // a finished match goes to history (kept, not deleted)
    const done = mergeTimeline([{ match: { matchId: detail.id, league: detail.league, label: "SAB vs BAR", finished: true }, events: a.getEvents() }]);
    expect(done.active).toHaveLength(0);
    expect(done.history.length).toBe(a.getEvents().length);
  });
});
