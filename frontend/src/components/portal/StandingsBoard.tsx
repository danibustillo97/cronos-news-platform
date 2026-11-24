'use client'

// Tabla de posiciones del home. Una sola <table> semántica:
// - Mobile: columna de equipo fija (sticky) y Pts justo al lado; el resto
//   de columnas se desliza horizontalmente dentro de la tarjeta (la página
//   nunca hace scroll horizontal).
// - Desktop: tabla completa PJ G E P GF GC DG Pts.
// Franjas de zona y leyenda = notas reales de ESPN (noteColor /
// noteDescription); si no vienen, no se dibuja nada.

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronUp, Table2 } from 'lucide-react'
import { useStandings } from '@/lib/useStandings'
import { formatGoalDiff, safeNoteColor, standingsLegend } from '@/lib/standings'
import { LEAGUE_LABELS } from '@/lib/leagueLogos'
import { FOOTBALL_LEAGUES } from '@/lib/sportsLeagues'
import { TeamCrest, LeagueBadge } from './Crest'
import { Skeleton } from './PortalBits'

const HOME_ORDER = ['col.1', 'conmebol.libertadores', 'conmebol.sudamericana', 'uefa.champions', 'esp.1', 'eng.1', 'ita.1', 'ger.1']
export const BOARD_LEAGUES = [
  ...HOME_ORDER.filter((id) => FOOTBALL_LEAGUES.some((l) => l.id === id)),
  ...FOOTBALL_LEAGUES.map((l) => l.id).filter((id) => !HOME_ORDER.includes(id)),
].map((id) => ({ id, label: LEAGUE_LABELS[id] ?? FOOTBALL_LEAGUES.find((l) => l.id === id)?.label ?? id }))

const COLLAPSED_ROWS = 10
/** Si la tabla elegida es corta (p. ej. un grupo de cuadrangulares), se acompaña con otra liga. */
const SHORT_TABLE = 10

function CompanionTable({ league, dark }: { league: string; dark: boolean }) {
  const { table, loading } = useStandings(league)
  const label = BOARD_LEAGUES.find((l) => l.id === league)?.label ?? LEAGUE_LABELS[league] ?? league
  if (loading) return <div className="border-t border-[var(--nx-line)] p-4"><Skeleton className="h-40" /></div>
  if (table.length === 0) return null
  return (
    <section aria-label={`También: ${label}`} className="border-t border-[var(--nx-line)] px-4 py-3">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--nx-muted)]">
          <LeagueBadge league={league} name={label} size={16} dark={dark} /> También: {label}
        </span>
        <Link href={`/deportes/futbol/tabla?league=${league}`} className="inline-flex min-h-[44px] items-center text-xs font-semibold text-[var(--nx-accent-text)] hover:underline">Tabla</Link>
      </div>
      <ol>
        {table.slice(0, 6).map((row) => (
          <li key={`${row.rank}-${row.team}`} className="flex min-h-[38px] items-center gap-2.5 border-t border-[var(--nx-line)] first:border-t-0">
            <span className="w-5 text-center text-xs font-bold tabular-nums text-[var(--nx-muted)]">{row.rank}</span>
            <TeamCrest src={row.logo} name={row.team} size={20} />
            <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-[var(--nx-ink)]">{row.team}</span>
            <span className="w-10 text-right text-[11px] tabular-nums text-[var(--nx-muted)]">{row.played} PJ</span>
            <span className="w-8 text-right text-[13px] font-bold tabular-nums text-[var(--nx-ink)]">{row.points}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}

// Traducción de las notas más comunes de ESPN; lo demás se muestra tal cual.
const NOTE_ES: Record<string, string> = {
  'Champions League': 'Champions League',
  'Champions League qualifiers': 'Previa de Champions',
  'Europa League': 'Europa League',
  'Conference League': 'Conference League',
  'Conference League qualifiers': 'Previa de Conference',
  Relegation: 'Descenso',
  'Relegation playoff': 'Repechaje de descenso',
  'Promotion': 'Ascenso',
  'Copa Libertadores': 'Copa Libertadores',
  'Copa Sudamericana': 'Copa Sudamericana',
  'Next round': 'Siguiente fase',
  'Knockout round playoffs': 'Playoffs',
  'Round of 16': 'Octavos de final',
  'Quarterfinals': 'Cuartos de final',
  'Playoffs': 'Cuadrangulares',
}
const noteLabel = (n: string) => NOTE_ES[n] ?? n

const th = 'px-2 py-2.5 text-[10px] font-black uppercase tracking-[0.12em] text-[var(--nx-muted)]'
const td = 'px-2 py-2 text-right tabular-nums text-[13px] text-[var(--nx-ink-2)]'

export default function StandingsBoard({ dark }: { dark: boolean }) {
  const [league, setLeague] = useState(BOARD_LEAGUES[0]?.id ?? 'col.1')
  const [expanded, setExpanded] = useState(false)
  const { table, leagueName, loading } = useStandings(league)
  const label = BOARD_LEAGUES.find((l) => l.id === league)?.label ?? leagueName
  const rows = expanded ? table : table.slice(0, COLLAPSED_ROWS)
  const legend = standingsLegend(table)
  const tabsId = 'standings-tabs'

  return (
    <div className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-[var(--nx-line)] bg-[var(--nx-surface)]">
      <div className="flex items-center justify-between gap-3 px-4 pt-4">
        <h3 className="flex items-center gap-2 text-base font-black text-[var(--nx-ink)]">
          <Table2 size={16} className="text-[var(--nx-accent-text)]" aria-hidden="true" /> Tablas de posiciones
        </h3>
        <Link href={`/deportes/futbol/tabla?league=${league}`} className="inline-flex min-h-[44px] items-center text-xs font-bold text-[var(--nx-accent-text)] hover:underline">
          Ver en Deportes
        </Link>
      </div>

      <div role="tablist" id={tabsId} aria-label="Competición" className="nx-snap-x flex gap-1.5 overflow-x-auto px-4 pb-3 pt-1">
        {BOARD_LEAGUES.map((l) => {
          const active = l.id === league
          return (
            <button
              key={l.id}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls="standings-panel"
              onClick={() => { setLeague(l.id); setExpanded(false) }}
              className={`inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-full border px-3 text-xs font-bold transition-colors ${
                active
                  ? 'border-transparent bg-[var(--nx-ink)] text-[var(--nx-bg)]'
                  : 'border-[var(--nx-line)] text-[var(--nx-ink-2)] hover:border-[var(--nx-line-strong)]'
              }`}
            >
              <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full ${active ? 'bg-white' : ''}`}>
                <LeagueBadge league={l.id} name={l.label} size={18} dark={active ? false : dark} />
              </span>
              {l.label}
            </button>
          )
        })}
      </div>

      <div id="standings-panel" role="tabpanel" aria-label={`Tabla de ${label}`} className="min-w-0 border-t border-[var(--nx-line)]">
        {loading ? (
          <div className="space-y-2 p-4" aria-busy="true" aria-label="Cargando tabla">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-9 rounded-lg" />)}
          </div>
        ) : table.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
            <LeagueBadge league={league} name={label} size={40} dark={dark} />
            <p className="text-sm font-bold text-[var(--nx-ink)]">La tabla de {label} no está disponible ahora.</p>
            <p className="text-xs text-[var(--nx-muted)]">Puede que la competición esté en fase de eliminación o entre temporadas.</p>
          </div>
        ) : (
          <>
            <div className="nx-thin-scroll overflow-x-auto">
              <table className="w-full min-w-[520px] border-separate border-spacing-0 md:min-w-0">
                <caption className="sr-only">Tabla de posiciones de {label}</caption>
                <thead>
                  <tr className="bg-[var(--nx-surface)]">
                    <th scope="col" className={`${th} sticky left-0 z-10 w-10 bg-[var(--nx-surface)] text-center`}>#</th>
                    <th scope="col" className={`${th} sticky left-10 z-10 min-w-[150px] bg-[var(--nx-surface)] text-left shadow-[1px_0_0_var(--nx-line)] md:shadow-none`}>Equipo</th>
                    <th scope="col" className={`${th} text-right md:hidden`}><abbr title="Puntos" className="no-underline">Pts</abbr></th>
                    <th scope="col" className={`${th} text-right`}><abbr title="Partidos jugados" className="no-underline">PJ</abbr></th>
                    <th scope="col" className={`${th} text-right`}><abbr title="Ganados" className="no-underline">G</abbr></th>
                    <th scope="col" className={`${th} text-right`}><abbr title="Empatados" className="no-underline">E</abbr></th>
                    <th scope="col" className={`${th} text-right`}><abbr title="Perdidos" className="no-underline">P</abbr></th>
                    <th scope="col" className={`${th} text-right`}><abbr title="Goles a favor" className="no-underline">GF</abbr></th>
                    <th scope="col" className={`${th} text-right`}><abbr title="Goles en contra" className="no-underline">GC</abbr></th>
                    <th scope="col" className={`${th} text-right`}><abbr title="Diferencia de gol" className="no-underline">DG</abbr></th>
                    <th scope="col" className={`${th} hidden pr-4 text-right md:table-cell`}><abbr title="Puntos" className="no-underline">Pts</abbr></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const zone = safeNoteColor(row.noteColor)
                    const cellBorder = 'border-t border-[var(--nx-line)]'
                    return (
                      <tr key={`${row.rank}-${row.team}`} className="group" title={row.noteDescription ? noteLabel(row.noteDescription) : undefined}>
                        <td className={`${cellBorder} sticky left-0 z-10 w-10 bg-[var(--nx-surface)] py-2 text-center text-[13px] font-black tabular-nums text-[var(--nx-ink-2)] group-hover:bg-[var(--nx-surface-2)]`}>
                          {zone && <span aria-hidden className="absolute inset-y-1.5 left-0 w-1 rounded-r-full" style={{ background: zone }} />}
                          {row.rank}
                        </td>
                        <th scope="row" className={`${cellBorder} sticky left-10 z-10 bg-[var(--nx-surface)] py-2 pr-2 text-left font-normal shadow-[1px_0_0_var(--nx-line)] group-hover:bg-[var(--nx-surface-2)] md:shadow-none`}>
                          <span className="flex min-w-0 items-center gap-2.5">
                            <TeamCrest src={row.logo} name={row.team} size={24} />
                            <span className="truncate text-[13px] font-bold text-[var(--nx-ink)]">{row.team}</span>
                          </span>
                        </th>
                        <td className={`${cellBorder} ${td} font-black text-[var(--nx-ink)] group-hover:bg-[var(--nx-surface-2)] md:hidden`}>{row.points}</td>
                        <td className={`${cellBorder} ${td} group-hover:bg-[var(--nx-surface-2)]`}>{row.played}</td>
                        <td className={`${cellBorder} ${td} group-hover:bg-[var(--nx-surface-2)]`}>{row.won}</td>
                        <td className={`${cellBorder} ${td} group-hover:bg-[var(--nx-surface-2)]`}>{row.drawn}</td>
                        <td className={`${cellBorder} ${td} group-hover:bg-[var(--nx-surface-2)]`}>{row.lost}</td>
                        <td className={`${cellBorder} ${td} group-hover:bg-[var(--nx-surface-2)]`}>{row.goalsFor ?? '—'}</td>
                        <td className={`${cellBorder} ${td} group-hover:bg-[var(--nx-surface-2)]`}>{row.goalsAgainst ?? '—'}</td>
                        <td className={`${cellBorder} ${td} group-hover:bg-[var(--nx-surface-2)]`}>{formatGoalDiff(row.goalDifference)}</td>
                        <td className={`${cellBorder} ${td} hidden pr-4 font-black text-[var(--nx-ink)] group-hover:bg-[var(--nx-surface-2)] md:table-cell`}>{row.points}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-3 border-t border-[var(--nx-line)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              {legend.length > 0 ? (
                <ul aria-label="Zonas de la tabla" className="flex flex-wrap gap-x-4 gap-y-1.5">
                  {legend.map((entry) => (
                    <li key={`${entry.color}-${entry.label}`} className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--nx-muted)]">
                      <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: entry.color }} />
                      {noteLabel(entry.label)}
                    </li>
                  ))}
                </ul>
              ) : <span className="text-[11px] text-[var(--nx-muted)]">Fuente: ESPN</span>}
              {table.length > COLLAPSED_ROWS && (
                <button
                  type="button"
                  onClick={() => setExpanded((v) => !v)}
                  aria-expanded={expanded}
                  aria-controls="standings-panel"
                  className="inline-flex min-h-[44px] items-center gap-1.5 self-start rounded-full border border-[var(--nx-line)] px-4 text-xs font-bold text-[var(--nx-ink)] hover:border-[var(--nx-line-strong)] sm:self-auto"
                >
                  {expanded ? <>Ver menos <ChevronUp size={14} aria-hidden="true" /></> : <>Tabla completa ({table.length}) <ChevronDown size={14} aria-hidden="true" /></>}
                </button>
              )}
            </div>
            {table.length < SHORT_TABLE && <CompanionTable league={league === 'eng.1' ? 'esp.1' : 'eng.1'} dark={dark} />}
          </>
        )}
      </div>
    </div>
  )
}
