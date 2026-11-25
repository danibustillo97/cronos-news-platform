'use client'

// Antesalas e impactos (GET /api/insights/feed). El servidor cachea 10 min;
// aquí se vuelve a pedir cada 5 min. Sin datos -> [].

import { useEffect, useState } from 'react'
import { normalizeFeedInsights, type Insight } from '@/lib/insightsFeed'

const POLL_MS = 5 * 60_000

export function useInsightsFeed() {
  const [insights, setInsights] = useState<Insight[]>([])
  useEffect(() => {
    let cancelled = false
    const load = () => fetch('/api/insights/feed')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: unknown) => { if (!cancelled && d) setInsights(normalizeFeedInsights(d)) })
      .catch(() => { /* sin datos */ })
    void load()
    const id = window.setInterval(() => { if (document.visibilityState === 'visible') void load() }, POLL_MS)
    return () => { cancelled = true; window.clearInterval(id) }
  }, [])
  return insights
}
