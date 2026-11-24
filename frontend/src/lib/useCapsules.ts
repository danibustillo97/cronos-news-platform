'use client'

// Cápsulas del backend. 404/503 (migración pendiente) -> [] y no se muestran.

import { useEffect, useState } from 'react'
import { normalizeCapsules, sortCapsules, type Capsule } from '@/lib/capsules'

export function useCapsules(query = 'limit=12') {
  const [capsules, setCapsules] = useState<Capsule[]>([])
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    let cancelled = false
    fetch(`/api/capsules/feed?${query}`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : { capsules: [] }))
      .then((data: unknown) => { if (!cancelled) setCapsules(sortCapsules(normalizeCapsules(data), new Date())) })
      .catch(() => { if (!cancelled) setCapsules([]) })
      .finally(() => { if (!cancelled) setLoaded(true) })
    return () => { cancelled = true }
  }, [query])
  return { capsules, loaded }
}
