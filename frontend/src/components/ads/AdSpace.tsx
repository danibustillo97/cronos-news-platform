'use client'

import { useEffect, useRef } from 'react'
import { useConsent } from './ConsentProvider'
import { getAdProviderConfig } from '@/lib/adConfig'

interface AdSpaceProps {
  slotId: string
  className?: string
  label?: string
}

export default function AdSpace({
  slotId,
  className = '',
  label = 'Publicidad',
}: AdSpaceProps) {
  const loaded = useRef(false)
  const { choice } = useConsent()
  const config = getAdProviderConfig()

  useEffect(() => {
    if (loaded.current || choice !== 'accepted') return
    if (!config.adsenseEnabled || !config.adsensePublisherId) return

    try {
      // @ts-ignore
      if (window.adsbygoogle && Array.isArray(window.adsbygoogle)) {
        // @ts-ignore
        window.adsbygoogle.push({})
        loaded.current = true
      }
    } catch (err) {
      console.error('AdSense error:', err)
    }
  }, [choice, config.adsenseEnabled, config.adsensePublisherId])

  return (
    <div className={`w-full my-6 ${className}`}>
      {label && (
        <span className="block text-center text-[10px] text-neutral-500 uppercase tracking-widest mb-2">
          {label}
        </span>
      )}

      <div className="w-full flex justify-center overflow-hidden">
        <ins
          className="adsbygoogle"
          style={{
            display: 'block',
            width: '100%',
            minHeight: 90,
            maxHeight: 280,
          }}
          data-ad-client={config.adsensePublisherId || undefined}
          data-ad-slot={slotId}
          data-ad-format="rectangle"
          data-full-width-responsive="false"
        />
      </div>
    </div>
  )
}
