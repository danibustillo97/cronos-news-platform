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
import { Radio, Clock, Play } from 'lucide-react'
import HeroEditorial from '@/components/news/HeroEditorial'
import { proxiedImage } from '@/lib/media'
import type { NewsView } from '@/types/news'
import type { Match } from '@/types/sports'

type SlotState = 'live' | 'upcoming' | 'ended' | 'normal'

function pickMatch(matches: Match[]): { match: Match; state: SlotState } | null {
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
  if (src) return <Image src={src} alt="" width={56} height={56} className="object-contain" />
  return (
    <span className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center text-white font-bold text-lg">
      {name.slice(0, 1)}
    </span>
  )
}

const BADGE = {
  live: { label: 'EN VIVO', icon: Radio, pulse: true },
  upcoming: { label: 'PRÓXIMAMENTE', icon: Clock, pulse: false },
  ended: { label: 'REPLAY', icon: Play, pulse: false },
} as const

function MatchSlot({ match, state }: { match: Match; state: 'live' | 'upcoming' | 'ended' }) {
  const badge = BADGE[state]
  const countdown = useCountdown(state === 'upcoming' ? match.date : null)
  const statusLine = state === 'live' ? match.statusDetail : state === 'upcoming' ? countdown : 'Finalizado'
  const ctaLabel = state === 'ended' ? 'Ver resultado completo →' : 'Ver cobertura completa →'

  return (
    <div className="relative w-full overflow-hidden rounded-md bg-gradient-to-br from-[#151515] to-[#0B0B0B] border border-white/10 aspect-[4/5] sm:aspect-[16/11] lg:aspect-[16/10] flex flex-col">
      <div className="flex items-center justify-between p-6 sm:p-8 pb-0">
        <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] ${state === 'live' ? 'text-[#E30613]' : 'text-neutral-400'}`}>
          <badge.icon size={13} className={badge.pulse ? 'animate-pulse' : ''} />
          {badge.label}
        </span>
        <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-neutral-500">{match.leagueName}</span>
      </div>

      <div className="flex-1 flex items-center justify-center gap-8 sm:gap-14 px-6">
        <div className="flex flex-col items-center gap-2 min-w-0">
          <TeamLogo src={match.homeLogo} name={match.homeTeam} />
          <span className="text-white text-sm font-bold text-center truncate max-w-[120px]">{match.homeTeam}</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-white font-black text-4xl sm:text-5xl tabular-nums">{match.homeScore}–{match.awayScore}</span>
          <span className="text-neutral-400 text-xs font-bold">{statusLine}</span>
        </div>
        <div className="flex flex-col items-center gap-2 min-w-0">
          <TeamLogo src={match.awayLogo} name={match.awayTeam} />
          <span className="text-white text-sm font-bold text-center truncate max-w-[120px]">{match.awayTeam}</span>
        </div>
      </div>

      <div className="p-6 sm:p-8 pt-0">
        <Link href="/deportes/futbol" className="inline-block text-xs font-bold text-[#E30613] hover:opacity-70 transition-opacity">
          {ctaLabel}
        </Link>
      </div>
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
