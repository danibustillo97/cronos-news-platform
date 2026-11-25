// "Parley del día" -- normalización y formato de cuotas reales (GET /api/picks).
// Solo información de mercado: nunca lenguaje de garantía.

export interface PickTeam { name: string; logo: string | null; form: string }
export interface PickMatch {
  id: string
  league: string
  leagueName: string
  date: string
  home: PickTeam
  away: PickTeam
  odds: {
    x12: { home: number; draw: number; away: number } | null
    overUnder: { line: number; over: number; under: number } | null
    doubleChance: { home?: number; away?: number }
  }
  provider: string
  /** "hoy" | "mañana" | día de la semana (lo decide el backend). */
  day: string
}
export interface ParlayPick { matchId: string; label: string; match: string; leagueName: string; date: string; odds: number; probability: number; reason: string; market: string }
export interface Parlay { name: string; description: string; odds: number; probability: number; picks: ParlayPick[] }
export interface PicksData { generatedAt: string; matches: PickMatch[]; parlays: Parlay[]; disclaimer: string }

export const DEFAULT_DISCLAIMER = 'Contenido informativo basado en cuotas de mercado; no es una recomendación de apuesta ni garantiza resultados. Solo para mayores de 18 años. Juega con responsabilidad.'

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}
const str = (v: unknown, max = 300) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const odd = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v > 1 ? v : null)
const prob = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= 1 ? v : 0)

function team(v: unknown): PickTeam {
  const r = isRecord(v) ? v : {}
  return { name: str(r.name, 80) || '—', logo: str(r.logo, 600) || null, form: str(r.form, 10).toUpperCase().replace(/[^WDL]/g, '') }
}

export function normalizePicks(raw: unknown): PicksData | null {
  if (!isRecord(raw)) return null
  const matches: PickMatch[] = (Array.isArray(raw.matches) ? raw.matches : []).filter(isRecord).map((m) => {
    const o = isRecord(m.odds) ? m.odds : {}
    const x = isRecord(o.x12) ? o.x12 : null
    const ou = isRecord(o.overUnder) ? o.overUnder : null
    const dc = isRecord(o.doubleChance) ? o.doubleChance : {}
    const x12 = x && odd(x.home) && odd(x.draw) && odd(x.away) ? { home: odd(x.home)!, draw: odd(x.draw)!, away: odd(x.away)! } : null
    const line = ou && typeof ou.line === 'number' && Number.isFinite(ou.line) ? ou.line : null
    return {
      id: str(m.id, 64), league: str(m.league, 40), leagueName: str(m.leagueName, 80), date: str(m.date, 40),
      home: team(m.home), away: team(m.away),
      odds: {
        x12,
        overUnder: ou && line !== null && odd(ou.over) && odd(ou.under) ? { line, over: odd(ou.over)!, under: odd(ou.under)! } : null,
        doubleChance: { ...(odd(dc.home) ? { home: odd(dc.home)! } : {}), ...(odd(dc.away) ? { away: odd(dc.away)! } : {}) },
      },
      provider: str(m.provider, 40) || 'proveedor',
      day: str(m.day, 20).toLowerCase(),
    }
  }).filter((m) => m.id)
  const parlays: Parlay[] = (Array.isArray(raw.parlays) ? raw.parlays : []).filter(isRecord).map((p) => ({
    name: str(p.name, 80) || 'Parley',
    description: str(p.description, 300),
    odds: odd(p.odds) ?? 0,
    probability: prob(p.probability),
    picks: (Array.isArray(p.picks) ? p.picks : []).filter(isRecord).map((k) => ({
      matchId: str(k.matchId, 64), label: str(k.label, 120), match: str(k.match, 160), leagueName: str(k.leagueName, 80),
      date: str(k.date, 40), odds: odd(k.odds) ?? 0, probability: prob(k.probability), reason: str(k.reason, 300), market: str(k.market, 40),
    })).filter((k) => k.label && k.odds > 1),
  })).filter((p) => p.picks.length > 0 && p.odds > 1)
  return { generatedAt: str(raw.generatedAt, 64), matches, parlays, disclaimer: str(raw.disclaimer, 600) || DEFAULT_DISCLAIMER }
}

/** Cuota decimal con coma (es-CO): 1.455 -> "1,46". */
export function formatOdds(v: number): string {
  return new Intl.NumberFormat('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)
}

/** 0.757 -> "76 %". */
export function formatProbability(p: number): string {
  return `${Math.round(p * 100)} %`
}

/** Probabilidades implícitas del 1X2 sin el margen de la casa (suman 100). */
export function impliedX12(x12: { home: number; draw: number; away: number }): { home: number; draw: number; away: number } {
  const raw = [1 / x12.home, 1 / x12.draw, 1 / x12.away]
  const sum = raw.reduce((a, b) => a + b, 0)
  const pct = raw.map((r) => (r / sum) * 100)
  const rounded = pct.map(Math.floor)
  let rest = 100 - rounded.reduce((a, b) => a + b, 0)
  pct.map((v, i) => ({ i, f: v - rounded[i] })).sort((a, b) => b.f - a.f).forEach(({ i }) => { if (rest > 0) { rounded[i] += 1; rest -= 1 } })
  return { home: rounded[0], draw: rounded[1], away: rounded[2] }
}

/** Margen de la casa en el 1X2 (overround), en %. */
export function bookMargin(x12: { home: number; draw: number; away: number }): number {
  return Math.round(((1 / x12.home + 1 / x12.draw + 1 / x12.away) - 1) * 1000) / 10
}

/** "DWWWL" (más reciente al final) -> chips en español G/E/P. */
export function formChips(form: string): { letter: 'G' | 'E' | 'P'; label: string }[] {
  return form.split('').slice(-5).map((c) => c === 'W' ? { letter: 'G' as const, label: 'Ganado' } : c === 'D' ? { letter: 'E' as const, label: 'Empatado' } : { letter: 'P' as const, label: 'Perdido' })
}

/** Lenguaje prohibido en textos que vengan del backend (defensa adicional). */
const FORBIDDEN = /\b(apuesta segura|fijo|fija|garantizad[oa]s?|segur[oa] gana|no falla)\b/i
export function safeText(text: string): string {
  return FORBIDDEN.test(text) ? '' : text
}

/** Agrupa partidos por día en el orden de llegada ("Hoy", "Mañana", …). */
export function groupByDay(matches: PickMatch[]): { day: string; label: string; matches: PickMatch[] }[] {
  const groups: { day: string; label: string; matches: PickMatch[] }[] = []
  for (const m of matches) {
    const day = m.day || 'próximos'
    let g = groups.find((x) => x.day === day)
    if (!g) { g = { day, label: day.charAt(0).toUpperCase() + day.slice(1), matches: [] }; groups.push(g) }
    g.matches.push(m)
  }
  const rank = (d: string) => (d === 'hoy' ? 0 : d === 'mañana' ? 1 : 2)
  return groups.sort((a, b) => rank(a.day) - rank(b.day))
}

export interface MatchSelection { pick: 'home' | 'draw' | 'away' | 'over' | 'under'; market: '1X2' | 'Goles'; label: string; short: string; odds: number; probability: number }

/** Selecciones posibles de un partido con su probabilidad implícita sin margen. */
export function selectionsForMatch(m: PickMatch): MatchSelection[] {
  const out: MatchSelection[] = []
  const x = m.odds.x12
  if (x) {
    const imp = impliedX12(x)
    out.push({ pick: 'home', market: '1X2', label: `Gana ${m.home.name}`, short: 'Local', odds: x.home, probability: imp.home / 100 })
    out.push({ pick: 'draw', market: '1X2', label: 'Empate', short: 'Empate', odds: x.draw, probability: imp.draw / 100 })
    out.push({ pick: 'away', market: '1X2', label: `Gana ${m.away.name}`, short: 'Visitante', odds: x.away, probability: imp.away / 100 })
  }
  const ou = m.odds.overUnder
  if (ou) {
    const po = 1 / ou.over
    const pu = 1 / ou.under
    const line = String(ou.line).replace('.', ',')
    out.push({ pick: 'over', market: 'Goles', label: `Más de ${line} goles`, short: `Más de ${line}`, odds: ou.over, probability: po / (po + pu) })
    out.push({ pick: 'under', market: 'Goles', label: `Menos de ${line} goles`, short: `Menos de ${line}`, odds: ou.under, probability: pu / (po + pu) })
  }
  return out
}
