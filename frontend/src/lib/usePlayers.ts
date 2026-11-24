'use client'

// Búsqueda (con debounce) y perfil de jugadores. Sin endpoint -> estado
// "no disponible" en vez de errores.

import { useEffect, useState } from 'react'
import { normalizeProfile, normalizeSearch, type PlayerHit, type PlayerProfile } from '@/lib/players'

export type LoadStatus = 'idle' | 'loading' | 'ready' | 'unavailable' | 'notfound'

export function usePlayerSearch(query: string, delayMs = 250) {
  const [results, setResults] = useState<PlayerHit[]>([])
  const [status, setStatus] = useState<LoadStatus>('idle')
  const q = query.trim()

  useEffect(() => {
    if (q.length < 2) { setResults([]); setStatus('idle'); return }
    const controller = new AbortController()
    setStatus('loading')
    const timer = window.setTimeout(() => {
      fetch(`/api/players/search?q=${encodeURIComponent(q)}`, { signal: controller.signal })
        .then(async (res) => {
          if (!res.ok) { setResults([]); setStatus(res.status === 404 || res.status >= 500 ? 'unavailable' : 'ready'); return }
          setResults(normalizeSearch(await res.json()))
          setStatus('ready')
        })
        .catch((e: unknown) => { if ((e as Error)?.name !== 'AbortError') { setResults([]); setStatus('unavailable') } })
    }, delayMs)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [q, delayMs])

  return { results, status }
}

const profileCache = new Map<string, Promise<PlayerProfile | null | 'unavailable'>>()

function fetchProfile(id: string): Promise<PlayerProfile | null | 'unavailable'> {
  const hit = profileCache.get(id)
  if (hit) return hit
  const p = fetch(`/api/players/${encodeURIComponent(id)}`)
    .then(async (res) => {
      if (res.status === 404) {
        const body = await res.json().catch(() => null) as { detail?: string } | null
        // FastAPI sin la ruta responde {"detail":"Not Found"}; un jugador inexistente debería traer otro detalle.
        return body?.detail === 'Not Found' ? 'unavailable' as const : null
      }
      if (!res.ok) return 'unavailable' as const
      return normalizeProfile(await res.json())
    })
    .catch(() => 'unavailable' as const)
  p.then((v) => { if (v === 'unavailable') profileCache.delete(id) })
  profileCache.set(id, p)
  return p
}

export function usePlayerProfile(id: string | null) {
  const [state, setState] = useState<{ id: string | null; profile: PlayerProfile | null; status: LoadStatus }>({ id: null, profile: null, status: 'idle' })
  useEffect(() => {
    if (!id) { setState({ id: null, profile: null, status: 'idle' }); return }
    let cancelled = false
    setState({ id, profile: null, status: 'loading' })
    fetchProfile(id).then((v) => {
      if (cancelled) return
      if (v === 'unavailable') setState({ id, profile: null, status: 'unavailable' })
      else if (!v) setState({ id, profile: null, status: 'notfound' })
      else setState({ id, profile: v, status: 'ready' })
    })
    return () => { cancelled = true }
  }, [id])
  return state
}
