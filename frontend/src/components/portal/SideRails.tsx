'use client'

// Rieles laterales del Pulso en escritorio (≥1280 px; más anchos ≥1536 px).
// Izquierda: "En vivo / Hoy" y "Tabla rápida". Derecha: anuncio lateral
// (solo si hay campaña), "Lo más leído", "Parley del día" y "Encuesta
// rápida". Todo abre en ventanas flotantes, sin salir de la página.

import { useState } from 'react'
import { ArrowUpRight, Flame, Table2, Ticket, Vote } from 'lucide-react'
import type { Match } from '@/types/sports'
import type { NewsView } from '@/types/news'
import type { Poll } from '@/lib/polls'
import { useStandings } from '@/lib/useStandings'
import { usePicks } from '@/lib/usePicks'
import { formatOdds, formatProbability } from '@/lib/picks'
import { openSheet } from '@/lib/sheetBus'
import StandingsTable from '@/components/news/StandingsTable'
import { LeagueBadge, TeamCrest } from './Crest'
import { openMatch } from '@/lib/matchModalBus'
import { localizeStatus } from '@/lib/matchStatus'
import { kickoffLabel, timeAgo } from '@/lib/feedComposer'
import PlacementAd from './PlacementAd'
import { PollBlock } from './PollCard'
import { ResponsibleBadges } from './FeedExtras'
import { StoryLink } from './StoryLink'

const RAIL_W = 'w-[256px] min-[1400px]:w-[300px] 2xl:w-[340px]'
const box = `${RAIL_W} rounded-2xl border border-[var(--nx-line)] bg-[var(--nx-surface)] p-3`
const heading = 'flex items-center gap-2 px-1 pb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--nx-muted)]'
const QUICK_LEAGUES = [['col.1', 'BetPlay'], ['eng.1', 'Premier'], ['esp.1', 'LaLiga'], ['uefa.champions', 'Champions']] as const

/** Fila compacta de dos líneas (escudo, nombre, goles) para el riel angosto. */
function RailMatch({ m }: { m: Match }) {
  const live = m.status === 'live'
  const scheduled = m.status === 'scheduled'
  const side = (name: string, logo: string | null, score: number) => (
    <span className="flex min-w-0 items-center gap-2">
      <TeamCrest src={logo} name={name} size={18} />
      <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-[var(--nx-ink)]">{name}</span>
      {!scheduled && <span className="w-5 text-right text-[13px] font-bold tabular-nums text-[var(--nx-ink)]">{score}</span>}
    </span>
  )
  return (
    <button type="button" onClick={() => openMatch({ league: m.league, id: m.id, preview: m })} aria-label={`${m.homeTeam} vs ${m.awayTeam}. Abrir partido`}
      className="flex min-h-[56px] w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left hover:bg-[var(--nx-surface-2)] active:scale-[0.99]">
      <span className="flex min-w-0 flex-1 flex-col gap-1">{side(m.homeTeam, m.homeLogo, m.homeScore)}{side(m.awayTeam, m.awayLogo, m.awayScore)}</span>
      <span className={`w-12 shrink-0 text-center text-[11px] font-bold leading-tight ${live ? 'text-[var(--nx-live)]' : 'text-[var(--nx-muted)]'}`}>
        {live ? localizeStatus(m.statusDetail) : m.status === 'finished' ? 'Final' : kickoffLabel(m.date).replace(/^Hoy /, '')}
      </span>
    </button>
  )
}

function LiveToday({ matches }: { matches: Match[] }) {
  const t = (m: Match) => (m.date ? Date.parse(m.date) : 0)
  const today = new Date().toDateString()
  const live = matches.filter((m) => m.status === 'live')
  const rest = matches.filter((m) => m.status !== 'live' && m.date && new Date(m.date).toDateString() === today).sort((a, b) => t(a) - t(b))
  const list = [...live, ...rest].slice(0, 8)
  if (list.length === 0) return null
  return (
    <section aria-label="En vivo y hoy" className={box}>
      <h2 className={heading}>
        {live.length > 0 && <span className="nx-live-dot text-[var(--nx-live)]" style={{ width: 6, height: 6 }} aria-hidden="true" />}
        {live.length > 0 ? `En vivo · ${live.length}` : 'Hoy'}
      </h2>
      <div className="-mx-1 divide-y divide-[var(--nx-line)]">{list.map((m) => <RailMatch key={m.id} m={m} />)}</div>
    </section>
  )
}

function QuickTable({ dark }: { dark: boolean }) {
  const [league, setLeague] = useState<string>(QUICK_LEAGUES[0][0])
  const { groups, loading } = useStandings(league)
  const g = groups[0]
  return (
    <section aria-label="Tabla rápida" className={box}>
      <h2 className={heading}><Table2 size={13} aria-hidden="true" /> Tabla rápida</h2>
      <div role="tablist" aria-label="Liga" className="mb-2 flex flex-wrap gap-1">
        {QUICK_LEAGUES.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={league === id} onClick={() => setLeague(id)}
            className={`inline-flex min-h-[34px] items-center gap-1.5 rounded-full px-2.5 text-[11px] font-bold ${league === id ? 'bg-[var(--nx-ink)] text-[var(--nx-bg)]' : 'border border-[var(--nx-line)] text-[var(--nx-ink-2)]'}`}>
            <LeagueBadge league={id} name={label} size={14} dark={league === id ? !dark : dark} />{label}
          </button>
        ))}
      </div>
      {loading ? <div className="nx-skeleton h-56 rounded-xl" /> : g ? (
        <StandingsTable table={g.table} groupName={g.name} league={league} limit={6} showLegend={false} compact onRowsClick={() => openSheet({ kind: 'table', league })} />
      ) : <p className="py-6 text-center text-xs text-[var(--nx-muted)]">Sin tabla por ahora.</p>}
      <button type="button" onClick={() => openSheet({ kind: 'table', league })} className="mt-1 flex min-h-[40px] w-full items-center justify-center gap-1 rounded-xl text-xs font-semibold text-[var(--nx-accent-text)] hover:bg-[var(--nx-surface-2)]">Tabla completa <ArrowUpRight size={14} aria-hidden="true" /></button>
    </section>
  )
}

export function LeftRail({ matches, dark }: { matches: Match[]; dark: boolean }) {
  return (
    <div className="flex flex-col gap-4">
      <LiveToday matches={matches} />
      <QuickTable dark={dark} />
    </div>
  )
}

/** "Lo más leído": por vistas si las hay; si no, lo más reciente. */
function MostRead({ stories, onOpen }: { stories: NewsView[]; onOpen: (s: NewsView) => void }) {
  const top = [...stories].sort((a, b) => (b.views ?? 0) - (a.views ?? 0) || Date.parse(b.published_at) - Date.parse(a.published_at)).slice(0, 5)
  if (top.length === 0) return null
  return (
    <section aria-label="Lo más leído" className={box}>
      <h2 className={heading}><Flame size={13} aria-hidden="true" /> Lo más leído</h2>
      <ol className="divide-y divide-[var(--nx-line)]">
        {top.map((s, i) => (
          <li key={s.id}>
            <StoryLink story={s} onOpen={onOpen} className="flex min-h-[52px] gap-3 px-1 py-2.5 hover:bg-[var(--nx-surface-2)]">
              <span className="w-5 shrink-0 text-lg font-bold tabular-nums text-[var(--nx-accent-text)]">{i + 1}</span>
              <span className="min-w-0">
                <span className="text-[13px] font-semibold leading-snug text-[var(--nx-ink)] line-clamp-2">{s.title}</span>
                <span className="mt-0.5 block text-[11px] text-[var(--nx-muted)]">{timeAgo(s.published_at)}</span>
              </span>
            </StoryLink>
          </li>
        ))}
      </ol>
    </section>
  )
}

function ParleyMini() {
  const { data } = usePicks()
  const p = data?.parlays[0]
  if (!data || !p) return null
  return (
    <section aria-label="Parley del día" className={box}>
      <h2 className={heading}><Ticket size={13} aria-hidden="true" /> Parley del día</h2>
      <ResponsibleBadges className="mb-2 px-1" />
      <p className="px-1 text-[14px] font-bold text-[var(--nx-ink)]">{p.name}</p>
      <ul className="mt-1 space-y-1 px-1">
        {p.picks.slice(0, 3).map((k, i) => (
          <li key={i} className="flex items-center justify-between gap-2 text-[12px]">
            <span className="min-w-0 truncate text-[var(--nx-ink-2)]">{k.label}</span>
            <span className="shrink-0 font-bold tabular-nums text-[var(--nx-ink)]">{formatOdds(k.odds)}</span>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex items-center justify-between rounded-xl bg-[var(--nx-surface-2)] px-3 py-2">
        <span className="text-[12px] text-[var(--nx-muted)]">Cuota combinada</span>
        <span className="text-right"><span className="block text-base font-bold tabular-nums text-[var(--nx-ink)]">{formatOdds(p.odds)}</span><span className="block text-[10px] text-[var(--nx-muted)]">Mercado {formatProbability(p.probability)}</span></span>
      </div>
      <p className="mt-2 px-1 text-[10px] leading-snug text-[var(--nx-muted)]">{data.disclaimer}</p>
      <button type="button" onClick={() => openSheet({ kind: 'parleys' })} className="mt-1 flex min-h-[40px] w-full items-center justify-center gap-1 rounded-xl text-xs font-semibold text-[var(--nx-accent-text)] hover:bg-[var(--nx-surface-2)]">Arma tu parley <ArrowUpRight size={14} aria-hidden="true" /></button>
    </section>
  )
}

function QuickPoll({ polls }: { polls: Poll[] }) {
  const poll = polls.find((p) => p.status === 'open') ?? polls[0]
  if (!poll) return null
  return (
    <section aria-label="Encuesta rápida" className={box}>
      <h2 className={heading}><Vote size={13} aria-hidden="true" /> Encuesta rápida</h2>
      <PollBlock poll={poll} compact bare />
      <button type="button" onClick={() => openSheet({ kind: 'polls' })} className="mt-1 flex min-h-[40px] w-full items-center justify-center gap-1 rounded-xl text-xs font-semibold text-[var(--nx-accent-text)] hover:bg-[var(--nx-surface-2)]">Más encuestas <ArrowUpRight size={14} aria-hidden="true" /></button>
    </section>
  )
}

export function RightRail({ stories, polls, onOpen }: { stories: NewsView[]; polls: Poll[]; onOpen: (s: NewsView) => void }) {
  return (
    <div className="flex flex-col gap-4">
      <div className={`${RAIL_W} empty:hidden`}><PlacementAd placement="sidebar" /></div>
      <MostRead stories={stories} onOpen={onOpen} />
      <ParleyMini />
      <QuickPoll polls={polls} />
    </div>
  )
}
