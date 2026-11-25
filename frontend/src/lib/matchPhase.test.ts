import { describe, expect, it } from 'vitest'
import { derivePhase } from './matchPhase'

const now = new Date('2026-11-25T17:00:00Z')
const at = (min: number) => new Date(now.getTime() + min * 60_000).toISOString()

describe('derivePhase', () => {
  it('previa far ahead, countdown within the hour', () => {
    expect(derivePhase(at(180), now).phase).toBe('previa')
    expect(derivePhase(at(35), now)).toMatchObject({ phase: 'pronto', label: 'en 35 min' })
    expect(derivePhase(at(0.2), now).label).toBe('en 1 min')
  })

  it('never shows a previa once kickoff has passed', () => {
    expect(derivePhase(at(-3), now)).toMatchObject({ phase: 'empieza', label: 'EMPIEZA YA' })
    expect(derivePhase(at(-200), now).phase).toBe('final')
  })

  it('follows the real scoreboard: live with minute, then final', () => {
    expect(derivePhase(at(-30), now, { status: 'live', homeScore: 1, awayScore: 0, statusDetail: "30'" })).toEqual({ phase: 'en-vivo', label: 'En vivo', score: { home: 1, away: 0 }, minute: "30'" })
    expect(derivePhase(at(-120), now, { status: 'finished', homeScore: 2, awayScore: 1 })).toMatchObject({ phase: 'final', label: 'Final · así queda', score: { home: 2, away: 1 } })
    expect(derivePhase(at(60), now, null, 'en-vivo').phase).toBe('en-vivo')
  })
})
