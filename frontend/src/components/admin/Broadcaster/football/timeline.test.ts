import { describe, expect, it } from "vitest";
import { parseMinute, planTimeline, type TimelineEvent } from "./timeline";

const event = (patch: Partial<TimelineEvent>): TimelineEvent => ({
  id: "1", minute: "10'", order: 600, kind: "goal", side: "home", player: "Hulk", assist: "", playerOut: "", text: "Goal", ...patch,
});

describe("parseMinute", () => {
  it("reads regular and added-time minutes", () => {
    expect(parseMinute("67'")).toBe(67);
    expect(parseMinute("90'+4'")).toBe(94);
    expect(parseMinute("45+2")).toBe(47);
    expect(parseMinute("")).toBe(0);
  });
});

describe("planTimeline", () => {
  it("maps goals, penalties, cards and changes, oldest first", () => {
    const plan = planTimeline([
      event({ id: "c", order: 3000, kind: "sub", side: "away", player: "Rony", playerOut: "Paulinho", minute: "50'" }),
      event({ id: "a", order: 600, kind: "penalty", minute: "10'" }),
      event({ id: "b", order: 1800, kind: "red", side: "away", player: "Cavani", minute: "30'" }),
    ], new Set(), []);
    expect(plan.map((item) => item.action)).toEqual([
      { type: "goal", team: "home", player: "Hulk", minute: 10, detail: "Penal" },
      { type: "card", team: "away", card: "red", player: "Cavani", minute: 30 },
      { type: "sub", team: "away", playerIn: "Rony", playerOut: "Paulinho", minute: 50 },
    ]);
  });

  it("skips events already applied or dismissed, and events without a team", () => {
    const plan = planTimeline([event({ id: "a" }), event({ id: "b", side: null }), event({ id: "c", kind: "var" })], new Set(["a"]), []);
    expect(plan).toEqual([]);
  });

  it("flags a goal the operator already entered by hand and never auto-applies it", () => {
    const [goal] = planTimeline([event({ minute: "11'" })], new Set(), [{ kind: "goal", team: "home", minute: 10 }]);
    expect(goal).toMatchObject({ duplicate: true, auto: false });
  });

  it("ignores voided manual events when looking for duplicates", () => {
    const [goal] = planTimeline([event({})], new Set(), [{ kind: "goal", team: "home", minute: 10, voided: true }]);
    expect(goal).toMatchObject({ duplicate: false, auto: true });
  });

  it("leaves own goals and changes for review", () => {
    const plan = planTimeline([event({ id: "a", kind: "own-goal" }), event({ id: "b", kind: "sub", playerOut: "X" })], new Set(), []);
    expect(plan.every((item) => !item.auto)).toBe(true);
  });
});
