'use client'

// Historias publicadas para el home -- mismo camino de siempre (Supabase
// en el navegador, tabla `news`, status='published', por recencia), con
// paginación real para el feed infinito, refresco periódico de lo nuevo
// (para el riel "Ahora") y carga aparte de las fijadas que no estén en la
// primera página.

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { missingPinned } from '@/lib/portalLayout'
import type { PortalLayout } from '@/types/portal'
import type { NewsView } from '@/types/news'

const PAGE_SIZE = 24
const REFRESH_MS = 90_000

function baseQuery() {
  return supabase.from('news').select('*').eq('status', 'published').order('published_at', { ascending: false })
}

function mergeById(current: NewsView[], incoming: NewsView[]): NewsView[] {
  const byId = new Map(current.map((n) => [n.id, n]))
  for (const item of incoming) byId.set(item.id, { ...byId.get(item.id), ...item })
  return [...byId.values()]
}

export function usePortalNews(layout: PortalLayout) {
  const [items, setItems] = useState<NewsView[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [failed, setFailed] = useState(false)
  const offset = useRef(0)
  const requestedPinned = useRef(new Set<string>())
  const busy = useRef(false)

  useEffect(() => {
    let cancelled = false
    baseQuery().range(0, PAGE_SIZE - 1).then(({ data, error }) => {
      if (cancelled) return
      if (error) { console.error('[portal] news', error); setFailed(true); setLoading(false); setHasMore(false); return }
      const rows = (data ?? []) as NewsView[]
      offset.current = rows.length
      setHasMore(rows.length === PAGE_SIZE)
      setItems((prev) => mergeById(prev, rows))
      setLoading(false)
    })

    const id = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return
      baseQuery().range(0, 9).then(({ data, error }) => {
        if (!cancelled && !error && data) setItems((prev) => mergeById(prev, data as NewsView[]))
      })
    }, REFRESH_MS)
    return () => { cancelled = true; window.clearInterval(id) }
  }, [])

  useEffect(() => {
    if (loading) return
    const missing = missingPinned(items, layout).filter((id) => !requestedPinned.current.has(id))
    if (missing.length === 0) return
    missing.forEach((id) => requestedPinned.current.add(id))
    supabase.from('news').select('*').eq('status', 'published').in('id', missing).then(({ data, error }) => {
      if (!error && data && data.length > 0) setItems((prev) => mergeById(prev, data as NewsView[]))
    })
  }, [items, layout, loading])

  const loadMore = useCallback(() => {
    if (busy.current || !hasMore || loading) return
    busy.current = true
    setLoadingMore(true)
    const from = offset.current
    baseQuery().range(from, from + PAGE_SIZE - 1).then(({ data, error }) => {
      busy.current = false
      setLoadingMore(false)
      if (error) { setHasMore(false); return }
      const rows = (data ?? []) as NewsView[]
      offset.current = from + rows.length
      setHasMore(rows.length === PAGE_SIZE)
      setItems((prev) => mergeById(prev, rows))
    })
  }, [hasMore, loading])

  return { items, loading, loadingMore, hasMore, failed, loadMore }
}
