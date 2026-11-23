import { describe, expect, it } from "vitest";
import { newerCopy } from "./useFootballMatch";

describe("newerCopy", () => {
  const at = (iso: string): { savedAt?: string } => ({ savedAt: iso });

  it("prefers whichever copy exists", () => {
    expect(newerCopy(null, null)).toBeNull();
    expect(newerCopy(at("2026-11-20T10:00:00Z"), null)).toBe("local");
    expect(newerCopy(null, at("2026-11-20T10:00:00Z"))).toBe("remote");
  });

  it("takes the cloud copy only when it is strictly newer", () => {
    expect(newerCopy(at("2026-11-20T10:00:00Z"), at("2026-11-20T10:05:00Z"))).toBe("remote");
    expect(newerCopy(at("2026-11-20T10:05:00Z"), at("2026-11-20T10:00:00Z"))).toBe("local");
    expect(newerCopy(at("2026-11-20T10:00:00Z"), at("2026-11-20T10:00:00Z"))).toBe("local");
  });

  it("keeps the browser copy when the cloud copy has no date (older versions)", () => {
    expect(newerCopy(at("2026-11-20T10:00:00Z"), {})).toBe("local");
  });
});
