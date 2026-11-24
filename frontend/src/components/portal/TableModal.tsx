'use client'

// Tabla de posiciones completa en ventana flotante (misma sensación que el
// modal de noticias): entra rápido, se cierra con X, Esc, tocando el fondo
// o deslizando hacia abajo en el teléfono. Selector de liga adentro,
// escudos, encabezado fijo y franjas de zona si el proveedor las trae.

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ArrowUpRight, X } from 'lucide-react'
import { useStandings } from '@/lib/useStandings'
import { LEAGUE_LABELS } from '@/lib/leagueLogos'
import { FOOTBALL_LEAGUES } from '@/lib/sportsLeagues'
import { formatGoalDiff, safeNoteColor, standingsLegend } from '@/lib/standings'
import { usePortalTheme } from '@/context/ThemeContext'
import { LeagueBadge, TeamCrest } from './Crest'

const ORDER = ['col.1', 'conmebol.libertadores', 'conmebol.sudamericana', 'uefa.champions', 'esp.1', 'eng.1', 'ita.1', 'ger.1']
const LEAGUES = [...ORDER.filter((id) => FOOTBALL_LEAGUES.some((l) => l.id === id)), ...FOOTBALL_LEAGUES.map((l) => l.id).filter((id) => !ORDER.includes(id))]
  .map((id) => ({ id, label: LEAGUE_LABELS[id] ?? FOOTBALL_LEAGUES.find((l) => l.id === id)?.label ?? id }))

const NOTE_ES: Record<string, string> = {
  'Champions League qualifiers': 'Previa de Champions', 'Conference League qualifiers': 'Previa de Conference',
  Relegation: 'Descenso', 'Relegation playoff': 'Repechaje de descenso', Promotion: 'Ascenso', 'Next round': 'Siguiente fase',
  'Knockout round playoffs': 'Playoffs', 'Round of 16': 'Octavos de final', Quarterfinals: 'Cuartos de final', Playoffs: 'Cuadrangulares',
}

const th = 'sticky top-0 z-10 bg-[var(--nx-surface)] px-2 py-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--nx-muted)]'
const td = 'border-t border-[var(--nx-line)] px-2 py-2 text-right text-[13px] tabular-nums text-[var(--nx-ink-2)]'

export default function TableModal({ open, initialLeague, onClose }: { open: boolean; initialLeague: string; onClose: () => void }) {
  const { theme } = usePortalTheme()
  const reduce = useReducedMotion()
  const [league, setLeague] = useState(initialLeague)
  const [drag, setDrag] = useState(0)
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  const startY = useRef<number | null>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const { table, loading } = useStandings(open ? league : null)
  const label = LEAGUES.find((l) => l.id === league)?.label ?? league
  const legend = standingsLegend(table)

  useEffect(() => { if (open) setLeague(initialLeague) }, [open, initialLeague])
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    const t = window.setTimeout(() => closeRef.current?.focus(), 50)
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); window.clearTimeout(t) }
  }, [open, onClose])

  if (!mounted) return null
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="table-modal"
          className="nx-portal fixed inset-0 z-[90] flex items-end justify-center sm:items-center sm:p-6"
          data-theme={theme}
          style={{ background: 'transparent' }}
          role="dialog"
          aria-modal="true"
          aria-label={`Tabla de posiciones: ${label}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0 : 0.15 }}
        >
          <button type="button" aria-label="Cerrar tabla" className="absolute inset-0 bg-black/60" onClick={onClose} />
          <motion.div
            className="relative flex max-h-[92svh] w-full flex-col overflow-hidden rounded-t-[22px] border border-[var(--nx-line)] bg-[var(--nx-surface)] shadow-2xl sm:max-h-[86vh] sm:max-w-3xl sm:rounded-[22px]"
            initial={reduce ? false : { y: 60, opacity: 0.6 }}
            animate={{ y: drag, opacity: 1 }}
            exit={reduce ? undefined : { y: 80, opacity: 0 }}
            transition={drag ? { duration: 0 } : { type: 'spring', damping: 30, stiffness: 340 }}
          >
            <div
              className="flex h-6 shrink-0 cursor-grab touch-none items-center justify-center sm:hidden"
              onPointerDown={(e) => { startY.current = e.clientY; (e.target as HTMLElement).setPointerCapture(e.pointerId) }}
              onPointerMove={(e) => { if (startY.current !== null) setDrag(Math.max(0, e.clientY - startY.current)) }}
              onPointerUp={() => { if (drag > 100) onClose(); setDrag(0); startY.current = null }}
              aria-hidden="true"
            >
              <span className="h-1.5 w-10 rounded-full bg-[var(--nx-line-strong)]" />
            </div>
            <header className="flex shrink-0 items-center justify-between gap-3 px-4 pb-2 pt-1 sm:pt-4">
              <h2 className="flex min-w-0 items-center gap-2.5 text-lg font-bold text-[var(--nx-ink)]">
                <LeagueBadge league={league} name={label} size={26} dark={theme === 'dark'} />
                <span className="truncate">{label}</span>
              </h2>
              <button ref={closeRef} type="button" onClick={onClose} aria-label="Cerrar" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--nx-muted)] hover:bg-[var(--nx-surface-2)]"><X size={19} /></button>
            </header>

            <div role="tablist" aria-label="Competición" className="nx-snap-x flex shrink-0 gap-1.5 overflow-x-auto px-4 pb-3">
              {LEAGUES.map((l) => (
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
                <table className="w-full min-w-[560px] border-separate border-spacing-0">
                  <caption className="sr-only">Tabla de posiciones de {label}</caption>
                  <thead>
                    <tr>
                      <th scope="col" className={`${th} left-0 z-20 w-10 text-center`}>#</th>
                      <th scope="col" className={`${th} left-10 z-20 min-w-[150px] text-left`}>Equipo</th>
                      {[['PJ', 'Partidos jugados'], ['G', 'Ganados'], ['E', 'Empatados'], ['P', 'Perdidos'], ['GF', 'Goles a favor'], ['GC', 'Goles en contra'], ['DG', 'Diferencia de gol'], ['PTS', 'Puntos']].map(([a, t]) => (
                        <th key={a} scope="col" className={`${th} text-right ${a === 'PTS' ? 'pr-4' : ''}`}><abbr title={t} className="no-underline">{a}</abbr></th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {table.map((r) => {
                      const zone = safeNoteColor(r.noteColor)
                      return (
                        <tr key={`${r.rank}-${r.team}`} title={r.noteDescription ? NOTE_ES[r.noteDescription] ?? r.noteDescription : undefined}>
                          <td className="sticky left-0 border-t border-[var(--nx-line)] bg-[var(--nx-surface)] py-2 text-center text-[13px] font-bold tabular-nums text-[var(--nx-ink-2)]">
                            {zone && <span aria-hidden className="absolute inset-y-1.5 left-0 w-1 rounded-r-full" style={{ background: zone }} />}
                            {r.rank}
                          </td>
                          <th scope="row" className="sticky left-10 border-t border-[var(--nx-line)] bg-[var(--nx-surface)] py-2 pr-2 text-left font-normal">
                            <span className="flex min-w-0 items-center gap-2.5"><TeamCrest src={r.logo} name={r.team} size={22} /><span className="truncate text-[13px] font-semibold text-[var(--nx-ink)]">{r.team}</span></span>
                          </th>
                          <td className={td}>{r.played}</td>
                          <td className={td}>{r.won}</td>
                          <td className={td}>{r.drawn}</td>
                          <td className={td}>{r.lost}</td>
                          <td className={td}>{r.goalsFor ?? '—'}</td>
                          <td className={td}>{r.goalsAgainst ?? '—'}</td>
                          <td className={td}>{formatGoalDiff(r.goalDifference)}</td>
                          <td className={`${td} pr-4 font-bold text-[var(--nx-ink)]`}>{r.points}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-[var(--nx-line)] px-4 py-2.5 pb-[calc(env(safe-area-inset-bottom,0px)+10px)]">
              {legend.length > 0 ? (
                <ul className="flex flex-wrap gap-x-3 gap-y-1">
                  {legend.map((e) => (
                    <li key={`${e.color}-${e.label}`} className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--nx-muted)]"><span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: e.color }} />{NOTE_ES[e.label] ?? e.label}</li>
                  ))}
                </ul>
              ) : <span className="text-[11px] text-[var(--nx-muted)]">Fuente: ESPN</span>}
              <Link href={`/deportes/futbol/tabla?league=${league}`} className="inline-flex min-h-[40px] items-center gap-1 text-xs font-semibold text-[var(--nx-accent-text)] hover:underline">Abrir en Deportes <ArrowUpRight size={13} aria-hidden="true" /></Link>
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
