import { describe, expect, it } from "vitest";
import { matchNewsId, pollFromTemplate } from "./audience";

describe("Audience engine", () => {
  it("builds polls only from real teams and players", () => {
    expect(pollFromTemplate("who-wins", { home: "Junior", away: "Nacional" })?.options.map((o) => o.label)).toEqual(["Junior", "Empate", "Nacional"]);
    expect(pollFromTemplate("figure", { home: "A", away: "B", scorers: ["Díaz"], starters: [] })).toBeNull(); // not enough real names
    const f = pollFromTemplate("figure", { home: "A", away: "B", scorers: ["Díaz", "Díaz"], starters: ["Quintero", "Borja", "Ospina", "Arias", "Cuesta", "Mina"] });
    expect(f?.options).toHaveLength(6);
    expect(f?.options[0].label).toBe("Díaz");
    expect(matchNewsId("col.1", "123")).toBe("match:col.1:123");
  });
});
