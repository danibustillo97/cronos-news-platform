// Live Match Engine — the single source of truth for WHICH matches exist today,
// in WHAT real state, and what each one can be used for.
//
//  - Real provider states → canonical status (SCHEDULED, LIVE, HT, BREAK, FINISHED,
//    POSTPONED, CANCELLED, UNKNOWN). A match is LIVE only when the provider says so.
//  - Days are Colombia days (America/Bogota), never the device's zone nor UTC.
//  - Categories: EN VIVO AHORA · PRÓXIMOS · FINALIZADOS HOY · ANTERIORES (independent).
//  - Eligibility: only LIVE / HT / BREAK can be produced live; SCHEDULED for previa,
//    FINISHED for post-match; POSTPONED / CANCELLED / UNKNOWN never go live.
//  - Reconciliation: a failed read keeps what was known (marked stale) and never
//    promotes anything to live; a match missing from a response is kept until verified.
// Pure + tested.

export type MatchStatus = "SCHEDULED" | "LIVE" | "HT" | "BREAK" | "FINISHED" | "POSTPONED" | "CANCELLED" | "UNKNOWN";
export const ACTIVE_STATUSES: MatchStatus[] = ["LIVE", "HT", "BREAK"];
export const TZ = "America/Bogota";

export interface ProviderStatus { name?: string; state?: string; completed?: boolean; description?: string; detail?: string; shortDetail?: string }

const NAME_MAP: Record<string, MatchStatus> = {
  STATUS_SCHEDULED: "SCHEDULED", STATUS_TBD: "SCHEDULED", STATUS_DELAYED: "SCHEDULED",
  STATUS_IN_PROGRESS: "LIVE", STATUS_FIRST_HALF: "LIVE", STATUS_SECOND_HALF: "LIVE", STATUS_OVERTIME: "LIVE",
  STATUS_EXTRA_TIME: "LIVE", STATUS_FIRST_HALF_EXTRA_TIME: "LIVE", STATUS_SECOND_HALF_EXTRA_TIME: "LIVE", STATUS_SHOOTOUT: "LIVE",
  STATUS_HALFTIME: "HT",
  STATUS_END_PERIOD: "BREAK", STATUS_HALFTIME_ET: "BREAK", STATUS_END_OF_EXTRATIME: "BREAK", STATUS_END_OF_REGULATION: "BREAK",
  STATUS_SUSPENDED: "BREAK", STATUS_RAIN_DELAY: "BREAK",
  STATUS_FULL_TIME: "FINISHED", STATUS_FINAL: "FINISHED", STATUS_FINAL_AET: "FINISHED", STATUS_FINAL_PEN: "FINISHED", STATUS_FINAL_ET: "FINISHED",
  STATUS_POSTPONED: "POSTPONED",
  STATUS_CANCELED: "CANCELLED", STATUS_CANCELLED: "CANCELLED", STATUS_ABANDONED: "CANCELLED", STATUS_FORFEIT: "CANCELLED",
};

/** Provider (ESPN status.type) → canonical status. Unknown names fall back to the provider state only when it is explicit. */
export function normalizeStatus(s: ProviderStatus | null | undefined): MatchStatus {
  if (!s) return "UNKNOWN";
  const byName = s.name ? NAME_MAP[s.name.toUpperCase()] : undefined;
  if (byName) return byName;
  const text = `${s.description ?? ""} ${s.detail ?? ""} ${s.shortDetail ?? ""}`.toLowerCase();
  if (/postpon|aplaz/.test(text)) return "POSTPONED";
  if (/cancel|abandon|suspendid/.test(text)) return "CANCELLED";
  if (/half ?time|^ht$|descanso|entretiempo/.test(text)) return "HT";
  if (s.state === "in") return "LIVE";            // the provider marks it as being played
  if (s.state === "post" && s.completed) return "FINISHED";
  if (s.state === "pre") return "SCHEDULED";
  return "UNKNOWN";
}

/** Match-detail endpoint (state pre|in|post + status text) → canonical status (used to verify a missing match). */
export function statusFromDetail(state: string | undefined, statusText = ""): MatchStatus {
  return normalizeStatus({ state, completed: state === "post", detail: statusText });
}

export const isActive = (s: MatchStatus) => ACTIVE_STATUSES.includes(s);

// ---------------------------------------------------------------- Colombia days
const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
/** "YYYY-MM-DD" of an instant in Colombia. */
export const bogotaDay = (at: Date | number | string) => dayFmt.format(new Date(at));
/** "YYYYMMDD" of today in Colombia, shifted by `offset` days (provider query format). */
export function bogotaYmd(now: number, offset = 0): string {
  const [y, m, d] = bogotaDay(now).split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + offset, 12));
  return `${t.getUTCFullYear()}${String(t.getUTCMonth() + 1).padStart(2, "0")}${String(t.getUTCDate()).padStart(2, "0")}`;
}
export const bogotaTime = (at: string | number) => new Date(at).toLocaleTimeString("es-CO", { timeZone: TZ, hour: "numeric", minute: "2-digit" });
export const bogotaDate = (at: string | number) => new Date(at).toLocaleDateString("es-CO", { timeZone: TZ, weekday: "short", day: "numeric", month: "short" });

// ---------------------------------------------------------------- matches
export interface CenterTeam { id: string; name: string; short: string; logo?: string; score: number }
export interface CenterMatch {
  id: string; league: string; leagueName: string; kickoff: string;
  status: MatchStatus; statusName: string; detail: string; clock: string; period: number;
  home: CenterTeam; away: CenterTeam;
  /** When this match was last seen in a successful provider response. */
  seenAt: number;
  /** Consecutive successful responses without this match (kept until verified). */
  missing: number;
  /** Data not confirmed by the latest read (source down or match missing). */
  stale: boolean;
}

export interface Categories { live: CenterMatch[]; upcoming: CenterMatch[]; finishedToday: CenterMatch[]; previous: CenterMatch[] }

/** Independent categories by real status and Colombia day. Previous days never enter EN VIVO AHORA. */
export function classify(matches: Iterable<CenterMatch>, now: number): Categories {
  const today = bogotaDay(now);
  const out: Categories = { live: [], upcoming: [], finishedToday: [], previous: [] };
  for (const m of matches) {
    const day = bogotaDay(m.kickoff);
    if (isActive(m.status) && day >= bogotaDay(now - 86_400_000)) out.live.push(m);          // a match past midnight still counts
    else if (day < today) out.previous.push(m);
    else if (m.status === "FINISHED") out.finishedToday.push(m);
    else if (m.status === "SCHEDULED" || m.status === "POSTPONED" || m.status === "CANCELLED" || m.status === "UNKNOWN") out.upcoming.push(m);
    else out.previous.push(m);
  }
  const byKick = (a: CenterMatch, b: CenterMatch) => a.kickoff.localeCompare(b.kickoff);
  out.live.sort(byKick); out.upcoming.sort(byKick); out.finishedToday.sort((a, b) => b.kickoff.localeCompare(a.kickoff)); out.previous.sort((a, b) => b.kickoff.localeCompare(a.kickoff));
  return out;
}

/**
 * Merge a provider read into what is known.
 *  - `incoming === null` (failed read): nothing changes except `stale = true`; nothing is promoted to live.
 *  - a match absent from a successful read is kept (missing + 1, stale) so it can be verified, and dropped
 *    after `dropAfter` misses only if it is not in an active state.
 */
export function reconcile(prev: Map<string, CenterMatch>, incoming: Omit<CenterMatch, "seenAt" | "missing" | "stale">[] | null, now: number, dropAfter = 6): Map<string, CenterMatch> {
  const next = new Map<string, CenterMatch>();
  if (incoming === null) {
    prev.forEach((m, id) => next.set(id, { ...m, stale: true }));
    return next;
  }
  const seen = new Set<string>();
  for (const m of incoming) { seen.add(m.id); next.set(m.id, { ...m, seenAt: now, missing: 0, stale: false }); }
  prev.forEach((m, id) => {
    if (seen.has(id)) return;
    const missing = m.missing + 1;
    if (missing >= dropAfter && !isActive(m.status)) return;
    next.set(id, { ...m, missing, stale: true });
  });
  return next;
}

// ---------------------------------------------------------------- what each match can be used for
export type Usage = "live" | "preview" | "post" | "none";
export function usageOf(s: MatchStatus): Usage {
  if (isActive(s)) return "live";
  if (s === "SCHEDULED") return "preview";
  if (s === "FINISHED") return "post";
  return "none";
}
export const USAGE_LABEL: Record<Usage, string> = { live: "En vivo", preview: "Previa", post: "Postpartido", none: "No disponible" };
export const STATUS_LABEL: Record<MatchStatus, string> = { SCHEDULED: "Programado", LIVE: "En juego", HT: "Descanso", BREAK: "Pausa", FINISHED: "Finalizado", POSTPONED: "Aplazado", CANCELLED: "Cancelado", UNKNOWN: "Estado no verificado" };

/** Only matches confirmed active by the provider can be selected for the live production. */
export function liveEligible(m: Pick<CenterMatch, "status"> | undefined | null): boolean { return Boolean(m && isActive(m.status)); }

/** Graphics that need the match to have started (they show what happened in it). */
const NEEDS_STARTED = new Set(["stats", "timeline", "sub", "card", "goal-pro", "goal", "events", "var", "result-card", "player", "live"]);
/**
 * Central rule for a graphic bound to a match: postponed / cancelled / unverified matches
 * never go on air bound to live data; "started" graphics need a live or finished match.
 */
export function graphicAllowed(variant: string, status: MatchStatus | undefined): { ok: boolean; reason?: string } {
  const s = status ?? "UNKNOWN";
  if (s === "POSTPONED" || s === "CANCELLED") return { ok: false, reason: `Partido ${STATUS_LABEL[s].toLowerCase()}: no se emite` };
  if (NEEDS_STARTED.has(variant) && !(isActive(s) || s === "FINISHED")) return { ok: false, reason: s === "UNKNOWN" ? "Estado del partido no verificado" : "El partido no ha comenzado" };
  return { ok: true };
}

/** Validation before TAKE: every prepared graphic bound to a match must be allowed by that match's real status. */
export function checkTake(graphics: { name: string; variant?: string; matchRef?: { id: string } }[], statusOf: (id: string) => MatchStatus | undefined): { ok: boolean; problems: string[] } {
  const problems: string[] = [];
  for (const g of graphics) {
    if (!g.matchRef || !g.variant) continue;
    const r = graphicAllowed(g.variant, statusOf(g.matchRef.id));
    if (!r.ok) problems.push(`${g.name}: ${r.reason}`);
  }
  return { ok: problems.length === 0, problems };
}

/** Minute shown in lists: running clock only while LIVE; HT says DESCANSO; BREAK says PAUSA. */
export function liveLabel(m: Pick<CenterMatch, "status" | "clock" | "detail">): string {
  if (m.status === "HT") return "DESCANSO";
  if (m.status === "BREAK") return "PAUSA";
  if (m.status === "LIVE") return m.clock || m.detail || "EN JUEGO";
  return STATUS_LABEL[m.status];
}
