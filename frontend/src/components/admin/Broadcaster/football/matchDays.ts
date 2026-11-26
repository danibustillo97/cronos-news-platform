// Calendar days for the match lists: every match under its REAL local day.
import type { Fixture } from "./useFootballMatch";

/** Local calendar days from today (0 today, -1 yesterday, 1 tomorrow). */
export function dayDiff(iso: string, now: Date): number {
  const d = new Date(iso);
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  return Math.round((day(d) - day(now)) / 86400000);
}

/** Every match goes under its REAL day (in your time zone); only live games jump to the top. */
export function groupLabel(f: Fixture, now: Date): string {
  if (f.state === "in") return "En vivo";
  const diff = dayDiff(f.date, now);
  if (diff === 0) return "Hoy";
  if (diff === 1) return "Mañana";
  if (diff === -1) return "Ayer";
  const d = new Date(f.date);
  const text = d.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "short" });
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export const ORDER = (label: string, f?: Fixture, now = new Date()) => {
  if (label === "En vivo") return -1000;
  const diff = f ? dayDiff(f.date, now) : 0;
  return diff >= 0 ? diff : 1000 - diff; // today, tomorrow, … then yesterday, the day before…
};
