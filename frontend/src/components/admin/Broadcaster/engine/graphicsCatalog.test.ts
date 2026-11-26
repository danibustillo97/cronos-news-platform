import { describe, expect, it } from "vitest";
import { arbitrate } from "./graphicsCatalog";

describe("graphics priority hierarchy", () => {
  it("keeps one graphic per exclusive layer and lets the scoreboard and ticker coexist", () => {
    const air = [{ id: "a", variant: "pro" }, { id: "b", variant: "cinta" }, { id: "c", variant: "stats" }];
    expect(arbitrate(air, "standings", false)).toEqual({ evict: ["c"], blocked: false });
    expect(arbitrate(air, "card", false)).toEqual({ evict: [], blocked: false }); // lower layer is free
  });
  it("an automatic graphic waits behind a more important one; the operator can force", () => {
    const air = [{ id: "g", variant: "goal-pro" }];
    expect(arbitrate(air, "sub", false)).toMatchObject({ blocked: true, blocker: "goal-pro" });
    expect(arbitrate(air, "sub", true)).toEqual({ evict: ["g"], blocked: false });
  });
  it("line-ups home and away travel together; the full-screen show clears center and lower", () => {
    expect(arbitrate([{ id: "h", variant: "lineup-home" }], "lineup-away", false).evict).toEqual([]);
    const air = [{ id: "p", variant: "pro" }, { id: "s", variant: "stats" }, { id: "t", variant: "timeline" }, { id: "x", variant: "cinta" }];
    expect(arbitrate(air, "recap", true).evict.sort()).toEqual(["s", "t"]);
  });
});
