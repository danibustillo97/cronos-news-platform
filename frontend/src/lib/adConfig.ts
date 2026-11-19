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
    adsterraEnabled: enabled(process.env.NEXT_PUBLIC_ADSTERRA_ENABLED),
    adsterraScriptUrl: process.env.NEXT_PUBLIC_ADSTERRA_SCRIPT_URL || null,
    adsterraContainerId: process.env.NEXT_PUBLIC_ADSTERRA_CONTAINER_ID || null,
    ga4MeasurementId: process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID || null,
  }
}
