import { describe, expect, it } from 'vitest'
import { filterCurrentNews, isCurrentNews, newsExpiresAt } from './newsFreshness'

describe('news freshness policy (America/Bogota)', () => {
  it('expires a story from yesterday at 06:00 the following day', () => {
    const yesterdayAtFivePm = '2026-11-24T22:00:00.000Z'
    expect(newsExpiresAt(yesterdayAtFivePm)?.toISOString()).toBe('2026-11-25T11:00:00.000Z')
    expect(isCurrentNews({ published_at: yesterdayAtFivePm }, new Date('2026-11-25T10:59:59.000Z'))).toBe(true)
    expect(isCurrentNews({ published_at: yesterdayAtFivePm }, new Date('2026-11-25T11:00:00.000Z'))).toBe(false)
  })

  it('keeps a story published this morning until 06:00 tomorrow', () => {
    const todayAtEightAm = '2026-11-25T13:00:00.000Z'
    expect(newsExpiresAt(todayAtEightAm)?.toISOString()).toBe('2026-11-26T11:00:00.000Z')
    expect(isCurrentNews({ published_at: todayAtEightAm }, new Date('2026-11-26T10:59:59.000Z'))).toBe(true)
    expect(isCurrentNews({ published_at: todayAtEightAm }, new Date('2026-11-26T11:00:00.000Z'))).toBe(false)
  })

  it('filters expired stories without deleting the underlying records', () => {
    const now = new Date('2026-11-25T12:00:00.000Z')
    const stories = [
      { id: 'old', published_at: '2026-11-24T22:00:00.000Z' },
      { id: 'fresh', published_at: '2026-11-25T13:00:00.000Z' },
    ]
    expect(filterCurrentNews(stories, now).map((story) => story.id)).toEqual(['fresh'])
    expect(stories).toHaveLength(2)
  })

  it('does not silently treat invalid publication dates as current', () => {
    expect(isCurrentNews({ published_at: null }, new Date('2026-11-25T12:00:00.000Z'))).toBe(false)
    expect(isCurrentNews({ published_at: 'not-a-date' }, new Date('2026-11-25T12:00:00.000Z'))).toBe(false)
  })
})
