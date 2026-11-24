'use client'

// Momentos de partido (goles, rojas, finales) para el feed. Se refresca
// cada 30 s; marca los nuevos para resaltarlos. Sin backend -> [].

import { useEffect, useRef, useState } from 'react'
import { momentItems, newMomentIds, normalizeMoments, type MomentItem } from '@/lib/moments'

const POLL_MS = 30_000

export function useMoments() {
  const [items, setItems] = useState<MomentItem[]>([])
  const [fresh, setFresh] = useState<Set<string>>(() => new Set())
  const seen = useRef<Set<string> | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (document.visibilityState !== 'visible' && seen.current) return
      try {
        const res = await fetch('/api/matches/moments', { cache: 'no-store' })
        if (!res.ok) return
        const list = normalizeMoments(await res.json())
        if (cancelled) return
        setFresh(newMomentIds(seen.current, list))
        seen.current = new Set(list.map((m) => m.id))
        setItems(momentItems(list))
      } catch { /* sin datos: no se muestran */ }
    }
    void load()
    const id = window.setInterval(load, POLL_MS)
    return () => { cancelled = true; window.clearInterval(id) }
  }, [])

  return { items, fresh }
}
