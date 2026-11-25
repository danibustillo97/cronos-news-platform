import { describe, expect, it } from 'vitest'
import { bookMargin, DEFAULT_DISCLAIMER, formChips, formatOdds, formatProbability, impliedX12, normalizePicks, safeText } from './picks'

const raw = {
  generatedAt: '2026-11-24T19:32:36Z',
  matches: [
    { id: '1', league: 'eng.1', leagueName: 'Premier', date: '2026-11-24T20:00Z', home: { name: 'Arsenal', logo: 'https://a.espncdn.com/x.png', form: 'dwwwl' }, away: { name: 'BVB', logo: null, form: 'WWWDW' },
      odds: { x12: { home: 1.455, draw: 4.7, away: 7.0 }, overUnder: { line: 2.5, over: 1.667, under: 2.2 }, doubleChance: { home: 1.1, away: 0.5 } }, provider: 'DraftKings' },
    { id: '2', home: {}, away: {}, odds: { x12: { home: 0, draw: 3, away: 2 } } },
  ],
  parlays: [
    { name: 'Parlay conservador', description: 'x', odds: 1.81, probability: 0.48, picks: [{ matchId: '1', label: 'Gana Arsenal', odds: 1.455, probability: 0.66, market: '1X2' }, { label: 'sin cuota', odds: 0.9 }] },
    { name: 'vacío', odds: 2, picks: [] },
  ],
  disclaimer: 'Contenido informativo. Solo +18.',
}

describe('picks', () => {
  it('normalizes matches, odds and parlays, dropping invalid entries', () => {
    const d = normalizePicks(raw)!
    expect(d.matches[0].home.form).toBe('DWWWL')
    expect(d.matches[0].odds.doubleChance).toEqual({ home: 1.1 })
    expect(d.matches[1].odds.x12).toBeNull()
    expect(d.parlays).toHaveLength(1)
    expect(d.parlays[0].picks).toHaveLength(1)
    expect(d.disclaimer).toBe('Contenido informativo. Solo +18.')
    expect(normalizePicks({ matches: [] })!.disclaimer).toBe(DEFAULT_DISCLAIMER)
    expect(normalizePicks('x')).toBeNull()
  })

  it('formats odds and probabilities in Spanish', () => {
    expect(formatOdds(1.455)).toBe('1,46')
    expect(formatOdds(7)).toBe('7,00')
    expect(formatProbability(0.757)).toBe('76 %')
  })

  it('removes the bookmaker margin from 1X2 implied probabilities', () => {
    const p = impliedX12({ home: 1.455, draw: 4.7, away: 7.0 })
    expect(p.home + p.draw + p.away).toBe(100)
    expect(p.home).toBeGreaterThan(p.draw)
    expect(bookMargin({ home: 1.455, draw: 4.7, away: 7.0 })).toBeCloseTo(4.3, 1)
  })

  it('turns form into Spanish chips and blocks guarantee language', () => {
    expect(formChips('DWWWL').map((c) => c.letter)).toEqual(['E', 'G', 'G', 'G', 'P'])
    expect(safeText('Apuesta segura de la jornada')).toBe('')
    expect(safeText('El mercado le da 81%')).toBe('El mercado le da 81%')
  })
})

describe('parley builder helpers', () => {
  it('groups matches by day with Hoy first and builds fair selections', async () => {
    const { groupByDay, selectionsForMatch } = await import('./picks')
    const d = normalizePicks({ matches: [
      { id: 'a', day: 'mañana', home: { name: 'A' }, away: { name: 'B' }, odds: { x12: { home: 2, draw: 3.5, away: 3.5 }, overUnder: { line: 2.5, over: 1.9, under: 1.9 } } },
      { id: 'b', day: 'Hoy', home: { name: 'C' }, away: { name: 'D' }, odds: {} },
      { id: 'c', home: { name: 'E' }, away: { name: 'F' }, odds: {} },
    ] })!
    expect(groupByDay(d.matches).map((g) => g.label)).toEqual(['Hoy', 'Mañana', 'Próximos'])
    const sels = selectionsForMatch(d.matches[0])
    expect(sels.map((s) => s.pick)).toEqual(['home', 'draw', 'away', 'over', 'under'])
    expect(sels.slice(0, 3).reduce((p, s) => p + s.probability, 0)).toBeCloseTo(1)
    expect(sels[3].probability).toBeCloseTo(0.5)
    expect(sels[3].label).toBe('Más de 2,5 goles')
    expect(selectionsForMatch(d.matches[1])).toEqual([])
  })
})
