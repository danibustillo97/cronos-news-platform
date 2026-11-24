import { describe, expect, it } from 'vitest'
import {
  ALL_SEASONS, compareScore, compareStats, compareValues, defaultSeasonKey, derive, emptyStats, normalizeProfile,
  normalizeSearch, pushRecent, readRecent, seasonOptions, selectStats,
} from './players'

function memory(): Storage {
  const m = new Map<string, string>()
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => { m.set(k, String(v)) } } as Storage
}

const raw = {
  id: '1', name: 'Luis Díaz', age: 29, position: 'Extremo', team: 'Bayern', teamLogo: null, nationality: 'Colombia', image: null,
  seasons: [
    { season: '2026-27', competition: 'Bundesliga', team: 'Bayern', stats: { starts: 10, goals: 6, assists: 4, shots: 30, shotsOnTarget: 15, yellowCards: 1, redCards: 0, foulsCommitted: 8, foulsSuffered: 20, offsides: 3 } },
    { season: '2026-27', competition: 'Champions', team: 'Bayern', stats: { starts: 4, goals: 2, assists: '1', shots: 9, shotsOnTarget: 4 } },
  ],
}

describe('normalize', () => {
  it('normalizes a profile, filling missing stats with 0', () => {
    const p = normalizeProfile(raw)!
    expect(p.seasons[1].stats.assists).toBe(1)
    expect(p.seasons[1].stats.redCards).toBe(0)
    expect(p.flag).toBeNull()
    const extra = normalizeProfile({ ...raw, jersey: 14, flag: 'https://a.espncdn.com/f.png', seasons: [{ ...raw.seasons[0], competitionId: 'ger.1', teamLogo: 'https://a.espncdn.com/t.png' }] })!
    expect(extra.jersey).toBe('14')
    expect(extra.seasons[0]).toMatchObject({ competitionId: 'ger.1', teamLogo: 'https://a.espncdn.com/t.png' })
    expect(normalizeProfile({ id: '', name: 'x' })).toBeNull()
  })

  it('normalizes search results', () => {
    expect(normalizeSearch({ players: [{ id: 7, name: 'Messi', team: 'Inter Miami' }, { name: 'sin id' }] }))
      .toEqual([{ id: '7', name: 'Messi', team: 'Inter Miami', image: null }])
    expect(normalizeSearch({ detail: 'Not Found' })).toEqual([])
  })
})

describe('season selection', () => {
  const p = normalizeProfile(raw)!
  it('offers a career total plus each season, defaulting to the most recent', () => {
    const opts = seasonOptions(p)
    expect(opts[0].key).toBe(ALL_SEASONS)
    expect(opts).toHaveLength(3)
    expect(defaultSeasonKey(p)).toBe(opts[1].key) // Bundesliga: más titularidades
    expect(selectStats(p, ALL_SEASONS).goals).toBe(8)
    expect(selectStats(p, opts[2].key).goals).toBe(2)
    expect(selectStats(p, 'desconocida').goals).toBe(8)
  })
})

describe('defaults and names', () => {
  it('opens on the competition with most starts in the latest season, preferring the league', () => {
    const p = normalizeProfile({
      ...raw,
      seasons: [
        { season: '2026-27', competition: 'German DFB Pokal', stats: { starts: 1 } },
        { season: '2026-27', competition: 'Bundesliga', competitionId: 'ger.1', stats: { starts: 5 } },
        { season: '2026-27', competition: 'Champions', stats: { starts: 5 } },
        { season: '2025-26', competition: 'Bundesliga', competitionId: 'ger.1', stats: { starts: 27 } },
      ],
    })!
    expect(defaultSeasonKey(p)).toBe('1:2026-27|Bundesliga')
    expect(p.seasons[0].competition).toBe('Copa de Alemania')
    expect(defaultSeasonKey(normalizeProfile({ id: 'x', name: 'Sin datos' })!)).toBe(ALL_SEASONS)
  })
})

describe('compare math', () => {
  it('derives per-player ratios without dividing by zero', () => {
    const d = derive(normalizeProfile(raw)!.seasons[0].stats)
    expect(d).toEqual({ goalContributions: 10, shotAccuracy: 50, conversion: 20, cards: 1, goalsPerStart: 0.6 })
    expect(derive(emptyStats())).toMatchObject({ shotAccuracy: null, conversion: null, goalsPerStart: null })
  })

  it('builds mirrored bars relative to the larger value and picks the winner', () => {
    expect(compareValues(10, 5, false)).toEqual({ aPct: 100, bPct: 50, winner: 'a' })
    expect(compareValues(2, 4, true)).toEqual({ aPct: 50, bPct: 100, winner: 'a' })
    expect(compareValues(0, 0, false)).toEqual({ aPct: 0, bPct: 0, winner: 'tie' })
    expect(compareValues(null, 3, false)).toMatchObject({ winner: null, bPct: 100 })
  })

  it('compares two players and scores the duel', () => {
    const p = normalizeProfile(raw)!
    const rows = compareStats(p.seasons[0].stats, p.seasons[1].stats)
    const byKey = Object.fromEntries(rows.map((r) => [r.key, r]))
    expect(byKey.goals.winner).toBe('a')
    expect(byKey.yellowCards.winner).toBe('b') // menos amarillas gana
    expect(byKey.shotAccuracy.suffix).toBe('%')
    const score = compareScore(rows)
    expect(score.a + score.b).toBeLessThanOrEqual(rows.length)
    expect(score.a).toBeGreaterThan(score.b)
  })
})

describe('recent searches', () => {
  it('keeps the latest unique searches', () => {
    const s = memory()
    pushRecent(s, { id: '1', name: 'A', team: null, image: null })
    pushRecent(s, { id: '2', name: 'B', team: null, image: null })
    pushRecent(s, { id: '1', name: 'A', team: null, image: null })
    expect(readRecent(s).map((h) => h.id)).toEqual(['1', '2'])
    expect(readRecent(null)).toEqual([])
  })
})
