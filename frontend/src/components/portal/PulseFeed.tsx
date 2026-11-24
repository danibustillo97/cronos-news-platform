'use client'

// "Pulso" -- el feed del home. Grilla de bloques de tamaños mixtos
// (grid-auto-flow: dense, sin huecos), compuesta por lib/feedComposer.ts.
// Scroll con sensación infinita: va revelando bloques y, al agotarse,
// pide la siguiente página real de Supabase. Tras unas cargas automáticas
// pasa a un botón para que el footer siempre sea alcanzable.

import { useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, X } from 'lucide-react'
import { composeFeed, type FeedBlock } from '@/lib/feedComposer'
import FeedAd from './FeedAd'
import type { NewsView } from '@/types/news'
import type { Match } from '@/types/sports'
import { MatchCard } from './MatchCard'
import { BriefCard, PlayersToolCard, QuoteCard, StandingsSnippet, StatCard, StoryCard, TrendingCard, VideoCard } from './FeedCards'
import { PollBlock } from './PollCard'
import type { Poll } from '@/lib/polls'
import { Reveal, SectionHeading, Skeleton } from './PortalBits'
import { useNow } from './useNow'

const NO_POLLS: Poll[] = []
const FIRST_BATCH = 14
const NEXT_BATCH = 9
const MAX_AUTO_LOADS = 3

function spanFor(block: FeedBlock<NewsView>): string {
  if (block.type === 'story' && block.size === 'lead') return 'sm:col-span-2 sm:row-span-2'
  if (block.type === 'story' && block.size === 'wide') return 'sm:col-span-2'
  if (block.type === 'quote') return 'sm:col-span-2 lg:col-span-1'
  if (block.type === 'poll') return ''
  return ''
}

export default function PulseFeed({
  stories, sources, matches, polls = NO_POLLS, dark, onOpen, hasMore, loadingMore, onLoadMore,
}: {
  polls?: Poll[]
  stories: NewsView[]
  sources: NewsView[]
  matches: Match[]
  dark: boolean
  onOpen: (s: NewsView) => void
  hasMore: boolean
  loadingMore: boolean
  onLoadMore: () => void
}) {
  const now = useNow(60_000)
  const [topic, setTopic] = useState<string | null>(null)
  const [visible, setVisible] = useState(FIRST_BATCH)
  const [autoLoads, setAutoLoads] = useState(0)
  const sentinel = useRef<HTMLDivElement>(null)
  const headingRef = useRef<HTMLDivElement>(null)

  // Marcador congelado por minuto: el feed no se reordena en cada poll.
  const minute = Math.floor(now.getTime() / 60_000)
  const blocks = useMemo(() => {
    if (topic) {
      const key = topic.toLowerCase()
      const matching = sources.filter((s) => (s.tags ?? []).some((t) => t.toLowerCase() === key))
      return matching.map((story, i): FeedBlock<NewsView> => ({ type: 'story', key: `topic-${story.id}`, story, size: i === 0 ? 'wide' : 'standard' }))
    }
    return composeFeed({
      stories, sources, matches, now: new Date(minute * 60_000),
      standingsLeague: 'col.1', secondaryLeague: 'eng.1', polls, playersTool: true,
    })
  }, [topic, stories, sources, matches, polls, minute])

  const shown = blocks.slice(0, visible)
  const exhausted = visible >= blocks.length
  const canAuto = autoLoads < MAX_AUTO_LOADS

  useEffect(() => {
    const el = sentinel.current
    if (!el) return
    const io = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      if (!exhausted) setVisible((v) => v + NEXT_BATCH)
      else if (hasMore && !loadingMore && canAuto && !topic) { setAutoLoads((n) => n + 1); onLoadMore() }
    }, { rootMargin: '600px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [visible, exhausted, hasMore, loadingMore, canAuto, onLoadMore, topic])

  const selectTopic = (tag: string | null) => {
    setTopic(tag)
    setVisible(FIRST_BATCH)
    headingRef.current?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  }

  const render = (block: FeedBlock<NewsView>) => {
    switch (block.type) {
      case 'story': return <StoryCard story={block.story} size={block.size} now={now} onOpen={onOpen} />
      case 'brief': return <BriefCard story={block.story} points={block.points} onOpen={onOpen} />
      case 'quote': return <QuoteCard story={block.story} quote={block.quote} onOpen={onOpen} />
      case 'match': return <MatchCard match={block.match} dark={dark} />
      case 'stat': return <StatCard stats={block.stats} />
      case 'trending': return <TrendingCard topics={block.topics} active={topic} onSelect={selectTopic} />
      case 'video': return <VideoCard story={block.story} embedUrl={block.embedUrl} onOpen={onOpen} />
      case 'poll': {
        const poll = polls.find((p) => p.id === block.pollId)
        return poll ? <PollBlock poll={poll} compact /> : null
      }
      case 'players': return <PlayersToolCard />
      case 'ad': return <FeedAd />
      default: return null
    }
  }

  return (
    <div>
      <div ref={headingRef} className="nx-section">
        <SectionHeading
          id="feed-heading"
          kicker="Lo último, a tu ritmo"
          title="Pulso"
          action={topic ? (
            <button type="button" onClick={() => selectTopic(null)} className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-[#FACC15] px-4 text-xs font-black text-black">
              {topic} <X size={14} aria-label="Quitar filtro" />
            </button>
          ) : null}
        />
      </div>

      {topic && blocks.length === 0 && (
        <p className="text-sm text-[var(--nx-muted)]">No hay más historias sobre {topic} por ahora.</p>
      )}

      {blocks.length === 0 && !topic ? (
        <div className="rounded-2xl border border-dashed border-[var(--nx-line-strong)] px-6 py-16 text-center">
          <p className="text-base font-bold text-[var(--nx-ink)]">El Pulso se está armando.</p>
          <p className="mt-1 text-sm text-[var(--nx-muted)]">Apenas haya nuevas historias o partidos, aparecen aquí.</p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 [grid-auto-flow:dense] sm:grid-cols-2 lg:grid-cols-3" aria-labelledby="feed-heading">
          {shown.map((block, index) => {
            const span = spanFor(block)
            if (block.type === 'standings') return <StandingsSnippet key={block.key} league={block.league} dark={dark} className={span} />
            return (
              <li key={block.key} className={`${span} ${block.type === 'ad' ? 'has-[aside[hidden]]:hidden' : ''}`}>
                <Reveal className="h-full" delay={Math.min(index % NEXT_BATCH, 4) * 0.04}>{render(block)}</Reveal>
              </li>
            )
          })}
          {loadingMore && Array.from({ length: 3 }).map((_, i) => (
            <li key={`sk-${i}`}><Skeleton className="h-[320px]" /></li>
          ))}
        </ul>
      )}

      <div ref={sentinel} aria-hidden="true" className="h-px" />

      <div className="mt-8 flex justify-center">
        {exhausted && hasMore && !canAuto && !topic ? (
          <button type="button" onClick={() => { setAutoLoads(0); onLoadMore() }} disabled={loadingMore} className="inline-flex min-h-[48px] items-center gap-2 rounded-full bg-[var(--nx-ink)] px-6 text-sm font-black text-[var(--nx-bg)] disabled:opacity-60">
            {loadingMore && <Loader2 size={16} className="animate-spin" aria-hidden="true" />} Cargar más historias
          </button>
        ) : exhausted && !hasMore && blocks.length > 0 ? (
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--nx-muted)]">Estás al día</p>
        ) : null}
      </div>
    </div>
  )
}
