// Sports Event Engine — normalizes the match detail of the source (FastAPI
// /api/matches/{league}/{id}, ESPN underneath) into sports events with a stable
// id, validation state and data freshness. Pure and deterministic (clock injected).
//
// Rules (never air unconfirmed data):
//  - an event is PENDING when first seen and CONFIRMED once it was present in
//    `confirmReads` successful reads (default 2 ≈ 15–30 s);
//  - a known event that is missing from `retractReads` consecutive successful
//    reads becomes RETRACTED (e.g. goal disallowed by VAR);
//  - phase events (kickoff, half-time, second half, full-time, line-ups published)
//    are derived from the match state and follow the same confirmation;
//  - freshness: FRESH while the last successful read is recent, STALE after
//    `staleAfterMs` (or after a failed read), UNAVAILABLE before the first read.
//  - dedupe: events are keyed by the source id, so a reconnection never repeats them.

export type EventType =
  | "goal" | "penalty-goal" | "own-goal" | "yellow" | "red" | "sub" | "var"
  | "kickoff" | "half-time" | "second-half" | "full-time" | "lineups";
export type Validation = "pending" | "confirmed" | "retracted";
export type Freshness = "fresh" | "stale" | "unavailable";
export type DataState = "confirmed" | "pending" | "unavailable" | "stale";
export type MatchState = "pre" | "in" | "post";

export interface PersonRef { id: string; name: string }
export interface SportsEvent {
  id: string;                  // source event id, or `${matchId}:${phase}` for derived phase events
  matchId: string;
  league: string;
  type: EventType;
  team?: "home" | "away";
  player?: PersonRef;
  assist?: PersonRef;
  playerOut?: string;
  minute: string;
  minuteValue: number;
  text?: string;
  source: "espn";
  firstSeen: number;
  lastSeen: number;
  observations: number;
  misses: number;
  status: Validation;
  /** 0–1: pending 0.5, confirmed 1, retracted 0. */
  confidence: number;
  /** Already in the first read of this session: history — shown, but it does not trigger automation. */
  baseline?: boolean;
}

export interface SourceDetail {
  id: string; league: string; leagueName?: string; state?: string; statusText?: string; clock?: string; period?: number; date?: string;
  home: { id?: string; name: string; short?: string; logo?: string; score?: number | null };
  away: { id?: string; name: string; short?: string; logo?: string; score?: number | null };
  events?: { id: string; minute: string; type: string; team: "home" | "away" | null; player: PersonRef | null; assist?: PersonRef | null; text?: string }[];
  stats?: { key: string; label: string; home: number; away: number; percent?: boolean }[];
  lineups?: { home?: unknown[]; away?: unknown[] };
}

export interface MatchSnapshot {
  matchId: string; league: string; leagueName?: string; state: MatchState; statusText: string; clock: string; period: number; kickoff?: string;
  home: { name: string; short: string; logo?: string; score: number };
  away: { name: string; short: string; logo?: string; score: number };
  stats: { key: string; label: string; home: number; away: number; percent?: boolean }[];
  lineupsAvailable: boolean;
  fetchedAt: number;
}

export interface IngestResult { confirmed: SportsEvent[]; retracted: SportsEvent[]; pending: SportsEvent[] }
export interface StoreOptions { confirmReads?: number; retractReads?: number; staleAfterMs?: number }

export const minuteValue = (m: string) => { const n = (m.match(/\d+/g) ?? []).map(Number); return (n[0] ?? 0) + (n[1] ?? 0); };

function mapType(raw: string, text = ""): EventType | null {
  const t = raw.toLowerCase();
  if (t === "goal" || t === "penalty-goal" || t === "own-goal" || t === "yellow" || t === "red" || t === "sub") return t;
  if (/disallowed|var/i.test(text) && /goal|penal|var/i.test(text)) return "var";
  return null;
}
const parseOut = (text = "") => text.match(/replaces (.+?)(?: because of an injury)?\.?\s*$/i)?.[1]?.trim();

export class MatchEventStore {
  private readonly events = new Map<string, SportsEvent>();
  private snapshot: MatchSnapshot | null = null;
  private lastOk = 0;
  private lastFail = 0;
  private reads = 0;
  private readonly opts: Required<StoreOptions>;

  constructor(readonly matchId: string, opts: StoreOptions = {}) {
    this.opts = { confirmReads: opts.confirmReads ?? 2, retractReads: opts.retractReads ?? 2, staleAfterMs: opts.staleAfterMs ?? 45_000 };
  }

  /** One successful read of the source. Returns the events whose state changed in this read. */
  ingest(detail: SourceDetail, now: number): IngestResult {
    const state: MatchState = detail.state === "in" || detail.state === "post" ? detail.state : "pre";
    const lineupsAvailable = Boolean(detail.lineups?.home?.length && detail.lineups?.away?.length);
    this.snapshot = {
      matchId: detail.id, league: detail.league, leagueName: detail.leagueName, state, statusText: detail.statusText ?? "", clock: detail.clock ?? "",
      period: detail.period ?? 0, kickoff: detail.date,
      home: { name: detail.home.name, short: detail.home.short || detail.home.name.slice(0, 3).toUpperCase(), logo: detail.home.logo, score: detail.home.score ?? 0 },
      away: { name: detail.away.name, short: detail.away.short || detail.away.name.slice(0, 3).toUpperCase(), logo: detail.away.logo, score: detail.away.score ?? 0 },
      stats: detail.stats ?? [], lineupsAvailable, fetchedAt: now,
    };
    this.lastOk = now;
    const firstRead = this.reads === 0;
    this.reads += 1;

    // what the source says right now
    const seen = new Map<string, Omit<SportsEvent, "firstSeen" | "lastSeen" | "observations" | "misses" | "status" | "confidence">>();
    for (const e of detail.events ?? []) {
      const type = mapType(e.type, e.text);
      if (!type) continue;
      seen.set(e.id, {
        id: e.id, matchId: detail.id, league: detail.league, type, team: e.team ?? undefined, player: e.player ?? undefined, assist: e.assist ?? undefined,
        playerOut: type === "sub" ? parseOut(e.text) : undefined, minute: e.minute, minuteValue: minuteValue(e.minute), text: e.text, source: "espn",
      });
    }
    const phase = (type: EventType, minute: string) => seen.set(`${detail.id}:${type}`, { id: `${detail.id}:${type}`, matchId: detail.id, league: detail.league, type, minute, minuteValue: minuteValue(minute), source: "espn" });
    if (lineupsAvailable) phase("lineups", "");
    if (state !== "pre") phase("kickoff", "0'");
    if (/half ?time|^ht$|descanso|entretiempo/i.test(detail.statusText ?? "") || (state === "in" && (detail.period ?? 0) >= 2)) phase("half-time", "45'");
    if (state === "in" && (detail.period ?? 0) >= 2) phase("second-half", "46'");
    if (state === "post") phase("full-time", "90'");

    const result: IngestResult = { confirmed: [], retracted: [], pending: [] };
    for (const [id, base] of seen) {
      const known = this.events.get(id);
      if (!known) {
        const ev: SportsEvent = { ...base, firstSeen: now, lastSeen: now, observations: 1, misses: 0, status: "pending", confidence: 0.5, baseline: firstRead };
        if (ev.observations >= this.opts.confirmReads) { ev.status = "confirmed"; ev.confidence = 1; result.confirmed.push(ev); } else result.pending.push(ev);
        this.events.set(id, ev);
        continue;
      }
      known.lastSeen = now;
      known.misses = 0;
      known.observations += 1;
      if (known.status === "retracted") continue; // a retraction is final for that id
      Object.assign(known, { team: base.team, player: base.player, assist: base.assist, minute: base.minute, minuteValue: base.minuteValue, text: base.text, playerOut: base.playerOut });
      if (known.status === "pending" && known.observations >= this.opts.confirmReads) { known.status = "confirmed"; known.confidence = 1; result.confirmed.push(known); }
    }
    // known events the source no longer reports (phase events never retract: the state moved on)
    for (const ev of this.events.values()) {
      if (seen.has(ev.id) || ev.status === "retracted" || ev.id.startsWith(`${detail.id}:`)) continue;
      ev.misses += 1;
      if (ev.misses >= this.opts.retractReads) { ev.status = "retracted"; ev.confidence = 0; result.retracted.push(ev); }
    }
    return result;
  }

  /** A failed read: nothing changes, data becomes stale. */
  markFailure(now: number) { this.lastFail = now; }

  freshness(now: number): Freshness {
    if (!this.lastOk) return "unavailable";
    if (this.lastFail > this.lastOk || now - this.lastOk > this.opts.staleAfterMs) return "stale";
    return "fresh";
  }

  /** State of a piece of data for display: never shown as current when the source is behind. */
  dataState(now: number, available = true): DataState {
    const f = this.freshness(now);
    if (f === "unavailable" || !available) return "unavailable";
    return f === "stale" ? "stale" : "confirmed";
  }

  getSnapshot() { return this.snapshot; }
  getEvents(): SportsEvent[] { return [...this.events.values()].sort((a, b) => a.minuteValue - b.minuteValue || a.firstSeen - b.firstSeen); }
  get lastSuccess() { return this.lastOk; }

  /** For persistence across reloads (dedupe survives a page refresh). */
  serialize() { return { matchId: this.matchId, events: this.getEvents(), lastOk: this.lastOk }; }
  restore(data: { matchId: string; events: SportsEvent[]; lastOk?: number }) {
    if (data.matchId !== this.matchId) return;
    data.events.forEach((e) => this.events.set(e.id, { ...e }));
    this.lastOk = 0; // restored data is never "fresh" until the source answers again
  }
}

export const EVENT_LABEL: Record<EventType, string> = {
  goal: "Gol", "penalty-goal": "Gol de penal", "own-goal": "Autogol", yellow: "Amarilla", red: "Roja", sub: "Cambio", var: "VAR",
  kickoff: "Inicio", "half-time": "Descanso", "second-half": "Segundo tiempo", "full-time": "Final", lineups: "Alineaciones confirmadas",
};
