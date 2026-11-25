'use client'

// Espacio publicitario con nombre (admin "Anuncios"). Muestra la campaña
// del dispositivo actual a su medida exacta, con "Publicidad" y enlace
// rel="sponsored noopener". Sin campaña no reserva espacio (nunca marcos
// vacíos). Impresión: una vez por campaña y vista, ≥50 % visible durante 1 s;
// clics con sendBeacon. En ?preview=1&ads=outline dibuja el contorno con la
// medida ("feed-1 · 300×250"), "apagado" si está desactivada, y responde a
// { type: "nexus:ads-highlight", placement } desplazándose y resaltando.
// Si el backend aún no tiene ubicaciones, usa la publicidad anterior.

import { useEffect, useRef, useState } from 'react'
import { creativeImage, shouldRender, shouldTrackImpression, sizeLabel, type AdPlacement } from '@/lib/adSlots'
import { useAdSlots } from '@/lib/useAdSlots'
import FeedAd from './FeedAd'
import type { AdPosition } from '@/components/ads/AdSlot'

const HIGHLIGHT = 'nexus:ads-highlight'
const seen = new Set<string>()

function track(campaignId: string, type: 'impression' | 'click') {
  const url = `/api/ads/campaigns/${encodeURIComponent(campaignId)}/event`
  const body = JSON.stringify({ type })
  try {
    if (navigator.sendBeacon && navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }))) return
  } catch { /* sigue con fetch */ }
  void fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {})
}

export default function PlacementAd({ placement, legacy, className = '' }: { placement: AdPlacement; legacy?: AdPosition; className?: string }) {
  const { slots, device, outline } = useAdSlots()
  const ref = useRef<HTMLDivElement>(null)
  const [pulse, setPulse] = useState(false)
  const slot = slots?.find((s) => s.placement === placement)
  const size = slot && device ? slot.sizes[device] : null
  const img = slot?.creative && device ? creativeImage(slot.creative, device) : null
  const campaignId = slot?.creative?.campaignId ?? null
  const visible = Boolean(device) && shouldRender(slot, outline, device ?? 'mobile')

  // Vista previa del admin: resaltar al seleccionar la ubicación.
  useEffect(() => {
    if (!outline) return
    const on = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return
      const d = e.data as { type?: string; placement?: string } | null
      if (d?.type !== HIGHLIGHT || d.placement !== placement) return
      ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setPulse(true)
      window.setTimeout(() => setPulse(false), 2400)
    }
    window.addEventListener('message', on)
    return () => window.removeEventListener('message', on)
  }, [outline, placement])

  // Impresión: ≥50 % visible durante 1 s, una vez por campaña.
  useEffect(() => {
    const el = ref.current
    if (!el || outline || !campaignId || !img) return
    let timer: number | null = null
    const io = new IntersectionObserver(([e]) => {
      if (e.intersectionRatio >= 0.5) {
        if (timer === null) timer = window.setTimeout(() => { if (shouldTrackImpression(seen, campaignId, false)) track(campaignId, 'impression'); io.disconnect() }, 1000)
      } else if (timer !== null) { window.clearTimeout(timer); timer = null }
    }, { threshold: [0, 0.5, 1] })
    io.observe(el)
    return () => { io.disconnect(); if (timer !== null) window.clearTimeout(timer) }
  }, [outline, campaignId, img])

  if (slots === undefined || !device) return null
  // Backend sin ubicaciones: publicidad anterior (banner propio o AdSense) para no perder inventario.
  if (slots === null) return legacy ? <div className={className}><FeedAd position={legacy} /></div> : null
  if (!visible || !slot || !size) return null
  const [w, h] = size

  if (outline) {
    const off = !slot.enabled
    return (
      <div ref={ref} data-ad-placement={placement} className={`mx-auto ${className}`} style={{ maxWidth: w }}>
        <div
          className={`relative flex w-full items-center justify-center overflow-hidden rounded-lg text-center transition-shadow ${off ? 'border-2 border-dashed border-[var(--nx-muted)]' : 'border-2 border-[#38BDF8]'} ${pulse ? 'shadow-[0_0_0_4px_rgba(250,204,21,0.9)] animate-pulse' : ''}`}
          style={{ aspectRatio: `${w} / ${h}` }}
        >
          {img && !off && (
            // eslint-disable-next-line @next/next/no-img-element -- creativo externo a su medida exacta
            <img src={img} alt="" className="absolute inset-0 h-full w-full object-cover opacity-60" />
          )}
          <span className="relative rounded bg-black/70 px-2 py-1 text-[11px] font-bold text-white">{sizeLabel(slot, device)}{off ? ' · apagado' : ''}</span>
        </div>
      </div>
    )
  }

  const creative = slot.creative!
  return (
    <aside ref={ref} aria-label="Publicidad" data-ad-placement={placement} className={`mx-auto w-full ${className}`} style={{ maxWidth: w }}>
      <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--nx-muted)]">Publicidad{creative.advertiser ? ` · ${creative.advertiser}` : ''}</p>
      <a
        href={creative.href ?? undefined}
        target="_blank"
        rel="sponsored noopener"
        onClick={() => { if (campaignId) track(campaignId, 'click') }}
        className="block overflow-hidden rounded-lg"
        style={{ aspectRatio: `${w} / ${h}` }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- creativo externo a su medida exacta */}
        <img src={img!} alt={creative.alt} width={w} height={h} loading="lazy" decoding="async" className="h-full w-full object-cover" />
      </a>
    </aside>
  )
}
