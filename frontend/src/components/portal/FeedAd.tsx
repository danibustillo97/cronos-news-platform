'use client'

// Publicidad nativa del feed (HOME_TOP / HOME_FEED), con el mismo marco que las tarjetas. AdSlot reserva su alto aunque
// no haya creativo (sin banner propio ni consentimiento de AdSense); en el
// feed eso dejaba una caja vacía. Si a los pocos segundos el slot sigue
// sin contenido, la tarjeta se retira de la grilla.

import { useEffect, useRef, useState } from 'react'
import AdSlot from '@/components/ads/AdSlot'

const SETTLE_MS = 3_500

export default function FeedAd({ position = 'HOME_FEED' }: { position?: 'HOME_TOP' | 'HOME_FEED' }) {
  const ref = useRef<HTMLDivElement>(null)
  const [empty, setEmpty] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const slot = () => el.querySelector('[data-ad-position]')
    const hasCreative = () => Boolean(slot()?.querySelector('img, iframe, ins, a'))
    const timer = window.setTimeout(() => setEmpty(!hasCreative()), SETTLE_MS)
    const mo = new MutationObserver(() => { if (hasCreative()) setEmpty(false) })
    mo.observe(el, { childList: true, subtree: true })
    return () => { window.clearTimeout(timer); mo.disconnect() }
  }, [])

  return (
    <aside ref={ref} aria-label="Publicidad" hidden={empty} className="overflow-hidden rounded-[20px] border border-[var(--nx-line)] bg-[var(--nx-surface)]">
      <div className="flex h-12 items-center px-4">
        <span className="inline-flex h-6 items-center rounded-full bg-[var(--nx-surface-2)] px-2.5 text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--nx-muted)]">Publicidad</span>
      </div>
      <AdSlot position={position} className="flex items-center justify-center px-4 pb-4" />
    </aside>
  )
}
