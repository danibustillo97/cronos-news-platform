'use client'

// Publicidad nativa del Pulso (HOME_FEED). AdSlot reserva su alto aunque
// no haya creativo (sin banner propio ni consentimiento de AdSense); en el
// feed eso dejaba una caja vacía. Si a los pocos segundos el slot sigue
// sin contenido, la tarjeta se retira de la grilla.

import { useEffect, useRef, useState } from 'react'
import AdSlot from '@/components/ads/AdSlot'

const SETTLE_MS = 3_500

export default function FeedAd() {
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
    <aside ref={ref} aria-label="Publicidad" hidden={empty} className="flex h-full flex-col rounded-2xl border border-dashed border-[var(--nx-line)] p-3">
      <span className="mb-2 text-center text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--nx-muted)]">Publicidad</span>
      <AdSlot position="HOME_FEED" className="flex flex-1 items-center justify-center" />
    </aside>
  )
}
