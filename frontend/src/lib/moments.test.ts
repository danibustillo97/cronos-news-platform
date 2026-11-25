import { describe, expect, it } from 'vitest'
import { momentItems, newMomentIds, normalizeMoments } from './moments'

const base = (id: string, kind: string, league = 'uefa.champions', extra: Record<string, unknown> = {}) => ({
  id, kind, matchId: `m-${id}`, league, leagueName: league === 'uefa.champions' ? 'Champions League' : 'Liga BetPlay', minute: "23'", minuteValue: 23,
  team: 'home', player: { id: '1', name: 'Bellingham' }, assist: null, score: { home: 1, away: 0 }, headline: 'x',
  home: { name: 'Real Madrid', logo: null }, away: { name: 'PSV' }, state: 'in', kickoff: '', ...extra,
})

describe('moments', () => {
  it('normalizes and dedupes moments', () => {
    const list = normalizeMoments({ moments: [base('a', 'goal'), base('a', 'goal'), base('b', 'otro'), { id: 'c', kind: 'red' }, base('d', 'final', 'col.1', { state: 'post' })] })
    expect(list.map((m) => m.id)).toEqual(['a', 'd'])
    expect(list[0].home.short).toBe('Real Madrid')
    expect(list[1].state).toBe('post')
    expect(normalizeMoments({ detail: 'x' })).toEqual([])
  })

  it('groups finals of the same league into one item, keeping newest-first order', () => {
    const ms = normalizeMoments({ moments: [base('g1', 'goal'), base('f1', 'final'), base('r1', 'red'), base('f2', 'final'), base('f3', 'final', 'col.1')] })
    const items = momentItems(ms)
    expect(items.map((i) => i.type)).toEqual(['goal', 'results', 'red', 'final'])
    const group = items[1]
    expect(group.type === 'results' && group.moments.map((m) => m.id)).toEqual(['f1', 'f2'])
    expect(new Set(items.map((i) => i.key)).size).toBe(items.length)
  })

  it('detects new moments between refreshes (not on the first load)', () => {
    const first = normalizeMoments({ moments: [base('a', 'goal')] })
    expect(newMomentIds(null, first).size).toBe(0)
    const next = normalizeMoments({ moments: [base('b', 'goal'), base('a', 'goal')] })
    expect([...newMomentIds(new Set(['a']), next)]).toEqual(['b'])
  })
})
