'use client'

// Feed "Reels": UNA sola columna centrada (ancho de teléfono en desktop)
// que mezcla noticias, "En 30 segundos", tablas, partidos, encuestas,
// datos automáticos y publicidad con la misma anatomía de tarjeta. El
// orden lo decide lib/reels.ts (determinista: el HTML del servidor ya
// trae las noticias con sus enlaces). En teléfono cada tarjeta encaja con
// scroll-snap; en desktop el snap es suave (proximity).

import { useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { composeReels, interleavePolls, autoFacts, TABLE_ROTATION } from '@/lib/reels'
import { useManyStandings } from '@/lib/useStandings'
import { LEAGUE_LABELS } from '@/lib/leagueLogos'
import type { Poll } from '@/lib/polls'
import type { NewsView } from '@/types/news'
import type { Match } from '@/types/sports'
import BriefReel from './BriefReel'
import { AdReel, FactReel, LiveMini, MatchReel, NewsReel, PollReel, TableReel, reelLi } from './ReelCards'
import { useNow } from './useNow'
import { CapsuleCard, PicksCard } from './FeedExtras'
import { useCapsules } from '@/lib/useCapsules'
import { usePicks } from '@/lib/usePicks'

const FACT_LEAGUES = ['col.1', 'eng.1', 'esp.1', 'ita.1', 'ger.1'] as const
const MAX_AUTO_LOADS = 4

export default function ReelsFeed({
  stories, stageStories, matches, polls, dark, onOpen, hasMore, loadingMore, onLoadMore,
}: {
  stories: NewsView[]
  stageStories: NewsView[]
  matches: Match[]
  polls: Poll[]
  dark: boolean
  onOpen: (s: NewsView) => void
  hasMore: boolean
  loadingMore: boolean
  onLoadMore: () => void
}) {
  const now = useNow(60_000)
  const items = useMemo(() => {
    const base = composeReels({
      stories,
      stageStories,
      leagues: TABLE_ROTATION,
      pollSlots: 0,
      factSlots: 6,
      matchSlots: 3,
      capsuleSlots: 3,
      picks: true,
    })
    return interleavePolls(base, polls.length)
  }, [stories, stageStories, polls])
  const { capsules } = useCapsules('limit=12')
  const { data: picks } = usePicks()

  const standings = useManyStandings(FACT_LEAGUES)
  const facts = useMemo(
    () => autoFacts(standings.map((s) => ({ league: s.league, label: LEAGUE_LABELS[s.league] ?? s.leagueName, table: s.table })), matches, now),
    [standings, matches, now],
  )

  const sentinel = useRef<HTMLDivElement>(null)
  const autoLoads = useRef(0)
  useEffect(() => {
    const el = sentinel.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && hasMore && !loadingMore && autoLoads.current < MAX_AUTO_LOADS) {
        autoLoads.current += 1
        onLoadMore()
      }
    }, { rootMargin: '1200px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [hasMore, loadingMore, onLoadMore])

  let newsSeen = 0

  return (
    <div className="grid w-full min-w-0 grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,640px)_minmax(0,1fr)]">
      <div className="hidden xl:block" aria-hidden="true" />
      <div className="mx-auto w-full min-w-0 max-w-[640px]">
        <div className="mb-4 px-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--nx-accent-text)]">Noticias, datos y tablas en un solo hilo</p>
          <h2 id="feed-heading" className="mt-1 text-2xl font-bold tracking-[-0.015em] text-[var(--nx-ink)]">Pulso</h2>
        </div>

        <ol className="nx-reels flex w-full min-w-0 flex-col gap-5" aria-labelledby="feed-heading">
          {items.map((item) => {
            switch (item.type) {
              case 'news':
                newsSeen += 1
                return <li key={item.key} className={reelLi}><NewsReel story={item.story} onOpen={onOpen} eager={newsSeen === 1} /></li>
              case 'brief':
                return <li key={item.key} className={reelLi}><BriefReel story={item.story} onOpen={onOpen} /></li>
              case 'table':
                return <TableReel key={item.key} league={item.league} dark={dark} />
              case 'match':
                return <MatchReel key={item.key} matches={matches} slot={item.slot} now={now} />
              case 'poll':
                return <PollReel key={item.key} poll={polls[item.slot]} />
              case 'fact':
                return <FactReel key={item.key} fact={facts[item.slot]} dark={dark} />
              case 'capsule': {
                const cap = capsules[item.slot]
                return cap ? <li key={item.key} className={reelLi}><CapsuleCard capsule={cap} /></li> : null
              }
              case 'picks':
                return <PicksCard key={item.key} data={picks} />
              case 'ad':
                return <AdReel key={item.key} position={item.position} />
              default:
                return null
            }
          })}
          {loadingMore && (
            <li className="flex justify-center py-6" aria-label="Cargando más">
              <Loader2 size={22} className="animate-spin text-[var(--nx-muted)]" aria-hidden="true" />
            </li>
          )}
        </ol>

        <div ref={sentinel} aria-hidden="true" className="h-px" />

        <div className="nx-snap-item mt-8 rounded-[20px] border border-[var(--nx-line)] bg-[var(--nx-surface)] px-5 py-7 text-center">
          {hasMore && autoLoads.current >= MAX_AUTO_LOADS ? (
            <button type="button" onClick={() => { autoLoads.current = 0; onLoadMore() }} disabled={loadingMore} className="inline-flex min-h-[48px] items-center gap-2 rounded-full bg-[var(--nx-ink)] px-6 text-sm font-bold text-[var(--nx-bg)] disabled:opacity-60">
              Cargar más historias
            </button>
          ) : (
            <>
              <p className="text-lg font-bold text-[var(--nx-ink)]">Estás al día</p>
              <p className="mt-1 text-sm text-[var(--nx-muted)]">Sigue explorando:</p>
            </>
          )}
          <nav aria-label="Seguir explorando" className="mt-4 flex flex-wrap justify-center gap-2">
            {[
              ['Partidos', '/deportes/futbol?view=matches'],
              ['Tablas', '/deportes/futbol/tabla'],
              ['Jugadores', '/jugadores'],
              ['Encuestas', '/encuestas'],
            ].map(([label, href]) => (
              <Link key={href} href={href} className="inline-flex min-h-[44px] items-center rounded-full border border-[var(--nx-line)] px-4 text-sm font-semibold text-[var(--nx-ink-2)] hover:border-[var(--nx-line-strong)] hover:text-[var(--nx-ink)]">
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
      <div className="hidden xl:block">
        <div className="sticky" style={{ top: 'calc(var(--nx-header-h) + 16px)' }}>
          <LiveMini matches={matches} />
        </div>
      </div>
    </div>
  )
}
