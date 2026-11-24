import { describe, expect, it } from 'vitest'
import type { Match } from '@/types/sports'
import type { FeedStory } from './feedComposer'
import type { StandingsRowData } from './standings'
import { autoFacts, briefSlides, composeReels, interleavePolls, matchesForSlot, slideDurationMs, type ReelItem } from './reels'

const NOW = new Date('2026-11-24T18:00:00')
const iso = (min: number) => new Date(NOW.getTime() + min * 60_000).toISOString()
const rich = {
  excerpt: 'Boca ganó la final de la Sudamericana en Barranquilla con autoridad.',
  content: '<p>Villa fue la figura del partido con un gol y una asistencia decisiva.</p><p>El técnico destacó el orden defensivo del equipo durante todo el juego.</p>',
}
const story = (id: string, extra: Partial<FeedStory> = {}): FeedStory => ({ id, title: `Historia ${id}`, slug: id, published_at: iso(-Number(id.replace(/\D/g, '') || 1)), ...extra })
const match = (id: string, status: Match['status'], min: number, h = 0, a = 0): Match => ({
  id, league: 'col.1', leagueName: 'Liga BetPlay', homeTeam: `H${id}`, awayTeam: `A${id}`, homeLogo: null, awayLogo: null,
  homeScore: h, awayScore: a, status, statusDetail: '', date: iso(min), venue: null,
})
const row = (rank: number, team: string, points: number, played: number, gf: number, ga: number): StandingsRowData => ({
  rank: String(rank), team, logo: null, played: String(played), won: '0', drawn: '0', lost: '0', points: String(points),
  goalDifference: String(gf - ga), goalsFor: String(gf), goalsAgainst: String(ga),
})

const nonAd = (items: ReelItem[]) => items.filter((i) => i.type !== 'ad')

describe('composeReels', () => {
  const many = Array.from({ length: 24 }, (_, i) => story(`s${i + 1}`, i % 3 === 0 ? rich : {}))
  const items = composeReels({ stories: many, stageStories: [story('stage1', rich)] })

  it('is deterministic and keys are unique', () => {
    expect(composeReels({ stories: many, stageStories: [story('stage1', rich)] })).toEqual(items)
    expect(new Set(items.map((i) => i.key)).size).toBe(items.length)
  })

  it('never puts two non-news items in a row while there are news, nor the same non-news type twice', () => {
    const seq = nonAd(items)
    const lastNews = seq.map((i) => i.type).lastIndexOf('news')
    for (let i = 1; i <= lastNews; i++) {
      const a = seq[i - 1].type
      const b = seq[i].type
      if (a !== 'news' && b !== 'news') throw new Error(`dos bloques seguidos: ${a}, ${b} en ${i}`)
    }
    for (let i = 1; i < items.length; i++) {
      if (items[i].type !== 'news') expect(items[i].type).not.toBe(items[i - 1].type)
    }
  })

  it('places a table roughly every 6-8 items, rotating leagues', () => {
    const seq = nonAd(items)
    const idx = seq.flatMap((it, i) => (it.type === 'table' ? [i] : []))
    expect(idx.length).toBeGreaterThanOrEqual(3)
    for (let i = 1; i < idx.length; i++) expect(idx[i] - idx[i - 1]).toBeLessThanOrEqual(9)
    const leagues = seq.filter((i): i is Extract<ReelItem, { type: 'table' }> => i.type === 'table').map((t) => t.league)
    expect(new Set(leagues).size).toBe(leagues.length)
    expect(leagues[0]).toBe('col.1')
  })

  it('turns some stories into 30-second briefs instead of duplicating them', () => {
    const briefIds = items.filter((i) => i.type === 'brief').map((i) => (i as { story: FeedStory }).story.id)
    const newsIds = items.filter((i) => i.type === 'news').map((i) => (i as { story: FeedStory }).story.id)
    expect(briefIds.length).toBeGreaterThan(0)
    expect(briefIds.some((id) => newsIds.includes(id))).toBe(false)
    expect(briefIds).toContain('stage1')
  })

  it('places ads after news, starting with HOME_TOP', () => {
    const ads = items.flatMap((it, i) => (it.type === 'ad' ? [i] : []))
    expect((items[ads[0]] as { position: string }).position).toBe('HOME_TOP')
    expect(ads.length).toBeGreaterThan(1)
    for (const i of ads) expect(items[i - 1].type).toBe('news')
  })

  it('backfills when there are few news, without repeating types consecutively', () => {
    const few = composeReels({ stories: [story('n1')], stageStories: [story('st', rich)] })
    expect(nonAd(few).length).toBeGreaterThanOrEqual(14)
    for (let i = 1; i < few.length; i++) {
      if (few[i].type !== 'news') expect(few[i].type).not.toBe(few[i - 1].type)
    }
    const types = new Set(few.map((i) => i.type))
    for (const t of ['table', 'match', 'fact', 'poll', 'brief']) expect(types).toContain(t)
  })

  it('still produces a data feed with no news at all', () => {
    const empty = composeReels({ stories: [] })
    expect(empty.length).toBeGreaterThan(5)
    expect(empty.some((i) => i.type === 'news')).toBe(false)
  })
})

describe('interleavePolls', () => {
  it('distributes every published poll through the feed instead of leaving them to filler priority', () => {
    const base = composeReels({ stories: Array.from({ length: 16 }, (_, i) => story('feed-' + (i + 1))), pollSlots: 0 })
    const items = interleavePolls(base, 3)
    const pollIndexes = items.flatMap((item, index) => item.type === 'poll' ? [index] : [])
    expect(pollIndexes).toHaveLength(3)
    expect(pollIndexes[0]).toBeLessThan(pollIndexes[1])
    expect(pollIndexes[1]).toBeLessThan(pollIndexes[2])
    const storyBefore = pollIndexes.map((index) => items.slice(0, index).filter((item) => item.type === 'news' || item.type === 'brief').length)
    expect(storyBefore).toEqual([4, 8, 12])
  })

  it('keeps all debates visible when a first page has fewer stories than polls', () => {
    const base = composeReels({ stories: [story('one'), story('two')], pollSlots: 0 })
    const items = interleavePolls(base, 4)
    expect(items.filter((item) => item.type === 'poll')).toHaveLength(4)
    expect(items.map((item) => item.key).filter((key) => key.startsWith('poll-'))).toEqual(['poll-0', 'poll-1', 'poll-2', 'poll-3'])
  })

  it('does not create empty poll slots', () => {
    const base = composeReels({ stories: [story('one')], pollSlots: 0 })
    expect(interleavePolls(base, 0)).toEqual(base)
  })
})

describe('briefSlides', () => {
  it('builds title, key points and a closing slide from the article itself', () => {
    const slides = briefSlides({ title: 'Boca campeón', category: 'Fútbol', ...rich, summary: null })
    expect(slides[0]).toEqual({ kind: 'title', text: 'Boca campeón', kicker: 'Fútbol' })
    expect(slides.filter((s) => s.kind === 'point').length).toBeGreaterThanOrEqual(2)
    expect(slides[slides.length - 1]).toEqual({ kind: 'cta', text: 'Leer la noticia completa' })
  })

  it('returns nothing when there is not enough material', () => {
    expect(briefSlides({ title: 'x', excerpt: 'Corta.', content: null, summary: null })).toEqual([])
  })

  it('times slides to about 30 seconds', () => {
    expect(slideDurationMs(4)).toBe(7500)
    expect(slideDurationMs(5)).toBe(6000)
    expect(slideDurationMs(2)).toBe(9000)
  })
})

describe('autoFacts', () => {
  const table = [row(1, 'Arsenal', 28, 11, 25, 8), row(2, 'Brighton', 22, 11, 20, 12), row(3, 'City', 22, 11, 22, 10), row(4, 'Liverpool', 21, 11, 19, 15)]

  it('derives leader, attack and defense only from real table numbers', () => {
    const facts = autoFacts([{ league: 'eng.1', label: 'Premier League', table }], [], NOW)
    const leader = facts.find((f) => f.id === 'leader-eng.1')!
    expect(leader.headline).toBe('Arsenal manda en Premier League')
    expect(leader.value).toBe('28 pts')
    expect(leader.detail).toBe('6 puntos sobre Brighton tras 11 fechas')
    expect(facts.find((f) => f.id === 'attack-eng.1')?.value).toBe('25')
    expect(facts.find((f) => f.id === 'defense-eng.1')?.value).toBe('8')
  })

  it('skips facts it cannot assert (ties, no games played, empty tables)', () => {
    const tied = [row(1, 'A', 3, 1, 1, 0), row(2, 'B', 3, 1, 1, 0)]
    const facts = autoFacts([{ league: 'col.1', label: 'Liga BetPlay', table: tied }, { league: 'x', label: 'X', table: [] }], [], NOW)
    expect(facts.map((f) => f.id)).toEqual(['compare-cta'])
  })

  it('reports live matches, goals of the day and big wins from the scoreboard', () => {
    const matches = [match('l', 'live', -30, 1, 1), match('f', 'finished', -200, 4, 0), match('s', 'scheduled', 60)]
    const facts = autoFacts([], matches, NOW)
    expect(facts.find((f) => f.id === 'live-now')?.value).toBe('1')
    expect(facts.find((f) => f.id === 'goals-today')?.value).toBe('6')
    expect(facts.find((f) => f.id === 'rout-f')?.headline).toBe('Hf goleó a Af')
  })
})

describe('matchesForSlot', () => {
  it('splits live, upcoming and results into slots and returns null when exhausted', () => {
    const matches = [match('l', 'live', -10), match('u1', 'scheduled', 30), match('r', 'finished', -300)]
    expect(matchesForSlot(matches, 0, NOW)?.title).toBe('En vivo')
    expect(matchesForSlot(matches, 1, NOW)?.matches.map((m) => m.id)).toEqual(['u1'])
    expect(matchesForSlot(matches, 2, NOW)?.title).toBe('Resultados')
    expect(matchesForSlot(matches, 3, NOW)).toBeNull()
    expect(matchesForSlot([], 0, NOW)).toBeNull()
  })
})


describe('composeReels: capsules and picks', () => {
  const stories = Array.from({ length: 20 }, (_, i) => story(`p${i + 1}`))

  it('adds no capsules or picks unless asked (current feed unchanged)', () => {
    const items = composeReels({ stories })
    expect(items.some((i) => i.type === 'capsule' || i.type === 'picks')).toBe(false)
  })

  it('interleaves capsules without repeating the type consecutively', () => {
    const items = composeReels({ stories, capsuleSlots: 3 })
    expect(items.filter((i) => i.type === 'capsule')).toHaveLength(3)
    for (let i = 1; i < items.length; i++) if (items[i].type === 'capsule') expect(items[i - 1].type).not.toBe('capsule')
  })

  it('places exactly one Parley del día, after a news item, from the 8th position on', () => {
    const items = composeReels({ stories, picks: true })
    const idx = items.findIndex((i) => i.type === 'picks')
    expect(items.filter((i) => i.type === 'picks')).toHaveLength(1)
    expect(idx).toBeGreaterThanOrEqual(8)
    expect(items[idx - 1].type).toBe('news')
  })

  it('still shows the parley in a thin feed', () => {
    const items = composeReels({ stories: [story('x1')], picks: true })
    expect(items.filter((i) => i.type === 'picks')).toHaveLength(1)
  })
})

describe('composeReels: momentos de partido', () => {
  const stories = Array.from({ length: 21 }, (_, i) => story(`m${i + 1}`))

  it('puts the newest moment on top and then at most one every 3 news, never next to another block', () => {
    const items = composeReels({ stories, momentSlots: 6 })
    expect(items[0]).toMatchObject({ type: 'moment', slot: 0 })
    const idx = items.flatMap((it, i) => (it.type === 'moment' ? [i] : []))
    expect(idx.length).toBeGreaterThan(1)
    for (const i of idx.slice(1)) {
      expect(items[i - 1].type).toBe('news')
      if (items[i + 1]) expect(['news', 'ad']).toContain(items[i + 1].type)
    }
    const newsCount = items.filter((i) => i.type === 'news').length
    expect(idx.length - 1).toBeLessThanOrEqual(Math.floor(newsCount / 3))
    expect(new Set(items.map((i) => i.key)).size).toBe(items.length)
  })

  it('spreads extra moments through the tail of a thin feed, never two together', () => {
    const items = composeReels({ stories: [story('t1'), story('t2')], momentSlots: 6 })
    const idx = items.flatMap((it, i) => (it.type === 'moment' ? [i] : []))
    expect(idx.length).toBeGreaterThanOrEqual(3)
    for (let k = 1; k < idx.length; k++) expect(idx[k] - idx[k - 1]).toBeGreaterThan(1)
  })

  it('adds no moments unless asked', () => {
    expect(composeReels({ stories }).some((i) => i.type === 'moment')).toBe(false)
  })
})
