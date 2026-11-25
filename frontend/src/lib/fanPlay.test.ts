import { describe, expect, it } from 'vitest'
import { evaluatePrediction, mvpCandidates, nextStreak, readMvp, readPredictions, saveMvp, savePrediction } from './fanPlay'

function memory(): Storage { const m = new Map<string, string>(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => { m.set(k, String(v)) } } as Storage }

describe('predicciones', () => {
  it('stores and evaluates score predictions', () => {
    const s = memory()
    savePrediction(s, 'm1', 2.4, -1)
    expect(readPredictions(s).m1).toMatchObject({ home: 2, away: 0 })
    expect(evaluatePrediction({ home: 2, away: 1 }, { home: 2, away: 1 })).toBe('exacto')
    expect(evaluatePrediction({ home: 3, away: 0 }, { home: 1, away: 0 })).toBe('resultado')
    expect(evaluatePrediction({ home: 1, away: 1 }, { home: 0, away: 0 })).toBe('resultado')
    expect(evaluatePrediction({ home: 0, away: 1 }, { home: 2, away: 0 })).toBe('fallo')
  })
})

describe('racha del hincha', () => {
  const d = (s: string) => new Date(`${s}T12:00:00`)
  it('counts consecutive days, keeps the same day, resets after a gap', () => {
    let s = nextStreak(null, d('2026-11-20'))
    expect(s).toMatchObject({ days: 1, last: '2026-11-20' })
    s = nextStreak(s, d('2026-11-21'))
    s = nextStreak(s, d('2026-11-22'))
    expect(s.days).toBe(3)
    expect(nextStreak(s, d('2026-11-22'))).toBe(s)
    const reset = nextStreak(s, d('2026-11-25'))
    expect(reset).toMatchObject({ days: 1, best: 3 })
  })
})

describe('¿quién fue el mejor?', () => {
  it('builds unique candidates and remembers the local vote', () => {
    expect(mvpCandidates(['Saka', 'Saka'], ['Ødegaard'], ['Raya', 'Saka', 'Rice', 'Saliba', 'White', 'Gabriel'])).toEqual(['Saka', 'Ødegaard', 'Raya', 'Rice', 'Saliba', 'White'])
    const s = memory()
    saveMvp(s, 'm1', 'Saka')
    expect(readMvp(s, 'm1')).toBe('Saka')
    expect(readMvp(s, 'm2')).toBeNull()
  })
})
