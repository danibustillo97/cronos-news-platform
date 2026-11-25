const BRAND_SUFFIX = ' | Nexus News'
const DEFAULT_TITLE = `Noticias deportivas${BRAND_SUFFIX}`

/**
 * Keeps search-result titles compact without changing the visible article
 * headline, Open Graph title, Twitter title, or NewsArticle structured data.
 */
export function buildArticleSeoTitle(headline: string, maxLength = 60): string {
  const normalized = String(headline ?? '').replace(/\s+/g, ' ').trim()
  if (!normalized) return DEFAULT_TITLE

  const prefixLimit = Math.max(20, maxLength - BRAND_SUFFIX.length)
  if (normalized.length <= prefixLimit) return `${normalized}${BRAND_SUFFIX}`

  const clipped = normalized.slice(0, prefixLimit + 1)
  const boundary = clipped.lastIndexOf(' ')
  const prefix = (boundary >= Math.ceil(prefixLimit * 0.6)
    ? clipped.slice(0, boundary)
    : normalized.slice(0, prefixLimit)
  ).replace(/[\\s:;,|–—-]+$/g, '').trim()

  return `${prefix || normalized.slice(0, prefixLimit).trim()}${BRAND_SUFFIX}`
}
