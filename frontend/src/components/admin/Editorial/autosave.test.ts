import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAutosave } from "./autosave";

function deferred() {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

describe("createAutosave", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("debounces and sends only the latest snapshot", async () => {
    const save = vi.fn(async () => undefined);
    const autosave = createAutosave<string>({ save, delayMs: 1000 });
    autosave.schedule("a");
    autosave.schedule("ab");
    autosave.schedule("abc");
    await vi.advanceTimersByTimeAsync(1000);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith("abc");
    expect(autosave.isDirty()).toBe(false);
  });

  it("never runs two saves at once and saves edits made during a request afterwards, in order", async () => {
    const calls: string[] = [];
    const first = deferred();
    const save = vi.fn(async (value: string) => {
      calls.push(value);
      if (value === "v1") await first.promise;
    });
    const autosave = createAutosave<string>({ save, delayMs: 100 });
    autosave.schedule("v1");
    await vi.advanceTimersByTimeAsync(100);
    autosave.schedule("v2");
    await vi.advanceTimersByTimeAsync(100);
    expect(calls).toEqual(["v1"]);
    first.resolve();
    await vi.advanceTimersByTimeAsync(0);
    expect(calls).toEqual(["v1", "v2"]);
  });

  it("flush waits for the request in flight before reporting success", async () => {
    const gate = deferred();
    const save = vi.fn(() => gate.promise);
    const autosave = createAutosave<string>({ save, delayMs: 100 });
    autosave.schedule("draft");
    await vi.advanceTimersByTimeAsync(100);
    let flushed: boolean | null = null;
    void autosave.flush().then((ok) => { flushed = ok; });
    await vi.advanceTimersByTimeAsync(0);
    expect(flushed).toBeNull();
    gate.resolve();
    await vi.advanceTimersByTimeAsync(0);
    expect(flushed).toBe(true);
  });

  it("keeps a failed snapshot pending so flush retries it instead of skipping it", async () => {
    const save = vi.fn()
      .mockRejectedValueOnce(new Error("401"))
      .mockResolvedValueOnce(undefined);
    const onError = vi.fn();
    const autosave = createAutosave<string>({ save, delayMs: 100, onError });
    autosave.schedule("important");
    await vi.advanceTimersByTimeAsync(100);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(autosave.isDirty()).toBe(true);
    expect(autosave.status()).toBe("error");
    await expect(autosave.flush()).resolves.toBe(true);
    expect(save).toHaveBeenLastCalledWith("important");
    expect(autosave.isDirty()).toBe(false);
  });

  it("flush reports failure while the save keeps failing", async () => {
    const autosave = createAutosave<string>({ save: () => Promise.reject(new Error("down")), delayMs: 100 });
    autosave.schedule("x");
    await expect(autosave.flush()).resolves.toBe(false);
    expect(autosave.isDirty()).toBe(true);
  });

  it("flush with nothing pending succeeds without saving", async () => {
    const save = vi.fn(async () => undefined);
    await expect(createAutosave({ save, delayMs: 100 }).flush()).resolves.toBe(true);
    expect(save).not.toHaveBeenCalled();
  });

  it("reset drops unsaved work and ignores the outcome of an old request", async () => {
    const gate = deferred();
    const statuses: string[] = [];
    const autosave = createAutosave<string>({ save: () => gate.promise, delayMs: 100, onStatus: (s) => statuses.push(s) });
    autosave.schedule("old");
    await vi.advanceTimersByTimeAsync(100);
    autosave.reset();
    gate.resolve();
    await vi.advanceTimersByTimeAsync(0);
    expect(autosave.isDirty()).toBe(false);
    expect(statuses.at(-1)).toBe("idle");
  });
});
