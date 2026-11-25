'use client'

// Publicidad nativa del feed (HOME_TOP / HOME_FEED), con el mismo marco que
// las tarjetas. Nunca muestra un marco vacío: arranca plegada (alto 0 pero
// con ancho, para que el proveedor pueda medir), se despliega solo cuando
// aparece un creativo real y, si a los 3,5 s no hay ninguno, se retira.

import { useEffect, useRef, useState } from 'react'
import AdSlot, { type AdPosition } from '@/components/ads/AdSlot'

const SETTLE_MS = 3_500
type State = 'pending' | 'shown' | 'empty'

export default function FeedAd({ position = 'HOME_FEED' }: { position?: AdPosition }) {
  const ref = useRef<HTMLElement>(null)
  const [state, setState] = useState<State>('pending')

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const hasCreative = () => Boolean(el.querySelector('[data-ad-position] img, [data-ad-position] iframe, [data-ad-position] ins[data-ad-status="filled"], [data-ad-position] a'))
    if (hasCreative()) { setState('shown'); return }
    const mo = new MutationObserver(() => { if (hasCreative()) setState('shown') })
    mo.observe(el, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-ad-status'] })
    const timer = window.setTimeout(() => setState((s) => (s === 'shown' ? s : 'empty')), SETTLE_MS)
    return () => { window.clearTimeout(timer); mo.disconnect() }
  }, [])

  return (
    <aside
      ref={ref}
      aria-label="Publicidad"
      hidden={state === 'empty'}
      data-ad-state={state}
      className={`overflow-hidden rounded-[20px] bg-[var(--nx-surface)] ${state === 'shown' ? 'border border-[var(--nx-line)]' : 'invisible h-0 border-0'}`}
    >
      <div className="flex h-12 items-center px-4">
        <span className="inline-flex h-6 items-center rounded-full bg-[var(--nx-surface-2)] px-2.5 text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--nx-muted)]">Publicidad</span>
      </div>
      <AdSlot position={position} className="flex items-center justify-center px-4 pb-4" />
    </aside>
  )
}
