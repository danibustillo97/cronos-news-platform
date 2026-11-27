'use client'

import { useEffect, useMemo, useState } from 'react'
import { Activity, CalendarDays, Clock3, RefreshCw } from 'lucide-react'
import { apiUrl } from '@/studio/lab/api-client'
import type { Match } from '@/types/sports'
import { MatchLine } from './MatchCard'

type MatchFilter = 'all' | 'live' | 'scheduled' | 'finished'

const FILTERS: { id: MatchFilter; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'live', label: 'En vivo' },
  { id: 'scheduled', label: 'Próximos' },
  { id: 'finished', label: 'Finalizados' },
]

function colombiaDateKey() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return value.year + value.month + value.day
}

function MatchdayBoard() {
  const [matches, setMatches] = useState<Match[]>([])
  const [filter, setFilter] = useState<MatchFilter>('all')
  const [league, setLeague] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  const dateKey = colombiaDateKey()
  const hasLive = matches.some((match) => match.status === 'live')

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      if (document.visibilityState === 'hidden') return
      try {
        const response = await fetch(apiUrl('/api/sports/day?date=' + dateKey), { cache: 'no-store' })
        if (!response.ok) throw new Error('Matchday request failed: ' + response.status)
        const rows = await response.json() as Match[]
        if (!cancelled) {
          setMatches(Array.isArray(rows) ? rows : [])
          setError(false)
          setUpdatedAt(new Date())
        }
      } catch {
        if (!cancelled) setError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    const interval = window.setInterval(() => { void load() }, hasLive ? 30_000 : 90_000)
    const onVisibility = () => { if (document.visibilityState === 'visible') void load() }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      cancelled = true
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [dateKey, hasLive])

  const counts = useMemo(() => ({
    all: matches.length,
    live: matches.filter((match) => match.status === 'live').length,
    scheduled: matches.filter((match) => match.status === 'scheduled').length,
    finished: matches.filter((match) => match.status === 'finished').length,
  }), [matches])

  const leagues = useMemo(
    () => [...new Map(matches.map((match) => [match.league, match.leagueName])).entries()],
    [matches],
  )

  const grouped = useMemo(() => {
    const visible = matches.filter((match) =>
      (filter === 'all' || match.status === filter) &&
      (league === 'all' || match.league === league),
    )
    const groups = new Map<string, Match[]>()
    for (const match of visible) {
      const group = groups.get(match.league) ?? []
      group.push(match)
      groups.set(match.league, group)
    }
    return [...groups.entries()].map(([id, rows]) => ({
      id,
      name: rows[0]?.leagueName ?? id,
      matches: rows,
    }))
  }, [matches, filter, league])

  const dateLabel = new Intl.DateTimeFormat('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'America/Bogota',
  }).format(new Date())

  const updatedLabel = updatedAt
    ? new Intl.DateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota' }).format(updatedAt)
    : null

  return (
    <section aria-labelledby="matchday-heading" className="mb-5 overflow-hidden rounded-2xl border border-[var(--nx-line)] bg-[var(--nx-surface)]">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--nx-line)] px-4 py-4 sm:px-5">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--nx-accent-text)]">
            <CalendarDays size={13} aria-hidden="true" /> Jornada de hoy
          </p>
          <h3 id="matchday-heading" className="mt-1 text-xl font-bold tracking-tight text-[var(--nx-ink)]">
            Todos los partidos
          </h3>
          <p className="mt-1 text-xs capitalize text-[var(--nx-muted)]">{dateLabel}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2 rounded-full bg-[var(--nx-surface-2)] px-3 py-2 text-xs font-semibold text-[var(--nx-ink-2)]">
          <Activity size={14} className={hasLive ? 'text-[var(--nx-live)]' : 'text-[var(--nx-muted)]'} aria-hidden="true" />
          <span>{counts.all} partidos</span>
          {counts.live > 0 && <span className="font-black text-[var(--nx-live)]">· {counts.live} en vivo</span>}
        </div>
      </header>

      <div className="border-b border-[var(--nx-line)] px-3 py-3 sm:px-4">
        <div className="nx-snap-x flex gap-1.5 overflow-x-auto pb-1" role="group" aria-label="Filtrar partidos por estado">
          {FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={filter === item.id}
              onClick={() => setFilter(item.id)}
              className={'inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-bold transition-colors ' + (filter === item.id
                ? 'bg-[var(--nx-ink)] text-[var(--nx-bg)]'
                : 'bg-[var(--nx-surface-2)] text-[var(--nx-ink-2)] hover:bg-[var(--nx-surface-3)]')}
            >
              {item.label}
              <span className={filter === item.id ? 'opacity-75' : 'text-[var(--nx-muted)]'}>{counts[item.id]}</span>
            </button>
          ))}
        </div>

        {leagues.length > 1 && (
          <div className="nx-snap-x mt-2 flex gap-1.5 overflow-x-auto pb-1" role="group" aria-label="Filtrar por competición">
            <button
              type="button"
              aria-pressed={league === 'all'}
              onClick={() => setLeague('all')}
              className={'min-h-8 shrink-0 rounded-full border px-3 text-[11px] font-semibold ' + (league === 'all'
                ? 'border-[var(--nx-accent)] text-[var(--nx-ink)]'
                : 'border-[var(--nx-line)] text-[var(--nx-muted)]')}
            >
              Todas las competiciones
            </button>
            {leagues.map(([id, name]) => (
              <button
                key={id}
                type="button"
                aria-pressed={league === id}
                onClick={() => setLeague(id)}
                className={'min-h-8 shrink-0 rounded-full border px-3 text-[11px] font-semibold ' + (league === id
                  ? 'border-[var(--nx-accent)] text-[var(--nx-ink)]'
                  : 'border-[var(--nx-line)] text-[var(--nx-muted)]')}
              >
                {name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="px-3 py-2 sm:px-4">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-9 text-sm text-[var(--nx-muted)]">
            <RefreshCw size={15} className="animate-spin" aria-hidden="true" /> Cargando la jornada…
          </div>
        ) : grouped.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm font-semibold text-[var(--nx-ink)]">
              {error ? 'No pudimos actualizar los partidos.' : filter === 'all' ? 'No hay partidos disponibles para hoy.' : 'No hay partidos en este filtro.'}
            </p>
            <p className="mt-1 text-xs text-[var(--nx-muted)]">
              {error ? 'Conservamos los datos anteriores y volveremos a consultar.' : 'La jornada se actualizará automáticamente durante el día.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--nx-line)]">
            {grouped.map((group) => (
              <section key={group.id} aria-label={group.name} className="py-2">
                <h4 className="px-2 pb-1 pt-1 text-[10px] font-bold uppercase tracking-[0.13em] text-[var(--nx-muted)]">
                  {group.name} · {group.matches.length}
                </h4>
                <div className="-mx-1 divide-y divide-[var(--nx-line)]/70">
                  {group.matches.map((match) => <MatchLine key={match.id} match={match} />)}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      <footer className="flex items-center justify-between gap-3 border-t border-[var(--nx-line)] px-4 py-2.5 text-[10px] text-[var(--nx-muted)] sm:px-5">
        <span className="flex items-center gap-1.5">
          <Clock3 size={12} aria-hidden="true" />
          {updatedLabel ? 'Actualizado ' + updatedLabel : 'Actualización automática'}
        </span>
        <span>{hasLive ? 'Refresco cada 30 s' : 'Refresco cada 90 s'}</span>
      </footer>
    </section>
  )
}

export default MatchdayBoard
