import { describe, expect, it, vi } from "vitest";
import { drawPresenter, setPresenterLayer } from "./presenterLayer";

describe("presenter layer", () => {
  it("draws nothing until a real presenter is registered", () => {
    const ctx = { drawImage: vi.fn() } as unknown as CanvasRenderingContext2D;
    setPresenterLayer(null);
    expect(drawPresenter(ctx, 1920, 1080, "program")).toBe(false);
    expect(ctx.drawImage).not.toHaveBeenCalled();
  });
  it("fits the presenter in its rect with the feet on the bottom edge, only on its bus", () => {
    const ctx = { drawImage: vi.fn() } as unknown as CanvasRenderingContext2D;
    setPresenterLayer({ source: { width: 500, height: 1000 } as unknown as CanvasImageSource, rect: { x: 0.6, y: 0.1, w: 0.3, h: 0.8 }, bus: "program" });
    expect(drawPresenter(ctx, 1920, 1080, "preview")).toBe(false);
    expect(drawPresenter(ctx, 1920, 1080, "program")).toBe(true);
    const [, x, y, w, h] = (ctx.drawImage as unknown as { mock: { calls: number[][] } }).mock.calls[0];
    expect(h).toBeCloseTo(864); // 0.8 * 1080
    expect(w).toBeCloseTo(432);
    expect(y + h).toBeCloseTo(0.9 * 1080);
    expect(x).toBeCloseTo(1152 + (576 - 432) / 2);
    setPresenterLayer(null);
  });
});
