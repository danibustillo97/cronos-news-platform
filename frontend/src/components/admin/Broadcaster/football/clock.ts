"use client";

import { useEffect, useState } from "react";

/**
 * Match clock as "base seconds + when it last started". Nothing ticks in React state, so a
 * running clock no longer re-renders the whole studio every second; whoever shows the time
 * derives it, and the time keeps counting across reloads.
 */
export function clockSecondsAt(baseSeconds: number, startedAt: number | null, now: number): number {
  if (startedAt === null) return baseSeconds;
  return baseSeconds + Math.max(0, Math.floor((now - startedAt) / 1000));
}

/** Re-renders only the calling component every `intervalMs` while `enabled`. */
export function useTicker(intervalMs: number, enabled = true): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const timer = window.setInterval(() => setTick((value) => value + 1), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs, enabled]);
  return tick;
}
