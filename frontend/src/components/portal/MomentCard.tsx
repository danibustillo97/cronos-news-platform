'use client'

// Momentos de partido dentro del Pulso, compactos: gol (marcador grande
// con el lado que anotó resaltado, goleador, minuto y "Datos de…"),
// final, varios finales de una liga juntos y tarjeta roja. Tocar abre la
// ventana del partido. Lo nuevo entra resaltado.

import { useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { ChevronDown, CircleDot, Flag, Trophy } from 'lucide-react'
import type { Moment, MomentItem } from '@/lib/moments'
import { openMatch } from '@/lib/matchModalBus'
import type { Match } from '@/types/sports'
import { TeamCrest, LeagueBadge } from './Crest'
import { InsightCard } from './MatchModal'
import { ShareGoalButton } from './FanPlay'
import { chipClass } from './ReelFrame'

function preview(m: Moment): Match {
  return {
    id: m.matchId, league: m.league, leagueName: m.leagueName, homeTeam: m.home.name, awayTeam: m.away.name,
    homeLogo: m.home.logo, awayLogo: m.away.logo, homeScore: m.score.home, awayScore: m.score.away,
    status: m.state === 'post' ? 'finished' : 'live', statusDetail: m.minute, date: m.kickoff || null, venue: null,
  }
}
const open = (m: Moment) => openMatch({ league: m.league, id: m.matchId, preview: preview(m) })

const frame = 'overflow-hidden rounded-2xl border bg-[var(--nx-surface)] transition-colors'

function Header({ icon, label, league, leagueName, tone }: { icon: React.ReactNode; label: string; league: string; leagueName: string; tone: 'accent' | 'live' | 'muted' }) {
  return (
    <div className="flex h-12 items-center justify-between gap-2 px-4 sm:px-5">
      <span className={chipClass(tone === 'live' ? 'live' : 'default')}>{icon}{label}</span>
      <span className="flex min-w-0 items-center gap-1.5 text-[11px] font-semibold text-[var(--nx-muted)]"><LeagueBadge league={league} name={leagueName} size={14} /><span className="truncate">{leagueName}</span></span>
    </div>
  )
}

function GoalMoment({ m, fresh }: { m: Moment; fresh: boolean }) {
  const [more, setMore] = useState(false)
  const homeScored = m.team === 'home'
  const awayScored = m.team === 'away'
  const live = m.state === 'in'
  return (
    <article className={`${frame} ${fresh ? 'border-[#FACC15] shadow-[0_0_0_3px_rgba(250,204,21,0.15)]' : 'border-[var(--nx-line)]'}`}>
      <Header icon={<CircleDot size={12} aria-hidden="true" />} label={live ? 'Gol · en vivo' : 'Gol'} league={m.league} leagueName={m.leagueName} tone={live ? 'live' : 'accent'} />
      <button type="button" onClick={() => open(m)} className="block w-full px-4 pb-4 text-left sm:px-5" aria-label={`${m.headline || `Gol de ${m.player?.name ?? ''}`}. Abrir partido`}>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <span className={`flex min-w-0 items-center gap-2 ${homeScored ? '' : 'opacity-60'}`}><TeamCrest src={m.home.logo} name={m.home.name} size={30} /><span className="truncate text-[14px] font-bold text-[var(--nx-ink)]">{m.home.short}</span></span>
          <span className="text-[1.9rem] font-bold leading-none tabular-nums text-[var(--nx-ink)]">
            <span className={homeScored ? 'text-[var(--nx-accent-text)]' : ''}>{m.score.home}</span>
            <span className="mx-1.5 text-[var(--nx-muted)]">-</span>
            <span className={awayScored ? 'text-[var(--nx-accent-text)]' : ''}>{m.score.away}</span>
          </span>
          <span className={`flex min-w-0 items-center justify-end gap-2 ${awayScored ? '' : 'opacity-60'}`}><span className="truncate text-right text-[14px] font-bold text-[var(--nx-ink)]">{m.away.short}</span><TeamCrest src={m.away.logo} name={m.away.name} size={30} /></span>
        </div>
        <p className="mt-2.5 text-[15px] font-bold leading-snug text-[var(--nx-ink)]">
          ⚽ {m.player?.name ?? 'Gol'} <span className="font-semibold tabular-nums text-[var(--nx-accent-text)]">{m.minute}</span>
        </p>
        {m.assist && <p className="text-[12px] text-[var(--nx-muted)]">Asistencia: {m.assist.name}</p>}
      </button>
      <div className="flex justify-end px-2 pb-1 sm:px-3"><ShareGoalButton moment={m} /></div>
      <div className="border-t border-[var(--nx-line)] px-4 pb-3 sm:px-5">
        <button type="button" onClick={() => setMore((v) => !v)} aria-expanded={more} className="flex min-h-[44px] w-full items-center justify-between text-[13px] font-semibold text-[var(--nx-ink-2)]">
          Analizar este gol
          <ChevronDown size={16} className={`transition-transform ${more ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>
        {more && (
          <div className="space-y-3 pb-2">
            {m.impact && (
              <p className="rounded-xl bg-[var(--nx-surface-2)] px-3 py-2.5 text-[13px] font-semibold leading-snug text-[var(--nx-ink)]">
                {m.impact}
              </p>
            )}
            {m.scoreBefore && (
              <div className="flex items-center justify-between gap-3 text-[12px] text-[var(--nx-muted)]">
                <span>Marcador antes: {m.scoreBefore.home}-{m.scoreBefore.away}</span>
                <span className="font-bold text-[var(--nx-ink)]">Después: {m.score.home}-{m.score.away}</span>
              </div>
            )}
            {m.text && (
              <div>
                <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--nx-muted)]">Detalle de la acción</p>
                <p className="text-[13px] leading-relaxed text-[var(--nx-ink-2)]">{m.text}</p>
              </div>
            )}
            {m.assist && <p className="text-[12px] text-[var(--nx-ink-2)]">Pase de gol: <strong>{m.assist.name}</strong></p>}
            {m.player?.id && <InsightCard athleteId={m.player.id} name={m.player.name} inset={false} />}
          </div>
        )}
      </div>
    </article>
  )
}

function FinalRow({ m }: { m: Moment }) {
  const hw = m.score.home > m.score.away
  const aw = m.score.away > m.score.home
  return (
    <button type="button" onClick={() => open(m)} aria-label={`Final: ${m.home.name} ${m.score.home}-${m.score.away} ${m.away.name}. Abrir partido`} className="flex min-h-[48px] w-full items-center gap-2 py-1.5 text-left">
      <span className="flex min-w-0 flex-1 items-center justify-end gap-2"><span className={`truncate text-right text-[14px] ${hw ? 'font-bold text-[var(--nx-ink)]' : 'text-[var(--nx-ink-2)]'}`}>{m.home.short}</span><TeamCrest src={m.home.logo} name={m.home.name} size={22} /></span>
      <span className="w-14 shrink-0 text-center text-[15px] font-bold tabular-nums text-[var(--nx-ink)]">{m.score.home}-{m.score.away}</span>
      <span className="flex min-w-0 flex-1 items-center gap-2"><TeamCrest src={m.away.logo} name={m.away.name} size={22} /><span className={`truncate text-[14px] ${aw ? 'font-bold text-[var(--nx-ink)]' : 'text-[var(--nx-ink-2)]'}`}>{m.away.short}</span></span>
    </button>
  )
}

export default function MomentCard({ item, fresh }: { item: MomentItem; fresh: Set<string> }) {
  const reduce = useReducedMotion()
  const isFresh = item.type === 'results' ? item.moments.some((m) => fresh.has(m.id)) : fresh.has(item.moment.id)
  let body: React.ReactNode
  if (item.type === 'goal') body = <GoalMoment m={item.moment} fresh={isFresh} />
  else if (item.type === 'red') {
    const m = item.moment
    body = (
      <button type="button" onClick={() => open(m)} className={`${frame} flex w-full items-center gap-3 border-[var(--nx-line)] px-4 py-3.5 text-left sm:px-5`} aria-label={`${m.headline}. Abrir partido`}>
        <span aria-hidden className="inline-block h-6 w-4 shrink-0 rounded-[3px] bg-[#DC2626]" />
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-bold leading-snug text-[var(--nx-ink)]">{m.headline || `Roja para ${m.player?.name ?? ''}`}</span>
          <span className="block truncate text-[12px] text-[var(--nx-muted)]">{m.home.short} {m.score.home}-{m.score.away} {m.away.short} · {m.leagueName}</span>
          {m.text && <span className="mt-1 line-clamp-2 block text-[12px] leading-relaxed text-[var(--nx-ink-2)]">{m.text}</span>}
        </span>
      </button>
    )
  } else if (item.type === 'incident') {
    const m = item.moment
    const labels = { yellow: 'Tarjeta amarilla', 'penalty-miss': 'Penalti fallado', var: 'Revisión VAR', sub: 'Cambio' }
    const label = m.eventType && m.eventType in labels ? labels[m.eventType as keyof typeof labels] : 'Incidencia'
    const marker = m.eventType === 'var' ? '📺' : m.eventType === 'penalty-miss' ? '❌' : m.eventType === 'yellow' ? '🟨' : '🔁'
    body = (
      <article className={`${frame} border-[var(--nx-line)]`}>
        <Header icon={<CircleDot size={12} aria-hidden="true" />} label={label} league={m.league} leagueName={m.leagueName} tone="muted" />
        <button type="button" onClick={() => open(m)} className="flex min-h-[58px] w-full items-start gap-3 px-4 pb-4 text-left sm:px-5">
          <span aria-hidden className="text-xl">{marker}</span>
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-bold leading-snug text-[var(--nx-ink)]">{m.headline}</span>
            <span className="mt-1 block text-[12px] text-[var(--nx-muted)]">{m.home.short} {m.score.home}-{m.score.away} {m.away.short} · {m.minute}</span>
            {m.text && <span className="mt-1 line-clamp-3 block text-[12px] leading-relaxed text-[var(--nx-ink-2)]">{m.text}</span>}
            <span className="mt-2 block text-[11px] font-semibold text-[var(--nx-accent-text)]">Abrir contexto del partido →</span>
          </span>
        </button>
      </article>
    )
  } else if (item.type === 'final') {
    const m = item.moment
    body = (
      <article className={`${frame} border-[var(--nx-line)]`}>
        <Header icon={<Flag size={12} aria-hidden="true" />} label="Final" league={m.league} leagueName={m.leagueName} tone="muted" />
        <div className="px-4 pb-3 sm:px-5"><FinalRow m={m} /></div>
      </article>
    )
  } else if (item.type === 'results') {
    body = (
      <article className={`${frame} border-[var(--nx-line)]`}>
        <Header icon={<Trophy size={12} aria-hidden="true" />} label="Resultados de hoy" league={item.league} leagueName={item.leagueName} tone="muted" />
        <div className="divide-y divide-[var(--nx-line)] px-4 pb-3 sm:px-5">{item.moments.map((m) => <FinalRow key={m.id} m={m} />)}</div>
      </article>
    )
  }
  return (
    <motion.div initial={isFresh && !reduce ? { opacity: 0, y: -16 } : false} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', damping: 22, stiffness: 260 }}>
      {body}
    </motion.div>
  )
}
