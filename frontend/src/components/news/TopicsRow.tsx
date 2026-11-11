'use client'

// "Temas del día" -- frecuencia real de tags entre lo publicado ahora
// mismo, nunca una lista de tendencias inventada. Pills discretos, no
// cards.

import { useMemo } from 'react'
import type { NewsView } from '@/types/news'

export default function TopicsRow({ news, isDark }: { news: NewsView[]; isDark: boolean }) {
  const topics = useMemo(() => {
    const counts = new Map<string, number>()
    for (const item of news) {
      for (const tag of item.tags ?? []) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1)
      }
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([tag]) => tag)
  }, [news])

  if (topics.length === 0) return null

  return (
    <section className="flex items-center gap-3 flex-wrap py-1">
      <span className={`text-xs font-bold uppercase tracking-[0.12em] flex-shrink-0 ${isDark ? 'text-white' : 'text-[#161616]'}`}>
        Temas del día
      </span>
      {topics.map((topic) => (
        <span
          key={topic}
          className={`px-2.5 py-1 text-xs border ${isDark ? 'border-white/10 text-neutral-300' : 'border-[#E5E5E5] text-[#666]'}`}
        >
          {topic}
        </span>
      ))}
    </section>
  )
}
