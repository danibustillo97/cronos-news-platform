// Helpers puros de tablas de posiciones (filas reales de
// /api/sports/standings). ESPN a veces devuelve las filas fuera de orden
// (ej. 1, 3, 2) -- se ordenan por el rank numérico real, nunca se recalcula.

export interface StandingsRowData {
  rank: string
  team: string
  logo: string | null
  played: string
  won: string
  drawn: string
  lost: string
  points: string
  goalDifference: string | null
  goalsFor: string | null
  goalsAgainst: string | null
  noteColor?: string | null
  noteDescription?: string | null
}

function rankOf(row: StandingsRowData): number {
  const n = parseInt(row.rank, 10)
  return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER
}

export function sortStandings<T extends StandingsRowData>(rows: T[]): T[] {
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => rankOf(a.row) - rankOf(b.row) || a.index - b.index)
    .map(({ row }) => row)
}

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i

/** Solo colores hex válidos llegan al style -- nada arbitrario del proveedor. */
export function safeNoteColor(color: string | null | undefined): string | null {
  if (!color) return null
  const c = color.trim()
  return HEX.test(c) ? c : null
}

export interface LegendEntry { color: string; label: string }

/** Leyenda de zonas a partir de las notas reales (orden de aparición, sin duplicados). */
export function standingsLegend(rows: StandingsRowData[]): LegendEntry[] {
  const seen = new Map<string, LegendEntry>()
  for (const row of rows) {
    const color = safeNoteColor(row.noteColor)
    const label = row.noteDescription?.trim()
    if (!color || !label) continue
    const key = `${color.toLowerCase()}|${label}`
    if (!seen.has(key)) seen.set(key, { color, label })
  }
  return [...seen.values()]
}

/** "+3", "-1", "0" -- respeta lo que manda ESPN pero agrega el signo si falta. */
export function formatGoalDiff(value: string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—'
  const n = Number(value)
  if (!Number.isFinite(n)) return value
  return n > 0 ? `+${n}` : String(n)
}

// Traducción de las notas de zona más comunes de ESPN.
const NOTE_ES: Record<string, string> = {
  'Champions League': 'Champions League',
  'Champions League qualifiers': 'Previa de Champions',
  'Europa League': 'Europa League',
  'Conference League': 'Conference League',
  'Conference League qualifiers': 'Previa de Conference',
  Relegation: 'Descenso',
  'Relegation playoff': 'Repechaje de descenso',
  Promotion: 'Ascenso',
  'Copa Libertadores': 'Copa Libertadores',
  'Copa Sudamericana': 'Copa Sudamericana',
  'Next round': 'Siguiente fase',
  'Knockout round playoffs': 'Playoffs',
  'Round of 16': 'Octavos de final',
  Quarterfinals: 'Cuartos de final',
  Playoffs: 'Cuadrangulares',
}

export function noteLabelEs(note: string): string {
  return NOTE_ES[note.trim()] ?? note.trim()
}

/**
 * Rótulo de grupo cuando la tabla es corta (fase de grupos o
 * cuadrangulares). ESPN no manda el nombre del grupo: se nombra la fase.
 */
export function tableGroupLabel(league: string | null | undefined, rows: number): string | null {
  if (rows === 0 || rows >= 8) return null
  if (league === 'col.1') return `Cuadrangulares · ${rows} equipos`
  return `Fase de grupos · ${rows} equipos`
}

export interface StandingsGroup { name: string | null; table: StandingsRowData[] }
export interface CompetitionFormat { kind: string; teams: number | null; summary: string; stages: string[] }

/** Lee la respuesta de /api/sports/standings: grupos (o la tabla única de antes) y formato. */
export function normalizeStandingsResponse(raw: unknown): { leagueName: string; groups: StandingsGroup[]; format: CompetitionFormat | null } {
  const r = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}
  const asRows = (v: unknown): StandingsRowData[] => sortStandings(Array.isArray(v) ? (v as StandingsRowData[]) : [])
  const groups: StandingsGroup[] = Array.isArray(r.groups)
    ? (r.groups as unknown[]).filter((g): g is Record<string, unknown> => typeof g === 'object' && g !== null)
      .map((g) => ({ name: typeof g.name === 'string' && g.name.trim() ? g.name.trim() : null, table: asRows(g.table) }))
      .filter((g) => g.table.length > 0)
    : []
  if (groups.length === 0) {
    const table = asRows(r.table)
    if (table.length > 0) groups.push({ name: null, table })
  }
  const f = typeof r.format === 'object' && r.format !== null ? (r.format as Record<string, unknown>) : null
  const format = f && typeof f.summary === 'string' && f.summary.trim()
    ? { kind: String(f.kind ?? ''), teams: typeof f.teams === 'number' ? f.teams : null, summary: f.summary.trim(), stages: Array.isArray(f.stages) ? f.stages.filter((s): s is string => typeof s === 'string') : [] }
    : null
  return { leagueName: typeof r.leagueName === 'string' ? r.leagueName : '', groups, format }
}
