'use client'

// "Se juega ahora": franja fija bajo la cabecera mientras hay partidos en
// vivo. Mini marcadores (punto pulsante, minuto, marcador animado, última
// jugada y barra de posesión); al bajar se pliega en una barra delgada.
// Tocar abre la ventana del partido.

import { useEffect, useRef, useState } from 'react'
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

function useLive(match: Match) {
  const { detail } = useMatchDetail(match.league, match.id, true, 30_000)
  return {
    home: detail?.home.score ?? match.homeScore,
    away: detail?.away.score ?? match.awayScore,
    homeShort: detail?.home.short ?? match.homeTeam,
    awayShort: detail?.away.short ?? match.awayTeam,
    clock: detail ? clockLabel(detail) : localizeStatus(match.statusDetail),
    last: detail ? lastEventLine(detail.events) : null,
    pos: detail ? possession(detail.stats) : null,
  }
}

function MiniScoreboard({ match, compact }: { match: Match; compact: boolean }) {
  const s = useLive(match)
  const label = `En vivo: ${match.homeTeam} ${s.home} - ${s.away} ${match.awayTeam}, ${s.clock}. Abrir partido`
  const onClick = () => openMatch({ league: match.league, id: match.id, preview: match })
  if (compact) {
    return (
      <button type="button" onClick={onClick} aria-label={label} className="flex h-9 shrink-0 items-center gap-2 rounded-full bg-[var(--nx-surface-2)] px-3 text-[13px] font-semibold text-[var(--nx-ink)] active:scale-95">
        <span className="nx-live-dot text-[var(--nx-live)]" style={{ width: 6, height: 6 }} aria-hidden="true" />
        <TeamCrest src={match.homeLogo} name={match.homeTeam} size={16} />
        <span className="tabular-nums"><Num v={s.home} />-<Num v={s.away} /></span>
        <TeamCrest src={match.awayLogo} name={match.awayTeam} size={16} />
        <span className="text-[11px] font-bold tabular-nums text-[var(--nx-live)]">{s.clock}</span>
      </button>
    )
  }
  return (
    <button type="button" onClick={onClick} aria-label={label} className="flex w-[232px] shrink-0 flex-col gap-1.5 rounded-2xl border border-[var(--nx-live)]/35 bg-[var(--nx-surface)] p-3 text-left transition-transform active:scale-[0.98]">
      <span className="flex w-full items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-[var(--nx-live)]"><span className="nx-live-dot" style={{ width: 6, height: 6 }} aria-hidden="true" />En vivo</span>
        <span className="text-[12px] font-bold tabular-nums text-[var(--nx-live)]">{s.clock}</span>
      </span>
      {([[match.homeTeam, match.homeLogo, s.home], [match.awayTeam, match.awayLogo, s.away]] as const).map(([name, logo, score]) => (
        <span key={name} className="flex w-full items-center gap-2">
          <TeamCrest src={logo} name={name} size={20} />
          <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-[var(--nx-ink)]">{name}</span>
          <span className="text-base font-bold tabular-nums text-[var(--nx-ink)]"><Num v={score} /></span>
        </span>
      ))}
      <span className="w-full truncate text-[12px] text-[var(--nx-ink-2)]">{s.last ?? match.leagueName}</span>
      {s.pos && (
        <span className="flex h-1 w-full overflow-hidden rounded-full bg-[var(--nx-surface-3)]" aria-hidden="true">
          <motion.span className="h-full bg-[#FACC15]" animate={{ width: `${s.pos.home}%` }} transition={{ duration: 0.6 }} />
        </span>
      )}
    </button>
  )
}

export default function LiveStrip({ matches }: { matches: Match[] }) {
  const live = matches.filter((m) => m.status === 'live').slice(0, 8)
  const sentinel = useRef<HTMLDivElement>(null)
  const [stuck, setStuck] = useState(false)

  useEffect(() => {
    const el = sentinel.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setStuck(!e.isIntersecting && e.boundingClientRect.top < 0), { threshold: 0, rootMargin: '-120px 0px 0px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [live.length])

  if (live.length === 0) return null
  return (
    <>
      <div ref={sentinel} aria-hidden="true" className="h-px" />
      <section
        aria-label="Partidos en vivo"
        className={`sticky z-30 -mx-4 mb-4 px-4 transition-[padding,background-color] duration-200 sm:mx-0 sm:px-0 ${stuck ? 'border-b border-[var(--nx-line)] bg-[var(--nx-bg)]/95 py-1.5 backdrop-blur-md sm:rounded-b-2xl sm:px-2' : 'py-0'}`}
        style={{ top: 'var(--nx-header-offset, 0px)' }}
      >
        {!stuck && (
          <h3 className="mb-2 flex items-center gap-2 px-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--nx-live)]">
            <span className="nx-live-dot" style={{ width: 6, height: 6 }} aria-hidden="true" /> Se juega ahora
          </h3>
        )}
        <div className="nx-snap-x flex gap-2.5 overflow-x-auto pb-0.5">
          {live.map((m) => <MiniScoreboard key={m.id} match={m} compact={stuck} />)}
        </div>
      </section>
    </>
  )
}
