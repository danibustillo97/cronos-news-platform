// NEXUS SPORT AI Broadcast — typed contracts shared by the editorial engine, the
// director, the virtual studio and the control room.

import type { NarrationLine } from "../engine/narration";

export type Mode = "yesterday" | "today" | "week" | "upcoming";
export type Priority = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export type Verification = "PROVISIONAL" | "CONFIRMED" | "CORRECTED" | "ANNULLED" | "EXPIRED";
export type StageId = "OPENING" | "NEWSROOM" | "MATCH_CENTER" | "ANALYSIS" | "STATS" | "DEBATE" | "UPCOMING" | "CLOSING";
export type Shot = "WIDE" | "HERO" | "SCREEN" | "DATA" | "SPLIT" | "DEBATE" | "CLOSING";
export type SegmentKind = "opening" | "news" | "matchcenter" | "analysis" | "debate" | "data" | "next" | "closing";
export type Quality = "LOW" | "MEDIUM" | "HIGH";

export const MODE_LABEL: Record<Mode, string> = { yesterday: "Resumen de ayer", today: "Actualidad de hoy", week: "Balance semanal", upcoming: "Próximos días" };
export const STAGE_LABEL: Record<StageId, string> = {
  OPENING: "Apertura", NEWSROOM: "Noticias", MATCH_CENTER: "Match Center", ANALYSIS: "Análisis", STATS: "Data Arena", DEBATE: "Debate Arena", UPCOMING: "Próximos días", CLOSING: "Cierre",
};
export const SEGMENT_LABEL: Record<SegmentKind, string> = {
  opening: "Apertura", news: "Actualidad", matchcenter: "Match Center", analysis: "Análisis", debate: "Debate", data: "Data Arena", next: "Próximos días", closing: "Cierre",
};
export const PRIORITY_RANK: Record<Priority, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };

export interface Source { name: string; url?: string; publishedAt?: string; updatedAt?: string }
export interface TeamRef { name: string; short?: string; logo?: string; score?: number }

export interface Item {
  id: string;
  kind: "result" | "live" | "news" | "fixture" | "standings" | "poll" | "numbers";
  title: string;
  priority: Priority;
  /** relevance score used to order items inside a priority */
  score: number;
  verification: Verification;
  source: Source;
  /** after this instant the item must not air (ISO) */
  validUntil?: string;
  matchId?: string;
  league?: string;
  leagueName?: string;
  entities: string[];
  /** why the editorial engine picked it (shown to the director) */
  reason: string;
}

// ------------------------------------------------------------------ what the LED wall shows
export type ScreenContent =
  | { type: "title"; kicker: string; title: string; subtitle?: string }
  | { type: "headlines"; title: string; items: string[]; reveal: number }
  | { type: "result"; league: string; home: TeamRef; away: TeamRef; status: string; scorers: { home: string[]; away: string[] }; reveal: number }
  | { type: "stats"; title: string; home: TeamRef; away: TeamRef; rows: { label: string; home: number; away: number; percent?: boolean }[]; reveal: number }
  | { type: "headline"; kicker: string; title: string; body?: string; source: string; date?: string; provisional?: boolean }
  | { type: "table"; title: string; rows: { pos: number; team: string; logo?: string; played: number; points: number; gd: number }[]; highlight: string[]; reveal: number }
  | { type: "fixtures"; title: string; rows: { time: string; day?: string; league: string; home: TeamRef; away: TeamRef }[]; reveal: number }
  | { type: "poll"; question: string; options: { label: string; votes: number }[]; state: "open" | "closed" | "none"; total: number }
  | { type: "numbers"; title: string; items: { label: string; value: string }[]; reveal: number }
  | { type: "closing"; title: string; lines: string[]; reveal: number };

export interface LowerThird { kicker: string; text: string; source?: string }

/** One step of the director's sequence. */
export interface Beat {
  id: string;
  narration?: NarrationLine;
  stage?: StageId;
  shot?: Shot;
  screen?: ScreenContent;
  lower?: LowerThird | null;
  sfx?: "impact" | "whistle" | "goal";
  /** extra hold after the narration (or instead of it), ms */
  holdMs?: number;
  /** importance of the beat: CRITICAL changes the treatment (impact, slower camera) */
  weight?: Priority;
}

export type SegmentStatus = "pending" | "on-air" | "done" | "skipped";
export interface Segment {
  id: string;
  kind: SegmentKind;
  title: string;
  stage: StageId;
  minS: number;
  recS: number;
  maxS: number;
  priority: Priority;
  status: SegmentStatus;
  approved: boolean;
  locked: boolean;
  beats: Beat[];
  itemIds: string[];
  sources: Source[];
  estimatedS: number;
  /** real seconds on air once played */
  actualS?: number;
  note?: string;
  /** lines written by the AI narrator in this segment */
  ai?: number;
}

export interface Edition {
  id: string;
  createdAt: number;
  title: string;
  modes: Mode[];
  leagues: string[];
  targetMin: number;
  segments: Segment[];
  items: Record<string, Item>;
  estimatedS: number;
  warnings: string[];
}

export type DirectorMode = "AUTO" | "SEMI" | "MANUAL";
