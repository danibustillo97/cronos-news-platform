"use client";

import { useTicker } from "./football/clock";

interface Props {
  session: { startedAt: number | null; stoppedAt: number | null };
}

/** HH:MM:SS of the current (or last) broadcast/recording session. */
export function SessionClock({ session }: Props) {
  const running = session.startedAt !== null && session.stoppedAt === null;
  useTicker(500, running);
  const end = session.stoppedAt ?? Date.now();
  const total = session.startedAt === null ? 0 : Math.max(0, Math.floor((end - session.startedAt) / 1000));
  const pad = (value: number) => String(value).padStart(2, "0");
  return <>{pad(Math.floor(total / 3600))}:{pad(Math.floor((total % 3600) / 60))}:{pad(total % 60)}</>;
}
