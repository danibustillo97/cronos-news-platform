'use client'

import { useEffect, useRef } from 'react'
import { getAdProviderConfig } from '@/lib/adConfig'
import { useConsent } from './ConsentProvider'

export default function AdvertisingScripts() {
  const { choice } = useConsent()
  const loaded = useRef(false)

  useEffect(() => {
    if (choice !== 'accepted' || loaded.current) return
    const config = getAdProviderConfig()
    if (config.adsenseEnabled && config.adsensePublisherId) {
      if (!document.querySelector('script[data-cronos-adsense]')) {
        const script = document.createElement('script')
        script.async = true
        script.crossOrigin = 'anonymous'
        script.dataset.cronosAdsense = 'true'
        script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(config.adsensePublisherId)}`
        document.head.appendChild(script)
      }
    }
    if (config.ga4MeasurementId) {
      if (!document.querySelector('script[data-cronos-ga4]')) {
        const gtScript = document.createElement('script')
        gtScript.async = true
        gtScript.dataset.cronosGa4 = 'true'
        gtScript.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(config.ga4MeasurementId)}`
        document.head.appendChild(gtScript)

        const inline = document.createElement('script')
        inline.dataset.cronosGa4 = 'true'
        inline.text = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${config.ga4MeasurementId.replace(/'/g, '')}')`
        document.head.appendChild(inline)
      }
    }
    loaded.current = true
  }, [choice])

  return null
}
