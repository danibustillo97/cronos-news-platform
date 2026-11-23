// Polls a background job (discovery, artifact, image generation) until it finishes.
// The old setInterval loops overlapped requests, kept polling forever when the job URL
// answered with an error, and kept running after their component unmounted.

export class PollAbortedError extends Error {
  constructor() {
    super("Seguimiento cancelado");
    this.name = "PollAbortedError";
  }
}

interface PollOptions<T> {
  /** Fetches the job; resolve null (or throw) for a failed attempt. */
  fetchStatus: () => Promise<T | null>;
  isDone: (job: T) => boolean;
  onUpdate?: (job: T) => void;
  intervalMs?: number;
  /** Gives up after this long (jobs on GitHub Actions can take a few minutes to start). */
  timeoutMs?: number;
  /** Gives up after this many failed attempts in a row. */
  maxConsecutiveErrors?: number;
  signal?: AbortSignal;
}

export function pollJob<T>({
  fetchStatus, isDone, onUpdate, intervalMs = 3000, timeoutMs = 15 * 60_000, maxConsecutiveErrors = 8, signal,
}: PollOptions<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const startedAt = Date.now();
    let errors = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const stop = () => {
      if (timer) clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    };
    const onAbort = () => { stop(); reject(new PollAbortedError()); };
    if (signal?.aborted) { reject(new PollAbortedError()); return; }
    signal?.addEventListener("abort", onAbort);

    const tick = async () => {
      let job: T | null = null;
      try {
        job = await fetchStatus();
      } catch {
        job = null;
      }
      if (signal?.aborted) return;
      if (job === null) {
        errors += 1;
        if (errors >= maxConsecutiveErrors) { stop(); reject(new Error("No se pudo consultar el estado del trabajo")); return; }
      } else {
        errors = 0;
        onUpdate?.(job);
        if (isDone(job)) { stop(); resolve(job); return; }
      }
      if (Date.now() - startedAt >= timeoutMs) { stop(); reject(new Error("El trabajo sigue en curso; revisa más tarde")); return; }
      // The next request starts only after this one finished: never two in flight.
      timer = setTimeout(() => void tick(), intervalMs);
    };
    void tick();
  });
}
