// "Arma tu parley": reglas del boleto, cuota combinada, probabilidad de
// mercado combinada y simulador Monte Carlo (independencia asumida). Es
// estadística con las probabilidades del mercado: no es una predicción.

export interface Selection {
  matchId: string
  match: string
  market: '1X2' | 'Goles'
  pick: string // 'home' | 'draw' | 'away' | 'over' | 'under'
  label: string
  odds: number
  probability: number // 0-1, probabilidad implícita sin margen
}

export const SLIP_MAX = 6
export const SLIP_KEY = 'nexus.slip'

/** Agregar/cambiar/quitar: una selección por partido (reemplaza), máximo 6; tocar la misma la quita. */
export function toggleSelection(slip: Selection[], sel: Selection): { slip: Selection[]; error: string | null } {
  const same = slip.find((s) => s.matchId === sel.matchId)
  if (same && same.pick === sel.pick && same.market === sel.market) return { slip: slip.filter((s) => s !== same), error: null }
  if (same) return { slip: slip.map((s) => (s === same ? sel : s)), error: null }
  if (slip.length >= SLIP_MAX) return { slip, error: `Máximo ${SLIP_MAX} selecciones por parley.` }
  return { slip: [...slip, sel], error: null }
}

export function combinedOdds(slip: Selection[]): number {
  return slip.length === 0 ? 0 : Math.round(slip.reduce((p, s) => p * s.odds, 1) * 100) / 100
}

export function combinedProbability(slip: Selection[]): number {
  return slip.length === 0 ? 0 : slip.reduce((p, s) => p * s.probability, 1)
}

/** Generador pseudoaleatorio reproducible (mulberry32) para pruebas. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface SimulationResult {
  runs: number
  wins: number
  winRate: number
  /** Cuántas jornadas acertaron 0, 1, … n selecciones. */
  hitsDistribution: number[]
  /** Pago promedio por cada `stake` apostado (incluye las jornadas perdidas). */
  averagePayout: number
  /** Ganancia o pérdida neta promedio por jornada. */
  averageNet: number
}

export function simulate(slip: Selection[], runs = 10_000, stake = 10_000, rng: () => number = Math.random): SimulationResult {
  const n = slip.length
  const dist = Array.from({ length: n + 1 }, () => 0)
  let wins = 0
  for (let r = 0; r < runs; r++) {
    let hits = 0
    for (const s of slip) if (rng() < s.probability) hits += 1
    dist[hits] += 1
    if (n > 0 && hits === n) wins += 1
  }
  const odds = combinedOdds(slip)
  const winRate = runs > 0 ? wins / runs : 0
  const averagePayout = Math.round(winRate * odds * stake)
  return { runs, wins, winRate, hitsDistribution: dist, averagePayout, averageNet: averagePayout - (n > 0 ? stake : 0) }
}

type KV = Pick<Storage, 'getItem' | 'setItem'>

export function readSlip(storage: KV | null): Selection[] {
  try {
    const v: unknown = JSON.parse(storage?.getItem(SLIP_KEY) ?? '[]')
    if (!Array.isArray(v)) return []
    return v.filter((s): s is Selection => typeof s === 'object' && s !== null
      && typeof (s as Selection).matchId === 'string' && typeof (s as Selection).odds === 'number' && (s as Selection).odds > 1
      && typeof (s as Selection).probability === 'number' && (s as Selection).probability > 0 && (s as Selection).probability <= 1).slice(0, SLIP_MAX)
  } catch {
    return []
  }
}

export function saveSlip(storage: KV | null, slip: Selection[]): void {
  try { storage?.setItem(SLIP_KEY, JSON.stringify(slip.slice(0, SLIP_MAX))) } catch { /* bloqueado */ }
}

export function formatCop(v: number): string {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v)
}

/** Texto para compartir el boleto (sin enlaces a operadores). */
export function slipShareText(slip: Selection[]): string {
  const lines = slip.map((s) => `• ${s.label} (${s.match}) @ ${s.odds.toFixed(2).replace('.', ',')}`)
  return [`Mi parley en NEXUS (${slip.length} selecciones)`, ...lines, `Cuota combinada: ${combinedOdds(slip).toFixed(2).replace('.', ',')}`, 'Contenido informativo +18. Juega con responsabilidad.'].join('\n')
}
