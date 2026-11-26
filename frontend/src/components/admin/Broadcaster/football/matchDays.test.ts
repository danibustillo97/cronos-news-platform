import { describe, expect, it } from "vitest";
import { groupLabel } from "./matchDays";
import type { Fixture } from "./useFootballMatch";

const at = (iso: string, state: Fixture["state"]) => ({ date: iso, state } as Fixture);

describe("match calendar groups", () => {
  const now = new Date(2026, 10, 26, 10, 0); // 26 nov, 10:00 local
  it("puts every match under its real local day", () => {
    expect(groupLabel(at(new Date(2026, 10, 25, 14, 0).toISOString(), "post"), now)).toBe("Ayer");
    expect(groupLabel(at(new Date(2026, 10, 25, 14, 0).toISOString(), "pre"), now)).toBe("Ayer"); // never "Hoy" by mistake
    expect(groupLabel(at(new Date(2026, 10, 26, 20, 0).toISOString(), "post"), now)).toBe("Hoy");
    expect(groupLabel(at(new Date(2026, 10, 27, 18, 35).toISOString(), "pre"), now)).toBe("Mañana");
    expect(groupLabel(at(new Date(2026, 10, 25, 14, 0).toISOString(), "in"), now)).toBe("En vivo");
  });
});
