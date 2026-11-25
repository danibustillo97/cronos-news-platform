'use client'

// LA tabla de posiciones de NEXUS: una sola implementación para la
// tarjeta del feed, la ventana flotante, el hub y las páginas de Deportes.
// Mismas columnas (#, escudo + equipo, PJ, G, E, P, DG, PTS; en teléfono
// #, equipo, PJ, DG, PTS), mismo alto de fila, escudo de 22 px, nombres
// recortados igual, números tabulares, franjas de zona reales + leyenda,
// el líder resaltado y el rótulo del grupo cuando la tabla es corta.

import { useState } from 'react'
import { usePortalTheme } from '@/context/ThemeContext'
import { formatGoalDiff, noteLabelEs, safeNoteColor, sortStandings, standingsLegend, tableGroupLabel, type StandingsGroup, type StandingsRowData } from '@/lib/standings'
import { TeamCrest } from '@/components/portal/Crest'

export type StandingsRow = StandingsRowData

const th = 'px-1.5 py-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--nx-muted)] sm:px-2'
const td = 'h-11 border-t border-[var(--nx-line)] px-1.5 text-right text-[13px] tabular-nums text-[var(--nx-ink-2)] sm:px-2'

export default function StandingsTable({
  table, limit, league, showLegend = true, stickyHeader = false, onRowsClick, caption, groupName,
}: {
  table: StandingsRowData[]
  limit?: number
  league?: string | null
  /** Nombre real del grupo ("Cuadrangular A"); si no viene, se nombra la fase cuando la tabla es corta. */
  groupName?: string | null
  showLegend?: boolean
  stickyHeader?: boolean
  /** Toda la tabla es clicable (p. ej. abre la ventana con la tabla completa). */
  onRowsClick?: () => void
  caption?: string
  /** Compatibilidad con llamadas antiguas (ya no cambian nada). */
  isDark?: boolean
  full?: boolean
}) {
  const { theme } = usePortalTheme()
  const sorted = sortStandings(table)
  const rows = limit ? sorted.slice(0, limit) : sorted
  const legend = showLegend ? standingsLegend(rows) : []
  const group = groupName ?? tableGroupLabel(league, sorted.length)
  const stick = stickyHeader ? 'sticky top-0 z-10 bg-[var(--nx-surface)]' : ''
  const headers: [string, string, string][] = [
    ['PJ', 'Partidos jugados', ''],
    ['G', 'Ganados', 'hidden sm:table-cell'],
    ['E', 'Empatados', 'hidden sm:table-cell'],
    ['P', 'Perdidos', 'hidden sm:table-cell'],
    ['DG', 'Diferencia de gol', ''],
  ]

  return (
    <div className="nx-portal w-full min-w-0" data-theme={theme} style={{ background: 'transparent' }}>
      {group && <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--nx-accent-text)]">{group}</p>}
      <table className={`w-full table-fixed border-separate border-spacing-0 ${onRowsClick ? 'cursor-pointer' : ''}`} onClick={onRowsClick}>
        {caption && <caption className="sr-only">{caption}</caption>}
        <colgroup>
          <col className="w-8 sm:w-9" />
          <col />
          <col className="w-9 sm:w-10" />
          <col className="hidden w-9 sm:table-column sm:w-10" />
          <col className="hidden w-9 sm:table-column sm:w-10" />
          <col className="hidden w-9 sm:table-column sm:w-10" />
          <col className="w-10 sm:w-11" />
          <col className="w-11 sm:w-12" />
        </colgroup>
        <thead>
          <tr>
            <th scope="col" className={`${th} ${stick} text-center`}>#</th>
            <th scope="col" className={`${th} ${stick} text-left`}>Equipo</th>
            {headers.map(([a, t, cls]) => <th key={a} scope="col" className={`${th} ${stick} text-right ${cls}`}><abbr title={t} className="no-underline">{a}</abbr></th>)}
            <th scope="col" className={`${th} ${stick} pr-2 text-right sm:pr-3`}><abbr title="Puntos" className="no-underline">PTS</abbr></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const zone = safeNoteColor(r.noteColor)
            const leader = i === 0 && Number(r.points) > 0
            const rowBg = leader ? 'bg-[#FACC15]/[0.07]' : ''
            return (
              <tr key={`${r.rank}-${r.team}`} title={r.noteDescription ? noteLabelEs(r.noteDescription) : undefined} className={rowBg}>
                <td className={`${td} relative !text-center font-bold ${leader ? '!text-[var(--nx-accent-text)]' : ''}`}>
                  {zone && <span aria-hidden className="absolute inset-y-2 left-0 w-1 rounded-r-full" style={{ background: zone }} />}
                  {r.rank}
                </td>
                <th scope="row" className="h-11 border-t border-[var(--nx-line)] pr-1.5 text-left font-normal">
                  <span className="flex min-w-0 items-center gap-2">
                    <TeamCrest src={r.logo} name={r.team} size={22} />
                    <span className={`min-w-0 truncate text-[13px] ${leader ? 'font-bold' : 'font-semibold'} text-[var(--nx-ink)]`}>{r.team}</span>
                  </span>
                </th>
                <td className={td}>{r.played}</td>
                <td className={`${td} hidden sm:table-cell`}>{r.won}</td>
                <td className={`${td} hidden sm:table-cell`}>{r.drawn}</td>
                <td className={`${td} hidden sm:table-cell`}>{r.lost}</td>
                <td className={td}>{formatGoalDiff(r.goalDifference)}</td>
                <td className={`${td} pr-2 font-bold !text-[var(--nx-ink)] sm:pr-3`}>{r.points}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {legend.length > 0 && (
        <ul aria-label="Zonas de la tabla" className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1">
          {legend.map((e) => (
            <li key={`${e.color}-${e.label}`} className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--nx-muted)]">
              <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: e.color }} />{noteLabelEs(e.label)}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * Varios grupos (cuadrangulares, fase de grupos): pestañas con el nombre de
 * cada grupo y la misma tabla. Con un solo grupo es igual a StandingsTable.
 */
export function StandingsGroups({
  groups, league, limit, stickyHeader, onRowsClick, showLegend,
}: {
  groups: StandingsGroup[]
  league?: string | null
  limit?: number
  stickyHeader?: boolean
  onRowsClick?: () => void
  showLegend?: boolean
}) {
  const [active, setActive] = useState(0)
  if (groups.length === 0) return null
  const g = groups[Math.min(active, groups.length - 1)]
  if (groups.length === 1) {
    return <StandingsTable table={g.table} groupName={g.name} league={league} limit={limit} stickyHeader={stickyHeader} onRowsClick={onRowsClick} showLegend={showLegend} />
  }
  return (
    <div className="min-w-0">
      <div role="tablist" aria-label="Grupos" className="nx-snap-x mb-2 flex gap-1.5 overflow-x-auto">
        {groups.map((x, i) => (
          <button key={x.name ?? i} type="button" role="tab" aria-selected={i === active} onClick={(e) => { e.stopPropagation(); setActive(i) }}
            className={`inline-flex min-h-[36px] shrink-0 items-center rounded-full px-3 text-[12px] font-bold transition-colors ${i === active ? 'bg-[var(--nx-ink)] text-[var(--nx-bg)]' : 'border border-[var(--nx-line)] text-[var(--nx-ink-2)]'}`}>
            {x.name ?? `Grupo ${i + 1}`}
          </button>
        ))}
      </div>
      {/* Con pestañas, el nombre del grupo ya está arriba: sin rótulo genérico. */}
      <StandingsTable table={g.table} groupName="" league={null} limit={limit} stickyHeader={stickyHeader} onRowsClick={onRowsClick} showLegend={showLegend} caption={g.name ?? undefined} />
    </div>
  )
}
