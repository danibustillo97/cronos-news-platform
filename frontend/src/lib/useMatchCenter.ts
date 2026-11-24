'use client'

// Datos del centro de partido. Se refresca cada 15 s mientras el partido
// está en vivo; detecta goles entre lecturas (para el "¡GOOOL!").

import { useEffect, useRef, useState } from 'react'
import { detectGoal, normalizeInsights, normalizeMatchDetail, type MatchDetail, type PlayerInsights, type Side } from '@/lib/matchCenter'

const LIVE_POLL_MS = 15_000

export function useMatchDetail(league: string | null, eventId: string | null, active: boolean, pollMs = LIVE_POLL_MS) {
  const [detail, setDetail] = useState<MatchDetail | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [goal, setGoal] = useState<{ side: Side; at: number } | null>(null)
  const prev = useRef<MatchDetail | null>(null)

  useEffect(() => {
    prev.current = null
    setDetail(null)
    setGoal(null)
    if (!active || !league || !eventId) { setStatus('idle'); return }
    let cancelled = false
    let timer: number | null = null
    const load = async () => {
      try {
        const res = await fetch(`/api/matches/${encodeURIComponent(league)}/${encodeURIComponent(eventId)}`, { cache: 'no-store' })
        const d = res.ok ? normalizeMatchDetail(await res.json()) : null
        if (cancelled) return
        if (!d) { setStatus((s) => (s === 'ready' ? s : 'error')); return }
        const side = detectGoal(prev.current, d)
        if (side) setGoal({ side, at: Date.now() })
        prev.current = d
        setDetail(d)
        setStatus('ready')
        if (d.state === 'in') timer = window.setTimeout(load, pollMs)
      } catch {
        if (!cancelled) setStatus((s) => (s === 'ready' ? s : 'error'))
      }
    }
    setStatus('loading')
    void load()
    return () => { cancelled = true; if (timer) window.clearTimeout(timer) }
  }, [league, eventId, active, pollMs])

  return { detail, status, goal }
}

const insightsCache = new Map<string, Promise<PlayerInsights | null>>()

export function usePlayerInsights(athleteId: string | null) {
  const [data, setData] = useState<PlayerInsights | null>(null)
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    if (!athleteId) return
    let cancelled = false
    let p = insightsCache.get(athleteId)
    if (!p) {
      p = fetch(`/api/matches/insights/player/${encodeURIComponent(athleteId)}`)
        .then((r) => (r.ok ? r.json() : null)).then((d: unknown) => (d ? normalizeInsights(d) : null)).catch(() => null)
      insightsCache.set(athleteId, p)
      p.then((v) => { if (!v) insightsCache.delete(athleteId) })
    }
    p.then((v) => { if (!cancelled) { setData(v); setLoaded(true) } })
    return () => { cancelled = true }
  }, [athleteId])
  return { data, loaded }
}
