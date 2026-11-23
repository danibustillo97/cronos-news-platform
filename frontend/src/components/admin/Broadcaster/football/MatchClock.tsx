"use client";

import type { ReactNode } from "react";
import { useTicker } from "./clock";
import type { FootballMatchController } from "./useFootballMatch";

const mmss = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

/** Match time text; only this element re-renders while the clock runs. */
export function MatchClock({ fm }: { fm: Pick<FootballMatchController, "clockNow" | "running"> }) {
  useTicker(250, fm.running);
  return <>{mmss(fm.clockNow())}</>;
}

/** "Inicio en …" before kick-off; renders `fallback` once the match is under way. */
export function KickoffCountdown({ kickoff, period, fallback }: { kickoff?: string; period: string; fallback: ReactNode }) {
  useTicker(30000, period === "PRE");
  const at = kickoff ? new Date(kickoff).getTime() : NaN;
  if (Number.isNaN(at) || period !== "PRE") return <>{fallback}</>;
  const diff = at - Date.now();
  if (diff <= 0) return <>Inicio inminente</>;
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return <>{d > 0 ? `Inicio en ${d} d ${h} h` : `Inicio en ${h} h ${m} min`}</>;
}
