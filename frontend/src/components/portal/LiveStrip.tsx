'use client'

// Franja "En vivo" arriba del feed cuando hay partidos jugándose: minuto,
// marcador animado, última jugada ("⚽ 10' Gyökeres") y barra de posesión.
// Tocar una tarjeta abre la ventana del partido.

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import type { Match } from '@/types/sports'
import { useMatchDetail } from '@/lib/useMatchCenter'
import { clockLabel, lastEventLine, possession } from '@/lib/matchCenter'
import { openMatch } from '@/lib/matchModalBus'
import { localizeStatus } from '@/lib/matchStatus'
import { TeamCrest } from './Crest'

function Num({ v }: { v: number }) {
  const reduce = useReducedMotion()
  return (
    <span className="relative inline-flex min-w-[0.7em] justify-center overflow-hidden">
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span key={v} initial={reduce ? false : { y: -14, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={reduce ? undefined : { y: 14, opacity: 0 }}>{v}</motion.span>
      </AnimatePresence>
    </span>
  )
}

function LiveCard({ match }: { match: Match }) {
  const { detail } = useMatchDetail(match.league, match.id, true, 30_000)
  const home = detail?.home.score ?? match.homeScore
  const away = detail?.away.score ?? match.awayScore
  const clock = detail ? clockLabel(detail) : localizeStatus(match.statusDetail)
  const last = detail ? lastEventLine(detail.events) : null
  const pos = detail ? possession(detail.stats) : null
  return (
    <button
      type="button"
      onClick={() => openMatch({ league: match.league, id: match.id, preview: match })}
      aria-label={`En vivo: ${match.homeTeam} ${home} - ${away} ${match.awayTeam}, ${clock}. Abrir partido`}
      className="flex w-[264px] shrink-0 flex-col gap-2 rounded-2xl border border-[var(--nx-live)]/40 bg-[var(--nx-surface)] p-3 text-left transition-transform active:scale-[0.98]"
    >
      <span className="flex w-full items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--nx-live)] px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-white">
          <span className="nx-live-dot" style={{ width: 6, height: 6 }} aria-hidden="true" /> En vivo
        </span>
        <span className="text-[12px] font-bold tabular-nums text-[var(--nx-live)]">{clock}</span>
      </span>
      {[[match.homeTeam, match.homeLogo, home], [match.awayTeam, match.awayLogo, away]].map(([name, logo, score]) => (
        <span key={name as string} className="flex w-full items-center gap-2">
          <TeamCrest src={logo as string | null} name={name as string} size={22} />
          <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-[var(--nx-ink)]">{name as string}</span>
          <span className="text-lg font-bold tabular-nums text-[var(--nx-ink)]"><Num v={score as number} /></span>
        </span>
      ))}
      <span className="w-full truncate text-[12px] text-[var(--nx-ink-2)]">{last ?? match.leagueName}</span>
      {pos && (
        <span className="flex h-1.5 w-full overflow-hidden rounded-full bg-[var(--nx-surface-3)]" aria-hidden="true">
          <motion.span className="h-full bg-[#FACC15]" animate={{ width: `${pos.home}%` }} transition={{ duration: 0.6 }} />
        </span>
      )}
    </button>
  )
}

export default function LiveStrip({ matches }: { matches: Match[] }) {
  const live = matches.filter((m) => m.status === 'live').slice(0, 6)
  if (live.length === 0) return null
  return (
    <section aria-label="Partidos en vivo" className="mb-5">
      <h3 className="mb-2 flex items-center gap-2 px-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--nx-live)]">
        <span className="nx-live-dot" style={{ width: 6, height: 6 }} aria-hidden="true" /> Se juega ahora
      </h3>
      <div className="nx-snap-x -mx-4 flex gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {live.map((m) => <LiveCard key={m.id} match={m} />)}
      </div>
    </section>
  )
}
