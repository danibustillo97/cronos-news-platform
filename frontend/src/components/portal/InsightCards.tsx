'use client'

// "Motor inteligente": antesalas con vida. Cada tarjeta cambia según la
// historia del partido (duelo de líderes, David vs Goliat…), muestra al
// favorito y un jugador a seguir, y su fase se calcula cada minuto con la
// hora de inicio y el marcador real: "en 35 min" → "EMPIEZA YA" → en vivo
// (marcador y minuto) → "Final · así queda". Nunca una previa de un partido
// que ya empezó. Tocar abre la ventana con todo el contexto (apilada).
// Los datos se muestran tal cual llegan del backend.

import { useEffect, useState } from 'react'
import { ArrowUpRight, Sparkles, Star } from 'lucide-react'
import { kickoffShort, STORY_STYLE, type Insight } from '@/lib/insightsFeed'
import { derivePhase, type PhaseInfo } from '@/lib/matchPhase'
import { openMatch } from '@/lib/matchModalBus'
import { openSheet } from '@/lib/sheetBus'
import { normalizePolls, type Poll } from '@/lib/polls'
import type { Match } from '@/types/sports'
import { LeagueBadge, TeamCrest } from './Crest'
import { FormChips } from './FeedExtras'
import { PollBlock } from './PollCard'
import { PlayerAvatar } from './PlayerBits'
import { chipClass } from './ReelFrame'
import { PredictScore } from './FanPlay'
import { useNow } from './useNow'

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

function preview(i: Insight, live?: Match | null): Match {
  return live ?? {
    id: i.matchId, league: i.league, leagueName: i.leagueName, homeTeam: i.home.name, awayTeam: i.away.name, homeLogo: i.home.logo, awayLogo: i.away.logo,
    homeScore: i.home.score ?? 0, awayScore: i.away.score ?? 0, status: i.state === 'post' ? 'finished' : i.state === 'in' ? 'live' : 'scheduled', statusDetail: '', date: i.kickoff || null, venue: null,
  }
}

function TeamLine({ t, align, fav }: { t: Insight['home']; align: 'left' | 'right'; fav: boolean }) {
  return (
    <div className={`flex min-w-0 flex-1 flex-col gap-1 ${align === 'right' ? 'items-end text-right' : ''}`}>
      <span className={`flex min-w-0 items-center gap-2 ${align === 'right' ? 'flex-row-reverse' : ''}`}>
        <TeamCrest src={t.logo} name={t.name} size={30} />
        <span className="truncate text-[15px] font-bold text-[var(--nx-ink)]">{t.short}</span>
        {fav && <Star size={13} className="shrink-0 fill-[#FACC15] text-[#FACC15]" aria-label="Favorito" />}
      </span>
      <span className="text-[11px] text-[var(--nx-muted)]">{t.position ? `${t.position}.º · ${t.points ?? 0} pts` : ''}</span>
      {t.form && <FormChips form={t.form} />}
    </div>
  )
}

/** Centro de la tarjeta: hora / cuenta regresiva / marcador en vivo / final. */
function PhaseCenter({ info, kickoff }: { info: PhaseInfo; kickoff: string }) {
  if (info.phase === 'en-vivo') {
    return (
      <span className="flex flex-col items-center pt-0.5">
        {info.score && <span className="text-[22px] font-bold leading-none tabular-nums text-[var(--nx-ink)]">{info.score.home}-{info.score.away}</span>}
        <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-[var(--nx-live)]"><span className="nx-live-dot" style={{ width: 6, height: 6 }} aria-hidden="true" />{info.minute ?? 'En vivo'}</span>
      </span>
    )
  }
  if (info.phase === 'final') {
    return (
      <span className="flex flex-col items-center pt-0.5">
        {info.score && <span className="text-[22px] font-bold leading-none tabular-nums text-[var(--nx-ink)]">{info.score.home}-{info.score.away}</span>}
        <span className="mt-1 text-[11px] font-bold text-[var(--nx-muted)]">Final</span>
      </span>
    )
  }
  if (info.phase === 'empieza') return <span className="pt-1.5 text-[12px] font-black uppercase tracking-[0.06em] text-[var(--nx-live)]">{info.label}</span>
  if (info.phase === 'pronto') return <span className="pt-1.5 text-[13px] font-bold text-[var(--nx-accent-text)]">{info.label}</span>
  return <span className="pt-1.5 text-center text-[12px] font-bold text-[var(--nx-accent-text)]">{kickoffShort(kickoff)}</span>
}

function KeyPlayers({ insight }: { insight: Insight }) {
  if (insight.keyPlayers.length === 0) return null
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--nx-muted)]">Jugador a tener en cuenta</p>
      <ul className="flex flex-col gap-1.5">
        {insight.keyPlayers.slice(0, 2).map((k) => {
          const team = k.team === 'away' ? insight.away : insight.home
          return (
            <li key={k.id || k.name}>
              <button type="button" onClick={(e) => { e.stopPropagation(); if (k.id) openSheet({ kind: 'player', id: k.id, name: k.name }) }} disabled={!k.id}
                className="flex min-h-[48px] w-full items-center gap-3 rounded-xl bg-[var(--nx-surface-2)] px-2.5 py-1.5 text-left transition-transform active:scale-[0.99]">
                <PlayerAvatar src={k.headshot} name={k.name} size={36} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-bold text-[var(--nx-ink)]">{k.name}</span>
                  <span className="block truncate text-[12px] text-[var(--nx-muted)]">{k.stat || team.short}</span>
                </span>
                <TeamCrest src={team.logo} name={team.name} size={18} />
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// ------------------------------------------------------------------- ventana

export function InsightSheetContent({ insight, live }: { insight: Insight; live?: Match | null }) {
  const [poll, setPoll] = useState<Poll | null>(null)
  const now = useNow(60_000)
  const info = derivePhase(insight.kickoff, now, live ?? null, insight.phase)
  const pollId = `match:${insight.league}:${insight.matchId}`

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
  const story = insight.story ? STORY_STYLE[insight.story] : null
  return (
    <div className="nx-thin-scroll min-h-0 flex-1 space-y-5 overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom,0px)+16px)] pt-1">
      <div>
        <p className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--nx-accent-text)]">
          <Sparkles size={12} aria-hidden="true" /> {insight.kind === 'preview' ? 'Antesala' : 'Impacto'} · {insight.leagueName}
          {story && <span className="rounded-full px-2 py-0.5 text-[10px]" style={{ color: story.accent, background: `${story.accent}22` }}>{story.label}</span>}
        </p>
        <h2 className="mt-1 text-lg font-bold leading-snug text-[var(--nx-ink)]">{insight.headline}</h2>
      </div>
      <div className="flex items-start gap-3">
        <TeamLine t={home} align="left" fav={insight.favorite?.side === 'home'} />
        <PhaseCenter info={info} kickoff={insight.kickoff} />
        <TeamLine t={away} align="right" fav={insight.favorite?.side === 'away'} />
      </div>
      {insight.favorite && <p className="text-[13px] font-semibold text-[var(--nx-ink-2)]">⭐ {insight.favorite.label}{insight.favorite.probability ? ` · ${Math.round(insight.favorite.probability * 100)} % según el mercado` : ''}</p>}
      {insight.market && <MarketBar market={insight.market} homeLabel={home.short} awayLabel={away.short} />}
      {(info.phase === 'previa' || info.phase === 'pronto' || info.phase === 'final') && <PredictScore matchId={insight.matchId} home={home.short} away={away.short} final={info.phase === 'final' ? info.score : null} locked={info.phase === 'final'} />}
      <KeyPlayers insight={insight} />
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
      <button type="button" onClick={() => openMatch({ league: insight.league, id: insight.matchId, preview: preview(insight, live) })}
        className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full bg-[var(--nx-ink)] text-sm font-bold text-[var(--nx-bg)] active:scale-[0.98]">
        Ver partido <ArrowUpRight size={16} aria-hidden="true" />
      </button>
    </div>
  )
}

// -------------------------------------------------------------------- tarjeta

export function InsightCard({ insight, live }: { insight: Insight; live?: Match | null }) {
  const now = useNow(60_000)
  const info = derivePhase(insight.kickoff, now, live ?? null, insight.phase)
  const story = insight.story ? STORY_STYLE[insight.story] : null
  const { home, away } = insight
  const open = () => openSheet({ kind: 'insight', insightId: insight.id, payload: { insight, live: live ?? null } })
  const liveNow = info.phase === 'en-vivo' || info.phase === 'empieza'
  const label = info.phase === 'final' ? 'Final · así queda' : liveNow ? 'En vivo' : insight.kind === 'preview' ? 'Antesala' : 'Así queda la tabla'

  return (
    <article
      className="overflow-hidden rounded-2xl border bg-[var(--nx-surface)]"
      style={{ borderColor: story ? `${story.accent}66` : 'var(--nx-line)' }}
    >
      <button type="button" onClick={open} className="block w-full text-left" aria-label={`${insight.headline}. Ver todos los datos`}>
        <div className="flex h-12 items-center justify-between gap-2 px-4 sm:px-5">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className={chipClass(liveNow ? 'live' : 'default')}>{liveNow ? <span className="nx-live-dot" style={{ width: 6, height: 6 }} aria-hidden="true" /> : <Sparkles size={12} aria-hidden="true" />}{label}</span>
            {story && <span className="truncate rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: story.accent, background: `${story.accent}22` }}>{story.label}</span>}
          </span>
          <span className="flex min-w-0 items-center gap-1.5 text-[11px] font-semibold text-[var(--nx-muted)]"><LeagueBadge league={insight.league} name={insight.leagueName} size={14} /><span className="hidden truncate sm:inline">{insight.leagueName}</span></span>
        </div>
        <div className="space-y-3 px-4 pb-4 sm:px-5">
          <div className="flex items-start gap-3">
            <TeamLine t={home} align="left" fav={insight.favorite?.side === 'home'} />
            <PhaseCenter info={info} kickoff={insight.kickoff} />
            <TeamLine t={away} align="right" fav={insight.favorite?.side === 'away'} />
          </div>
          {insight.favorite && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--nx-surface-2)] px-2.5 py-1 text-[12px] font-semibold text-[var(--nx-ink-2)]">
              ⭐ {insight.favorite.label}{insight.favorite.side ? ` · ${(insight.favorite.side === 'home' ? home : away).short}` : ''}
            </span>
          )}
          {insight.facts.length > 0 && (
            <ul className="space-y-1.5">
              {insight.facts.slice(0, info.phase === 'previa' || info.phase === 'pronto' ? 3 : 2).map((f, i) => <li key={i} className="flex gap-2 text-[14px] leading-snug text-[var(--nx-ink-2)]"><span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: story?.accent ?? '#FACC15' }} />{f}</li>)}
            </ul>
          )}
          {insight.market && (info.phase === 'previa' || info.phase === 'pronto' || info.phase === 'empieza') && <MarketBar market={insight.market} homeLabel={home.short} awayLabel={away.short} />}
        </div>
      </button>
      <div className="space-y-3 px-4 pb-4 sm:px-5">
        <KeyPlayers insight={insight} />
        {(info.phase === 'previa' || info.phase === 'pronto' || info.phase === 'final') && (
          <PredictScore matchId={insight.matchId} home={home.short} away={away.short} final={info.phase === 'final' ? info.score : null} locked={info.phase === 'final'} compact />
        )}
        <button type="button" onClick={open} className="inline-flex min-h-[44px] items-center gap-1 text-[13px] font-semibold text-[var(--nx-accent-text)]">Ver todos los datos <ArrowUpRight size={16} aria-hidden="true" /></button>
      </div>
    </article>
  )
}
