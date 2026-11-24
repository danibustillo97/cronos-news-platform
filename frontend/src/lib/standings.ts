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
