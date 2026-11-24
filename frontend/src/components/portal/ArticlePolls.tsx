'use client'

// Encuestas/debates ligados a una nota (newsId === id de la nota y
// placement "article"). El artículo es siempre claro, así que se monta con
// los tokens del tema claro. Sin endpoint o sin encuestas: no renderiza nada.

import { useMemo } from 'react'
import { usePolls } from '@/lib/usePolls'
import { inPlacement, sortPolls } from '@/lib/polls'
import { PollBlock } from './PollCard'

export default function ArticlePolls({ newsId }: { newsId: string }) {
  const { polls } = usePolls(`placement=article&newsId=${encodeURIComponent(newsId)}`)
  const mine = useMemo(
    () => sortPolls(polls.filter((p) => p.newsId === newsId && inPlacement(p, 'article')), new Date()),
    [polls, newsId],
  )
  if (mine.length === 0) return null
  return (
    <section aria-label="Tu opinión" className="nx-portal my-10 rounded-2xl" data-theme="light" style={{ background: 'transparent' }}>
      <div className="flex flex-col gap-4">
        {mine.map((poll) => <PollBlock key={poll.id} poll={poll} />)}
      </div>
    </section>
  )
}
