'use client'

// Abstracción de posiciones de publicidad -- el resto del portal pide un
// AdSlot por POSICIÓN semántica ("dónde"), nunca un slotId/creativo
// directamente. Two real providers exist now, tried in order:
//   1. A house banner (admin-uploaded, real business/sponsor, managed at
//      /admin -> Publicidad, persisted in `ad_banners`) -- shown if one
//      is active for this position.
//   2. Google AdSense (via AdSpace) -- the fallback when no house banner
//      is configured for the slot.
// Adding a third provider, or changing the split, is a change to ONLY
// this file -- no call site (<AdSlot position="...">) ever changes.
//
// Reserva de espacio (minHeight) explícita por posición para no mover el
// layout cuando el anuncio carga (CLS) -- nunca "lo que sea que entre".

import { useEffect, useState } from 'react'
import { apiUrl } from '@/studio/lab/api-client'
import AdSpace from './AdSpace'

// The 5 positions that actually appear on a real page -- grep this repo
// for `AdSlot position=` before adding one back (see ModernNewsPortal.tsx
// and ArticleContent.tsx for where each one really renders).
export type AdPosition =
  | 'HOME_TOP' | 'HOME_FEED'
  | 'ARTICLE_TOP' | 'ARTICLE_END'
  | 'SIDEBAR_DESKTOP'

// Un único ad unit real de AdSense existe hoy (mismo en todo el portal
// actual) -- el mapa ya está listo para asignar unidades distintas por
// posición el día que existan en la cuenta de AdSense, sin tocar quien
// llama a <AdSlot position="...">.
const SLOT_ID_BY_POSITION: Record<AdPosition, string> = {
  HOME_TOP: '8962635274',
  HOME_FEED: '8962635274',
  ARTICLE_TOP: '8962635274',
  ARTICLE_END: '8962635274',
  SIDEBAR_DESKTOP: '8962635274',
}

// minHeight reservado por posición -- formatos distintos reservan distinto
// espacio (un sidebar vertical no es del mismo alto que un banner nativo
// en el feed). Matches backend/app/domain/ads/entities.py POSITION_SIZES
// exactly -- that map is the real source of truth for width too (an
// uploaded banner is rejected there if it doesn't match).
const MIN_HEIGHT_BY_POSITION: Record<AdPosition, number> = {
  HOME_TOP: 90, HOME_FEED: 250,
  ARTICLE_TOP: 90, ARTICLE_END: 250,
  SIDEBAR_DESKTOP: 600,
}

interface HouseBanner {
  id: string
  imageUrl: string
  linkUrl: string
  altText: string
  width: number
  height: number
}

function useHouseBanner(position: AdPosition): { banner: HouseBanner | null; loading: boolean } {
  const [banner, setBanner] = useState<HouseBanner | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(apiUrl(`/api/ads?position=${position}`))
      .then((res) => (res.ok ? res.json() : []))
      .then((rows: HouseBanner[]) => {
        if (cancelled) return
        // A pick, not a merge -- exactly one creative fills the slot at a
        // time. Random rotation across reloads when more than one sponsor
        // is active for the same position.
        setBanner(rows.length > 0 ? rows[Math.floor(Math.random() * rows.length)] : null)
      })
      .catch(() => { if (!cancelled) setBanner(null) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [position])

  return { banner, loading }
}

export default function AdSlot({ position, className = '' }: { position: AdPosition; className?: string }) {
  const { banner, loading } = useHouseBanner(position)

  return (
    <div style={{ minHeight: MIN_HEIGHT_BY_POSITION[position] }} className={className} data-ad-position={position}>
      {banner ? (
        <a
          href={banner.linkUrl}
          target="_blank"
          rel="noopener noreferrer sponsored"
          className="block w-full"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- an
              external sponsor creative, not a next/image-optimizable
              site asset */}
          <img
            src={banner.imageUrl}
            alt={banner.altText || 'Publicidad'}
            width={banner.width}
            height={banner.height}
            className="mx-auto w-full h-auto max-w-full"
            style={{ maxWidth: banner.width }}
          />
        </a>
      ) : loading ? null : (
        <AdSpace slotId={SLOT_ID_BY_POSITION[position]} />
      )}
    </div>
  )
}
