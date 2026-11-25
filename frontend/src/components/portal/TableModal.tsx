'use client'

// Contenido de la ventana "Tabla de posiciones" (se abre apilada desde la
// pila de ventanas: X, Esc, fondo, deslizar). Selector de liga, grupos
// (cuadrangulares, fase de liga…), escudos, encabezado fijo, zonas y
// "¿Cómo se juega?".

import { useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { useStandings } from '@/lib/useStandings'
import { LEAGUE_LABELS } from '@/lib/leagueLogos'
import { FOOTBALL_LEAGUES } from '@/lib/sportsLeagues'
import { usePortalTheme } from '@/context/ThemeContext'
import { LeagueBadge } from './Crest'
import { StandingsGroups } from '@/components/news/StandingsTable'

const ORDER = ['col.1', 'conmebol.libertadores', 'conmebol.sudamericana', 'uefa.champions', 'esp.1', 'eng.1', 'ita.1', 'ger.1']
export const TABLE_LEAGUES = [...ORDER.filter((id) => FOOTBALL_LEAGUES.some((l) => l.id === id)), ...FOOTBALL_LEAGUES.map((l) => l.id).filter((id) => !ORDER.includes(id))]
  .map((id) => ({ id, label: LEAGUE_LABELS[id] ?? FOOTBALL_LEAGUES.find((l) => l.id === id)?.label ?? id }))

export function tableTitle(league: string): string {
  return TABLE_LEAGUES.find((l) => l.id === league)?.label ?? LEAGUE_LABELS[league] ?? league
}

export default function TableSheetContent({ initialLeague }: { initialLeague: string }) {
  const { theme } = usePortalTheme()
  const [league, setLeague] = useState(initialLeague)
  const { table, groups, format, loading } = useStandings(league)
  const label = tableTitle(league)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div role="tablist" aria-label="Competición" className="nx-snap-x flex shrink-0 gap-1.5 overflow-x-auto px-4 pb-3">
        {TABLE_LEAGUES.map((l) => (
          <button
            key={l.id}
            type="button"
            role="tab"
            aria-selected={l.id === league}
            onClick={() => setLeague(l.id)}
            className={`inline-flex min-h-[40px] shrink-0 items-center gap-2 rounded-full border px-3 text-xs font-bold transition-colors ${l.id === league ? 'border-transparent bg-[var(--nx-ink)] text-[var(--nx-bg)]' : 'border-[var(--nx-line)] text-[var(--nx-ink-2)] hover:border-[var(--nx-line-strong)]'}`}
          >
            <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full ${l.id === league ? 'bg-white' : ''}`}><LeagueBadge league={l.id} name={l.label} size={18} dark={l.id === league ? false : theme === 'dark'} /></span>
            {l.label}
          </button>
        ))}
      </div>

      <div className="nx-thin-scroll min-h-0 flex-1 overflow-auto border-t border-[var(--nx-line)]">
        {loading ? (
          <div className="space-y-2 p-4">{Array.from({ length: 10 }).map((_, i) => <div key={i} className="nx-skeleton h-9 rounded-lg" />)}</div>
        ) : table.length === 0 ? (
          <p className="px-6 py-14 text-center text-sm text-[var(--nx-muted)]">La tabla de {label} no está disponible ahora (fase de eliminación o entre temporadas).</p>
        ) : (
          <div className="space-y-3 px-2 pb-3 pt-2 sm:px-3">
            <StandingsGroups groups={groups} league={league} stickyHeader />
            {format && (
              <section aria-label="¿Cómo se juega?" className="rounded-xl bg-[var(--nx-surface-2)] p-3">
                <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--nx-muted)]">¿Cómo se juega?</h3>
                <p className="mt-1 text-[13px] leading-relaxed text-[var(--nx-ink-2)]">{format.summary}</p>
                {format.stages.length > 0 && <p className="mt-1.5 text-[12px] text-[var(--nx-muted)]">{format.stages.join(' → ')}</p>}
              </section>
            )}
          </div>
        )}
      </div>

      <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-[var(--nx-line)] px-4 py-2.5 pb-[calc(env(safe-area-inset-bottom,0px)+10px)]">
        <span className="text-[11px] text-[var(--nx-muted)]">Fuente: ESPN</span>
        <Link href={`/deportes/futbol/tabla?league=${league}`} className="inline-flex min-h-[40px] items-center gap-1 text-xs font-semibold text-[var(--nx-accent-text)] hover:underline">Abrir en Deportes <ArrowUpRight size={13} aria-hidden="true" /></Link>
      </footer>
    </div>
  )
}
