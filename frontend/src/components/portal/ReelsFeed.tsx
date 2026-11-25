'use client'

// Feed "Reels": UNA sola columna centrada (ancho de teléfono en desktop)
// que mezcla noticias, "En 30 segundos", tablas, partidos, encuestas,
// datos automáticos y publicidad con la misma anatomía de tarjeta. El
// orden lo decide lib/reels.ts (determinista: el HTML del servidor ya
// trae las noticias con sus enlaces). En teléfono cada tarjeta encaja con
// scroll-snap; en desktop el snap es suave (proximity).

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Loader2, RefreshCw } from 'lucide-react'
import LiveStrip from './LiveStrip'
import MomentCard from './MomentCard'
import { useMoments } from '@/lib/useMoments'
import { useInsightsFeed } from '@/lib/useInsightsFeed'
import { mergeDynamic } from '@/lib/insightsFeed'
import { InsightCard } from './InsightCards'
import PlacementAd from './PlacementAd'
import { FEED_AD_AFTER } from '@/lib/adSlots'
import { composeReels, interleavePolls, autoFacts, TABLE_ROTATION } from '@/lib/reels'
import { useManyStandings } from '@/lib/useStandings'
import { LEAGUE_LABELS } from '@/lib/leagueLogos'
import type { Poll } from '@/lib/polls'
import type { NewsView } from '@/types/news'
import type { Match } from '@/types/sports'
import BriefReel from './BriefReel'
import { FactReel, LiveMini, MatchReel, NewsReel, PollReel, TableReel, reelLi } from './ReelCards'
import { useNow } from './useNow'
import { CapsuleCard, PicksCard } from './FeedExtras'
import { useCapsules } from '@/lib/useCapsules'
import { usePicks } from '@/lib/usePicks'

const FACT_LEAGUES = ['col.1', 'eng.1', 'esp.1', 'ita.1', 'ger.1'] as const
const MAX_AUTO_LOADS = 4

export default function ReelsFeed({
  stories, stageStories, matches, polls, dark, onOpen, hasMore, loadingMore, onLoadMore, onRefresh,
}: {
  onRefresh?: () => Promise<number>
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
      momentSlots: 8,
    })
    // La publicidad del feed ahora va en ubicaciones con nombre (feed-1/2/3), no en el compositor.
    return interleavePolls(base, polls.length).filter((i) => i.type !== 'ad')
  }, [stories, stageStories, polls])
  const { capsules } = useCapsules('limit=12')
  const { data: picks } = usePicks()
  const moments = useMoments()
  const insights = useInsightsFeed()
  // Lugares dinámicos: alterna lo que pasó (momentos) con lo que viene (antesalas).
  const dynamic = useMemo(() => mergeDynamic(moments.items, insights), [moments.items, insights])
  // Lo que se juega ahora vive en la franja fija "Se juega ahora"; las tarjetas de partidos muestran el resto.
  const notLive = useMemo(() => matches.filter((m) => m.status !== 'live'), [matches])

  const standings = useManyStandings(FACT_LEAGUES)
  // "Partidos en vivo ahora" ya lo muestra la franja "Se juega ahora": no se repite en la lista.
  const facts = useMemo(
    () => autoFacts(standings.map((s) => ({ league: s.league, label: LEAGUE_LABELS[s.league] ?? s.leagueName, table: s.table })), matches, now)
      .filter((f) => f.id !== 'live-now'),
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

  const [refreshing, setRefreshing] = useState(false)
  const [refreshNote, setRefreshNote] = useState<string | null>(null)
  const doRefresh = async () => {
    if (!onRefresh || refreshing) return
    setRefreshing(true)
    setRefreshNote(null)
    try { navigator.vibrate?.(8) } catch { /* sin vibración */ }
    const added = await onRefresh().catch(() => 0)
    setRefreshing(false)
    setRefreshNote(added > 0 ? `${added} ${added === 1 ? 'novedad' : 'novedades'}` : 'Estás al día')
    window.setTimeout(() => setRefreshNote(null), 2500)
  }

  let newsSeen = 0
  const renderItem = (item: (typeof items)[number]) => {
    switch (item.type) {

              case 'news':
                newsSeen += 1
                return <li key={item.key} className={reelLi}><NewsReel story={item.story} onOpen={onOpen} eager={newsSeen === 1} /></li>
              case 'brief':
                return <li key={item.key} className={reelLi}><BriefReel story={item.story} onOpen={onOpen} /></li>
              case 'table':
                return <TableReel key={item.key} league={item.league} dark={dark} />
              case 'match':
                return <MatchReel key={item.key} matches={notLive} slot={item.slot} now={now} />
              case 'moment': {
                const dyn = dynamic[item.slot]
                if (!dyn) return null
                return (
                  <li key={`${item.key}-${dyn.key}`} className={reelLi}>
                    {dyn.type === 'moment' ? <MomentCard item={dyn.item} fresh={moments.fresh} /> : <InsightCard insight={dyn.insight} />}
                  </li>
                )
              }
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
              default:
                return null
            }
  }

  return (
    <div className="grid w-full min-w-0 grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,640px)_minmax(0,1fr)]">
      <div className="hidden xl:block" aria-hidden="true" />
      <div className="mx-auto w-full min-w-0 max-w-[640px]">
        <div className="mb-4 flex items-end justify-between gap-3 px-1">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--nx-accent-text)]">Noticias, datos y tablas en un solo hilo</p>
            <h2 id="feed-heading" className="mt-1 text-2xl font-bold tracking-[-0.015em] text-[var(--nx-ink)]">Pulso</h2>
          </div>
          {onRefresh && (
            <button type="button" onClick={doRefresh} disabled={refreshing} aria-live="polite" className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-[var(--nx-line)] px-3.5 text-[13px] font-semibold text-[var(--nx-ink-2)] transition-transform hover:border-[var(--nx-line-strong)] active:scale-95 disabled:opacity-70">
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} aria-hidden="true" />
              {refreshing ? 'Actualizando…' : refreshNote ?? 'Actualizar'}
            </button>
          )}
        </div>

        <LiveStrip matches={matches} />

        <ol className="nx-reels flex w-full min-w-0 flex-col gap-5 lg:gap-6" aria-labelledby="feed-heading">
          {items.map((item, index) => {
            const adAfter = (Object.entries(FEED_AD_AFTER) as ['feed-1' | 'feed-2' | 'feed-3', number][]).find(([, n]) => n === index)
            const ad = adAfter ? <li key={`ad-${adAfter[0]}`} className={`${reelLi} empty:hidden`}><PlacementAd placement={adAfter[0]} legacy={adAfter[0] === 'feed-1' ? 'HOME_TOP' : 'HOME_FEED'} /></li> : null
            const node = renderItem(item)
            return ad ? [ad, node] : node
          })}
          {loadingMore && (
            <li className="flex justify-center py-6" aria-label="Cargando más">
              <Loader2 size={22} className="animate-spin text-[var(--nx-muted)]" aria-hidden="true" />
            </li>
          )}
        </ol>

        <div ref={sentinel} aria-hidden="true" className="h-px" />

        <div className="nx-snap-item mt-8 rounded-2xl border border-[var(--nx-line)] bg-[var(--nx-surface)] px-5 py-7 text-center">
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
        <div className="sticky flex flex-col gap-4" style={{ top: 'calc(var(--nx-header-h) + 16px)' }}>
          <PlacementAd placement="sidebar" />
          <LiveMini matches={matches} />
        </div>
      </div>
    </div>
  )
}
