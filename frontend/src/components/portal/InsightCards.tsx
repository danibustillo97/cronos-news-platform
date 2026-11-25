'use client'

// "Motor inteligente": antesalas (lo que viene) e impactos (cómo queda la
// tabla). Tarjeta compacta en el Pulso y ventana flotante con todo el
// contexto. Los datos se muestran tal cual llegan del backend.

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ArrowUpRight, Sparkles, X } from 'lucide-react'
import { kickoffShort, type Insight } from '@/lib/insightsFeed'
import { openMatch } from '@/lib/matchModalBus'
import { normalizePolls, type Poll } from '@/lib/polls'
import { usePortalTheme } from '@/context/ThemeContext'
import type { Match } from '@/types/sports'
import { LeagueBadge, TeamCrest } from './Crest'
import { FormChips } from './FeedExtras'
import { PollBlock } from './PollCard'

export function MarketBar({ market, homeLabel, awayLabel, caption = 'Probabilidad según el mercado' }: { market: { home: number; draw: number; away: number }; homeLabel: string; awayLabel: string; caption?: string }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-[11px] font-semibold tabular-nums text-[var(--nx-ink-2)]">
        <span>{homeLabel} {market.home}%</span><span>Empate {market.draw}%</span><span>{awayLabel} {market.away}%</span>
      </div>
      <div className="flex h-2 overflow-hidden rounded-full bg-[var(--nx-surface-3)]" role="img" aria-label={`${caption}: ${homeLabel} ${market.home}%, empate ${market.draw}%, ${awayLabel} ${market.away}%`}>
        <span className="h-full bg-[#FACC15]" style={{ width: `${market.home}%` }} />
        <span className="h-full bg-[var(--nx-muted)]" style={{ width: `${market.draw}%` }} />
        <span className="h-full bg-[var(--nx-ink-2)]" style={{ width: `${market.away}%` }} />
      </div>
      <p className="mt-1 text-[10px] text-[var(--nx-muted)]">{caption}</p>
    </div>
  )
}

function preview(i: Insight): Match {
  return {
    id: i.matchId, league: i.league, leagueName: i.leagueName, homeTeam: i.home.name, awayTeam: i.away.name, homeLogo: i.home.logo, awayLogo: i.away.logo,
    homeScore: i.home.score ?? 0, awayScore: i.away.score ?? 0, status: i.state === 'post' ? 'finished' : i.state === 'in' ? 'live' : 'scheduled', statusDetail: '', date: i.kickoff || null, venue: null,
  }
}

function TeamLine({ t, align }: { t: Insight['home']; align: 'left' | 'right' }) {
  return (
    <div className={`flex min-w-0 flex-1 flex-col gap-1 ${align === 'right' ? 'items-end text-right' : ''}`}>
      <span className={`flex min-w-0 items-center gap-2 ${align === 'right' ? 'flex-row-reverse' : ''}`}>
        <TeamCrest src={t.logo} name={t.name} size={30} />
        <span className="truncate text-[15px] font-bold text-[var(--nx-ink)]">{t.short}</span>
      </span>
      <span className="text-[11px] text-[var(--nx-muted)]">{t.position ? `${t.position}.º · ${t.points ?? 0} pts` : ''}</span>
      {t.form && <FormChips form={t.form} />}
    </div>
  )
}

// ------------------------------------------------------------------- ventana

function InsightModal({ insight, onClose }: { insight: Insight; onClose: () => void }) {
  const { theme } = usePortalTheme()
  const reduce = useReducedMotion()
  const [poll, setPoll] = useState<Poll | null>(null)
  const [drag, setDrag] = useState(0)
  const startY = useRef<number | null>(null)
  const pollId = `match:${insight.league}:${insight.matchId}`

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey) }
  }, [onClose])
  // Encuesta automática "¿Quién gana?" del partido, si existe.
  useEffect(() => {
    let cancelled = false
    fetch(`/api/polls?newsId=${encodeURIComponent(pollId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: unknown) => { if (!cancelled) setPoll(normalizePolls(d).find((p) => p.newsId === pollId) ?? null) })
      .catch(() => { /* sin encuesta */ })
    return () => { cancelled = true }
  }, [pollId])

  const { home, away } = insight
  return (
    <motion.div className="nx-portal fixed inset-0 z-[95] flex items-end justify-center sm:items-center sm:p-6" data-theme={theme} style={{ background: 'transparent' }}
      role="dialog" aria-modal="true" aria-label={insight.headline} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduce ? 0 : 0.15 }}>
      <button type="button" aria-label="Cerrar" className="absolute inset-0 bg-black/60" onClick={onClose} />
      <motion.div className="relative flex max-h-[92svh] w-full flex-col overflow-hidden rounded-t-[22px] border border-[var(--nx-line)] bg-[var(--nx-surface)] shadow-2xl sm:max-h-[88vh] sm:max-w-xl sm:rounded-[22px]"
        initial={reduce ? false : { y: 60, opacity: 0.6 }} animate={{ y: drag, opacity: 1 }} exit={reduce ? undefined : { y: 80, opacity: 0 }} transition={drag ? { duration: 0 } : { type: 'spring', damping: 30, stiffness: 340 }}>
        <div className="flex h-6 shrink-0 cursor-grab touch-none items-center justify-center sm:hidden" aria-hidden="true"
          onPointerDown={(e) => { startY.current = e.clientY; (e.target as HTMLElement).setPointerCapture(e.pointerId) }}
          onPointerMove={(e) => { if (startY.current !== null) setDrag(Math.max(0, e.clientY - startY.current)) }}
          onPointerUp={() => { if (drag > 100) onClose(); setDrag(0); startY.current = null }}>
          <span className="h-1.5 w-10 rounded-full bg-[var(--nx-line-strong)]" />
        </div>
        <header className="flex shrink-0 items-start justify-between gap-3 px-4 pb-2 pt-1 sm:pt-4">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--nx-accent-text)]"><Sparkles size={12} aria-hidden="true" /> {insight.kind === 'preview' ? 'Antesala' : 'Impacto'} · {insight.leagueName}</p>
            <h2 className="mt-1 text-lg font-bold leading-snug text-[var(--nx-ink)]">{insight.headline}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--nx-muted)] hover:bg-[var(--nx-surface-2)]"><X size={19} /></button>
        </header>
        <div className="nx-thin-scroll min-h-0 flex-1 space-y-5 overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom,0px)+16px)] pt-2">
          <div className="flex items-start gap-3">
            <TeamLine t={home} align="left" />
            <span className="pt-1.5 text-center text-[12px] font-bold text-[var(--nx-muted)]">{insight.state === 'pre' ? kickoffShort(insight.kickoff) : `${home.score ?? 0} - ${away.score ?? 0}`}</span>
            <TeamLine t={away} align="right" />
          </div>
          {insight.market && <MarketBar market={insight.market} homeLabel={home.short} awayLabel={away.short} />}
          {insight.facts.length > 0 && (
            <section aria-label="Datos">
              <h3 className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--nx-muted)]">Los datos</h3>
              <ul className="space-y-2">{insight.facts.map((f, i) => <li key={i} className="flex gap-2 text-[14px] leading-snug text-[var(--nx-ink)]"><span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#FACC15]" />{f}</li>)}</ul>
            </section>
          )}
          {insight.standings.length > 0 && (
            <section aria-label="Así están en la tabla">
              <h3 className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--nx-muted)]">Así están en la tabla</h3>
              <table className="w-full table-fixed border-separate border-spacing-0 text-[13px]">
                <thead><tr className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--nx-muted)]"><th className="w-9 pb-1.5 text-center">#</th><th className="pb-1.5 text-left">Equipo</th><th className="w-9 pb-1.5 text-right">PJ</th><th className="w-10 pb-1.5 text-right">DG</th><th className="w-11 pb-1.5 pr-2 text-right">PTS</th></tr></thead>
                <tbody>
                  {insight.standings.map((r) => (
                    <tr key={`${r.pos}-${r.team}`} className={r.highlight ? 'bg-[#FACC15]/[0.1]' : ''}>
                      <td className={`h-10 border-t border-[var(--nx-line)] text-center font-bold tabular-nums ${r.highlight ? 'text-[var(--nx-accent-text)]' : 'text-[var(--nx-muted)]'}`}>{r.pos}</td>
                      <td className={`truncate border-t border-[var(--nx-line)] ${r.highlight ? 'font-bold text-[var(--nx-ink)]' : 'text-[var(--nx-ink-2)]'}`}>{r.team}</td>
                      <td className="border-t border-[var(--nx-line)] text-right tabular-nums text-[var(--nx-ink-2)]">{r.played}</td>
                      <td className="border-t border-[var(--nx-line)] text-right tabular-nums text-[var(--nx-ink-2)]">{r.gd > 0 ? `+${r.gd}` : r.gd}</td>
                      <td className="border-t border-[var(--nx-line)] pr-2 text-right font-bold tabular-nums text-[var(--nx-ink)]">{r.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
          {insight.format && (
            <section aria-label="¿Cómo se juega?" className="rounded-xl bg-[var(--nx-surface-2)] p-3">
              <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--nx-muted)]">¿Cómo se juega?</h3>
              <p className="mt-1 text-[13px] leading-relaxed text-[var(--nx-ink-2)]">{insight.format}</p>
            </section>
          )}
          {insight.h2h.length > 0 && (
            <section aria-label="Historial entre ambos">
              <h3 className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--nx-muted)]">Historial reciente ({home.short})</h3>
              <ul className="divide-y divide-[var(--nx-line)]">
                {insight.h2h.map((h, i) => (
                  <li key={i} className="flex min-h-[40px] items-center gap-3 text-[13px]">
                    <FormChips form={h.result} />
                    <span className="font-bold tabular-nums text-[var(--nx-ink)]">{h.score}</span>
                    <span className="min-w-0 flex-1 truncate text-[var(--nx-muted)]">{h.competition}</span>
                    <span className="text-[12px] text-[var(--nx-muted)]">{h.date.slice(0, 10)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {poll && (
            <section aria-label="¿Quién gana?">
              <h3 className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--nx-muted)]">¿Quién gana?</h3>
              <PollBlock poll={poll} compact />
            </section>
          )}
          <button type="button" onClick={() => { onClose(); window.setTimeout(() => openMatch({ league: insight.league, id: insight.matchId, preview: preview(insight) }), 160) }}
            className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full bg-[var(--nx-ink)] text-sm font-bold text-[var(--nx-bg)]">
            Ver partido <ArrowUpRight size={16} aria-hidden="true" />
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// -------------------------------------------------------------------- tarjeta

export function InsightCard({ insight }: { insight: Insight }) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  const close = useCallback(() => setOpen(false), [])
  const { home, away } = insight
  return (
    <>
      <article className="overflow-hidden rounded-[20px] border border-[var(--nx-line)] bg-[var(--nx-surface)]">
        <button type="button" onClick={() => setOpen(true)} className="block w-full text-left" aria-label={`${insight.headline}. Ver todos los datos`}>
          <div className="flex h-11 items-center justify-between gap-2 px-4">
            <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-[#FACC15] px-2.5 text-[11px] font-bold uppercase tracking-[0.1em] text-black"><Sparkles size={12} aria-hidden="true" />{insight.kind === 'preview' ? 'Antesala' : 'Así queda la tabla'}</span>
            <span className="flex min-w-0 items-center gap-1.5 text-[11px] font-semibold text-[var(--nx-muted)]"><LeagueBadge league={insight.league} name={insight.leagueName} size={14} /><span className="truncate">{insight.leagueName}</span></span>
          </div>
          <div className="space-y-3 px-4 pb-4">
            <div className="flex items-start gap-3">
              <TeamLine t={home} align="left" />
              <span className="pt-1.5 text-center text-[12px] font-bold text-[var(--nx-accent-text)]">{insight.state === 'pre' ? kickoffShort(insight.kickoff) : `${home.score ?? 0} - ${away.score ?? 0}`}</span>
              <TeamLine t={away} align="right" />
            </div>
            {insight.facts.length > 0 && (
              <ul className="space-y-1.5">
                {insight.facts.slice(0, 3).map((f, i) => <li key={i} className="flex gap-2 text-[14px] leading-snug text-[var(--nx-ink-2)]"><span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#FACC15]" />{f}</li>)}
              </ul>
            )}
            {insight.market && <MarketBar market={insight.market} homeLabel={home.short} awayLabel={away.short} />}
            <span className="inline-flex min-h-[40px] items-center gap-1 text-[13px] font-semibold text-[var(--nx-accent-text)]">Ver todos los datos <ArrowUpRight size={14} aria-hidden="true" /></span>
          </div>
        </button>
      </article>
      {mounted && createPortal(<AnimatePresence>{open && <InsightModal key="insight" insight={insight} onClose={close} />}</AnimatePresence>, document.body)}
    </>
  )
}
