'use client'

// Tipos de tarjeta del feed Reels (todas usan ReelFrame). Las que dependen
// de datos del navegador renderizan su propio <li> y devuelven null si no
// hay datos: el feed nunca muestra huecos.

import { useCallback, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { BarChart3, CircleDot, Newspaper, Sparkles, Swords, Table2, Vote } from 'lucide-react'
import { proxiedImage } from '@/lib/media'
import { estimateReadMinutes } from '@/lib/readTime'
import { useStandings } from '@/lib/useStandings'
import { LEAGUE_LABELS } from '@/lib/leagueLogos'
import { formatGoalDiff } from '@/lib/standings'
import { matchesForSlot, type AutoFact } from '@/lib/reels'
import type { Poll } from '@/lib/polls'
import type { NewsView } from '@/types/news'
import type { Match } from '@/types/sports'
import ReelFrame, { reelTitle } from './ReelFrame'
import { StoryLink } from './StoryLink'
import { LeagueBadge, TeamCrest } from './Crest'
import { MatchLine } from './MatchCard'
import { PollBlock } from './PollCard'
import { Skeleton } from './PortalBits'
import FeedAd from './FeedAd'
import TableModal from './TableModal'

export const reelLi = 'nx-snap-item w-full min-w-0 max-w-full'

const openOnClick = (story: NewsView, onOpen: (s: NewsView) => void) => (e: React.MouseEvent<HTMLAnchorElement>) => {
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
  e.preventDefault()
  onOpen(story)
}

export function NewsReel({ story, onOpen, eager = false }: { story: NewsView; onOpen: (s: NewsView) => void; eager?: boolean }) {
  const src = proxiedImage(story.image_url)
  const minutes = story.read_minutes ?? estimateReadMinutes(story.content, story.excerpt)
  const titleId = `reel-${story.id}`
  const source = story.source?.split('·')[0].trim()
  return (
    <ReelFrame
      icon={<Newspaper size={12} aria-hidden="true" />}
      kind={story.category || 'Noticia'}
      time={story.published_at}
      labelledBy={titleId}
      media={
        <StoryLink story={story} onOpen={onOpen} className="relative block aspect-[4/5] w-full overflow-hidden bg-[var(--nx-surface-2)] sm:aspect-video" ariaLabel={story.title}>
          {src ? (
            <Image src={src} alt={story.title} fill sizes="(max-width: 640px) 100vw, 600px" loading={eager ? 'eager' : 'lazy'} className="object-cover transition-transform duration-700 hover:scale-[1.02]" />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center text-2xl font-bold text-[var(--nx-muted)]">NEXUS</span>
          )}
        </StoryLink>
      }
      title={
        <h3 id={titleId} className={reelTitle}>
          <StoryLink story={story} onOpen={onOpen} className="hover:underline hover:decoration-2 hover:underline-offset-4">{story.title}</StoryLink>
        </h3>
      }
      body={story.excerpt ? <p className="text-[15px] leading-relaxed text-[var(--nx-ink-2)] line-clamp-2">{story.excerpt}</p> : undefined}
      meta={[source, minutes > 0 ? `${minutes} min de lectura` : null].filter(Boolean).join(' · ') || undefined}
      share={{ url: `/noticia/${story.slug}`, title: story.title }}
      saveId={story.id}
      social={{ type: 'news', id: story.id }}
      more={{ href: `/noticia/${story.slug}`, label: 'Leer', onClick: openOnClick(story, onOpen) }}
    />
  )
}

export function TableReel({ league, dark }: { league: string; dark: boolean }) {
  const { table, leagueName, loading } = useStandings(league)
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  const label = LEAGUE_LABELS[league] ?? leagueName ?? league
  if (!loading && table.length === 0) return null
  const rows = table.slice(0, 6)
  const href = `/deportes/futbol/tabla?league=${encodeURIComponent(league)}`
  return (
    <li className={reelLi}>
      <ReelFrame
        icon={<Table2 size={12} aria-hidden="true" />}
        kind="Tabla"
        title={
          <h3 className="text-lg font-bold text-[var(--nx-ink)]">
            <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-2.5 text-left hover:underline hover:decoration-2 hover:underline-offset-4">
              <LeagueBadge league={league} name={label} size={24} dark={dark} /> {label}
            </button>
          </h3>
        }
        body={loading ? <Skeleton className="h-[264px]" /> : (
          <table className="w-full cursor-pointer border-separate border-spacing-0 text-[13px]" onClick={() => setOpen(true)}>
            <caption className="sr-only">Primeros puestos de {label}</caption>
            <thead>
              <tr className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--nx-muted)]">
                <th scope="col" className="w-7 pb-2 text-left">#</th>
                <th scope="col" className="pb-2 text-left">Equipo</th>
                <th scope="col" className="w-10 pb-2 text-right"><abbr title="Partidos jugados" className="no-underline">PJ</abbr></th>
                <th scope="col" className="w-10 pb-2 text-right"><abbr title="Diferencia de gol" className="no-underline">DG</abbr></th>
                <th scope="col" className="w-10 pb-2 text-right"><abbr title="Puntos" className="no-underline">PTS</abbr></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.rank}-${r.team}`}>
                  <td className="relative h-11 border-t border-[var(--nx-line)] font-bold tabular-nums text-[var(--nx-muted)]">
                    {r.noteColor && /^#[0-9a-f]{3,6}$/i.test(r.noteColor) && <span aria-hidden className="absolute inset-y-2.5 -left-4 w-1 rounded-r-full" style={{ background: r.noteColor }} />}
                    {r.rank}
                  </td>
                  <th scope="row" className="border-t border-[var(--nx-line)] text-left font-normal">
                    <span className="flex min-w-0 items-center gap-2.5">
                      <TeamCrest src={r.logo} name={r.team} size={22} />
                      <span className="truncate font-semibold text-[var(--nx-ink)]">{r.team}</span>
                    </span>
                  </th>
                  <td className="border-t border-[var(--nx-line)] text-right tabular-nums text-[var(--nx-ink-2)]">{r.played}</td>
                  <td className="border-t border-[var(--nx-line)] text-right tabular-nums text-[var(--nx-ink-2)]">{formatGoalDiff(r.goalDifference)}</td>
                  <td className="border-t border-[var(--nx-line)] text-right font-bold tabular-nums text-[var(--nx-ink)]">{r.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        meta={!loading && table.length > rows.length ? `${table.length} equipos · Fuente: ESPN` : 'Fuente: ESPN'}
        share={{ url: href, title: `Tabla de ${label}` }}
        more={{ href, label: 'Ver tabla completa', onClick: (e) => { if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return; e.preventDefault(); setOpen(true) } }}
      />
      <TableModal open={open} initialLeague={league} onClose={close} />
    </li>
  )
}

export function MatchReel({ matches, slot, now }: { matches: Match[]; slot: number; now: Date }) {
  const group = matchesForSlot(matches, slot, now)
  if (!group) return null
  const live = group.title === 'En vivo'
  const view = live ? 'live' : group.title === 'Resultados' ? 'results' : 'matches'
  return (
    <li className={reelLi}>
      <ReelFrame
        icon={<CircleDot size={12} aria-hidden="true" />}
        kind={live ? 'En vivo' : 'Partidos'}
        tone={live ? 'live' : 'default'}
        title={<h3 className="text-lg font-bold text-[var(--nx-ink)]">{group.title}</h3>}
        body={<div className="-mx-2 divide-y divide-[var(--nx-line)]">{group.matches.map((m) => <MatchLine key={m.id} match={m} />)}</div>}
        meta={[...new Set(group.matches.map((m) => m.leagueName))].join(' · ')}
        share={{ url: `/deportes/futbol?view=${view}`, title: group.title }}
        more={{ href: `/deportes/futbol?view=${view}`, label: 'Todos los partidos' }}
      />
    </li>
  )
}

export function PollReel({ poll }: { poll: Poll | undefined }) {
  if (!poll) return null
  const debate = poll.kind === 'debate'
  return (
    <li className={reelLi}>
      <ReelFrame
        icon={debate ? <Swords size={12} aria-hidden="true" /> : <Vote size={12} aria-hidden="true" />}
        kind={debate ? 'Debate' : 'Encuesta'}
        tone="accent"
        time={poll.createdAt || null}
        body={<PollBlock poll={poll} compact bare />}
        share={{ url: `/encuestas#encuesta-${encodeURIComponent(poll.id)}`, title: poll.question }}
        social={{ type: 'poll', id: poll.id }}
        more={{ href: '/encuestas', label: 'Más encuestas' }}
      />
    </li>
  )
}

export function FactReel({ fact, dark }: { fact: AutoFact | undefined; dark: boolean }) {
  if (!fact) return null
  const cta = fact.id === 'compare-cta'
  return (
    <li className={reelLi}>
      <ReelFrame
        icon={cta ? <Swords size={12} aria-hidden="true" /> : <Sparkles size={12} aria-hidden="true" />}
        kind={cta ? 'Cara a cara' : 'Dato'}
        body={
          <div className="flex items-start gap-4 py-2">
            {fact.league ? <LeagueBadge league={fact.league} name={fact.kicker} size={36} dark={dark} /> : <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--nx-surface-2)] text-[var(--nx-accent-text)]"><BarChart3 size={18} aria-hidden="true" /></span>}
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--nx-accent-text)]">{fact.kicker}</p>
              <h3 className="mt-1.5 text-[19px] font-bold leading-snug text-[var(--nx-ink)]">
                {fact.value && <span className="mr-1.5 text-[2rem] leading-none tabular-nums">{fact.value}</span>}
                {fact.headline}
              </h3>
              {fact.detail && <p className="mt-1.5 text-sm leading-relaxed text-[var(--nx-ink-2)]">{fact.detail}</p>}
            </div>
          </div>
        }
        meta={cta ? 'Herramienta de NEXUS' : 'Calculado con datos de ESPN'}
        share={{ url: fact.href, title: `${fact.value ? `${fact.value} ` : ''}${fact.headline}` }}
        more={{ href: fact.href, label: cta ? 'Comparar' : 'Ver más' }}
      />
    </li>
  )
}

export function AdReel({ position }: { position: 'HOME_TOP' | 'HOME_FEED' }) {
  return (
    <li className={`${reelLi} has-[aside[hidden]]:hidden`}>
      <FeedAd position={position} />
    </li>
  )
}

/** Mini columna lateral (≥1280 px): marcador en vivo/hoy, nada más. */
export function LiveMini({ matches }: { matches: Match[] }) {
  const t = (m: Match) => (m.date ? Date.parse(m.date) : 0)
  const today = new Date().toDateString()
  const list = [
    ...matches.filter((m) => m.status === 'live'),
    ...matches.filter((m) => m.status !== 'live' && m.date && new Date(m.date).toDateString() === today).sort((a, b) => t(a) - t(b)),
  ].slice(0, 7)
  if (list.length === 0) return null
  return (
    <aside aria-label="Marcador de hoy" className="w-[280px] rounded-[20px] border border-[var(--nx-line)] bg-[var(--nx-surface)] p-3">
      <h2 className="px-1 pb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--nx-muted)]">Marcador de hoy</h2>
      <div className="-mx-1 divide-y divide-[var(--nx-line)]">{list.map((m) => <MatchLine key={m.id} match={m} />)}</div>
      <Link href="/deportes/futbol" className="mt-1 flex min-h-[44px] items-center justify-center rounded-xl text-xs font-semibold text-[var(--nx-accent-text)] hover:bg-[var(--nx-surface-2)]">Todos los partidos</Link>
    </aside>
  )
}
