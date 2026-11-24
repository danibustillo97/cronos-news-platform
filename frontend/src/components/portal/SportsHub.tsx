'use client'

// Hub deportivo del home: partidos (en vivo / hoy / resultados /
// próximos) con escudos y estado, + tablas de posiciones con selector de
// competición. Todo enlaza a /deportes. Datos reales del scoreboard.

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, CalendarX2 } from 'lucide-react'
import type { Match } from '@/types/sports'
import { MatchCard } from './MatchCard'
import StandingsBoard from './StandingsBoard'
import { SectionHeading, Skeleton } from './PortalBits'
import { useNow } from './useNow'

type Tab = 'live' | 'today' | 'results' | 'upcoming'

const TAB_LABEL: Record<Tab, string> = { live: 'En vivo', today: 'Hoy', results: 'Resultados', upcoming: 'Próximos' }
const MAX_CARDS = 4

function t(m: Match): number {
  const v = m.date ? Date.parse(m.date) : NaN
  return Number.isFinite(v) ? v : 0
}

export default function SportsHub({ matches, loading, dark }: { matches: Match[]; loading: boolean; dark: boolean }) {
  const now = useNow(60_000)
  const groups = useMemo(() => {
    const today = now.toDateString()
    return {
      live: matches.filter((m) => m.status === 'live'),
      today: matches.filter((m) => m.date && new Date(m.date).toDateString() === today).sort((a, b) => t(a) - t(b)),
      results: matches.filter((m) => m.status === 'finished').sort((a, b) => t(b) - t(a)),
      upcoming: matches.filter((m) => m.status === 'scheduled').sort((a, b) => t(a) - t(b)),
    } satisfies Record<Tab, Match[]>
  }, [matches, now])

  const available = (Object.keys(TAB_LABEL) as Tab[]).filter((k) => groups[k].length > 0)
  const [picked, setPicked] = useState<Tab | null>(null)
  const tab: Tab | null = picked && groups[picked].length > 0 ? picked : available[0] ?? null
  const shown = tab ? groups[tab].slice(0, MAX_CARDS) : []

  return (
    <div>
      <SectionHeading
        id="sports-heading"
        kicker="Fútbol en directo"
        title="En la cancha"
        action={
          <Link href="/deportes/futbol" className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-[var(--nx-line)] px-4 text-xs font-bold text-[var(--nx-ink)] hover:border-[var(--nx-line-strong)]">
            Hub de fútbol <ArrowRight size={14} aria-hidden="true" />
          </Link>
        }
      />
      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-start">
        <div className="flex min-w-0 flex-col gap-3">
          {available.length > 0 && (
            <div role="tablist" aria-label="Partidos" className="nx-snap-x flex gap-1.5 overflow-x-auto">
              {available.map((k) => (
                <button
                  key={k}
                  type="button"
                  role="tab"
                  aria-selected={tab === k}
                  onClick={() => setPicked(k)}
                  className={`inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-full px-4 text-xs font-black uppercase tracking-[0.1em] transition-colors ${
                    tab === k ? 'bg-[#FACC15] text-black' : 'bg-[var(--nx-surface)] text-[var(--nx-ink-2)] ring-1 ring-[var(--nx-line)] hover:ring-[var(--nx-line-strong)]'
                  }`}
                >
                  {k === 'live' && <span className="nx-live-dot text-[var(--nx-live)]" style={{ width: 6, height: 6 }} aria-hidden="true" />}
                  {TAB_LABEL[k]}
                  <span className="tabular-nums opacity-60">{groups[k].length}</span>
                </button>
              ))}
            </div>
          )}

          {loading && matches.length === 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[132px]" />)}
            </div>
          ) : shown.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--nx-line-strong)] px-6 py-12 text-center">
              <CalendarX2 size={28} className="text-[var(--nx-muted)]" aria-hidden="true" />
              <p className="text-sm font-bold text-[var(--nx-ink)]">No hay partidos en la agenda de hoy.</p>
              <Link href="/deportes/futbol" className="inline-flex min-h-[44px] items-center text-xs font-bold text-[var(--nx-accent-text)] hover:underline">Revisa el calendario completo</Link>
            </div>
          ) : (
            <ul className="nx-snap-x -mx-4 flex gap-3 overflow-x-auto px-4 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0" role="tabpanel" aria-label={tab ? TAB_LABEL[tab] : undefined}>
              {shown.map((m) => (
                <li key={m.id} className="w-[82%] shrink-0 sm:w-auto">
                  <MatchCard match={m} dark={dark} />
                </li>
              ))}
            </ul>
          )}
          {tab && groups[tab].length > MAX_CARDS && (
            <Link href={`/deportes/futbol?view=${tab === 'live' ? 'live' : tab === 'results' ? 'results' : 'matches'}`} className="inline-flex min-h-[44px] items-center gap-1.5 self-start text-xs font-bold text-[var(--nx-accent-text)] hover:underline">
              Ver los {groups[tab].length} partidos <ArrowRight size={14} aria-hidden="true" />
            </Link>
          )}
        </div>

        <StandingsBoard dark={dark} />
      </div>
    </div>
  )
}
