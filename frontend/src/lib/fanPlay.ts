// Interacción del hincha, guardada en el navegador: pronóstico de marcador,
// racha diaria y "¿Quién fue el mejor?" local.

type KV = Pick<Storage, 'getItem' | 'setItem'>

function read<T>(s: KV | null, key: string, fallback: T): T {
  try { const v = s?.getItem(key); return v ? (JSON.parse(v) as T) : fallback } catch { return fallback }
}
function write(s: KV | null, key: string, value: unknown): void {
  try { s?.setItem(key, JSON.stringify(value)) } catch { /* bloqueado */ }
}

// ---------------------------------------------------------------- pronóstico

export const PRED_KEY = 'nexus.predictions'
export interface Prediction { home: number; away: number; at: string }
export type PredictionResult = 'exacto' | 'resultado' | 'fallo'

export function clampGoals(n: number): number {
  return Math.max(0, Math.min(15, Math.round(Number.isFinite(n) ? n : 0)))
}

export function readPredictions(s: KV | null): Record<string, Prediction> {
  const v = read<Record<string, Prediction>>(s, PRED_KEY, {})
  return typeof v === 'object' && v ? v : {}
}

export function savePrediction(s: KV | null, matchId: string, home: number, away: number, now = new Date()): Record<string, Prediction> {
  const all = readPredictions(s)
  all[matchId] = { home: clampGoals(home), away: clampGoals(away), at: now.toISOString() }
  // Se guardan los últimos 60 pronósticos.
  const trimmed = Object.fromEntries(Object.entries(all).sort((a, b) => b[1].at.localeCompare(a[1].at)).slice(0, 60))
  write(s, PRED_KEY, trimmed)
  return trimmed
}

const sign = (h: number, a: number) => Math.sign(h - a)

export function evaluatePrediction(p: Pick<Prediction, 'home' | 'away'>, final: { home: number; away: number }): PredictionResult {
  if (p.home === final.home && p.away === final.away) return 'exacto'
  if (sign(p.home, p.away) === sign(final.home, final.away)) return 'resultado'
  return 'fallo'
}

export const RESULT_LABEL: Record<PredictionResult, string> = {
  exacto: '¡Acertaste el marcador exacto!',
  resultado: 'Acertaste el resultado',
  fallo: 'Esta vez no fue',
}

// ------------------------------------------------------------- racha diaria

export const STREAK_KEY = 'nexus.streak'
export interface Streak { last: string; days: number; best: number }

export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Suma un día si la visita anterior fue ayer; reinicia si se saltó días; no cambia si ya visitó hoy. */
export function nextStreak(prev: Streak | null, now: Date): Streak {
  const today = dayKey(now)
  if (!prev || !prev.last) return { last: today, days: 1, best: Math.max(1, prev?.best ?? 0) }
  if (prev.last === today) return prev
  const y = new Date(now); y.setDate(now.getDate() - 1)
  const days = prev.last === dayKey(y) ? prev.days + 1 : 1
  return { last: today, days, best: Math.max(prev.best ?? 0, days) }
}

export function touchStreak(s: KV | null, now = new Date()): Streak {
  const next = nextStreak(read<Streak | null>(s, STREAK_KEY, null), now)
  write(s, STREAK_KEY, next)
  return next
}

// ---------------------------------------------------- ¿quién fue el mejor? (local)

export const MVP_KEY = 'nexus.mvp'

export function readMvp(s: KV | null, matchId: string): string | null {
  return read<Record<string, string>>(s, MVP_KEY, {})[matchId] ?? null
}

export function saveMvp(s: KV | null, matchId: string, player: string): void {
  const all = read<Record<string, string>>(s, MVP_KEY, {})
  all[matchId] = player.slice(0, 80)
  write(s, MVP_KEY, all)
}

/** Candidatos: goleadores y asistidores primero, luego titulares, sin repetir (máx. 6). */
export function mvpCandidates(scorers: string[], assisters: string[], starters: string[], max = 6): string[] {
  return [...new Set([...scorers, ...assisters, ...starters].map((n) => n.trim()).filter(Boolean))].slice(0, max)
}
