/**
 * Editorial freshness policy for the public "current news" surfaces.
 * A story is current for exactly 24 hours after it was published; after that
 * it leaves the feed, the home and the category pages and lives in /archivo.
 * Its permanent article URL is NOT expired (SEO keeps the page indexed).
 */
export const NEWS_TIME_ZONE = 'America/Bogota'
/** Hours a story stays in the current feed. */
export const NEWS_FEED_HOURS = 24
// Bounded reads fetch a little more than the window; filterCurrentNews applies the exact cutoff.
export const NEWS_QUERY_LOOKBACK_HOURS = NEWS_FEED_HOURS + 1

/** UTC instant when the story leaves the current feed (published + 24 h). */
export function newsExpiresAt(publishedAt: string | null | undefined): Date | null {
  if (!publishedAt) return null
  const published = new Date(publishedAt)
  if (!Number.isFinite(published.getTime())) return null
  return new Date(published.getTime() + NEWS_FEED_HOURS * 60 * 60 * 1000)
}

export function isCurrentNews(
  item: { published_at?: string | null },
  now: Date = new Date(),
): boolean {
  const expiresAt = newsExpiresAt(item.published_at)
  return Boolean(expiresAt && expiresAt.getTime() > now.getTime())
}

export function filterCurrentNews<T extends { published_at?: string | null }>(
  items: T[],
  now: Date = new Date(),
): T[] {
  return items.filter((item) => isCurrentNews(item, now))
}

/** Lower bound for bounded Supabase reads; filterCurrentNews applies exact cutoff. */
export function newsQueryFloor(now: Date = new Date()): string {
  return new Date(now.getTime() - NEWS_QUERY_LOOKBACK_HOURS * 60 * 60 * 1000).toISOString()
}
