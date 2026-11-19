'use client'

// EL SLOT dinámico de "Ahora" -- no una sección más, un mismo espacio
// que cambia de estado. Normalmente muestra la historia destacada
// (HeroEditorial, reusado tal cual), pero SI existe algo realmente en
// vivo, lo REEMPLAZA por completo -- nunca los muestra los dos a la vez.
// La única señal "en vivo" real que existe hoy en NEXUS es el scoreboard
// deportivo (backend/app/presentation/api/sports.py) -- no hay infra de
// streaming editorial todavía (deliberadamente fuera de esta iteración).
// Estados:
//
//   NORMAL    -- nada relevante en vivo: el destacado editorial de siempre
//   UPCOMING  -- un partido programado que arranca en <60 min (real, con cuenta regresiva)
//   LIVE      -- un partido con status 'live' en el scoreboard (real)
//   ENDED     -- un partido que terminó hace <30 min (real, "replay" del resultado)
//
// Cuando exista programación editorial propia (streaming real), este
// mismo componente es donde se conecta -- no hace falta otro slot.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Radio, Clock, Play, ArrowLeftRight, CircleDot } from 'lucide-react'
import HeroEditorial from '@/components/news/HeroEditorial'
import { proxiedImage } from '@/lib/media'
import type { NewsView } from '@/types/news'
import type { Match } from '@/types/sports'

type SlotState = 'live' | 'upcoming' | 'ended' | 'normal'

export function pickMatch(matches: Match[]): { match: Match; state: SlotState } | null {
  const live = matches.find((m) => m.status === 'live')
  if (live) return { match: live, state: 'live' }

  const now = Date.now()
  const upcoming = matches
    .filter((m) => m.status === 'scheduled' && m.date)
    .find((m) => {
      const diffMin = (new Date(m.date as string).getTime() - now) / 60_000
      return diffMin > 0 && diffMin <= 60
    })
  if (upcoming) return { match: upcoming, state: 'upcoming' }

  const ended = matches
    .filter((m) => m.status === 'finished' && m.date)
    .find((m) => {
      const diffMin = (now - new Date(m.date as string).getTime()) / 60_000
      return diffMin >= 0 && diffMin <= 30
    })
  if (ended) return { match: ended, state: 'ended' }

  return null
}

function useCountdown(targetIso: string | null): string {
  const [label, setLabel] = useState('')
  useEffect(() => {
    if (!targetIso) return
    const update = () => {
      const diffMin = Math.max(0, Math.round((new Date(targetIso).getTime() - Date.now()) / 60_000))
      setLabel(diffMin <= 1 ? 'Arranca en instantes' : `Arranca en ${diffMin} min`)
    }
    update()
    const id = window.setInterval(update, 30_000)
    return () => window.clearInterval(id)
  }, [targetIso])
  return label
}

function TeamLogo({ src, name }: { src: string | null; name: string }) {
  if (src) return <Image src={src} alt="" width={72} height={72} className="object-contain" />
  return (
    <span className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center text-white font-bold text-lg">
      {name.slice(0, 1)}
    </span>
  )
}

const BADGE = {
  live: { label: 'EN VIVO', icon: Radio, pulse: true },
  upcoming: { label: 'PRÓXIMAMENTE', icon: Clock, pulse: false },
  ended: { label: 'REPLAY', icon: Play, pulse: false },
} as const

type EventKind = 'goal' | 'own-goal' | 'penalty' | 'yellow' | 'red' | 'sub' | 'var' | 'other'
interface TimelineEvent {
  id: string
  minute: string
  kind: EventKind
  side: 'home' | 'away' | null
  player: string
  assist: string
  playerOut: string
  text: string
}

function useTimeline(match: Match, poll: boolean): TimelineEvent[] {
  const [events, setEvents] = useState<TimelineEvent[]>([])
  useEffect(() => {
    if (match.status === 'scheduled') { setEvents([]); return }
    let cancelled = false
    const load = () => {
      fetch(`/api/football/timeline?league=${encodeURIComponent(match.league)}&event=${encodeURIComponent(match.id)}`)
        .then((res) => (res.ok ? res.json() : { events: [] }))
        .then((data: { events?: TimelineEvent[] }) => { if (!cancelled) setEvents(data.events ?? []) })
        .catch(() => { if (!cancelled) setEvents([]) })
    }
    load()
    if (!poll) return () => { cancelled = true }
    const id = window.setInterval(load, 20_000)
    return () => { cancelled = true; window.clearInterval(id) }
  }, [match.id, match.league, match.status, poll])
  return events
}

function EventIcon({ kind }: { kind: EventKind }) {
  if (kind === 'yellow') return <span className="block h-4 w-3 rounded-[2px] bg-yellow-300" />
  if (kind === 'red') return <span className="block h-4 w-3 rounded-[2px] bg-red-500" />
  if (kind === 'sub') return <ArrowLeftRight size={14} className="text-emerald-400" />
  if (kind === 'var') return <span className="rounded-sm bg-white/15 px-1 text-[9px] font-black text-white">VAR</span>
  if (kind === 'goal' || kind === 'penalty' || kind === 'own-goal') return <CircleDot size={15} className={kind === 'own-goal' ? 'text-red-400' : 'text-yellow-300'} />
  return <span className="block h-1.5 w-1.5 rounded-full bg-neutral-500" />
}

function eventLabel(event: TimelineEvent): string {
  if (event.kind === 'goal') return 'Gol'
  if (event.kind === 'penalty') return 'Gol de penal'
  if (event.kind === 'own-goal') return 'Autogol'
  if (event.kind === 'yellow') return 'Tarjeta amarilla'
  if (event.kind === 'red') return 'Tarjeta roja'
  if (event.kind === 'sub') return 'Sustitución'
  if (event.kind === 'var') return 'Revisión VAR'
  return event.text
}

function Timeline({ match, events, live }: { match: Match; events: TimelineEvent[]; live: boolean }) {
  return (
    <div className="flex min-h-0 flex-col border-t border-white/10 lg:border-l lg:border-t-0">
      <div className="flex items-center justify-between px-5 py-3">
        <span className="text-[11px] font-black uppercase tracking-[0.16em] text-white">Minuto a minuto</span>
        {live && <span className="text-[10px] font-bold text-yellow-300">Actualiza solo</span>}
      </div>
      {events.length === 0 ? (
        <p className="px-5 pb-5 text-xs text-neutral-500">
          {match.status === 'scheduled' ? 'Los eventos aparecerán cuando ruede el balón.' : 'Aún no hay jugadas destacadas.'}
        </p>
      ) : (
        <ol className="min-h-0 flex-1 space-y-px overflow-y-auto px-2 pb-3 lg:max-h-[330px]" style={{ scrollbarWidth: 'thin' }}>
          {events.map((event) => {
            const logo = event.side === 'away' ? match.awayLogo : match.homeLogo
            const team = event.side === 'away' ? match.awayTeam : match.homeTeam
            const big = event.kind === 'goal' || event.kind === 'penalty' || event.kind === 'own-goal'
            return (
              <li key={event.id} className={`grid grid-cols-[38px_20px_22px_minmax(0,1fr)] items-center gap-2 rounded-md px-3 py-2 ${big ? 'bg-yellow-300/[0.08]' : 'hover:bg-white/[0.03]'}`}>
                <span className="text-xs font-black tabular-nums text-yellow-300">{event.minute}</span>
                <span className="flex justify-center"><EventIcon kind={event.kind} /></span>
                {logo
                  ? <Image src={logo} alt={team} title={team} width={20} height={20} className="h-5 w-5 object-contain" />
                  : <span className="h-5 w-5 rounded-full bg-white/10" />}
                <span className="min-w-0">
                  <span className={`block truncate text-[13px] ${big ? 'font-black text-white' : 'font-semibold text-neutral-100'}`}>{event.player || eventLabel(event)}</span>
                  <span className="block truncate text-[11px] text-neutral-500">
                    {eventLabel(event)}
                    {event.assist && ` · Asist. ${event.assist}`}
                    {event.playerOut && ` · Sale ${event.playerOut}`}
                  </span>
                </span>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}

function MatchSlot({ match, state }: { match: Match; state: 'live' | 'upcoming' | 'ended' }) {
  const badge = BADGE[state]
  const countdown = useCountdown(state === 'upcoming' ? match.date : null)
  const events = useTimeline(match, state === 'live')
  const statusLine = state === 'live' ? match.statusDetail : state === 'upcoming' ? countdown : 'Finalizado'
  const ctaLabel = state === 'ended' ? 'Ver resultado completo →' : 'Ver cobertura completa →'

  return (
    <div className="relative grid w-full overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-[#16140a] via-[#0f0f0d] to-[#0B0B0B] lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <div aria-hidden className="pointer-events-none absolute -left-24 -top-24 h-64 w-64 rounded-full bg-yellow-300/10 blur-3xl" />
      <div className="relative flex min-h-[300px] flex-col">
        <div className="flex items-center justify-between gap-3 p-5 pb-0">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.16em] ${state === 'live' ? 'bg-yellow-300 text-black' : 'bg-white/10 text-neutral-300'}`}>
            <badge.icon size={12} className={badge.pulse ? 'animate-pulse' : ''} />
            {badge.label}
          </span>
          <span className="truncate text-[11px] font-bold uppercase tracking-[0.14em] text-neutral-400">{match.leagueName}</span>
        </div>

        <div className="flex flex-1 items-center justify-center gap-4 px-4 py-6 sm:gap-8">
          <div className="flex min-w-0 flex-1 flex-col items-center gap-2">
            <TeamLogo src={match.homeLogo} name={match.homeTeam} />
            <span className="max-w-full truncate text-center text-sm font-bold text-white">{match.homeTeam}</span>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <span className="rounded-lg border border-yellow-300/30 bg-black/40 px-4 py-1 text-4xl font-black tabular-nums text-white sm:text-5xl">{match.homeScore}<span className="mx-1 text-yellow-300">–</span>{match.awayScore}</span>
            <span className="text-xs font-bold text-yellow-300">{statusLine}</span>
          </div>
          <div className="flex min-w-0 flex-1 flex-col items-center gap-2">
            <TeamLogo src={match.awayLogo} name={match.awayTeam} />
            <span className="max-w-full truncate text-center text-sm font-bold text-white">{match.awayTeam}</span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 px-5 pb-4">
          <Link href="/deportes/futbol" className="text-xs font-bold text-yellow-300 transition-opacity hover:opacity-70">{ctaLabel}</Link>
          {match.venue && <span className="truncate text-[11px] text-neutral-500">{match.venue}</span>}
        </div>
      </div>

      <Timeline match={match} events={events} live={state === 'live'} />
    </div>
  )
}

export default function LiveSlot({
  matches, featured, isDark, onOpen,
}: {
  matches: Match[]
  featured: NewsView
  isDark: boolean
  onOpen: (item: NewsView) => void
}) {
  const picked = pickMatch(matches)

  if (picked && picked.state !== 'normal') {
    return <MatchSlot match={picked.match} state={picked.state} />
  }

  return <HeroEditorial item={featured} src={proxiedImage(featured.image_url)} onOpen={onOpen} />
}
