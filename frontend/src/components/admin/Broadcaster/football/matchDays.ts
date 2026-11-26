// Calendar days for the match lists: every match under its REAL day in Colombia (America/Bogota)
// and "En vivo" only when the provider confirms an active state.
import type { Fixture } from "./useFootballMatch";
import { bogotaDay, isActive, type MatchStatus } from "../engine/matchStatus";

/** Local calendar days from today (0 today, -1 yesterday, 1 tomorrow). */
export function dayDiff(iso: string, now: Date): number {
  const a = Date.parse(`${bogotaDay(iso)}T12:00:00Z`);
  const b = Date.parse(`${bogotaDay(now)}T12:00:00Z`);
  return Math.round((a - b) / 86400000);
}

/** Every match goes under its REAL day (in your time zone); only live games jump to the top. */
export function groupLabel(f: Fixture, now: Date): string {
  const status = (f as Fixture & { status?: MatchStatus }).status;
  if (status ? isActive(status) : f.state === "in") return "En vivo";
  const diff = dayDiff(f.date, now);
  if (diff === 0) return "Hoy";
  if (diff === 1) return "Mañana";
  if (diff === -1) return "Ayer";
  const d = new Date(f.date);
  const text = d.toLocaleDateString("es-CO", { timeZone: "America/Bogota", weekday: "long", day: "numeric", month: "short" });
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export const ORDER = (label: string, f?: Fixture, now = new Date()) => {
  if (label === "En vivo") return -1000;
  const diff = f ? dayDiff(f.date, now) : 0;
  return diff >= 0 ? diff : 1000 - diff; // today, tomorrow, … then yesterday, the day before…
};
