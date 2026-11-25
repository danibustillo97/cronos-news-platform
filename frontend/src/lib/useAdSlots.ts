'use client'

// Ubicaciones publicitarias (GET /api/ads/slots), compartidas por todos los
// espacios de la página (una sola petición), más el dispositivo actual y
// el modo de vista previa del admin (?preview=1&ads=outline).

import { useEffect, useState } from 'react'
import { deviceFor, normalizeAdSlots, type AdSlotDef, type Device } from '@/lib/adSlots'

let cache: Promise<AdSlotDef[] | null> | null = null

function fetchSlots(): Promise<AdSlotDef[] | null> {
  if (!cache) {
    cache = fetch('/api/ads/slots')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: unknown) => (d ? normalizeAdSlots(d) : null))
      .catch(() => null)
  }
  return cache
}

export function useAdSlots() {
  // null = el backend no tiene ubicaciones (se usa la publicidad anterior).
  const [slots, setSlots] = useState<AdSlotDef[] | null | undefined>(undefined)
  const [device, setDevice] = useState<Device | null>(null)
  const [outline, setOutline] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchSlots().then((s) => { if (!cancelled) setSlots(s) })
    const q = new URLSearchParams(window.location.search)
    setOutline(q.get('preview') === '1' && q.get('ads') === 'outline')
    const update = () => setDevice(deviceFor(window.innerWidth))
    update()
    window.addEventListener('resize', update)
    return () => { cancelled = true; window.removeEventListener('resize', update) }
  }, [])

  return { slots, device, outline }
}
