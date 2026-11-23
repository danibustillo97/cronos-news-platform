import { describe, expect, it } from "vitest";
import { drawMotion } from "./motion";
import { fakeCanvas } from "../testCanvas";

const image = { naturalWidth: 960, naturalHeight: 170 } as HTMLImageElement;
const base = { image, x: 100, y: 50, w: 960, h: 170, elapsed: 5000, tone: "#38bdf8" };

describe("drawMotion", () => {
  it("multiplies its alpha by the surface opacity", () => {
    for (const motion of ["panel", "elite", "goal", "card", "var", "void"] as const) {
      const { context, calls } = fakeCanvas();
      drawMotion({ ...base, ctx: context, motion, opacity: 0.25 });
      const draw = calls.find((call) => call.op === "drawImage");
      expect(draw?.alpha, motion).toBeCloseTo(0.25);
    }
  });

  it("does not move or shrink a widget while the program fades to black", () => {
    const { context, calls } = fakeCanvas();
    drawMotion({ ...base, ctx: context, motion: "elite", opacity: 0 });
    const clip = calls.find((call) => call.op === "rect");
    expect(clip?.args[2]).toBeCloseTo(960, 1);
    const draw = calls.find((call) => call.op === "drawImage");
    expect(draw?.args.slice(1)).toEqual([100, 50, 960, 170]);
  });
});
