import { describe, expect, it } from 'vitest'
import { filterCurrentNews, isCurrentNews, newsExpiresAt } from './newsFreshness'

describe('news freshness policy (24 h feed)', () => {
  it('keeps a story in the feed for exactly 24 hours', () => {
    const published = '2026-11-24T22:00:00.000Z'
    expect(newsExpiresAt(published)?.toISOString()).toBe('2026-11-25T22:00:00.000Z')
    expect(isCurrentNews({ published_at: published }, new Date('2026-11-25T21:59:59.000Z'))).toBe(true)
    expect(isCurrentNews({ published_at: published }, new Date('2026-11-25T22:00:00.000Z'))).toBe(false)
  })

  it('archives a story published after midnight before the next night', () => {
    const justAfterMidnight = '2026-11-25T05:10:00.000Z' // 00:10 in Bogotá
    expect(isCurrentNews({ published_at: justAfterMidnight }, new Date('2026-11-26T05:09:00.000Z'))).toBe(true)
    expect(isCurrentNews({ published_at: justAfterMidnight }, new Date('2026-11-26T05:11:00.000Z'))).toBe(false)
  })

  it('filters expired stories without deleting the underlying records', () => {
    const now = new Date('2026-11-25T12:00:00.000Z')
    const stories = [
      { id: 'old', published_at: '2026-11-24T10:00:00.000Z' },
      { id: 'fresh', published_at: '2026-11-25T08:00:00.000Z' },
    ]
    expect(filterCurrentNews(stories, now).map((story) => story.id)).toEqual(['fresh'])
    expect(stories).toHaveLength(2)
  })

  it('does not silently treat invalid publication dates as current', () => {
    expect(isCurrentNews({ published_at: null }, new Date('2026-11-25T12:00:00.000Z'))).toBe(false)
    expect(isCurrentNews({ published_at: 'not-a-date' }, new Date('2026-11-25T12:00:00.000Z'))).toBe(false)
  })
})
