import { describe, expect, it } from 'vitest'
import {
  applyLocalVote, closesLabel, getVoterId, inPlacement, isClosed, leaderId, markVoted, normalizePoll, normalizePolls,
  percentages, readVoted, sortPolls, VOTED_KEY, VOTER_KEY, type Poll,
} from './polls'

function memory(): Storage {
  const m = new Map<string, string>()
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => { m.set(k, String(v)) } } as Storage
}

const base = {
  id: 'p1', kind: 'poll', question: '¿Quién gana la final?', context: null, totalVotes: 10, status: 'open',
  closesAt: null, newsId: null, featured: false, createdAt: '2026-11-24T10:00:00Z',
  options: [{ id: 'a', label: 'Estudiantes', argument: null, votes: 7 }, { id: 'b', label: 'Palmeiras', argument: null, votes: 3 }],
}

describe('normalizePoll', () => {
  it('accepts a valid poll and rejects malformed ones', () => {
    expect(normalizePoll(base)?.options.map((o) => o.votes)).toEqual([7, 3])
    expect(normalizePoll({ ...base, options: [base.options[0]] })).toBeNull()
    expect(normalizePoll({ ...base, question: '  ' })).toBeNull()
    expect(normalizePoll(null)).toBeNull()
  })

  it('only treats exactly-two-option polls as debates and repairs counts', () => {
    expect(normalizePoll({ ...base, kind: 'debate' })?.kind).toBe('debate')
    const three = { ...base, kind: 'debate', options: [...base.options, { id: 'c', label: 'Empate', argument: null, votes: -4 }] }
    const out = normalizePoll(three)!
    expect(out.kind).toBe('poll')
    expect(out.options[2].votes).toBe(0)
    expect(normalizePoll({ ...base, totalVotes: 2 })!.totalVotes).toBe(10)
  })

  it('reads placements and never shows drafts', () => {
    expect(normalizePoll({ ...base, placement: ['pulse', 'home', 'x', 'pulse'] })!.placement).toEqual(['pulse', 'home'])
    expect(normalizePoll({ ...base, status: 'draft' })).toBeNull()
    const p = normalizePoll({ ...base, placement: ['article'] })!
    expect(inPlacement(p, 'article')).toBe(true)
    expect(inPlacement(p, 'pulse')).toBe(false)
    expect(inPlacement(normalizePoll(base)!, 'pulse')).toBe(true)
  })

  it('reads lists wrapped or bare, dropping junk', () => {
    expect(normalizePolls({ polls: [base, { id: 'x' }] }).map((p) => p.id)).toEqual(['p1'])
    expect(normalizePolls([base])).toHaveLength(1)
    expect(normalizePolls({ detail: 'Not Found' })).toEqual([])
  })
})

describe('results', () => {
  it('percentages always add up to 100', () => {
    expect(percentages([{ votes: 1 }, { votes: 1 }, { votes: 1 }])).toEqual([34, 33, 33])
    expect(percentages([{ votes: 7 }, { votes: 3 }])).toEqual([70, 30])
    expect(percentages([{ votes: 0 }, { votes: 0 }])).toEqual([0, 0])
    const p = percentages([{ votes: 13 }, { votes: 29 }, { votes: 58 }, { votes: 1 }])
    expect(p.reduce((s, v) => s + v, 0)).toBe(100)
  })

  it('finds the leader, null on ties', () => {
    expect(leaderId(normalizePoll(base)!)).toBe('a')
    expect(leaderId({ options: [{ id: 'a', label: 'a', argument: null, votes: 2 }, { id: 'b', label: 'b', argument: null, votes: 2 }] })).toBeNull()
  })

  it('applies an optimistic vote', () => {
    const voted = applyLocalVote(normalizePoll(base)!, 'b')
    expect(voted.totalVotes).toBe(11)
    expect(voted.options[1].votes).toBe(4)
    expect(applyLocalVote(normalizePoll(base)!, 'zzz').totalVotes).toBe(10)
  })

  it('knows when a poll is closed and labels the deadline', () => {
    const now = new Date('2026-11-24T12:00:00Z')
    expect(isClosed({ status: 'closed', closesAt: null }, now)).toBe(true)
    expect(isClosed({ status: 'open', closesAt: '2026-11-24T11:00:00Z' }, now)).toBe(true)
    expect(closesLabel({ status: 'open', closesAt: '2026-11-24T15:00:00Z' }, now)).toBe('Cierra en 3 h')
    expect(closesLabel({ status: 'open', closesAt: '2026-11-24T12:20:00Z' }, now)).toBe('Cierra en 20 min')
    expect(closesLabel({ status: 'open', closesAt: null }, now)).toBe('Votación abierta')
  })

  it('sorts open featured first, closed last', () => {
    const now = new Date('2026-11-24T12:00:00Z')
    const polls = [
      { ...normalizePoll(base)!, id: 'old', createdAt: '2026-11-20T00:00:00Z' },
      { ...normalizePoll(base)!, id: 'closed', status: 'closed' as const },
      { ...normalizePoll(base)!, id: 'feat', featured: true, createdAt: '2026-11-01T00:00:00Z' },
      { ...normalizePoll(base)!, id: 'new', createdAt: '2026-11-24T00:00:00Z' },
    ] satisfies Poll[]
    expect(sortPolls(polls, now).map((p) => p.id)).toEqual(['feat', 'new', 'old', 'closed'])
  })
})

describe('local vote state', () => {
  it('creates and reuses a voter id', () => {
    const s = memory()
    const id = getVoterId(s, () => '11111111-2222-4333-8444-555555555555')
    expect(id).toBe('11111111-2222-4333-8444-555555555555')
    expect(getVoterId(s, () => 'otro')).toBe(id)
    s.setItem(VOTER_KEY, 'basura')
    expect(getVoterId(s, () => '99999999-2222-4333-8444-555555555555')).toBe('99999999-2222-4333-8444-555555555555')
  })

  it('remembers voted polls and survives corrupted or blocked storage', () => {
    const s = memory()
    expect(markVoted(s, 'p1', 'a')).toEqual({ p1: 'a' })
    expect(readVoted(s)).toEqual({ p1: 'a' })
    s.setItem(VOTED_KEY, '{roto')
    expect(readVoted(s)).toEqual({})
    const blocked = { getItem: () => { throw new Error('x') }, setItem: () => { throw new Error('x') } } as unknown as Storage
    expect(readVoted(blocked)).toEqual({})
    expect(markVoted(blocked, 'p', 'o')).toEqual({ p: 'o' })
    expect(getVoterId(null, () => 'id')).toBe('id')
  })
})
