import { describe, expect, it } from 'vitest'
import { combinedOdds, combinedProbability, readSlip, saveSlip, seededRandom, simulate, slipShareText, toggleSelection, SLIP_MAX, type Selection } from './slip'

const sel = (matchId: string, pick = 'home', odds = 2, probability = 0.5): Selection => ({ matchId, match: `M${matchId}`, market: '1X2', pick, label: `Gana ${matchId}`, odds, probability })
function memory(): Storage { const m = new Map<string, string>(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => { m.set(k, String(v)) } } as Storage }

describe('slip rules', () => {
  it('one pick per match: adding replaces, tapping the same removes', () => {
    let { slip } = toggleSelection([], sel('1'))
    ;({ slip } = toggleSelection(slip, sel('1', 'draw')))
    expect(slip).toEqual([sel('1', 'draw')])
    ;({ slip } = toggleSelection(slip, sel('1', 'draw')))
    expect(slip).toEqual([])
  })

  it('caps the slip at 6 selections', () => {
    let slip: Selection[] = []
    for (let i = 0; i < SLIP_MAX; i++) slip = toggleSelection(slip, sel(String(i))).slip
    const r = toggleSelection(slip, sel('x'))
    expect(r.slip).toHaveLength(6)
    expect(r.error).toMatch(/Máximo 6/)
  })

  it('combines odds and market probabilities', () => {
    const slip = [sel('a', 'home', 1.5, 0.6), sel('b', 'home', 2, 0.45)]
    expect(combinedOdds(slip)).toBe(3)
    expect(combinedProbability(slip)).toBeCloseTo(0.27)
    expect(combinedOdds([])).toBe(0)
  })
})

describe('simulator', () => {
  it('is reproducible with a seeded RNG and converges to the market probability', () => {
    const slip = [sel('a', 'home', 1.5, 0.6), sel('b', 'home', 2, 0.45)]
    const a = simulate(slip, 10_000, 10_000, seededRandom(42))
    const b = simulate(slip, 10_000, 10_000, seededRandom(42))
    expect(a).toEqual(b)
    expect(a.winRate).toBeGreaterThan(0.25)
    expect(a.winRate).toBeLessThan(0.29)
    expect(a.hitsDistribution.reduce((x, y) => x + y, 0)).toBe(10_000)
    expect(a.hitsDistribution).toHaveLength(3)
    expect(a.averagePayout).toBe(Math.round(a.winRate * 3 * 10_000))
    expect(a.averageNet).toBe(a.averagePayout - 10_000)
  })

  it('handles an empty slip', () => {
    expect(simulate([], 100, 10_000, seededRandom(1))).toMatchObject({ wins: 0, winRate: 0, averagePayout: 0, averageNet: 0, hitsDistribution: [100] })
  })
})

describe('persistence and sharing', () => {
  it('saves and reads back only valid selections', () => {
    const s = memory()
    saveSlip(s, [sel('a')])
    expect(readSlip(s)).toEqual([sel('a')])
    s.setItem('nexus.slip', JSON.stringify([{ matchId: 'x', odds: 0.5, probability: 2 }, sel('b')]))
    expect(readSlip(s)).toEqual([sel('b')])
    s.setItem('nexus.slip', '{roto')
    expect(readSlip(s)).toEqual([])
  })

  it('shares plain text with the responsibility note and no links', () => {
    const t = slipShareText([sel('a', 'home', 1.5, 0.6)])
    expect(t).toContain('Cuota combinada: 1,50')
    expect(t).toContain('Juega con responsabilidad')
    expect(t).not.toMatch(/https?:\/\//)
  })
})
