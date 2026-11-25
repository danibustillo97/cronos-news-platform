/**
 * Editorial freshness policy for the public "current news" surfaces.
 * A story remains current until 06:00 America/Bogota on the calendar day
 * after its publication date. Its permanent article URL is NOT expired.
 *
 * Bogotá is UTC-5 year-round; using Intl for the calendar date avoids
 * interpreting timestamps in the visitor's browser timezone.
 */
export const NEWS_TIME_ZONE = 'America/Bogota'
export const NEWS_DAILY_CUTOFF_HOUR = 6
// A story published just after midnight can remain current for almost 30h.
export const NEWS_QUERY_LOOKBACK_HOURS = 31

function bogotaDateParts(value: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: NEWS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value)
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value)
  return { year: get('year'), month: get('month'), day: get('day') }
}

/** UTC instant for 06:00 Bogotá on the day after publication. */
export function newsExpiresAt(publishedAt: string | null | undefined): Date | null {
  if (!publishedAt) return null
  const published = new Date(publishedAt)
  if (!Number.isFinite(published.getTime())) return null
  const { year, month, day } = bogotaDateParts(published)
  return new Date(Date.UTC(year, month - 1, day + 1, NEWS_DAILY_CUTOFF_HOUR + 5, 0, 0))
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
