'use client'

// Tarjeta de partido única para todo el portal (escenario, hub, feed).
// Estado siempre explícito: EN VIVO (rojo, minuto), FINAL, o la hora de
// inicio. Enlaza al hub de fútbol de esa liga.

import { localizeStatus } from '@/lib/matchStatus'
import Link from 'next/link'
import type { Match } from '@/types/sports'
import { kickoffLabel } from '@/lib/feedComposer'
import { TeamCrest, LeagueBadge } from './Crest'
import { LiveBadge } from './PortalBits'
import { useNow } from './useNow'

function statusText(match: Match, now: Date): string {
  if (match.status === 'live') return localizeStatus(match.statusDetail === 'Scheduled' ? '' : match.statusDetail)
  if (match.status === 'finished') return 'Final'
  return kickoffLabel(match.date, now)
}

export function matchHref(match: Match): string {
  return `/deportes/futbol?league=${encodeURIComponent(match.league)}&view=${match.status === 'live' ? 'live' : match.status === 'finished' ? 'results' : 'matches'}`
}

function matchLabel(match: Match, now: Date): string {
  const score = match.status === 'scheduled' ? 'vs' : `${match.homeScore} a ${match.awayScore}`
  return `${match.leagueName}: ${match.homeTeam} ${score} ${match.awayTeam}. ${statusText(match, now)}`
}

/** Variante "card": dos filas de equipo (lectura tipo marcador de TV). */
export function MatchCard({ match, dark = true, className = '' }: { match: Match; dark?: boolean; className?: string }) {
  const now = useNow(30_000)
  const live = match.status === 'live'
  const finished = match.status === 'finished'
  const homeWins = finished && match.homeScore > match.awayScore
  const awayWins = finished && match.awayScore > match.homeScore
  const row = (name: string, logo: string | null, score: number, winner: boolean) => (
    <div className="flex items-center gap-3">
      <TeamCrest src={logo} name={name} size={30} />
      <span className={`min-w-0 flex-1 truncate text-[15px] ${winner || live ? 'font-black text-[var(--nx-ink)]' : 'font-semibold text-[var(--nx-ink-2)]'}`}>{name}</span>
      {match.status !== 'scheduled' && (
        <span className={`w-7 text-right text-lg font-extrabold tabular-nums ${live ? 'text-[var(--nx-ink)]' : winner ? 'text-[var(--nx-ink)]' : 'text-[var(--nx-muted)]'}`}>{score}</span>
      )}
    </div>
  )
  return (
    <Link
      href={matchHref(match)}
      aria-label={matchLabel(match, now)}
      className={`group flex h-full flex-col gap-3 rounded-2xl border bg-[var(--nx-surface)] p-4 transition-colors hover:border-[var(--nx-line-strong)] ${live ? 'border-[var(--nx-live)]/50' : 'border-[var(--nx-line)]'} ${className}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2">
          <LeagueBadge league={match.league} name={match.leagueName} size={18} dark={dark} />
          <span className="truncate text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--nx-muted)]">{match.leagueName}</span>
        </span>
        {live ? <LiveBadge size="sm" /> : (
          <span className={`shrink-0 text-[11px] font-black uppercase tracking-[0.1em] ${finished ? 'text-[var(--nx-muted)]' : 'text-[var(--nx-accent-text)]'}`}>{statusText(match, now)}</span>
        )}
      </div>
      <div className="flex flex-1 flex-col justify-center gap-2.5">
        {row(match.homeTeam, match.homeLogo, match.homeScore, homeWins)}
        {row(match.awayTeam, match.awayLogo, match.awayScore, awayWins)}
      </div>
      {(live || match.venue) && (
        <div className="mt-auto flex items-center justify-between gap-2 border-t border-[var(--nx-line)] pt-2.5 text-[11px] text-[var(--nx-muted)]">
          <span className="truncate">{match.venue ?? ''}</span>
          {live && <span className="shrink-0 font-black text-[var(--nx-live)]">{statusText(match, now)}</span>}
        </div>
      )}
    </Link>
  )
}

/** Variante compacta en una línea (riel / listas). */
export function MatchLine({ match }: { match: Match }) {
  const now = useNow(30_000)
  const live = match.status === 'live'
  return (
    <Link href={matchHref(match)} aria-label={matchLabel(match, now)} className="flex min-h-[52px] items-center gap-2 rounded-xl px-2 py-2 transition-colors hover:bg-[var(--nx-surface-2)]">
      <span className="flex min-w-0 flex-1 items-center justify-end gap-2">
        <span className="truncate text-right text-[13px] font-bold text-[var(--nx-ink)]">{match.homeTeam}</span>
        <TeamCrest src={match.homeLogo} name={match.homeTeam} size={22} />
      </span>
      <span className={`flex w-16 shrink-0 flex-col items-center leading-tight ${live ? 'text-[var(--nx-live)]' : 'text-[var(--nx-ink)]'}`}>
        <span className="text-sm font-black tabular-nums">{match.status === 'scheduled' ? 'vs' : `${match.homeScore} – ${match.awayScore}`}</span>
        <span className={`text-[10px] font-bold ${live ? '' : 'text-[var(--nx-muted)]'}`}>{statusText(match, now)}</span>
      </span>
      <span className="flex min-w-0 flex-1 items-center gap-2">
        <TeamCrest src={match.awayLogo} name={match.awayTeam} size={22} />
        <span className="truncate text-[13px] font-bold text-[var(--nx-ink)]">{match.awayTeam}</span>
      </span>
    </Link>
  )
}
