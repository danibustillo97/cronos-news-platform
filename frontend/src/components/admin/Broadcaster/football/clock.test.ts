import { describe, expect, it } from "vitest";
import { clockSecondsAt } from "./clock";

describe("clockSecondsAt", () => {
  it("returns the base time while stopped", () => {
    expect(clockSecondsAt(754, null, 1_000_000)).toBe(754);
  });

  it("adds whole elapsed seconds while running, including across a reload", () => {
    const startedAt = 1_000_000;
    expect(clockSecondsAt(2700, startedAt, startedAt + 999)).toBe(2700);
    expect(clockSecondsAt(2700, startedAt, startedAt + 61_500)).toBe(2761);
  });

  it("never runs backwards if the system clock moves back", () => {
    expect(clockSecondsAt(10, 5_000, 4_000)).toBe(10);
  });
});
