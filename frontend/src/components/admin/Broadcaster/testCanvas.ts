// Minimal 2D canvas double for node tests: records every drawing call with the alpha in effect.
export interface CanvasCall {
  op: string;
  alpha: number;
  args: unknown[];
}

export function fakeCanvas(width = 1920, height = 1080) {
  const calls: CanvasCall[] = [];
  const state: Record<string | symbol, unknown> = { globalAlpha: 1 };
  const stack: Array<Record<string | symbol, unknown>> = [];
  const gradient = { addColorStop: () => undefined };
  const context = new Proxy(state, {
    get(target, key) {
      if (key in target) return target[key];
      if (key === "save") return () => stack.push({ ...target });
      if (key === "restore") return () => Object.assign(target, stack.pop());
      if (key === "createLinearGradient" || key === "createRadialGradient") return () => gradient;
      if (key === "measureText") return () => ({ width: 100 });
      return (...args: unknown[]) => calls.push({ op: String(key), alpha: target.globalAlpha as number, args });
    },
    set(target, key, value) {
      target[key] = value;
      return true;
    },
  });
  const canvas = { width, height, getContext: () => context } as unknown as HTMLCanvasElement;
  return { canvas, context: context as unknown as CanvasRenderingContext2D, calls };
}

/** Full-frame fills in logical (1920×1080) coordinates: the base of each drawScene pass. */
export const baseFills = (calls: CanvasCall[]) =>
  calls.filter((call) => call.op === "fillRect" && call.args[0] === 0 && call.args[1] === 0 && call.args[2] === 1920 && call.args[3] === 1080);
