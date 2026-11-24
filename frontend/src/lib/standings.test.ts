import { describe, expect, it } from 'vitest'
import { formatGoalDiff, safeNoteColor, sortStandings, standingsLegend, type StandingsRowData } from './standings'

const row = (rank: string, team: string, noteColor: string | null = null, noteDescription: string | null = null): StandingsRowData => ({
  rank, team, logo: null, played: '1', won: '0', drawn: '0', lost: '0', points: '0',
  goalDifference: '0', goalsFor: '0', goalsAgainst: '0', noteColor, noteDescription,
})

describe('standings helpers', () => {
  it('sorts rows by numeric rank (ESPN sends them out of order)', () => {
    expect(sortStandings([row('1', 'A'), row('3', 'C'), row('2', 'B'), row('10', 'J'), row('x', 'Z')]).map((r) => r.team)).toEqual(['A', 'B', 'C', 'J', 'Z'])
  })

  it('builds a de-duplicated legend from real notes only', () => {
    const rows = [
      row('1', 'A', '#81D6AC', 'Champions League'),
      row('2', 'B', '#81D6AC', 'Champions League'),
      row('5', 'E', '#B5E7CE', 'Europa League'),
      row('6', 'F', 'red;background:url(x)', 'Inyección'),
      row('18', 'R', '#FF7F84', 'Relegation'),
      row('19', 'S', '#FF7F84', null),
    ]
    expect(standingsLegend(rows)).toEqual([
      { color: '#81D6AC', label: 'Champions League' },
      { color: '#B5E7CE', label: 'Europa League' },
      { color: '#FF7F84', label: 'Relegation' },
    ])
    expect(safeNoteColor('red;x')).toBeNull()
  })

  it('formats goal difference with sign', () => {
    expect(formatGoalDiff('3')).toBe('+3')
    expect(formatGoalDiff('+1')).toBe('+1')
    expect(formatGoalDiff('-2')).toBe('-2')
    expect(formatGoalDiff('0')).toBe('0')
    expect(formatGoalDiff(null)).toBe('—')
  })
})
