'use client'

// Ventana flotante del partido (mismo patrón que noticias/tabla): abre al
// instante con lo que ya se sabe del marcador y completa con el detalle.
// Se cierra con X, Esc, el fondo o deslizando hacia abajo en el teléfono.
// En vivo se actualiza cada 15 s, anima el marcador y muestra "¡GOOOL!".
// Bajo cada gol, "datos inteligentes" del goleador a medida que llegan.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ArrowUpRight } from 'lucide-react'
import { useMatchDetail, usePlayerInsights } from '@/lib/useMatchCenter'
import { clockLabel, EVENT_META, isGoalEvent, possession, sortEvents, statBar, type MatchDetail, type MatchEvent, type Side } from '@/lib/matchCenter'
import { interceptToSheet } from '@/lib/sheetBus'
import type { Match } from '@/types/sports'
import { BestPlayer } from './FanPlay'
import { kickoffLabel } from '@/lib/feedComposer'
import { localizeStatus } from '@/lib/matchStatus'
import { usePortalTheme } from '@/context/ThemeContext'
import { LeagueBadge, TeamCrest } from './Crest'
import { PlayerAvatar } from './PlayerBits'
import { FormChips } from './FeedExtras'
import PlacementAd from './PlacementAd'

type Tab = 'resumen' | 'stats' | 'lineups' | 'relato'
const TABS: { id: Tab; label: string }[] = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'stats', label: 'Estadísticas' },
  { id: 'lineups', label: 'Alineaciones' },
  { id: 'relato', label: 'Relato' },
]

// ------------------------------------------------------- datos inteligentes

export function InsightCard({ athleteId, name, inset = true }: { athleteId: string; name: string; inset?: boolean }) {
  const { data, loaded } = usePlayerInsights(athleteId)
  const reduce = useReducedMotion()
  if (!loaded) {
    return (
      <div className={`${inset ? 'ml-11' : ''} mt-2 flex items-center gap-2 rounded-xl border border-dashed border-[var(--nx-line-strong)] px-3 py-2 text-[12px] text-[var(--nx-muted)]`}>
        <span className="nx-live-dot text-[#FACC15]" style={{ width: 6, height: 6 }} aria-hidden="true" /> Buscando datos de {name}…
      </div>
    )
  }
  if (!data) return null
  const maxGoals = Math.max(1, ...data.lastGames.map((g) => g.goals))
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 8, height: 0 }}
      animate={{ opacity: 1, y: 0, height: 'auto' }}
      transition={{ duration: 0.35 }}
      className={`${inset ? 'ml-11' : ''} mt-2 overflow-hidden rounded-2xl border border-[#FACC15]/30 bg-[#FACC15]/[0.06] p-3`}
    >
      <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--nx-accent-text)]">Datos inteligentes</p>
      <div className="flex items-center gap-3">
        <PlayerAvatar src={data.player.image} name={data.player.name} size={44} />
        <div className="min-w-0">
          <Link href={`/jugadores/${encodeURIComponent(data.player.id || athleteId)}`} onClick={interceptToSheet({ kind: 'player', id: data.player.id || athleteId, name: data.player.name })} className="block truncate text-[15px] font-bold text-[var(--nx-ink)] hover:underline">{data.player.name}</Link>
          <p className="truncate text-xs text-[var(--nx-muted)]">{[data.player.position, data.player.team].filter(Boolean).join(' · ')}</p>
        </div>
      </div>
      {data.facts.length > 0 && (
        <ul className="mt-2.5 space-y-1.5">
          {data.facts.map((f, i) => (
            <motion.li key={i} initial={reduce ? false : { opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.12 * i }} className="flex gap-2 text-[13px] leading-snug text-[var(--nx-ink-2)]">
              <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#FACC15]" />{f}
            </motion.li>
          ))}
        </ul>
      )}
      {data.lastGames.length > 0 && (
        <div className="mt-3">
          <p className="mb-1 text-[11px] font-semibold text-[var(--nx-muted)]">Goles en sus últimos {data.lastGames.length} partidos</p>
          <div className="flex h-16 items-end gap-2" role="img" aria-label={data.lastGames.map((g) => `${g.goals} contra ${g.opponent}`).join(', ')}>
            {[...data.lastGames].reverse().map((g, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-[10px] font-bold tabular-nums text-[var(--nx-ink)]">{g.goals}</span>
                <motion.span
                  className={`w-full rounded-t ${g.goals > 0 ? 'bg-[#FACC15]' : 'bg-[var(--nx-surface-3)]'}`}
                  initial={reduce ? false : { height: 0 }}
                  animate={{ height: `${Math.max(4, (g.goals / maxGoals) * 34)}px` }}
                  transition={{ delay: 0.08 * i, duration: 0.4 }}
                />
                <span className="w-full truncate text-center text-[9px] text-[var(--nx-muted)]" title={g.opponent}>{g.opponent.slice(0, 3).toUpperCase()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {data.season && (
        <p className="mt-2 text-[12px] text-[var(--nx-ink-2)]">
          <span className="font-semibold">{data.season.season} · {data.season.competition}:</span> {data.season.goals} goles, {data.season.assists} asistencias en {data.season.starts} titularidades
        </p>
      )}
    </motion.div>
  )
}

// ------------------------------------------------------------------ pestañas

function EventRow({ ev, detail }: { ev: MatchEvent; detail: MatchDetail }) {
  const meta = EVENT_META[ev.type]
  const goal = isGoalEvent(ev.type)
  const team = ev.team === 'home' ? detail.home : ev.team === 'away' ? detail.away : null
  return (
    <li className="py-2">
      <div className={`flex items-start gap-3 rounded-xl px-2 py-1.5 ${goal ? 'bg-[var(--nx-surface-2)]' : ''}`}>
        <span className="w-9 shrink-0 pt-0.5 text-right text-[13px] font-bold tabular-nums text-[var(--nx-accent-text)]">{ev.minute}</span>
        <span className="w-6 shrink-0 text-center text-[17px] leading-6" aria-hidden="true">{ev.type === 'var' ? <span className="rounded bg-[var(--nx-surface-3)] px-1 text-[9px] font-black">VAR</span> : meta.icon}</span>
        <div className="min-w-0 flex-1">
          <p className={`text-[14px] leading-snug ${goal ? 'font-bold text-[var(--nx-ink)]' : 'font-semibold text-[var(--nx-ink)]'}`}>
            {ev.player?.name ?? meta.label}
            {ev.type === 'penalty-goal' && <span className="ml-1 text-xs font-semibold text-[var(--nx-muted)]">(penal)</span>}
            {ev.type === 'own-goal' && <span className="ml-1 text-xs font-semibold text-[var(--nx-muted)]">(autogol)</span>}
          </p>
          <p className="text-[12px] text-[var(--nx-muted)]">
            {meta.label}{ev.assist ? ` · ${ev.type === 'sub' ? 'Sale' : 'Asistencia'}: ${ev.assist.name}` : ''}{!ev.player && ev.text && ev.text !== meta.label ? ` · ${ev.text}` : ''}
          </p>
        </div>
        {team && <TeamCrest src={team.logo} name={team.name} size={20} className="mt-0.5" />}
      </div>
      {goal && ev.type !== 'own-goal' && ev.player?.id && <InsightCard athleteId={ev.player.id} name={ev.player.name} />}
    </li>
  )
}

function MatchBalance({ detail }: { detail: MatchDetail }) {
  const winner = detail.home.score > detail.away.score
    ? detail.home.name
    : detail.away.score > detail.home.score
      ? detail.away.name
      : null
  const metricOrder = ['possessionPct', 'totalShots', 'shotsOnTarget', 'wonCorners', 'saves', 'foulsCommitted', 'yellowCards', 'redCards']
  const metrics = metricOrder
    .map((key) => detail.stats.find((stat) => stat.key === key))
    .filter((stat): stat is MatchDetail['stats'][number] => Boolean(stat))

  if (detail.state !== 'post') return null
  return (
    <section className="mb-4 rounded-2xl border border-[var(--nx-line)] bg-[var(--nx-surface-2)] p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[11px] font-black uppercase tracking-[0.13em] text-[var(--nx-accent-text)]">Balance final</h3>
        <span className="text-[11px] font-semibold text-[var(--nx-muted)]">
          {winner ? `Ganador: ${winner}` : 'Partido empatado'}
        </span>
      </div>
      <p className="mt-1 text-sm font-bold text-[var(--nx-ink)]">
        {detail.home.name} {detail.home.score}-{detail.away.score} {detail.away.name}
      </p>
      {metrics.length > 0 ? (
        <div className="mt-3 space-y-2.5">
          {metrics.map((stat) => {
            const max = Math.max(stat.home, stat.away, 1)
            const fmt = (value: number) => stat.percent ? `${Math.round(value)}%` : String(Math.round(value * 10) / 10)
            return (
              <div key={stat.key}>
                <div className="mb-1 grid grid-cols-[2.5rem_minmax(0,1fr)_2.5rem] items-center gap-2 text-[12px] tabular-nums">
                  <span className={stat.home > stat.away ? 'font-black text-[var(--nx-ink)]' : 'text-[var(--nx-muted)]'}>{fmt(stat.home)}</span>
                  <span className="text-center font-semibold text-[var(--nx-muted)]">{stat.label}</span>
                  <span className={stat.away > stat.home ? 'text-right font-black text-[var(--nx-ink)]' : 'text-right text-[var(--nx-muted)]'}>{fmt(stat.away)}</span>
                </div>
                <div className="grid grid-cols-2 gap-1">
                  <div className="flex h-1.5 justify-end overflow-hidden rounded-l-full bg-[var(--nx-surface-3)]">
                    <span className="h-full rounded-l-full bg-[#FACC15]" style={{ width: `${(stat.home / max) * 100}%` }} />
                  </div>
                  <div className="flex h-1.5 overflow-hidden rounded-r-full bg-[var(--nx-surface-3)]">
                    <span className="h-full rounded-r-full bg-[var(--nx-ink-2)]" style={{ width: `${(stat.away / max) * 100}%` }} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <p className="mt-2 text-xs text-[var(--nx-muted)]">La fuente no publicó estadísticas comparativas para este encuentro.</p>
      )}
      <p className="mt-3 text-[10px] text-[var(--nx-muted)]">Comparación basada en las estadísticas registradas del partido; no representa por sí sola una valoración arbitral o de merecimiento.</p>
    </section>
  )
}

function Resumen({ detail }: { detail: MatchDetail }) {
  const pos = possession(detail.stats)
  const events = sortEvents(detail.events.filter((e) => e.type !== 'period'), detail.state === 'in')
  return (
    <div>
      {detail.state === 'post' && <MatchBalance detail={detail} />}
      {pos && (
        <div className="mb-3">
          <div className="mb-1 flex justify-between text-[11px] font-semibold text-[var(--nx-muted)]"><span>{pos.home}%</span><span>Posesión</span><span>{pos.away}%</span></div>
          <div className="flex h-2 overflow-hidden rounded-full bg-[var(--nx-surface-3)]" role="img" aria-label={`Posesión: ${detail.home.short} ${pos.home}%, ${detail.away.short} ${pos.away}%`}>
            <motion.span className="h-full bg-[#FACC15]" animate={{ width: `${pos.home}%` }} transition={{ duration: 0.6 }} />
            <span className="h-full flex-1 bg-[var(--nx-ink-2)]" />
          </div>
        </div>
      )}
      {events.length === 0 ? (
        <p className="py-8 text-center text-sm text-[var(--nx-muted)]">{detail.state === 'pre' ? 'Las jugadas aparecerán cuando ruede el balón.' : 'Todavía no hay jugadas destacadas.'}</p>
      ) : (
        <ol className="divide-y divide-[var(--nx-line)]">{events.map((ev) => <EventRow key={ev.id} ev={ev} detail={detail} />)}</ol>
      )}
    </div>
  )
}

function Stats({ detail }: { detail: MatchDetail }) {
  if (detail.stats.length === 0) return <p className="py-8 text-center text-sm text-[var(--nx-muted)]">Las estadísticas aparecen cuando empieza el partido.</p>
  return (
    <ul className="divide-y divide-[var(--nx-line)]">
      {detail.stats.map((s) => {
        const b = statBar(s)
        const fmt = (v: number) => (s.percent ? `${Math.round(v)}%` : String(Math.round(v * 10) / 10))
        return (
          <li key={s.key || s.label} className="py-2.5">
            <p className="mb-1.5 text-center text-xs font-semibold text-[var(--nx-muted)]">{s.label}</p>
            <div className="grid grid-cols-[2.75rem_minmax(0,1fr)_minmax(0,1fr)_2.75rem] items-center gap-2">
              <span className={`text-right text-[14px] tabular-nums ${b.leader === 'home' ? 'font-bold text-[var(--nx-ink)]' : 'text-[var(--nx-muted)]'}`}>{fmt(s.home)}</span>
              <span className="flex h-2 justify-end overflow-hidden rounded-l-full bg-[var(--nx-surface-2)]"><motion.span className={`h-full rounded-l-full ${b.leader === 'home' ? 'bg-[#FACC15]' : 'bg-[var(--nx-surface-3)]'}`} animate={{ width: `${b.homePct}%` }} /></span>
              <span className="flex h-2 overflow-hidden rounded-r-full bg-[var(--nx-surface-2)]"><motion.span className={`h-full rounded-r-full ${b.leader === 'away' ? 'bg-[var(--nx-ink)]' : 'bg-[var(--nx-surface-3)]'}`} animate={{ width: `${b.awayPct}%` }} /></span>
              <span className={`text-[14px] tabular-nums ${b.leader === 'away' ? 'font-bold text-[var(--nx-ink)]' : 'text-[var(--nx-muted)]'}`}>{fmt(s.away)}</span>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function Lineups({ detail }: { detail: MatchDetail }) {
  const { home, away } = detail.lineups
  if (home.length === 0 && away.length === 0) return <p className="py-8 text-center text-sm text-[var(--nx-muted)]">Las alineaciones se publican cerca del inicio del partido.</p>
  const col = (t: typeof detail.home, list: typeof home) => (
    <div className="min-w-0">
      <p className="mb-2 flex items-center gap-2 text-[13px] font-bold text-[var(--nx-ink)]"><TeamCrest src={t.logo} name={t.name} size={20} /><span className="truncate">{t.short}</span></p>
      {[['Titulares', list.filter((p) => p.starter)], ['Suplentes', list.filter((p) => !p.starter)]].map(([label, ps]) => (ps as typeof home).length > 0 && (
        <div key={label as string} className="mb-3">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--nx-muted)]">{label as string}</p>
          <ul className="space-y-1">
            {(ps as typeof home).map((p) => (
              <li key={p.id || p.name} className="flex items-center gap-2 text-[13px]">
                <span className="w-6 shrink-0 text-right text-[12px] font-bold tabular-nums text-[var(--nx-muted)]">{p.jersey}</span>
                <span className="min-w-0 flex-1 truncate text-[var(--nx-ink)]">{p.name}</span>
                {p.position && <span className="shrink-0 text-[10px] font-semibold text-[var(--nx-muted)]">{p.position}</span>}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
  return <div className="grid grid-cols-2 gap-4">{col(detail.home, home)}{col(detail.away, away)}</div>
}

function Relato({ detail }: { detail: MatchDetail }) {
  if (detail.commentary.length === 0) return <p className="py-8 text-center text-sm text-[var(--nx-muted)]">El relato aparece durante el partido.</p>
  return (
    <ol className="space-y-3">
      {detail.commentary.map((c, i) => (
        <li key={i} className="flex gap-3">
          <span className="w-10 shrink-0 text-right text-[13px] font-bold tabular-nums text-[var(--nx-accent-text)]">{c.minute}</span>
          <p className="text-[14px] leading-relaxed text-[var(--nx-ink-2)]">{c.text}</p>
        </li>
      ))}
    </ol>
  )
}

// -------------------------------------------------------------------- modal

function Score({ value }: { value: number }) {
  const reduce = useReducedMotion()
  return (
    <span className="relative inline-flex min-w-[1ch] justify-center overflow-hidden">
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span key={value} initial={reduce ? false : { y: -24, opacity: 0, scale: 1.4 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={reduce ? undefined : { y: 24, opacity: 0 }} transition={{ type: 'spring', damping: 14, stiffness: 260 }}>
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}

function GoalBanner({ side, detail, at }: { side: Side; detail: MatchDetail; at: number }) {
  const [show, setShow] = useState(true)
  useEffect(() => { setShow(true); const t = window.setTimeout(() => setShow(false), 2800); return () => window.clearTimeout(t) }, [at])
  const team = side === 'home' ? detail.home : detail.away
  return (
    <AnimatePresence>
      {show && (
        <motion.div key={at} role="status" aria-live="assertive" className="pointer-events-none absolute inset-x-0 top-0 z-30 flex justify-center pt-3"
          initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, y: -10 }} transition={{ type: 'spring', damping: 12, stiffness: 220 }}>
          <span className="flex items-center gap-3 rounded-full bg-[#FACC15] px-5 py-2.5 text-black shadow-2xl">
            <TeamCrest src={team.logo} name={team.name} size={26} />
            <span className="text-xl font-black italic tracking-tight">¡GOOOL!</span>
            <span className="text-sm font-bold">{team.short}</span>
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/** Contenido de la ventana del partido (la carcasa, el apilado y el cierre los pone SheetStack). */
export function MatchSheetContent({ league: reqLeague, id, preview }: { league: string; id: string; preview?: Match }) {
  const { theme } = usePortalTheme()
  const { detail, status, goal } = useMatchDetail(reqLeague, id, true)
  const [tab, setTab] = useState<Tab>('resumen')

  // Lo que ya se sabe (marcador) mientras llega el detalle.
  const p = preview
  const live = detail ? detail.state === 'in' : p?.status === 'live'
  const home = detail?.home ?? (p ? { name: p.homeTeam, short: p.homeTeam, logo: p.homeLogo, score: p.homeScore, form: '' } : null)
  const away = detail?.away ?? (p ? { name: p.awayTeam, short: p.awayTeam, logo: p.awayLogo, score: p.awayScore, form: '' } : null)
  const scheduled = detail ? detail.state === 'pre' : p?.status === 'scheduled'
  const clock = detail ? clockLabel(detail) : p ? (p.status === 'live' ? localizeStatus(p.statusDetail) : p.status === 'finished' ? 'Final' : kickoffLabel(p.date)) : ''
  const leagueName = detail?.leagueName ?? p?.leagueName ?? ''
  const league = detail?.league ?? reqLeague

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {goal && detail && <GoalBanner side={goal.side} detail={detail} at={goal.at} />}
      <header className={`relative shrink-0 px-4 pb-3 ${live ? 'bg-[radial-gradient(120%_100%_at_50%_0%,rgba(220,38,38,0.18),transparent_70%)]' : ''}`}>
        <span className="flex min-w-0 items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--nx-muted)]">
          {league && <LeagueBadge league={league} name={leagueName} size={16} dark={theme === 'dark'} />}<span className="truncate">{leagueName}</span>
        </span>
        {home && away ? (
          <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-center">
            <div className="flex flex-col items-center gap-1.5"><TeamCrest src={home.logo} name={home.name} size={52} /><span className="text-[14px] font-bold leading-tight text-[var(--nx-ink)]">{home.name}</span>{home.form && <FormChips form={home.form} />}</div>
            <div className="flex flex-col items-center px-2">
              {scheduled ? <span className="text-2xl font-bold text-[var(--nx-muted)]">vs</span> : (
                <span className="flex items-center text-[2.6rem] font-bold leading-none tabular-nums text-[var(--nx-ink)]"><Score value={home.score} /><span className="mx-2 text-[var(--nx-muted)]">-</span><Score value={away.score} /></span>
              )}
              <span className={`mt-1.5 inline-flex items-center gap-1.5 text-[13px] font-bold ${live ? 'text-[var(--nx-live)]' : 'text-[var(--nx-muted)]'}`}>
                {live && <span className="nx-live-dot" style={{ width: 7, height: 7 }} aria-hidden="true" />}{live ? `En vivo · ${clock}` : clock}
              </span>
            </div>
            <div className="flex flex-col items-center gap-1.5"><TeamCrest src={away.logo} name={away.name} size={52} /><span className="text-[14px] font-bold leading-tight text-[var(--nx-ink)]">{away.name}</span>{away.form && <FormChips form={away.form} />}</div>
          </div>
        ) : <div className="nx-skeleton mt-2 h-24 rounded-xl" />}
        {detail?.venue && <p className="mt-2 text-center text-[11px] text-[var(--nx-muted)]">{detail.venue}</p>}
      </header>

      <div role="tablist" aria-label="Secciones del partido" className="flex shrink-0 border-b border-[var(--nx-line)] px-2">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
            className={`relative min-h-[44px] flex-1 px-2 text-[13px] font-semibold ${tab === t.id ? 'text-[var(--nx-ink)]' : 'text-[var(--nx-muted)]'}`}>
            {t.label}
            {tab === t.id && <motion.span layoutId={`match-tab-${id}`} className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-[#FACC15]" />}
          </button>
        ))}
      </div>

      <div className="nx-thin-scroll min-h-0 flex-1 overflow-y-auto px-4 py-3 pb-[calc(env(safe-area-inset-bottom,0px)+16px)]" role="tabpanel">
        {!detail ? (
          status === 'error' ? (
            <div className="py-10 text-center">
              <p className="text-sm text-[var(--nx-muted)]">No pudimos cargar el detalle del partido.</p>
              <Link href={`/deportes/futbol?league=${encodeURIComponent(league)}`} className="mt-3 inline-flex min-h-[44px] items-center gap-1 text-sm font-semibold text-[var(--nx-accent-text)]">Ver en Deportes <ArrowUpRight size={14} aria-hidden="true" /></Link>
            </div>
          ) : <div className="space-y-2">{[0, 1, 2, 3].map((i) => <div key={i} className="nx-skeleton h-12 rounded-xl" />)}</div>
        ) : (
          <>
            {tab === 'resumen' ? <Resumen detail={detail} />
              : tab === 'stats' ? <Stats detail={detail} />
              : tab === 'lineups' ? <Lineups detail={detail} />
              : <Relato detail={detail} />}
            {detail.state === 'post' && <BestPlayer detail={detail} />}
          </>
        )}
        <PlacementAd placement="match-modal" className="mt-6" />
      </div>
    </div>
  )
}
