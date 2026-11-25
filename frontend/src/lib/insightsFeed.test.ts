import { describe, expect, it } from 'vitest'
import { kickoffShort, mergeDynamic, normalizeFeedInsights } from './insightsFeed'
import type { MomentItem } from './moments'

const raw = { insights: [
  { id: 'preview:1', kind: 'preview', league: 'uefa.champions', leagueName: 'Champions League', matchId: '1', kickoff: '2026-11-25T17:45Z', state: 'pre', headline: 'Antesala: Slavia vs Villarreal',
    facts: ['Slavia perdió 4 de sus últimos 5.', '', 9], home: { id: '494', name: 'Slavia Prague', short: 'SLP', form: 'lldxl', position: 34, points: 1 }, away: { name: 'Villarreal' },
    market: { home: 31, draw: 26, away: 42 }, h2h: [{ date: '2020', result: 'X', score: '1-1' }], standings: [{ pos: 29, teamId: '102', team: 'Villarreal', points: 3, played: 4, gd: -6, highlight: true }], format: 'Fase de liga.' },
  { id: 'preview:1', kind: 'preview', matchId: '1' },
  { id: 'x', kind: 'otro', matchId: '2' },
] }

describe('insights feed', () => {
  it('normalizes insights, keeping facts as-is', () => {
    const list = normalizeFeedInsights(raw)
    expect(list).toHaveLength(1)
    expect(list[0].facts).toEqual(['Slavia perdió 4 de sus últimos 5.', '9'])
    expect(list[0].home.form).toBe('LLDL')
    expect(list[0].away).toMatchObject({ short: 'Villarreal', position: null, form: null })
    expect(list[0].h2h[0].result).toBe('L')
    expect(list[0].standings[0].highlight).toBe(true)
    expect(normalizeFeedInsights({})).toEqual([])
  })

  it('alternates moments and previews, then continues with whatever is left', () => {
    const ms = [{ type: 'goal', key: 'mo-a' }, { type: 'final', key: 'mo-b' }] as unknown as MomentItem[]
    const ins = normalizeFeedInsights(raw).concat(normalizeFeedInsights({ insights: [{ id: 'p2', kind: 'preview', matchId: '2' }, { id: 'p3', kind: 'impact', matchId: '3' }] }))
    expect(mergeDynamic(ms, ins).map((d) => d.key)).toEqual(['mo-a', 'in-preview:1', 'mo-b', 'in-p2', 'in-p3'])
    expect(mergeDynamic([], [])).toEqual([])
  })

  it('labels kickoffs as hoy/mañana', () => {
    const now = new Date('2026-11-25T08:00:00')
    expect(kickoffShort(new Date('2026-11-25T14:45:00').toISOString(), now)).toBe('hoy 14:45')
    expect(kickoffShort(new Date('2026-11-26T20:00:00').toISOString(), now)).toBe('mañana 20:00')
    expect(kickoffShort('x', now)).toBe('')
  })
})
