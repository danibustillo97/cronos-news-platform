export type AdPosition =
  | 'HOME_TOP'
  | 'HOME_FEED'
  | 'ARTICLE_TOP'
  | 'ARTICLE_END'
  | 'SIDEBAR_DESKTOP'

export interface AdProviderConfig {
  adsenseEnabled: boolean
  adsensePublisherId: string | null
  adsenseSlots: Partial<Record<AdPosition, string>>
  /** Generic AdSense unit used by any space without its own unit. */
  adsenseDefaultSlot: string | null
  adsterraEnabled: boolean
  adsterraScriptUrl: string | null
  adsterraContainerId: string | null
  ga4MeasurementId: string | null
}

function enabled(value: string | undefined): boolean {
  return value === 'true'
}

export function getAdProviderConfig(): AdProviderConfig {
  return {
    adsenseEnabled: enabled(process.env.NEXT_PUBLIC_ADSENSE_ENABLED),
    adsensePublisherId: process.env.NEXT_PUBLIC_ADSENSE_PUBLISHER_ID || null,
    adsenseSlots: {
      HOME_TOP: process.env.NEXT_PUBLIC_ADSENSE_SLOT_HOME_TOP || undefined,
      HOME_FEED: process.env.NEXT_PUBLIC_ADSENSE_SLOT_HOME_FEED || undefined,
      ARTICLE_TOP: process.env.NEXT_PUBLIC_ADSENSE_SLOT_ARTICLE_TOP || undefined,
      ARTICLE_END: process.env.NEXT_PUBLIC_ADSENSE_SLOT_ARTICLE_END || undefined,
      SIDEBAR_DESKTOP: process.env.NEXT_PUBLIC_ADSENSE_SLOT_SIDEBAR || undefined,
    },
    adsenseDefaultSlot: process.env.NEXT_PUBLIC_ADSENSE_SLOT_DEFAULT || null,
    adsterraEnabled: enabled(process.env.NEXT_PUBLIC_ADSTERRA_ENABLED),
    adsterraScriptUrl: process.env.NEXT_PUBLIC_ADSTERRA_SCRIPT_URL || null,
    adsterraContainerId: process.env.NEXT_PUBLIC_ADSTERRA_CONTAINER_ID || null,
    ga4MeasurementId: process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID || null,
  }
}

/** Named portal spaces (admin "Anuncios") -> the AdSense position whose unit fills them. */
const PLACEMENT_POSITION: Record<string, AdPosition> = {
  'home-top': 'HOME_TOP', 'feed-1': 'HOME_FEED', 'feed-2': 'HOME_FEED', 'feed-3': 'HOME_FEED',
  sidebar: 'SIDEBAR_DESKTOP', 'article-inline': 'ARTICLE_TOP', 'article-bottom': 'ARTICLE_END', 'match-modal': 'HOME_FEED',
}

/**
 * AdSense unit that fills a named space when it has no direct campaign
 * (direct sponsors first, AdSense as the fallback). null = AdSense is off or
 * not configured, so the space collapses as before.
 */
export function adsenseSlotFor(placement: string, config: AdProviderConfig = getAdProviderConfig()): string | null {
  if (!config.adsenseEnabled || !config.adsensePublisherId) return null
  const position = PLACEMENT_POSITION[placement]
  return (position && config.adsenseSlots[position]) || config.adsenseDefaultSlot
}
