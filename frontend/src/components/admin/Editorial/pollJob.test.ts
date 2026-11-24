import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PollAbortedError, pollJob } from "./pollJob";

type Job = { status: string };

describe("pollJob", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("polls until the job is done and reports every update", async () => {
    const states = ["QUEUED", "RUNNING", "COMPLETED"];
    const updates: string[] = [];
    const promise = pollJob<Job>({
      fetchStatus: async () => ({ status: states.shift()! }),
      isDone: (job) => job.status === "COMPLETED",
      onUpdate: (job) => updates.push(job.status),
      intervalMs: 1000,
    });
    await vi.advanceTimersByTimeAsync(3000);
    await expect(promise).resolves.toEqual({ status: "COMPLETED" });
    expect(updates).toEqual(["QUEUED", "RUNNING", "COMPLETED"]);
  });

  it("never has two requests in flight", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    let calls = 0;
    const promise = pollJob<Job>({
      fetchStatus: () => new Promise((resolve) => {
        inFlight += 1; calls += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        setTimeout(() => { inFlight -= 1; resolve({ status: calls >= 3 ? "COMPLETED" : "RUNNING" }); }, 2500);
      }),
      isDone: (job) => job.status === "COMPLETED",
      intervalMs: 1000,
    });
    await vi.advanceTimersByTimeAsync(20_000);
    await promise;
    expect(maxInFlight).toBe(1);
  });

  it("tolerates a few failures but gives up after too many in a row", async () => {
    const promise = pollJob<Job>({ fetchStatus: async () => null, isDone: () => false, intervalMs: 100, maxConsecutiveErrors: 3 });
    const assertion = expect(promise).rejects.toThrow("No se pudo consultar");
    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
  });

  it("gives up after the timeout", async () => {
    const promise = pollJob<Job>({ fetchStatus: async () => ({ status: "RUNNING" }), isDone: () => false, intervalMs: 1000, timeoutMs: 5000 });
    const assertion = expect(promise).rejects.toThrow("sigue en curso");
    await vi.advanceTimersByTimeAsync(10_000);
    await assertion;
  });

  it("stops when aborted (component unmounted)", async () => {
    const controller = new AbortController();
    const fetchStatus = vi.fn(async () => ({ status: "RUNNING" }));
    const promise = pollJob<Job>({ fetchStatus, isDone: () => false, intervalMs: 1000, signal: controller.signal });
    const assertion = expect(promise).rejects.toBeInstanceOf(PollAbortedError);
    await vi.advanceTimersByTimeAsync(1500);
    controller.abort();
    await assertion;
    const callsAtAbort = fetchStatus.mock.calls.length;
    await vi.advanceTimersByTimeAsync(10_000);
    expect(fetchStatus.mock.calls.length).toBe(callsAtAbort);
  });
});
