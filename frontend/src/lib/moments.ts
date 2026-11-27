// Momentos de partido para el feed (goles, rojas, finales):
//   GET /api/matches/moments -> { moments: Moment[], live: number, updatedAt }

export type MomentKind = 'goal' | 'red' | 'incident' | 'final'
export type MomentEventType = 'goal' | 'own-goal' | 'penalty-goal' | 'penalty-miss' | 'yellow' | 'red' | 'var' | 'sub' | null
export interface MomentTeam { name: string; short: string; logo: string | null }
export interface Moment {
  id: string
  kind: MomentKind
  eventType: MomentEventType
  text: string
  scoreBefore: { home: number; away: number } | null
  impact: string | null
  matchId: string
  league: string
  leagueName: string
  minute: string
  minuteValue: number
  team: 'home' | 'away' | null
  player: { id: string; name: string } | null
  assist: { id: string; name: string } | null
  score: { home: number; away: number }
  headline: string
  home: MomentTeam
  away: MomentTeam
  state: 'in' | 'post'
  kickoff: string
}

/** Un ítem del feed: un gol, una roja, un final suelto o varios finales de la misma liga. */
export type MomentItem =
  | { type: 'goal' | 'red' | 'incident' | 'final'; key: string; moment: Moment }
  | { type: 'results'; key: string; league: string; leagueName: string; moments: Moment[] }

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}
const str = (v: unknown, max = 300) => (typeof v === 'string' ? v.trim().slice(0, max) : typeof v === 'number' && Number.isFinite(v) ? String(v) : '')
const num = (v: unknown) => { const n = typeof v === 'number' ? v : Number(v); return Number.isFinite(n) && n >= 0 ? n : 0 }
const ref = (v: unknown) => (isRecord(v) && str(v.name) ? { id: str(v.id, 64), name: str(v.name, 120) } : null)
const team = (v: unknown): MomentTeam => {
  const r = isRecord(v) ? v : {}
  const name = str(r.name, 80) || '—'
  return { name, short: str(r.short, 30) || name, logo: str(r.logo, 600) || null }
}

export function normalizeMoments(raw: unknown): Moment[] {
  const list = isRecord(raw) && Array.isArray(raw.moments) ? raw.moments : Array.isArray(raw) ? raw : []
  const seen = new Set<string>()
  const out: Moment[] = []
  for (const m of list) {
    if (!isRecord(m)) continue
    const id = str(m.id, 128)
    const kind = m.kind === 'goal' || m.kind === 'red' || m.kind === 'incident' || m.kind === 'final' ? m.kind : null
    if (!id || !kind || seen.has(id) || !str(m.matchId, 64)) continue
    seen.add(id)
    const sc = isRecord(m.score) ? m.score : {}
    const before = isRecord(m.scoreBefore) ? m.scoreBefore : null
    out.push({
      id, kind,
      eventType: m.eventType === 'goal' || m.eventType === 'own-goal' || m.eventType === 'penalty-goal' || m.eventType === 'penalty-miss' || m.eventType === 'yellow' || m.eventType === 'red' || m.eventType === 'var' || m.eventType === 'sub' ? m.eventType : null,
      text: str(m.text, 500),
      scoreBefore: before ? { home: num(before.home), away: num(before.away) } : null,
      impact: str(m.impact, 220) || null,
      matchId: str(m.matchId, 64), league: str(m.league, 40), leagueName: str(m.leagueName, 80),
      minute: str(m.minute, 12), minuteValue: num(m.minuteValue),
      team: m.team === 'home' || m.team === 'away' ? m.team : null,
      player: ref(m.player), assist: ref(m.assist),
      score: { home: num(sc.home), away: num(sc.away) },
      headline: str(m.headline, 200),
      home: team(m.home), away: team(m.away),
      state: m.state === 'post' ? 'post' : 'in',
      kickoff: str(m.kickoff, 40),
    })
  }
  return out
}

/**
 * Ítems del feed en el orden del backend (más recientes primero). Los
 * finales de una misma liga se agrupan en "Resultados de hoy · liga" en la
 * posición del primero; un final solo queda como tarjeta de resultado.
 */
export function momentItems(moments: Moment[]): MomentItem[] {
  const finalsByLeague = new Map<string, Moment[]>()
  for (const m of moments) if (m.kind === 'final') finalsByLeague.set(m.league, [...(finalsByLeague.get(m.league) ?? []), m])
  const out: MomentItem[] = []
  const emitted = new Set<string>()
  for (const m of moments) {
    if (m.kind !== 'final') { out.push({ type: m.kind, key: `mo-${m.id}`, moment: m }); continue }
    if (emitted.has(m.league)) continue
    emitted.add(m.league)
    const group = finalsByLeague.get(m.league) ?? [m]
    out.push(group.length > 1
      ? { type: 'results', key: `mo-results-${m.league}`, league: m.league, leagueName: m.leagueName, moments: group }
      : { type: 'final', key: `mo-${m.id}`, moment: m })
  }
  return out
}

/** Ids que no estaban en la lectura anterior (para resaltar lo nuevo). */
export function newMomentIds(prev: Set<string> | null, next: Moment[]): Set<string> {
  if (!prev) return new Set()
  return new Set(next.filter((m) => !prev.has(m.id)).map((m) => m.id))
}
