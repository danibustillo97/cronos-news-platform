import { describe, expect, it } from "vitest";
import { ctr, imageFitsSlot, sizeLabel, specSheetText, type AdSlotAdmin } from "./adSlots";

describe("adSlots helpers", () => {
  it("accepts exact or retina sizes only", () => {
    expect(imageFitsSlot({ width: 320, height: 100 }, [320, 100])).toBe(true);
    expect(imageFitsSlot({ width: 640, height: 200 }, [320, 100])).toBe(true);
    expect(imageFitsSlot({ width: 300, height: 100 }, [320, 100])).toBe(false);
  });
  it("formats sizes and CTR", () => {
    expect(sizeLabel([970, 250])).toBe("970×250");
    expect(sizeLabel(null)).toBe("—");
    expect(ctr(0, 0)).toBe("—");
    expect(ctr(2000, 25)).toBe("1,25%");
  });
  it("spec sheet lists only devices where the slot exists", () => {
    const slots: AdSlotAdmin[] = [{ placement: "sidebar", name: "Columna lateral", page: "Portada", where: "Derecha", enabled: true, campaigns: [],
      sizes: { mobile: null, tablet: null, desktop: [300, 600] } }];
    const text = specSheetText(slots);
    expect(text).toContain("Computador: 300×600 px");
    expect(text).not.toContain("Móvil:");
  });
});
