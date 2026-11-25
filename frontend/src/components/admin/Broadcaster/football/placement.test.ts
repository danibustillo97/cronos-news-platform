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
