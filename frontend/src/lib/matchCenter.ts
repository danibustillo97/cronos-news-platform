// Centro de partido -- lógica pura. Contrato (backend):
//   GET /api/matches/{league}/{eventId}            -> MatchDetail
//   GET /api/matches/insights/player/{athleteId}   -> PlayerInsights

export type MatchState = 'pre' | 'in' | 'post'
export type EventType = 'goal' | 'own-goal' | 'penalty-goal' | 'penalty-miss' | 'yellow' | 'red' | 'sub' | 'var' | 'period' | 'other'
export type Side = 'home' | 'away'

export interface DetailTeam { id: string; name: string; short: string; logo: string | null; score: number; form: string }
export interface MatchEvent { id: string; minute: string; type: EventType; team: Side | null; player: { id: string; name: string } | null; assist: { id: string; name: string } | null; text: string }
export interface MatchStat { key: string; label: string; home: number; away: number; percent: boolean }
export interface LineupPlayer { id: string; name: string; jersey: string; position: string; starter: boolean }
export interface MatchDetail {
  id: string
  league: string
  leagueName: string
  state: MatchState
  clock: string
  period: number
  statusText: string
  date: string
  venue: string | null
  home: DetailTeam
  away: DetailTeam
  events: MatchEvent[]
  stats: MatchStat[]
  lineups: { home: LineupPlayer[]; away: LineupPlayer[] }
  commentary: { minute: string; text: string }[]
  updatedAt: string
}

export interface PlayerInsights {
  player: { id: string; name: string; team: string | null; image: string | null; position: string | null }
  facts: string[]
  lastGames: { date: string; opponent: string; homeAway: string; result: string; score: string; goals: number; assists: number }[]
  season: { season: string; competition: string; goals: number; assists: number; starts: number; shots: number; shotsOnTarget: number } | null
}

const TYPES: readonly EventType[] = ['goal', 'own-goal', 'penalty-goal', 'penalty-miss', 'yellow', 'red', 'sub', 'var', 'period', 'other']

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}
const str = (v: unknown, max = 300) => (typeof v === 'string' ? v.trim().slice(0, max) : typeof v === 'number' && Number.isFinite(v) ? String(v) : '')
const num = (v: unknown) => { const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN; return Number.isFinite(n) && n >= 0 ? n : 0 }
const ref = (v: unknown) => (isRecord(v) && str(v.name) ? { id: str(v.id, 64), name: str(v.name, 120) } : null)

function team(v: unknown): DetailTeam {
  const r = isRecord(v) ? v : {}
  const name = str(r.name, 80) || '—'
  return { id: str(r.id, 64), name, short: str(r.short, 30) || name, logo: str(r.logo, 600) || null, score: num(r.score), form: str(r.form, 10).toUpperCase().replace(/[^WDL]/g, '') }
}

function lineup(v: unknown): LineupPlayer[] {
  return (Array.isArray(v) ? v : []).filter(isRecord).map((p) => ({
    id: str(p.id, 64), name: str(p.name, 120), jersey: str(p.jersey, 4), position: str(p.position, 30), starter: p.starter === true,
  })).filter((p) => p.name)
}

export function normalizeMatchDetail(raw: unknown): MatchDetail | null {
  if (!isRecord(raw) || !str(raw.id, 64)) return null
  const state: MatchState = raw.state === 'in' || raw.state === 'post' ? raw.state : 'pre'
  const lu = isRecord(raw.lineups) ? raw.lineups : {}
  return {
    id: str(raw.id, 64),
    league: str(raw.league, 40),
    leagueName: str(raw.leagueName, 80),
    state,
    clock: str(raw.clock, 20),
    period: num(raw.period),
    statusText: str(raw.statusText, 60),
    date: str(raw.date, 40),
    venue: str(raw.venue, 120) || null,
    home: team(raw.home),
    away: team(raw.away),
    events: (Array.isArray(raw.events) ? raw.events : []).filter(isRecord).map((e, i) => ({
      id: str(e.id, 64) || `e${i}`,
      minute: str(e.minute, 12),
      type: TYPES.includes(e.type as EventType) ? (e.type as EventType) : 'other',
      team: e.team === 'home' || e.team === 'away' ? e.team : null,
      player: ref(e.player),
      assist: ref(e.assist),
      text: str(e.text, 300),
    })),
    stats: (Array.isArray(raw.stats) ? raw.stats : []).filter(isRecord).map((s) => ({
      key: str(s.key, 40), label: str(s.label, 60), home: num(s.home), away: num(s.away), percent: s.percent === true,
    })).filter((s) => s.label),
    lineups: { home: lineup(lu.home), away: lineup(lu.away) },
    commentary: (Array.isArray(raw.commentary) ? raw.commentary : []).filter(isRecord).map((c) => ({ minute: str(c.minute, 12), text: str(c.text, 500) })).filter((c) => c.text).slice(0, 25),
    updatedAt: str(raw.updatedAt, 64),
  }
}

export function normalizeInsights(raw: unknown): PlayerInsights | null {
  if (!isRecord(raw) || !isRecord(raw.player) || !str(raw.player.name)) return null
  const p = raw.player
  const s = isRecord(raw.season) ? raw.season : null
  return {
    player: { id: str(p.id, 64), name: str(p.name, 120), team: str(p.team, 80) || null, image: str(p.image, 600) || null, position: str(p.position, 40) || null },
    facts: (Array.isArray(raw.facts) ? raw.facts : []).map((f) => str(f, 300)).filter(Boolean).slice(0, 6),
    lastGames: (Array.isArray(raw.lastGames) ? raw.lastGames : []).filter(isRecord).map((g) => ({
      date: str(g.date, 40), opponent: str(g.opponent, 80), homeAway: str(g.homeAway, 10), result: str(g.result, 4).toUpperCase(),
      score: str(g.score, 12), goals: num(g.goals), assists: num(g.assists),
    })).slice(0, 5),
    season: s ? { season: str(s.season, 20), competition: str(s.competition, 80), goals: num(s.goals), assists: num(s.assists), starts: num(s.starts), shots: num(s.shots), shotsOnTarget: num(s.shotsOnTarget) } : null,
  }
}

export const isGoalEvent = (t: EventType) => t === 'goal' || t === 'own-goal' || t === 'penalty-goal'

export const EVENT_META: Record<EventType, { icon: string; label: string }> = {
  goal: { icon: '⚽', label: 'Gol' },
  'own-goal': { icon: '⚽', label: 'Autogol' },
  'penalty-goal': { icon: '⚽', label: 'Gol de penal' },
  'penalty-miss': { icon: '❌', label: 'Penal fallado' },
  yellow: { icon: '🟨', label: 'Tarjeta amarilla' },
  red: { icon: '🟥', label: 'Tarjeta roja' },
  sub: { icon: '🔁', label: 'Cambio' },
  var: { icon: '📺', label: 'Revisión VAR' },
  period: { icon: '⏱️', label: 'Período' },
  other: { icon: '•', label: 'Jugada' },
}

/** "45+2'" -> 47, "10'" -> 10; para ordenar. */
export function minuteValue(minute: string): number {
  const m = minute.match(/(\d+)(?:\s*\+\s*(\d+))?/)
  return m ? Number(m[1]) + (m[2] ? Number(m[2]) / 100 : 0) : -1
}

/** Más recientes primero (cuando está en vivo) o en orden del partido. */
export function sortEvents(events: MatchEvent[], newestFirst: boolean): MatchEvent[] {
  return events.map((e, i) => ({ e, i })).sort((a, b) => {
    const d = minuteValue(a.e.minute) - minuteValue(b.e.minute)
    return (newestFirst ? -d : d) || (newestFirst ? b.i - a.i : a.i - b.i)
  }).map(({ e }) => e)
}

const SIGNIFICANT: EventType[] = ['goal', 'own-goal', 'penalty-goal', 'penalty-miss', 'red', 'yellow', 'var', 'sub']

/** Última jugada relevante en una línea: "⚽ 10' Gyökeres". */
export function lastEventLine(events: MatchEvent[]): string | null {
  const ev = sortEvents(events.filter((e) => SIGNIFICANT.includes(e.type)), true)[0]
  if (!ev) return null
  const who = ev.player?.name ?? EVENT_META[ev.type].label
  return `${EVENT_META[ev.type].icon} ${ev.minute ? `${ev.minute.replace(/'?$/, "'")} ` : ''}${who}`.trim()
}

/** Posesión (home %, away %) para la mini barra de "momentum"; null si no viene. */
export function possession(stats: MatchStat[]): { home: number; away: number } | null {
  const s = stats.find((x) => /possession|posesi/i.test(x.key) || /posesi/i.test(x.label))
  if (!s) return null
  const total = s.home + s.away
  if (total <= 0) return null
  const home = Math.round((s.home / total) * 100)
  return { home, away: 100 - home }
}

/** Barras espejadas: si es porcentaje, reparto; si no, relativo al mayor. */
export function statBar(s: MatchStat): { homePct: number; awayPct: number; leader: Side | null } {
  const total = s.home + s.away
  const max = Math.max(s.home, s.away)
  const homePct = s.percent ? (total > 0 ? (s.home / total) * 100 : 0) : max > 0 ? (s.home / max) * 100 : 0
  const awayPct = s.percent ? (total > 0 ? (s.away / total) * 100 : 0) : max > 0 ? (s.away / max) * 100 : 0
  return { homePct: Math.round(homePct), awayPct: Math.round(awayPct), leader: s.home === s.away ? null : s.home > s.away ? 'home' : 'away' }
}

/** ¿Hubo gol entre dos lecturas? Devuelve el lado que anotó (o null). */
export function detectGoal(prev: Pick<MatchDetail, 'home' | 'away'> | null, next: Pick<MatchDetail, 'home' | 'away'>): Side | null {
  if (!prev) return null
  if (next.home.score > prev.home.score) return 'home'
  if (next.away.score > prev.away.score) return 'away'
  return null
}

/** Ids de jugadores con gol (para pedir "datos inteligentes"), sin repetir. */
export function scorerIds(events: MatchEvent[]): string[] {
  return [...new Set(events.filter((e) => isGoalEvent(e.type) && e.type !== 'own-goal' && e.player?.id).map((e) => e.player!.id))]
}

/** Etiqueta del reloj: "63'" en vivo, "Final", "Hoy 3:00 p. m.". */
export function clockLabel(d: Pick<MatchDetail, 'state' | 'clock' | 'statusText'>): string {
  if (d.state === 'in') return d.clock ? (d.clock.endsWith("'") ? d.clock : `${d.clock}'`) : d.statusText || 'En juego'
  if (d.state === 'post') return 'Final'
  return d.statusText || 'Por jugar'
}
