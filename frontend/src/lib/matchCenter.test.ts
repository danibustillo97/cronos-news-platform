import { describe, expect, it } from 'vitest'
import {
  clockLabel, detectGoal, lastEventLine, minuteValue, normalizeInsights, normalizeMatchDetail, possession, scorerIds, sortEvents, statBar,
} from './matchCenter'

const raw = {
  id: '401915295', league: 'uefa.champions', leagueName: 'Champions League', state: 'in', clock: "63'", period: 2, statusText: '2.º tiempo', date: '2026-11-24T20:00Z', venue: 'Emirates',
  home: { id: '359', name: 'Arsenal', short: 'ARS', logo: 'https://a.espncdn.com/a.png', score: 1, form: 'dwwwl' },
  away: { id: '124', name: 'Borussia Dortmund', short: 'BVB', logo: null, score: 0, form: 'WWWDW' },
  events: [
    { id: 'e2', minute: "45+2'", type: 'yellow', team: 'away', player: { id: '9', name: 'Can' }, assist: null, text: '' },
    { id: 'e1', minute: "10'", type: 'goal', team: 'home', player: { id: '258906', name: 'Gyökeres' }, assist: { id: '7', name: 'Madueke' }, text: 'Gol' },
    { id: 'e3', minute: "50'", type: 'weird', team: 'x', player: null, assist: null, text: 'otra' },
  ],
  stats: [{ key: 'possessionPct', label: 'Posesión', home: 77, away: 23, percent: true }, { key: 'shots', label: 'Remates', home: 9, away: 3, percent: false }, { key: 'x', label: '' }],
  lineups: { home: [{ id: '1', name: 'Raya', jersey: '22', position: 'POR', starter: true }, { name: '' }], away: [] },
  commentary: [{ minute: "62'", text: 'Remate de Saka.' }, { minute: '', text: '' }],
  updatedAt: '2026-11-24T21:03:00Z',
}

describe('match center', () => {
  const d = normalizeMatchDetail(raw)!

  it('normalizes the match detail defensively', () => {
    expect(d.state).toBe('in')
    expect(d.home.form).toBe('DWWWL')
    expect(d.events[2]).toMatchObject({ type: 'other', team: null })
    expect(d.stats).toHaveLength(2)
    expect(d.lineups.home).toHaveLength(1)
    expect(d.commentary).toHaveLength(1)
    expect(normalizeMatchDetail({})).toBeNull()
    expect(normalizeMatchDetail({ id: 'x', state: 'raro' })!.state).toBe('pre')
  })

  it('orders events by minute, including stoppage time', () => {
    expect(minuteValue("45+2'")).toBeCloseTo(45.02)
    expect(sortEvents(d.events, true).map((e) => e.id)).toEqual(['e3', 'e2', 'e1'])
    expect(sortEvents(d.events, false).map((e) => e.id)).toEqual(['e1', 'e2', 'e3'])
  })

  it('summarizes the last relevant event and the possession momentum', () => {
    expect(lastEventLine(d.events)).toBe("🟨 45+2' Can")
    expect(lastEventLine(d.events.filter((e) => e.type === 'goal'))).toBe("⚽ 10' Gyökeres")
    expect(lastEventLine([])).toBeNull()
    expect(possession(d.stats)).toEqual({ home: 77, away: 23 })
    expect(possession([])).toBeNull()
  })

  it('builds mirrored stat bars', () => {
    expect(statBar(d.stats[0])).toEqual({ homePct: 77, awayPct: 23, leader: 'home' })
    expect(statBar(d.stats[1])).toEqual({ homePct: 100, awayPct: 33, leader: 'home' })
    expect(statBar({ key: 'k', label: 'C', home: 0, away: 0, percent: false })).toEqual({ homePct: 0, awayPct: 0, leader: null })
  })

  it('detects goals between two reads and lists scorers for insights', () => {
    const before = { home: { ...d.home, score: 0 }, away: d.away }
    expect(detectGoal(before, d)).toBe('home')
    expect(detectGoal(d, d)).toBeNull()
    expect(detectGoal(null, d)).toBeNull()
    expect(scorerIds(d.events)).toEqual(['258906'])
  })

  it('labels the clock in Spanish', () => {
    expect(clockLabel(d)).toBe("63'")
    expect(clockLabel({ state: 'post', clock: '', statusText: 'FT' })).toBe('Final')
    expect(clockLabel({ state: 'in', clock: '12', statusText: '' })).toBe("12'")
  })

  it('normalizes player insights', () => {
    const ins = normalizeInsights({
      player: { id: '258906', name: 'Viktor Gyökeres', team: 'Arsenal', image: null },
      facts: ['Lleva 6 goles en la temporada.', '', 7],
      lastGames: [{ date: '2026-11-20', opponent: 'Chelsea', result: 'w', goals: 2, assists: '1' }],
      season: { season: '2026-27', competition: 'Premier League', goals: 6 },
    })!
    expect(ins.facts).toEqual(['Lleva 6 goles en la temporada.', '7'])
    expect(ins.lastGames[0]).toMatchObject({ result: 'W', goals: 2, assists: 1 })
    expect(ins.season?.goals).toBe(6)
    expect(normalizeInsights({ player: {} })).toBeNull()
  })
})
