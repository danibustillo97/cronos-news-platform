'use client'

// Riel "Ahora": la línea de tiempo en vivo del home -- publicaciones y
// partidos mezclados por recencia (en vivo arriba, lo próximo al cierre).
// Desktop: columna fija (sticky) junto al Pulso. Mobile/tablet: tira
// deslizable. Se actualiza sola con el poll del scoreboard y de noticias.

import { localizeStatus } from '@/lib/matchStatus'
import { useMemo } from 'react'
import Link from 'next/link'
import { buildNowItems, kickoffLabel, timeAgo, type NowItem } from '@/lib/feedComposer'
import type { NewsView } from '@/types/news'
import type { Match } from '@/types/sports'
import { TeamCrest } from './Crest'
import { matchHref } from './MatchCard'
import { StoryLink } from './StoryLink'
import { useNow } from './useNow'

function stamp(item: NowItem<NewsView>, now: Date): string {
  if (item.kind === 'live') return 'En vivo'
  if (item.kind === 'kickoff') return kickoffLabel(item.match.date, now)
  return timeAgo(item.at, now)
}

function MatchText({ match, kind }: { match: Match; kind: NowItem['kind'] }) {
  const score = kind === 'kickoff' ? 'vs' : `${match.homeScore}–${match.awayScore}`
  return (
    <span className="flex min-w-0 items-center gap-1.5 text-[13px] font-bold text-[var(--nx-ink)]">
      <TeamCrest src={match.homeLogo} name={match.homeTeam} size={18} />
      <span className="truncate">{match.homeTeam}</span>
      <span className={`shrink-0 tabular-nums ${kind === 'live' ? 'text-[var(--nx-live)]' : ''}`}>{score}</span>
      <span className="truncate">{match.awayTeam}</span>
      <TeamCrest src={match.awayLogo} name={match.awayTeam} size={18} />
    </span>
  )
}

function label(item: NowItem<NewsView>): string {
  if (item.kind === 'story') return item.story.category || 'Publicado'
  if (item.kind === 'live') return `${item.match.leagueName} · ${localizeStatus(item.match.statusDetail)}`
  if (item.kind === 'final') return `${item.match.leagueName} · Final`
  return `${item.match.leagueName} · Previa`
}

function Entry({ item, now, onOpen, compact }: { item: NowItem<NewsView>; now: Date; onOpen: (s: NewsView) => void; compact: boolean }) {
  const live = item.kind === 'live'
  const body = (
    <>
      <span className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em] ${live ? 'text-[var(--nx-live)]' : 'text-[var(--nx-accent-text)]'}`}>
        {live && <span className="nx-live-dot" style={{ width: 6, height: 6 }} aria-hidden="true" />}
        <span className="truncate">{label(item)}</span>
      </span>
      {item.kind === 'story'
        ? <span className={`mt-1 text-[13px] font-bold leading-snug text-[var(--nx-ink)] ${compact ? 'line-clamp-3' : 'line-clamp-2'}`}>{item.story.title}</span>
        : <span className="mt-1.5 block"><MatchText match={item.match} kind={item.kind} /></span>}
      <span className="mt-1 block text-[11px] font-semibold text-[var(--nx-muted)]">{stamp(item, now)}</span>
    </>
  )
  const cls = compact
    ? 'flex h-full min-h-[96px] flex-col rounded-xl border border-[var(--nx-line)] bg-[var(--nx-surface)] p-3'
    : 'block min-h-[44px] rounded-lg py-2 pl-5 pr-2 transition-colors hover:bg-[var(--nx-surface-2)]'
  return item.kind === 'story'
    ? <StoryLink story={item.story} onOpen={onOpen} className={cls}>{body}</StoryLink>
    : <Link href={matchHref(item.match)} className={cls}>{body}</Link>
}

export default function NowRail({ stories, matches, onOpen, variant }: { stories: NewsView[]; matches: Match[]; onOpen: (s: NewsView) => void; variant: 'rail' | 'strip' }) {
  const now = useNow(30_000)
  const items = useMemo(() => buildNowItems(stories, matches, now, variant === 'rail' ? 14 : 10), [stories, matches, now, variant])
  const anyLive = items.some((i) => i.kind === 'live')

  const header = (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 text-base font-extrabold text-[var(--nx-ink)]">
        <span className={`nx-live-dot ${anyLive ? 'text-[var(--nx-live)]' : 'text-[var(--nx-accent)]'}`} aria-hidden="true" /> Ahora
      </h2>
      <span className="text-[11px] font-semibold text-[var(--nx-muted)]">Se actualiza solo</span>
    </div>
  )

  if (items.length === 0) {
    return variant === 'rail' ? (
      <aside aria-label="Ahora" className="rounded-2xl border border-[var(--nx-line)] bg-[var(--nx-surface)] p-4">
        {header}
        <p className="text-sm text-[var(--nx-muted)]">Todo tranquilo por ahora. Lo próximo que pase aparece aquí.</p>
      </aside>
    ) : null
  }

  if (variant === 'strip') {
    return (
      <aside aria-label="Ahora">
        {header}
        <ol className="nx-snap-x -mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1">
          {items.map((item) => (
            <li key={item.key} className="w-[220px] shrink-0"><Entry item={item} now={now} onOpen={onOpen} compact /></li>
          ))}
        </ol>
      </aside>
    )
  }

  return (
    <aside aria-label="Ahora" className="flex max-h-[calc(100vh_-_var(--nx-header-h)_-_32px)] flex-col rounded-2xl border border-[var(--nx-line)] bg-[var(--nx-surface)] p-4">
      {header}
      <ol className="nx-thin-scroll relative -mr-2 flex-1 overflow-y-auto pr-2">
        <span aria-hidden className="absolute bottom-2 left-[7px] top-2 w-px bg-[var(--nx-line-strong)]" />
        {items.map((item) => (
          <li key={item.key} className="relative">
            <span aria-hidden className={`absolute left-[4px] top-[14px] h-[7px] w-[7px] rounded-full ring-2 ring-[var(--nx-surface)] ${item.kind === 'live' ? 'bg-[var(--nx-live)]' : item.kind === 'kickoff' ? 'bg-[var(--nx-muted)]' : 'bg-[var(--nx-accent)]'}`} />
            <Entry item={item} now={now} onOpen={onOpen} compact={false} />
          </li>
        ))}
      </ol>
    </aside>
  )
}
