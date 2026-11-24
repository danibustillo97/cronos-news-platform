'use client'

// Parley del día (cuotas reales). Caché en memoria compartida por la
// tarjeta del feed y la página /parleys; sin datos -> null y no se muestra.

import { useEffect, useState } from 'react'
import { normalizePicks, type PicksData } from '@/lib/picks'

let cache: { at: number; promise: Promise<PicksData | null> } | null = null
const TTL = 5 * 60_000

function fetchPicks(): Promise<PicksData | null> {
  if (cache && Date.now() - cache.at < TTL) return cache.promise
  const promise = fetch('/api/picks?hours=48')
    .then((r) => (r.ok ? r.json() : null))
    .then((d: unknown) => (d ? normalizePicks(d) : null))
    .catch(() => null)
  cache = { at: Date.now(), promise }
  promise.then((v) => { if (!v) cache = null })
  return promise
}

export function usePicks() {
  const [data, setData] = useState<PicksData | null>(null)
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    let cancelled = false
    fetchPicks().then((d) => { if (!cancelled) { setData(d); setLoaded(true) } })
    return () => { cancelled = true }
  }, [])
  return { data, loaded }
}
