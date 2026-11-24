// Jugadores -- tipos + lógica pura de perfil y comparación.
//
// Contrato (backend):
//   GET /api/players/search?q=texto -> { players: PlayerHit[] }
//   GET /api/players/{id}           -> PlayerProfile

export interface PlayerHit {
  id: string
  name: string
  team: string | null
  image: string | null
}

export interface PlayerStats {
  starts: number
  goals: number
  assists: number
  shots: number
  shotsOnTarget: number
  yellowCards: number
  redCards: number
  foulsCommitted: number
  foulsSuffered: number
  offsides: number
}

export interface PlayerSeason {
  season: string
  competition: string
  competitionId: string | null
  team: string | null
  teamLogo: string | null
  stats: PlayerStats
}

export interface PlayerProfile {
  id: string
  name: string
  age: number | null
  position: string | null
  team: string | null
  teamLogo: string | null
  nationality: string | null
  flag: string | null
  jersey: string | null
  image: string | null
  seasons: PlayerSeason[]
}

export const STAT_KEYS = [
  'starts', 'goals', 'assists', 'shots', 'shotsOnTarget',
  'yellowCards', 'redCards', 'foulsCommitted', 'foulsSuffered', 'offsides',
] as const satisfies readonly (keyof PlayerStats)[]

export const STAT_LABELS: Record<keyof PlayerStats, string> = {
  starts: 'Titularidades',
  goals: 'Goles',
  assists: 'Asistencias',
  shots: 'Remates',
  shotsOnTarget: 'Remates al arco',
  yellowCards: 'Amarillas',
  redCards: 'Rojas',
  foulsCommitted: 'Faltas cometidas',
  foulsSuffered: 'Faltas recibidas',
  offsides: 'Fueras de lugar',
}

/** Estadísticas donde un número menor es mejor (disciplina). */
export const LOWER_IS_BETTER = new Set<keyof PlayerStats>(['yellowCards', 'redCards', 'foulsCommitted', 'offsides'])

export const POPULAR_PLAYERS = ['Luis Díaz', 'James Rodríguez', 'Kylian Mbappé', 'Erling Haaland', 'Lionel Messi', 'Jhon Durán']

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}
function str(v: unknown, max = 200): string | null {
  if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t ? t.slice(0, max) : null
}
function num(v: unknown): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN
  return Number.isFinite(n) && n > 0 ? n : 0
}

export function emptyStats(): PlayerStats {
  return { starts: 0, goals: 0, assists: 0, shots: 0, shotsOnTarget: 0, yellowCards: 0, redCards: 0, foulsCommitted: 0, foulsSuffered: 0, offsides: 0 }
}

export function normalizeStats(raw: unknown): PlayerStats {
  const out = emptyStats()
  if (!isRecord(raw)) return out
  for (const k of STAT_KEYS) out[k] = num(raw[k])
  return out
}

export function normalizeSearch(raw: unknown): PlayerHit[] {
  const list = isRecord(raw) && Array.isArray(raw.players) ? raw.players : Array.isArray(raw) ? raw : []
  const out: PlayerHit[] = []
  for (const p of list) {
    if (!isRecord(p)) continue
    const id = str(p.id, 64)
    const name = str(p.name)
    if (id && name) out.push({ id, name, team: str(p.team), image: str(p.image, 600) })
  }
  return out
}

export function normalizeProfile(raw: unknown): PlayerProfile | null {
  if (!isRecord(raw)) return null
  const id = str(raw.id, 64)
  const name = str(raw.name)
  if (!id || !name) return null
  const age = num(raw.age)
  const seasons: PlayerSeason[] = Array.isArray(raw.seasons)
    ? raw.seasons.filter(isRecord).map((s) => ({
      season: str(s.season, 40) ?? '—',
      competition: localizeCompetition(str(s.competition, 120) ?? 'Competición'),
      competitionId: str(s.competitionId, 60),
      team: str(s.team),
      teamLogo: str(s.teamLogo, 600),
      stats: normalizeStats(s.stats),
    }))
    : []
  return {
    id, name,
    age: age > 0 ? Math.floor(age) : null,
    position: str(raw.position, 60),
    team: str(raw.team),
    teamLogo: str(raw.teamLogo, 600),
    nationality: str(raw.nationality, 80),
    flag: str(raw.flag, 600),
    jersey: str(raw.jersey, 8),
    image: str(raw.image, 600),
    seasons,
  }
}

export function sumStats(list: PlayerStats[]): PlayerStats {
  const out = emptyStats()
  for (const s of list) for (const k of STAT_KEYS) out[k] += s[k]
  return out
}

export const ALL_SEASONS = 'all'

export function seasonKey(s: Pick<PlayerSeason, 'season' | 'competition'>, index: number): string {
  return `${index}:${s.season}|${s.competition}`
}

export function seasonOptions(profile: PlayerProfile): { key: string; label: string }[] {
  const opts = profile.seasons.map((s, i) => ({ key: seasonKey(s, i), label: `${s.season} · ${s.competition}` }))
  return profile.seasons.length > 1 ? [{ key: ALL_SEASONS, label: 'Total de la carrera registrada' }, ...opts] : opts
}

/**
 * Temporada por defecto: dentro de la temporada más reciente (la primera
 * que manda el backend), la competición donde más jugó -- con empate, la
 * liga (trae competitionId). Evita abrir en una copa con 1 partido.
 */
export function defaultSeasonKey(profile: PlayerProfile): string {
  const first = profile.seasons[0]
  if (!first) return ALL_SEASONS
  let best = 0
  profile.seasons.forEach((s, i) => {
    if (s.season !== first.season) return
    const b = profile.seasons[best]
    const better = s.stats.starts > b.stats.starts
      || (s.stats.starts === b.stats.starts && Boolean(s.competitionId) && !b.competitionId)
    if (better) best = i
  })
  return seasonKey(profile.seasons[best], best)
}

// ESPN a veces manda nombres de competición en inglés.
const COMPETITION_ES: Record<string, string> = {
  'international friendly': 'Amistoso internacional',
  'club friendly': 'Amistoso de clubes',
  'german supercup': 'Supercopa de Alemania',
  'german dfb pokal': 'Copa de Alemania',
  'fifa world cup': 'Mundial',
  'fifa club world cup': 'Mundial de Clubes',
  'uefa champions league': 'Champions League',
  'uefa europa league': 'Europa League',
  'uefa conference league': 'Conference League',
  'uefa nations league': 'Liga de Naciones',
  'english fa cup': 'FA Cup',
  'english carabao cup': 'Copa de la Liga inglesa',
  'english league cup': 'Copa de la Liga inglesa',
  'spanish copa del rey': 'Copa del Rey',
  'spanish supercopa': 'Supercopa de España',
  'italian coppa italia': 'Copa Italia',
  'italian supercoppa': 'Supercopa de Italia',
  'french coupe de france': 'Copa de Francia',
  'copa america': 'Copa América',
  'fifa world cup qualifying - conmebol': 'Eliminatorias Sudamericanas',
  'conmebol libertadores': 'Copa Libertadores',
  'conmebol sudamericana': 'Copa Sudamericana',
  'colombian primera a': 'Liga BetPlay',
  'colombian copa colombia': 'Copa Colombia',
}

export function localizeCompetition(name: string): string {
  return COMPETITION_ES[name.trim().toLowerCase()] ?? name
}

export function selectStats(profile: PlayerProfile, key: string): PlayerStats {
  if (key === ALL_SEASONS) return sumStats(profile.seasons.map((s) => s.stats))
  const index = profile.seasons.findIndex((s, i) => seasonKey(s, i) === key)
  return index >= 0 ? profile.seasons[index].stats : sumStats(profile.seasons.map((s) => s.stats))
}

export interface DerivedStats {
  goalContributions: number
  shotAccuracy: number | null // % de remates al arco
  conversion: number | null // % de goles sobre remates
  cards: number
  goalsPerStart: number | null
}

const round1 = (n: number) => Math.round(n * 10) / 10

export function derive(s: PlayerStats): DerivedStats {
  return {
    goalContributions: s.goals + s.assists,
    shotAccuracy: s.shots > 0 ? round1((Math.min(s.shotsOnTarget, s.shots) / s.shots) * 100) : null,
    conversion: s.shots > 0 ? round1((Math.min(s.goals, s.shots) / s.shots) * 100) : null,
    cards: s.yellowCards + s.redCards,
    goalsPerStart: s.starts > 0 ? Math.round((s.goals / s.starts) * 100) / 100 : null,
  }
}

export type Winner = 'a' | 'b' | 'tie'

export interface CompareRow {
  key: string
  label: string
  a: number | null
  b: number | null
  /** Ancho de cada barra espejada, 0-100, relativo al mayor de los dos. */
  aPct: number
  bPct: number
  winner: Winner | null
  lowerIsBetter: boolean
  suffix: string
}

export function compareValues(a: number | null, b: number | null, lowerIsBetter: boolean): Pick<CompareRow, 'aPct' | 'bPct' | 'winner'> {
  if (a === null || b === null) {
    const max = Math.max(a ?? 0, b ?? 0)
    return { aPct: a && max ? (a / max) * 100 : 0, bPct: b && max ? (b / max) * 100 : 0, winner: null }
  }
  const max = Math.max(a, b)
  const aPct = max > 0 ? Math.round((a / max) * 1000) / 10 : 0
  const bPct = max > 0 ? Math.round((b / max) * 1000) / 10 : 0
  if (a === b) return { aPct, bPct, winner: 'tie' }
  const aWins = lowerIsBetter ? a < b : a > b
  return { aPct, bPct, winner: aWins ? 'a' : 'b' }
}

export function compareStats(a: PlayerStats, b: PlayerStats): CompareRow[] {
  const da = derive(a)
  const db = derive(b)
  const rows: CompareRow[] = [
    { key: 'goalContributions', label: 'Goles + asistencias', a: da.goalContributions, b: db.goalContributions, lowerIsBetter: false, suffix: '' } as CompareRow,
    ...STAT_KEYS.map((k) => ({ key: k, label: STAT_LABELS[k], a: a[k], b: b[k], lowerIsBetter: LOWER_IS_BETTER.has(k), suffix: '' }) as CompareRow),
    { key: 'shotAccuracy', label: 'Precisión de remate', a: da.shotAccuracy, b: db.shotAccuracy, lowerIsBetter: false, suffix: '%' } as CompareRow,
    { key: 'conversion', label: 'Conversión', a: da.conversion, b: db.conversion, lowerIsBetter: false, suffix: '%' } as CompareRow,
  ]
  return rows.map((r) => ({ ...r, ...compareValues(r.a, r.b, r.lowerIsBetter) }))
}

/** Marcador global de la comparación (filas ganadas por cada uno). */
export function compareScore(rows: CompareRow[]): { a: number; b: number } {
  return rows.reduce((acc, r) => ({ a: acc.a + (r.winner === 'a' ? 1 : 0), b: acc.b + (r.winner === 'b' ? 1 : 0) }), { a: 0, b: 0 })
}

// --------------------------------------------------------- búsquedas recientes

export const RECENT_KEY = 'nexus.players.recent'
type KV = Pick<Storage, 'getItem' | 'setItem'>

export function readRecent(storage: KV | null): PlayerHit[] {
  try {
    return normalizeSearch(JSON.parse(storage?.getItem(RECENT_KEY) ?? '[]')).slice(0, 8)
  } catch {
    return []
  }
}

export function pushRecent(storage: KV | null, hit: PlayerHit): PlayerHit[] {
  const next = [hit, ...readRecent(storage).filter((h) => h.id !== hit.id)].slice(0, 8)
  try { storage?.setItem(RECENT_KEY, JSON.stringify(next)) } catch { /* bloqueado */ }
  return next
}

export function safeStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null
  } catch {
    return null
  }
}
