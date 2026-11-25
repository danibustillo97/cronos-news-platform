// Live board for the broadcaster: every followed match at once.
//  - feeds the "multi" graphic (Resultados en vivo) via setMultiScores
//  - detects NEW goals in other matches (from /api/matches/moments) so the
//    studio can air a "goal-alert" automatically.
// Pure helpers are exported for tests; the hook polls every 30 s.

import { useEffect, useRef, useState } from "react";
import { setMultiScores, type MultiScore } from "./designs";

export interface BoardMatch {
  id: string; league?: string; leagueName?: string; homeTeam: string; awayTeam: string;
  homeScore?: number | null; awayScore?: number | null; status: string; statusDetail?: string; date?: string;
}
export interface GoalMoment {
  id: string; kind: string; matchId: string; leagueName?: string; minute?: string; headline: string;
  player?: { id: string; name: string } | null; home?: { name?: string }; away?: { name?: string }; score?: { home: number; away: number };
}

const STATUS_ORDER: Record<string, number> = { live: 0, halftime: 1, finished: 2, scheduled: 3 };

export function toMultiScores(matches: BoardMatch[], max = 7): MultiScore[] {
  return [...matches]
    .filter((m) => m.status !== "scheduled" || isSoon(m.date))
    .sort((a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9))
    .slice(0, max)
    .map((m) => ({
      id: m.id, league: m.leagueName ?? m.league ?? "", home: m.homeTeam, away: m.awayTeam,
      homeScore: m.status === "scheduled" ? null : m.homeScore ?? 0, awayScore: m.status === "scheduled" ? null : m.awayScore ?? 0,
      status: (["live", "halftime", "finished"].includes(m.status) ? m.status : "scheduled") as MultiScore["status"],
      detail: m.status === "finished" ? "Final" : m.status === "halftime" ? "ET" : m.status === "scheduled" && m.date
        ? new Date(m.date).toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" }) : m.statusDetail ?? "",
    }));
}

function isSoon(date?: string): boolean {
  if (!date) return false;
  const diff = new Date(date).getTime() - Date.now();
  return diff > 0 && diff < 3 * 3600_000;
}

/** Goals not seen before, excluding the match on air (it has its own goal animation). */
export function newGoals(moments: GoalMoment[], seen: Set<string>, onAirMatchId: string | null): GoalMoment[] {
  return moments.filter((m) => m.kind === "goal" && !seen.has(m.id) && m.matchId !== onAirMatchId);
}

export function goalAlertText(m: GoalMoment): { title: string; subtitle: string } {
  const score = m.score ? `${m.home?.name ?? ""} ${m.score.home}-${m.score.away} ${m.away?.name ?? ""}`.trim() : m.headline;
  const who = m.player?.name ? `${m.player.name}${m.minute ? ` · ${m.minute}` : ""}` : m.minute ?? "";
  return { title: score, subtitle: [who, m.leagueName].filter(Boolean).join(" · ") };
}

const PREF = "nexus.broadcast.goalAlerts";
export function readGoalAlertsPref(): boolean {
  try { return localStorage.getItem(PREF) !== "off"; } catch { return true; }
}
export function writeGoalAlertsPref(on: boolean) {
  try { localStorage.setItem(PREF, on ? "on" : "off"); } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent("nexus:goal-alerts", { detail: on }));
}

export function useGoalAlertsPref(): boolean {
  const [on, setOn] = useState(true);
  useEffect(() => {
    setOn(readGoalAlertsPref());
    const listener = (e: Event) => setOn(Boolean((e as CustomEvent).detail));
    window.addEventListener("nexus:goal-alerts", listener);
    return () => window.removeEventListener("nexus:goal-alerts", listener);
  }, []);
  return on;
}

/** Polls scoreboard + moments while enabled; calls onGoal for each new goal in other matches. */
export function useLiveBoard(enabled: boolean, onAirMatchId: string | null, onGoal: (goal: GoalMoment) => void) {
  const [matches, setMatches] = useState<BoardMatch[]>([]);
  const seen = useRef<Set<string> | null>(null);
  const onGoalRef = useRef(onGoal);
  onGoalRef.current = onGoal;
  const airRef = useRef(onAirMatchId);
  airRef.current = onAirMatchId;

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const tick = async () => {
      const [board, moments] = await Promise.all([
        fetch("/api/sports/scoreboard").then((r) => (r.ok ? r.json() : [])).catch(() => []),
        fetch("/api/matches/moments").then((r) => (r.ok ? r.json() : { moments: [] })).catch(() => ({ moments: [] })),
      ]);
      if (!alive) return;
      const list = (Array.isArray(board) ? board : []) as BoardMatch[];
      setMatches(list);
      setMultiScores(toMultiScores(list));
      const all = ((moments?.moments ?? []) as GoalMoment[]);
      if (seen.current === null) { // first load: remember what already happened, alert only new goals
        seen.current = new Set(all.map((m) => m.id));
        return;
      }
      for (const goal of newGoals(all, seen.current, airRef.current)) onGoalRef.current(goal);
      all.forEach((m) => seen.current!.add(m.id));
    };
    void tick();
    const timer = window.setInterval(() => void tick(), 30_000);
    return () => { alive = false; window.clearInterval(timer); };
  }, [enabled]);

  return matches;
}
