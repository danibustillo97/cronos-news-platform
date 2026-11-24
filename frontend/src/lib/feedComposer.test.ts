import { describe, expect, it } from 'vitest'
import type { Match } from '@/types/sports'
import {
  briefPoints, buildNowItems, composeFeed, extractQuote, extractVideoEmbed, featuredMatches,
  matchDayStats, summaryPoints, timeAgo, trendingTopics, type FeedStory,
} from './feedComposer'

const NOW = new Date('2026-11-24T18:00:00')
const iso = (offsetMin: number) => new Date(NOW.getTime() + offsetMin * 60_000).toISOString()

const match = (id: string, status: Match['status'], offsetMin: number, homeScore = 0, awayScore = 0): Match => ({
  id, league: 'col.1', leagueName: 'Liga BetPlay', homeTeam: `H${id}`, awayTeam: `A${id}`,
  homeLogo: null, awayLogo: null, homeScore, awayScore, status, statusDetail: '', date: iso(offsetMin), venue: null,
})

const story = (id: string, offsetMin: number, extra: Partial<FeedStory> = {}): FeedStory => ({
  id, title: `Historia ${id}`, slug: id, published_at: iso(offsetMin), ...extra,
})

describe('text extraction', () => {
  it('extracts a real quote from the article body', () => {
    const html = '<p>Intro sin cita.</p><p>El DT dijo: “Vamos a pelear el título hasta la última fecha, con todo lo que tenemos”, tras el partido.</p>'
    expect(extractQuote(html)).toBe('Vamos a pelear el título hasta la última fecha, con todo lo que tenemos')
  })

  it('ignores attribute quotes, captions and too-short quotes', () => {
    const html = '<figure><img src="https://x.com/a-very-long-image-path-that-looks-like-a-quote.png" alt="Una descripción muy larga de la foto del partido en el estadio"><figcaption>“Esta leyenda de la foto no es una declaración del protagonista”</figcaption></figure><p>Dijo “sí”.</p>'
    expect(extractQuote(html)).toBeNull()
    expect(extractQuote(null)).toBeNull()
  })

  it('splits summaries into usable sentences', () => {
    const text = 'Primera frase con suficiente largo para contar. Segunda frase, también con buen largo aquí. Corta. Tercera frase del resumen que vale la pena leer.'
    expect(summaryPoints(text)).toEqual([
      'Primera frase con suficiente largo para contar.',
      'Segunda frase, también con buen largo aquí.',
      'Tercera frase del resumen que vale la pena leer.',
    ])
    expect(summaryPoints(null)).toEqual([])
  })

  it('combines excerpt and body for the 30-second brief without repeating', () => {
    const points = briefPoints({
      excerpt: 'Boca ganó la final de la Sudamericana en Barranquilla.',
      content: '<p>Boca ganó la final de la Sudamericana en Barranquilla.</p><p>Villa fue la figura del partido con un gol y una asistencia.</p>',
      summary: null,
    })
    expect(points).toEqual([
      'Boca ganó la final de la Sudamericana en Barranquilla.',
      'Villa fue la figura del partido con un gol y una asistencia.',
    ])
  })

  it('finds an embedded YouTube video without autoplay', () => {
    const embed = extractVideoEmbed('<p>x</p><iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe>')
    expect(embed).toContain('/embed/dQw4w9WgXcQ')
    expect(embed).not.toContain('autoplay=1')
    expect(extractVideoEmbed('<p>sin video</p>')).toBeNull()
  })

  it('ranks trending tags case-insensitively', () => {
    const topics = trendingTopics([
      story('1', 0, { tags: ['Junior', 'Liga BetPlay'] }),
      story('2', 0, { tags: ['junior', 'Selección Colombia', 'Junior'] }),
      story('3', 0, { tags: ['Liga BetPlay', 'Junior'] }),
    ])
    expect(topics).toEqual([
      { tag: 'Junior', count: 3 },
      { tag: 'Liga BetPlay', count: 2 },
      { tag: 'Selección Colombia', count: 1 },
    ])
  })
})

describe('matches', () => {
  const matches = [
    match('fin-old', 'finished', -600, 1, 1),
    match('fin', 'finished', -120, 2, 1),
    match('live', 'live', -30, 1, 0),
    match('soon', 'scheduled', 45),
    match('later', 'scheduled', 300),
  ]

  it('prioritises live, then next kickoff, then last result', () => {
    expect(featuredMatches(matches, NOW).map((m) => m.id)).toEqual(['live', 'soon', 'fin'])
  })

  it('computes real day stats and nothing when there are no matches', () => {
    const stats = matchDayStats(matches, NOW)
    expect(stats.find((s) => s.label === 'En vivo')?.value).toBe(1)
    expect(stats.find((s) => s.label === 'Goles del día')?.value).toBeGreaterThanOrEqual(4)
    expect(matchDayStats([], NOW)).toEqual([])
  })

  it('builds the Ahora rail: live first, recent by recency, upcoming last', () => {
    const items = buildNowItems([story('a', -10), story('b', -200)], matches, NOW)
    expect(items.map((i) => i.key)).toEqual(['live-live', 's-a', 'f-fin', 's-b', 'f-fin-old', 'k-soon', 'k-later'])
  })
})

describe('composeFeed', () => {
  const sources = [
    story('s1', -5, { excerpt: 'Primera frase con suficiente largo para contar. Segunda frase, también con buen largo aquí.', content: '<p>Dijo: “Este equipo tiene hambre de gloria y lo vamos a demostrar en la final”.</p>', tags: ['A', 'B', 'C'] }),
    story('s2', -50, { tags: ['A', 'B'] }),
    story('s3', -90, { tags: ['C', 'D'] }),
  ]

  it('weaves stories with data blocks and never fabricates missing ones', () => {
    const blocks = composeFeed({ stories: sources.slice(1), sources, matches: [], now: NOW })
    const types = blocks.map((b) => b.type)
    expect(types).toContain('brief')
    expect(types).toContain('quote')
    expect(types).toContain('trending')
    expect(types).not.toContain('match')
    expect(types).not.toContain('stat')
    expect(types).not.toContain('standings')
    expect(blocks[0]).toMatchObject({ type: 'story', size: 'lead' })
  })

  it('places ads naturally and keeps keys unique', () => {
    const many = Array.from({ length: 30 }, (_, i) => story(`n${i}`, -i * 10))
    const blocks = composeFeed({ stories: many, sources: many, matches: [match('live', 'live', -10)], now: NOW, standingsLeague: 'col.1' })
    const adIndexes = blocks.flatMap((b, i) => (b.type === 'ad' ? [i] : []))
    expect(adIndexes[0]).toBe(5)
    expect(adIndexes.length).toBeGreaterThan(1)
    expect(new Set(blocks.map((b) => b.key)).size).toBe(blocks.length)
    expect(blocks.some((b) => b.type === 'standings')).toBe(true)
  })

  it('backfills a thin feed with more real matches, a second table, polls and the players tool', () => {
    const matches = [match('live', 'live', -10), match('m1', 'scheduled', 60), match('m2', 'scheduled', 120), match('m3', 'scheduled', 180), match('m4', 'scheduled', 240)]
    const blocks = composeFeed({
      stories: sources.slice(2), sources, matches, now: NOW, standingsLeague: 'col.1', secondaryLeague: 'eng.1',
      polls: [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }], playersTool: true,
    })
    const types = blocks.map((b) => b.type)
    expect(types.filter((t) => t === 'match').length).toBeGreaterThanOrEqual(4)
    expect(types.filter((t) => t === 'standings')).toHaveLength(2)
    expect(types.filter((t) => t === 'poll')).toHaveLength(3)
    expect(types).toContain('players')
    expect(blocks.length).toBeGreaterThanOrEqual(12)
    expect(new Set(blocks.map((b) => b.key)).size).toBe(blocks.length)
  })

  it('does not add the second table when there are plenty of stories', () => {
    const many = Array.from({ length: 12 }, (_, i) => story(`x${i}`, -i))
    const blocks = composeFeed({ stories: many, sources: many, matches: [], now: NOW, standingsLeague: 'col.1', secondaryLeague: 'eng.1' })
    expect(blocks.filter((b) => b.type === 'standings')).toHaveLength(1)
  })

  it('returns an empty feed when there is nothing real to show', () => {
    expect(composeFeed({ stories: [], sources: [], matches: [], now: NOW })).toEqual([])
  })
})

describe('timeAgo', () => {
  it('formats relative times in Spanish', () => {
    expect(timeAgo(iso(0), NOW)).toBe('ahora')
    expect(timeAgo(iso(-5), NOW)).toBe('hace 5 min')
    expect(timeAgo(iso(-180), NOW)).toBe('hace 3 h')
    expect(timeAgo(iso(-60 * 30), NOW)).toBe('ayer')
    expect(timeAgo('nope', NOW)).toBe('')
  })
})
