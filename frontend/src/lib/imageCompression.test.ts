import { describe, expect, it } from "vitest";
import { canSkipCompression, fitWithin } from "./imageCompression";

describe("image compression sizing", () => {
  it("downscales the longest side to the limit and keeps the ratio", () => {
    expect(fitWithin(4032, 3024)).toEqual({ width: 2400, height: 1800 });
    expect(fitWithin(3024, 4032)).toEqual({ width: 1800, height: 2400 });
  });

  it("never upscales small images", () => {
    expect(fitWithin(800, 450)).toEqual({ width: 800, height: 450 });
    expect(fitWithin(0, 100)).toEqual({ width: 0, height: 0 });
  });

  it("sends small web images untouched", () => {
    expect(canSkipCompression({ size: 300 * 1024, type: "image/jpeg" })).toBe(true);
    expect(canSkipCompression({ size: 6 * 1024 * 1024, type: "image/jpeg" })).toBe(false);
    expect(canSkipCompression({ size: 100 * 1024, type: "image/heic" })).toBe(false);
  });
});
