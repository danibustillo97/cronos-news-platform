import { describe, expect, it } from "vitest";
import { findFreeSpot, overlaps, rectAt } from "./placement";

describe("smart placement", () => {
  it("keeps the default spot when the screen is free", () => {
    expect(findFreeSpot("lower", { w: 700, h: 96 }, [], { x: 4, y: 78 })).toEqual({ x: 4, y: 78 });
  });

  it("moves a lower third away from the home line-up", () => {
    const lineupHome = rectAt({ x: 3, y: 17 }, { w: 420, h: 760 }); // tall panel on the left
    expect(findFreeSpot("lower", { w: 700, h: 96 }, [lineupHome], { x: 4, y: 78 })).toEqual({ x: 52, y: 78 });
  });

  it("with both line-ups up, uses the top-right slot", () => {
    const home = rectAt({ x: 3, y: 17 }, { w: 420, h: 760 });
    const away = rectAt({ x: 74, y: 17 }, { w: 420, h: 760 });
    expect(findFreeSpot("lower", { w: 700, h: 96 }, [home, away], { x: 4, y: 78 })).toEqual({ x: 28, y: 62 });
  });

  it("detects overlaps with a margin", () => {
    expect(overlaps({ x: 0, y: 0, w: 100, h: 100 }, { x: 104, y: 0, w: 10, h: 10 })).toBe(true);
    expect(overlaps({ x: 0, y: 0, w: 100, h: 100 }, { x: 200, y: 0, w: 10, h: 10 })).toBe(false);
  });
});

describe("settle around a camera", () => {
  it("moves and shrinks graphics so they never cover the camera frame", async () => {
    const { settle, overlaps, rectAt } = await import("./placement");
    const camera = { x: 77, y: 151, w: 1037, h: 648 };
    const out = settle([
      { id: "a", variant: "pro", spot: { x: 2.5, y: 3.5 }, scale: 1, size: { w: 1100, h: 110 } },
      { id: "b", variant: "lineup-home", spot: { x: 3, y: 17 }, scale: 1, size: { w: 520, h: 760 } },
    ], [camera]);
    for (const g of out) expect(overlaps(rectAt(g.spot, g.size, g.scale), camera)).toBe(false);
    expect(overlaps(rectAt(out[0].spot, out[0].size, out[0].scale), rectAt(out[1].spot, out[1].size, out[1].scale))).toBe(false);
  });
});
