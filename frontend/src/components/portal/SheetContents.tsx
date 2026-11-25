'use client'

// Contenidos de ventanas nuevas de la pila: jugador, encuestas y cápsula.

import { useMemo } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { usePlayerProfile } from '@/lib/usePlayers'
import { usePlayerInsights } from '@/lib/useMatchCenter'
import { defaultSeasonKey, derive, selectStats, seasonOptions } from '@/lib/players'
import { usePolls } from '@/lib/usePolls'
import { sortPolls, type Poll } from '@/lib/polls'
import type { Capsule } from '@/lib/capsules'
import { PlayerAvatar } from './PlayerBits'
import { TeamCrest } from './Crest'
import { InsightCard as PlayerInsights } from './MatchModal'
import { PollBlock } from './PollCard'
import { CapsuleCard } from './FeedExtras'

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl bg-[var(--nx-surface-2)] p-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--nx-muted)]">{label}</p>
      <p className="mt-1 text-[22px] font-bold leading-none tabular-nums text-[var(--nx-ink)]">{value}</p>
      {hint && <p className="mt-1 text-[11px] text-[var(--nx-muted)]">{hint}</p>}
    </div>
  )
}

export function PlayerSheetContent({ id, name }: { id: string; name?: string }) {
  const { profile, status } = usePlayerProfile(id)
  const { data: insights } = usePlayerInsights(id)
  const season = profile ? defaultSeasonKey(profile) : null
  const stats = profile && season ? selectStats(profile, season) : null
  const d = stats ? derive(stats) : null
  const seasonLabel = profile && season ? seasonOptions(profile).find((o) => o.key === season)?.label : null
  const displayName = profile?.name ?? insights?.player.name ?? name ?? 'Jugador'

  return (
    <div className="nx-thin-scroll min-h-0 flex-1 space-y-5 overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom,0px)+16px)] pt-1">
      <header className="flex items-center gap-4">
        <PlayerAvatar src={profile?.image ?? insights?.player.image} name={displayName} size={72} />
        <div className="min-w-0">
          <h2 className="truncate text-xl font-bold text-[var(--nx-ink)]">{displayName}</h2>
          <p className="text-[13px] text-[var(--nx-ink-2)]">{[profile?.position ?? insights?.player.position, profile?.age ? `${profile.age} años` : null, profile?.jersey ? `#${profile.jersey}` : null].filter(Boolean).join(' · ')}</p>
          <div className="mt-1 flex flex-wrap gap-x-4 text-[13px] text-[var(--nx-ink-2)]">
            {(profile?.team ?? insights?.player.team) && <span className="inline-flex items-center gap-1.5 font-semibold text-[var(--nx-ink)]"><TeamCrest src={profile?.teamLogo} name={profile?.team ?? insights?.player.team ?? ''} size={18} />{profile?.team ?? insights?.player.team}</span>}
            {profile?.nationality && <span className="inline-flex items-center gap-1.5">{profile.flag && <Image src={profile.flag} alt="" width={18} height={18} className="h-[18px] w-[18px] object-contain" />}{profile.nationality}</span>}
          </div>
        </div>
      </header>
      {status === 'loading' && !profile && <div className="grid grid-cols-3 gap-2">{[0, 1, 2].map((i) => <div key={i} className="nx-skeleton h-20 rounded-xl" />)}</div>}
      {stats && d && (
        <section aria-label="Cifras de la temporada">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--nx-muted)]">{seasonLabel}</p>
          <div className="grid grid-cols-3 gap-2">
            <Tile label="Goles" value={String(stats.goals)} />
            <Tile label="Asist." value={String(stats.assists)} />
            <Tile label="G + A" value={String(d.goalContributions)} />
            <Tile label="Precisión" value={d.shotAccuracy !== null ? `${d.shotAccuracy}%` : '—'} hint={`${stats.shotsOnTarget}/${stats.shots} al arco`} />
            <Tile label="Conversión" value={d.conversion !== null ? `${d.conversion}%` : '—'} />
            <Tile label="Titular" value={String(stats.starts)} />
          </div>
        </section>
      )}
      <PlayerInsights athleteId={id} name={displayName} inset={false} />
      <Link href={`/jugadores/${encodeURIComponent(id)}`} className="flex min-h-[48px] items-center justify-center gap-2 rounded-full border border-[var(--nx-line)] text-sm font-semibold text-[var(--nx-ink-2)]">
        Perfil completo y comparador <ArrowUpRight size={16} aria-hidden="true" />
      </Link>
    </div>
  )
}

export function PollsSheetContent() {
  const home = usePolls('placement=home')
  const pulse = usePolls('placement=pulse')
  const polls = useMemo(() => {
    const byId = new Map<string, Poll>()
    for (const p of [...home.polls, ...pulse.polls]) byId.set(p.id, p)
    return sortPolls([...byId.values()], new Date())
  }, [home.polls, pulse.polls])
  const loaded = home.loaded && pulse.loaded
  return (
    <div className="nx-thin-scroll min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom,0px)+16px)] pt-1">
      {!loaded ? [0, 1].map((i) => <div key={i} className="nx-skeleton h-48 rounded-2xl" />)
        : polls.length === 0 ? <p className="py-10 text-center text-sm text-[var(--nx-muted)]">No hay votaciones abiertas en este momento.</p>
        : polls.map((p) => <PollBlock key={p.id} poll={p} hero={p.kind === 'debate'} />)}
    </div>
  )
}

export function CapsuleSheetContent({ capsule }: { capsule: Capsule }) {
  return (
    <div className="nx-thin-scroll min-h-0 flex-1 overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom,0px)+16px)] pt-1">
      <CapsuleCard capsule={capsule} inSheet />
    </div>
  )
}
