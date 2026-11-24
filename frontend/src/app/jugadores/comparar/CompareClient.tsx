'use client'

// Cara a cara: dos jugadores, cada uno con su temporada/competición, y
// barras espejadas por estadística (gana el resaltado; en disciplina gana
// el número menor). URL compartible: ?a=ID&b=ID&sa=…&sb=…

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Check, RefreshCw, Share2, Swords, UserPlus } from 'lucide-react'
import PortalPage, { pageShell } from '@/components/portal/PortalPage'
import { PlayerAvatar, PlayerSearchBox } from '@/components/portal/PlayerBits'
import { TeamCrest } from '@/components/portal/Crest'
import { Skeleton } from '@/components/portal/PortalBits'
import { usePlayerProfile } from '@/lib/usePlayers'
import {
  compareScore, compareStats, defaultSeasonKey, seasonOptions, selectStats, type CompareRow, type PlayerProfile,
} from '@/lib/players'

type Side = 'a' | 'b'

function fmt(v: number | null, suffix: string): string {
  if (v === null) return '—'
  return `${Number.isInteger(v) ? v : v.toFixed(1)}${suffix}`
}

function PlayerSlot({
  side, id, profile, status, season, onSeason, onPick,
}: {
  side: Side
  id: string | null
  profile: PlayerProfile | null
  status: string
  season: string | null
  onSeason: (k: string) => void
  onPick: (id: string) => void
}) {
  const [changing, setChanging] = useState(false)
  const accent = side === 'a' ? 'ring-[#FACC15]/50' : 'ring-[var(--nx-line-strong)]'
  if (!id || changing) {
    return (
      <div className={`flex min-w-0 flex-col gap-3 rounded-2xl bg-[var(--nx-surface)] p-4 ring-1 ${accent}`}>
        <p className="flex items-center gap-2 text-sm font-semibold text-[var(--nx-ink)]"><UserPlus size={16} aria-hidden="true" /> {side === 'a' ? 'Jugador 1' : 'Jugador 2'}</p>
        <PlayerSearchBox id={`cmp-${side}`} autoFocus={changing} placeholder="Busca un jugador" onPick={(hit) => { setChanging(false); onPick(hit.id) }} />
        {changing && <button type="button" onClick={() => setChanging(false)} className="min-h-[44px] self-start text-xs font-semibold text-[var(--nx-muted)] hover:text-[var(--nx-ink)]">Cancelar</button>}
      </div>
    )
  }
  if (!profile) {
    return (
      <div className={`flex min-w-0 flex-col items-center gap-3 rounded-2xl bg-[var(--nx-surface)] p-4 text-center ring-1 ${accent}`}>
        {status === 'loading' ? <><Skeleton className="h-16 w-16 !rounded-full" /><Skeleton className="h-4 w-24" /></> : (
          <>
            <p className="text-sm text-[var(--nx-muted)]">No pudimos cargar este jugador.</p>
            <button type="button" onClick={() => setChanging(true)} className="min-h-[44px] text-xs font-semibold text-[var(--nx-accent-text)]">Elegir otro</button>
          </>
        )}
      </div>
    )
  }
  return (
    <div className={`flex min-w-0 flex-col items-center gap-2.5 rounded-2xl bg-[var(--nx-surface)] p-3 text-center ring-1 sm:p-5 ${accent}`}>
      <PlayerAvatar src={profile.image} name={profile.name} size={64} className="sm:!h-20 sm:!w-20" />
      <Link href={`/jugadores/${encodeURIComponent(profile.id)}`} className="max-w-full text-[15px] font-bold leading-tight text-[var(--nx-ink)] hover:underline sm:text-lg">{profile.name}</Link>
      {profile.team && <span className="inline-flex max-w-full items-center gap-1.5 text-xs text-[var(--nx-muted)]"><TeamCrest src={profile.teamLogo} name={profile.team} size={16} /><span className="truncate">{profile.team}</span></span>}
      {profile.seasons.length > 0 ? (
        <label className="w-full">
          <span className="sr-only">Temporada de {profile.name}</span>
          <select value={season ?? ''} onChange={(e) => onSeason(e.target.value)} className="h-11 w-full rounded-xl border border-[var(--nx-line-strong)] bg-[var(--nx-bg)] px-2 text-xs font-semibold text-[var(--nx-ink)] sm:text-sm">
            {seasonOptions(profile).map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
        </label>
      ) : <span className="text-xs text-[var(--nx-muted)]">Sin estadísticas</span>}
      <button type="button" onClick={() => setChanging(true)} className="inline-flex min-h-[44px] items-center gap-1.5 text-xs font-semibold text-[var(--nx-muted)] hover:text-[var(--nx-ink)]">
        <RefreshCw size={13} aria-hidden="true" /> Cambiar jugador
      </button>
    </div>
  )
}

function Row({ row, nameA, nameB }: { row: CompareRow; nameA: string; nameB: string }) {
  const aWin = row.winner === 'a'
  const bWin = row.winner === 'b'
  return (
    <li className="py-3" aria-label={`${row.label}: ${nameA} ${fmt(row.a, row.suffix)}, ${nameB} ${fmt(row.b, row.suffix)}${row.winner === 'tie' ? ', empate' : row.winner ? `, gana ${aWin ? nameA : nameB}` : ''}`}>
      <p className="mb-1.5 text-center text-xs font-semibold text-[var(--nx-muted)]">
        {row.label}{row.lowerIsBetter && <span className="ml-1 font-normal">(menos es mejor)</span>}
      </p>
      <div className="grid grid-cols-[3.25rem_minmax(0,1fr)_minmax(0,1fr)_3.25rem] items-center gap-2" aria-hidden="true">
        <span className={`text-right text-[15px] tabular-nums ${aWin ? 'font-bold text-[var(--nx-ink)]' : 'text-[var(--nx-muted)]'}`}>{fmt(row.a, row.suffix)}</span>
        <span className="flex h-2.5 justify-end overflow-hidden rounded-l-full bg-[var(--nx-surface-2)]">
          <span className={`h-full rounded-l-full transition-[width] duration-500 ${aWin ? 'bg-[#FACC15]' : 'bg-[var(--nx-surface-3)]'}`} style={{ width: `${row.aPct}%` }} />
        </span>
        <span className="flex h-2.5 overflow-hidden rounded-r-full bg-[var(--nx-surface-2)]">
          <span className={`h-full rounded-r-full transition-[width] duration-500 ${bWin ? 'bg-[var(--nx-ink)]' : 'bg-[var(--nx-surface-3)]'}`} style={{ width: `${row.bPct}%` }} />
        </span>
        <span className={`text-[15px] tabular-nums ${bWin ? 'font-bold text-[var(--nx-ink)]' : 'text-[var(--nx-muted)]'}`}>{fmt(row.b, row.suffix)}</span>
      </div>
    </li>
  )
}

export default function CompareClient() {
  const router = useRouter()
  const params = useSearchParams()
  const [ids, setIds] = useState<Record<Side, string | null>>({ a: params.get('a'), b: params.get('b') })
  const [seasons, setSeasons] = useState<Record<Side, string | null>>({ a: params.get('sa'), b: params.get('sb') })
  const [copied, setCopied] = useState(false)
  const A = usePlayerProfile(ids.a)
  const B = usePlayerProfile(ids.b)

  // Temporada por defecto (o la de la URL si sigue existiendo).
  useEffect(() => {
    for (const [side, st] of [['a', A], ['b', B]] as const) {
      const p = st.profile
      if (!p) continue
      const valid = seasonOptions(p).some((o) => o.key === seasons[side])
      if (!valid) setSeasons((s) => ({ ...s, [side]: defaultSeasonKey(p) }))
    }
  }, [A, B, seasons])

  // URL compartible.
  useEffect(() => {
    const q = new URLSearchParams()
    if (ids.a) q.set('a', ids.a)
    if (ids.b) q.set('b', ids.b)
    if (ids.a && seasons.a) q.set('sa', seasons.a)
    if (ids.b && seasons.b) q.set('sb', seasons.b)
    const next = `/jugadores/comparar${q.toString() ? `?${q}` : ''}`
    if (window.location.pathname + window.location.search !== next) router.replace(next, { scroll: false })
  }, [ids, seasons, router])

  const rows = useMemo(() => {
    if (!A.profile || !B.profile || !seasons.a || !seasons.b) return null
    return compareStats(selectStats(A.profile, seasons.a), selectStats(B.profile, seasons.b))
  }, [A.profile, B.profile, seasons])
  const score = rows ? compareScore(rows) : null

  const share = async () => {
    const url = window.location.href
    try {
      if (navigator.share) { await navigator.share({ title: 'Cara a cara en NEXUS', url }); return }
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch { /* cancelado */ }
  }

  const pick = (side: Side) => (id: string) => {
    setIds((s) => ({ ...s, [side]: id }))
    setSeasons((s) => ({ ...s, [side]: null }))
  }

  return (
    <PortalPage>
      <div className={`${pageShell} max-w-[960px] pb-20 pt-8 sm:pt-12`}>
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--nx-accent-text)]"><Swords size={14} aria-hidden="true" /> Cara a cara</p>
            <h1 className="mt-2 text-[clamp(1.75rem,1.4rem+1.5vw,2.5rem)] font-bold leading-[1.1] tracking-[-0.015em] text-[var(--nx-ink)]">Comparar jugadores</h1>
          </div>
          {rows && (
            <button type="button" onClick={share} className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-[var(--nx-line)] px-4 text-sm font-semibold text-[var(--nx-ink-2)] hover:border-[var(--nx-line-strong)]">
              {copied ? <Check size={15} aria-hidden="true" /> : <Share2 size={15} aria-hidden="true" />} {copied ? 'Enlace copiado' : 'Compartir comparación'}
            </button>
          )}
        </header>

        <div className="mt-6 grid grid-cols-2 gap-2 sm:gap-4">
          <PlayerSlot side="a" id={ids.a} profile={A.profile} status={A.status} season={seasons.a} onSeason={(k) => setSeasons((s) => ({ ...s, a: k }))} onPick={pick('a')} />
          <PlayerSlot side="b" id={ids.b} profile={B.profile} status={B.status} season={seasons.b} onSeason={(k) => setSeasons((s) => ({ ...s, b: k }))} onPick={pick('b')} />
        </div>

        {rows && score && A.profile && B.profile ? (
          <section aria-label="Comparación por estadística" className="mt-6 rounded-2xl border border-[var(--nx-line)] bg-[var(--nx-surface)] px-4 py-2 sm:px-6">
            <p className="border-b border-[var(--nx-line)] py-3 text-center text-sm text-[var(--nx-ink-2)]">
              <span className="font-bold text-[var(--nx-ink)]">{A.profile.name}</span> gana en <span className="font-bold tabular-nums text-[var(--nx-accent-text)]">{score.a}</span>
              <span className="mx-2 text-[var(--nx-muted)]">·</span>
              <span className="font-bold text-[var(--nx-ink)]">{B.profile.name}</span> gana en <span className="font-bold tabular-nums text-[var(--nx-ink)]">{score.b}</span>
            </p>
            <ul className="divide-y divide-[var(--nx-line)]">
              {rows.map((r) => <Row key={r.key} row={r} nameA={A.profile!.name} nameB={B.profile!.name} />)}
            </ul>
            <p className="py-3 text-center text-[11px] text-[var(--nx-muted)]">Totales de la temporada/competición elegida para cada jugador. Fuente: ESPN.</p>
          </section>
        ) : (
          <p className="mt-8 rounded-2xl border border-dashed border-[var(--nx-line-strong)] px-6 py-10 text-center text-sm text-[var(--nx-muted)]">
            Elige dos jugadores para ver el cara a cara.
          </p>
        )}
      </div>
    </PortalPage>
  )
}
