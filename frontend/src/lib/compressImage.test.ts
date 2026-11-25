import { describe, expect, it } from "vitest";
import { fitWithin } from "./compressImage";

describe("fitWithin", () => {
  it("scales big images down keeping aspect", () => {
    expect(fitWithin(2160, 3840, 1080, 1920)).toEqual({ width: 1080, height: 1920 });
    expect(fitWithin(4000, 2000, 1080, 1920)).toEqual({ width: 1080, height: 540 });
  });
  it("never upscales", () => {
    expect(fitWithin(600, 800, 1080, 1920)).toEqual({ width: 600, height: 800 });
  });
});
