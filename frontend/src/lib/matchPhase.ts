// Inteligencia de tiempo para las antesalas: la fase se calcula en el
// navegador con la hora de inicio y el marcador real (cada minuto). Nunca
// se muestra una previa de un partido que ya empezó.

export type Phase = 'previa' | 'pronto' | 'empieza' | 'en-vivo' | 'final'

export interface PhaseInfo { phase: Phase; label: string; score: { home: number; away: number } | null; minute: string | null }

interface ScoreState { status: 'live' | 'finished' | 'scheduled'; homeScore: number; awayScore: number; statusDetail?: string | null }

const MIN = 60_000

export function derivePhase(kickoffIso: string, now: Date, live?: ScoreState | null, backendPhase?: string | null): PhaseInfo {
  const k = Date.parse(kickoffIso)
  if (live?.status === 'finished' || backendPhase === 'final') {
    return { phase: 'final', label: 'Final · así queda', score: live ? { home: live.homeScore, away: live.awayScore } : null, minute: null }
  }
  if (live?.status === 'live' || backendPhase === 'en-vivo') {
    const detail = live?.statusDetail?.trim() || null
    return { phase: 'en-vivo', label: 'En vivo', score: live ? { home: live.homeScore, away: live.awayScore } : null, minute: detail && detail !== 'Scheduled' ? detail : null }
  }
  if (!Number.isFinite(k)) return { phase: 'previa', label: '', score: null, minute: null }
  const diff = k - now.getTime()
  if (diff <= 0) {
    // Ya pasó la hora y el marcador aún no lo refleja: arranca (o está por terminar si pasó mucho).
    if (-diff > 130 * MIN) return { phase: 'final', label: 'Final · así queda', score: null, minute: null }
    return { phase: 'empieza', label: 'EMPIEZA YA', score: null, minute: null }
  }
  if (diff <= 60 * MIN) {
    const m = Math.max(1, Math.round(diff / MIN))
    return { phase: 'pronto', label: `en ${m} min`, score: null, minute: null }
  }
  return { phase: 'previa', label: '', score: null, minute: null }
}
