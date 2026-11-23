// Debounced autosave that never loses or reorders an edit:
// - one request in flight at a time; edits made meanwhile are saved right after it,
// - only the newest snapshot is sent (intermediate keystrokes are skipped),
// - a failed save keeps the snapshot pending, so flush() retries it instead of
//   reporting "nothing to save" (approving or switching articles must not skip it).

export type AutosaveStatus = "idle" | "pending" | "saving" | "saved" | "error";

export interface Autosave<T> {
  /** Records the latest snapshot and (re)starts the debounce timer. */
  schedule(snapshot: T): void;
  /** Saves anything unsaved now and resolves true only when everything is persisted. */
  flush(): Promise<boolean>;
  /** True while there is a snapshot that has not been persisted yet. */
  isDirty(): boolean;
  /** Forgets unsaved work (after switching documents on purpose) and stops timers. */
  reset(): void;
  status(): AutosaveStatus;
}

interface Options<T> {
  save: (snapshot: T) => Promise<void>;
  delayMs: number;
  onStatus?: (status: AutosaveStatus) => void;
  onError?: (error: unknown) => void;
}

export function createAutosave<T>({ save, delayMs, onStatus, onError }: Options<T>): Autosave<T> {
  let pending: { value: T } | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let inFlight: Promise<boolean> | null = null;
  let current: AutosaveStatus = "idle";
  let generation = 0;

  const setStatus = (next: AutosaveStatus) => {
    current = next;
    onStatus?.(next);
  };

  const clearTimer = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };

  const run = (): Promise<boolean> => {
    if (inFlight) return inFlight;
    if (!pending) return Promise.resolve(current !== "error");
    const snapshot = pending;
    const startedIn = generation;
    setStatus("saving");
    inFlight = (async () => {
      try {
        await save(snapshot.value);
        if (startedIn !== generation) return true;
        // Only clear what was saved: a newer edit made during the request stays pending.
        if (pending === snapshot) pending = null;
        setStatus(pending ? "pending" : "saved");
        return true;
      } catch (error) {
        if (startedIn !== generation) return false;
        setStatus("error");
        onError?.(error);
        return false;
      } finally {
        inFlight = null;
      }
    })();
    return inFlight.then((ok) => {
      // Edits that arrived while saving go out right away (unless that save failed).
      if (ok && pending && !timer && startedIn === generation) void run();
      return ok;
    });
  };

  return {
    schedule(snapshot) {
      pending = { value: snapshot };
      setStatus("pending");
      clearTimer();
      timer = setTimeout(() => {
        timer = null;
        void run();
      }, delayMs);
    },
    async flush() {
      clearTimer();
      // Wait for the request in flight, then persist whatever is still pending.
      if (inFlight) await inFlight;
      while (pending) {
        const ok = await run();
        if (!ok) return false;
      }
      return current !== "error" || !pending;
    },
    isDirty() {
      return pending !== null;
    },
    reset() {
      generation += 1;
      clearTimer();
      pending = null;
      inFlight = null;
      setStatus("idle");
    },
    status() {
      return current;
    },
  };
}
