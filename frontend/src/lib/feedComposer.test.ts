import { describe, expect, it } from 'vitest'
import type { Match } from '@/types/sports'
import { briefPoints, decodeEntities, featuredMatches, htmlParagraphs, summaryPoints, timeAgo } from './feedComposer'

const NOW = new Date('2026-11-24T18:00:00')
const iso = (offsetMin: number) => new Date(NOW.getTime() + offsetMin * 60_000).toISOString()

const match = (id: string, status: Match['status'], offsetMin: number, homeScore = 0, awayScore = 0): Match => ({
  id, league: 'col.1', leagueName: 'Liga BetPlay', homeTeam: `H${id}`, awayTeam: `A${id}`,
  homeLogo: null, awayLogo: null, homeScore, awayScore, status, statusDetail: '', date: iso(offsetMin), venue: null,
})

describe('text extraction', () => {
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

  it('turns article HTML into plain paragraphs, dropping captions and decoding entities', () => {
    expect(htmlParagraphs('<p>Hola &amp; adi&oacute;s</p><figure><img src="x"><figcaption>Pie</figcaption></figure><p>Dos&nbsp;frases</p>'))
      .toEqual(['Hola & adi&oacute;s', 'Dos frases'])
    expect(decodeEntities('&#8220;Gol&#8221; &laquo;ya&raquo;')).toBe('“Gol” «ya»')
  })
})

describe('matches', () => {
  it('prioritises live, then next kickoff, then last result', () => {
    const matches = [
      match('fin-old', 'finished', -600, 1, 1),
      match('fin', 'finished', -120, 2, 1),
      match('live', 'live', -30, 1, 0),
      match('soon', 'scheduled', 45),
      match('later', 'scheduled', 300),
    ]
    expect(featuredMatches(matches, NOW).map((m) => m.id)).toEqual(['live', 'soon', 'fin'])
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
