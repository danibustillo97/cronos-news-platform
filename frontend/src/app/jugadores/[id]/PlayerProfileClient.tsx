'use client'

// Perfil de jugador: cabecera (foto o monograma, club, selección, edad),
// cifras clave de la temporada elegida (con derivados: G+A, precisión de
// remate, conversión, tarjetas) y la tabla por temporada y competición.

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, Swords } from 'lucide-react'
import PortalPage, { pageShell } from '@/components/portal/PortalPage'
import { PlayerAvatar } from '@/components/portal/PlayerBits'
import { LeagueBadge, TeamCrest } from '@/components/portal/Crest'
import { Skeleton } from '@/components/portal/PortalBits'
import { usePortalTheme } from '@/context/ThemeContext'
import { usePlayerProfile } from '@/lib/usePlayers'
import { defaultSeasonKey, derive, pushRecent, safeStorage, seasonOptions, selectStats, type PlayerProfile } from '@/lib/players'

const th = 'px-2 py-2.5 text-right text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--nx-muted)]'
const td = 'border-t border-[var(--nx-line)] px-2 py-2.5 text-right text-[13px] tabular-nums text-[var(--nx-ink-2)]'

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-[var(--nx-line)] bg-[var(--nx-surface)] p-4">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--nx-muted)]">{label}</dt>
      <dd className="mt-1.5 text-[28px] font-bold leading-none tabular-nums text-[var(--nx-ink)]">{value}</dd>
      {hint && <dd className="mt-1.5 text-xs text-[var(--nx-muted)]">{hint}</dd>}
    </div>
  )
}

function Header({ p }: { p: PlayerProfile }) {
  const facts = [p.position, p.age ? `${p.age} años` : null, p.jersey ? `#${p.jersey}` : null].filter(Boolean)
  return (
    <header className="flex flex-col gap-5 sm:flex-row sm:items-center">
      <PlayerAvatar src={p.image} name={p.name} size={112} className="ring-1 ring-[var(--nx-line)]" />
      <div className="min-w-0">
        <h1 className="text-[clamp(1.75rem,1.4rem+1.5vw,2.5rem)] font-bold leading-[1.1] tracking-[-0.015em] text-[var(--nx-ink)]">{p.name}</h1>
        {facts.length > 0 && <p className="mt-1.5 text-[15px] text-[var(--nx-ink-2)]">{facts.join(' · ')}</p>}
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-[var(--nx-ink-2)]">
          {p.team && (
            <span className="inline-flex items-center gap-2 font-semibold text-[var(--nx-ink)]">
              <TeamCrest src={p.teamLogo} name={p.team} size={22} /> {p.team}
            </span>
          )}
          {p.nationality && (
            <span className="inline-flex items-center gap-2">
              {p.flag && <Image src={p.flag} alt="" width={22} height={22} className="h-[22px] w-[22px] object-contain" />}
              {p.nationality}
            </span>
          )}
        </div>
      </div>
    </header>
  )
}

export default function PlayerProfileClient({ id }: { id: string }) {
  const { theme } = usePortalTheme()
  const { profile, status } = usePlayerProfile(id)
  const [seasonKey, setSeasonKey] = useState<string | null>(null)

  useEffect(() => {
    if (!profile) return
    setSeasonKey(defaultSeasonKey(profile))
    pushRecent(safeStorage(), { id: profile.id, name: profile.name, team: profile.team, image: profile.image })
    document.title = `${profile.name} | Nexus News`
  }, [profile])

  const stats = useMemo(() => (profile && seasonKey ? selectStats(profile, seasonKey) : null), [profile, seasonKey])
  const d = stats ? derive(stats) : null

  return (
    <PortalPage>
      <div className={`${pageShell} max-w-[1200px] pb-20 pt-6 sm:pt-10`}>
        <Link href="/jugadores" className="mb-6 inline-flex min-h-[44px] items-center gap-1.5 text-sm font-semibold text-[var(--nx-muted)] hover:text-[var(--nx-ink)]">
          <ArrowLeft size={16} aria-hidden="true" /> Jugadores
        </Link>

        {status === 'loading' || status === 'idle' ? (
          <div className="space-y-6" aria-busy="true" aria-label="Cargando jugador">
            <div className="flex items-center gap-5"><Skeleton className="h-28 w-28 !rounded-full" /><div className="flex-1 space-y-3"><Skeleton className="h-9 w-2/3" /><Skeleton className="h-4 w-1/3" /></div></div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
            <Skeleton className="h-64" />
          </div>
        ) : !profile ? (
          <div className="rounded-2xl border border-dashed border-[var(--nx-line-strong)] px-6 py-16 text-center">
            <p className="text-lg font-bold text-[var(--nx-ink)]">{status === 'notfound' ? 'No encontramos a este jugador.' : 'No pudimos cargar este jugador ahora.'}</p>
            <p className="mt-1 text-sm text-[var(--nx-muted)]">Intenta de nuevo en un momento o busca otro nombre.</p>
            <Link href="/jugadores" className="mt-5 inline-flex min-h-[44px] items-center rounded-full bg-[var(--nx-ink)] px-5 text-sm font-bold text-[var(--nx-bg)]">Buscar jugadores</Link>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <Header p={profile} />
              <Link href={`/jugadores/comparar?a=${encodeURIComponent(profile.id)}`} className="inline-flex min-h-[48px] shrink-0 items-center gap-2 self-start rounded-full bg-[#FACC15] px-5 text-sm font-bold text-black lg:self-auto">
                <Swords size={16} aria-hidden="true" /> Comparar con otro jugador
              </Link>
            </div>

            {profile.seasons.length === 0 ? (
              <p className="mt-10 rounded-2xl border border-dashed border-[var(--nx-line-strong)] px-6 py-10 text-center text-sm text-[var(--nx-muted)]">La fuente todavía no tiene estadísticas para este jugador.</p>
            ) : (
              <>
                <section aria-labelledby="key-stats" className="mt-10">
                  <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                    <h2 id="key-stats" className="text-xl font-bold tracking-[-0.01em] text-[var(--nx-ink)]">Cifras clave</h2>
                    <label className="flex items-center gap-2 text-sm text-[var(--nx-muted)]">
                      <span>Ver</span>
                      <select
                        value={seasonKey ?? ''}
                        onChange={(e) => setSeasonKey(e.target.value)}
                        className="h-11 max-w-[70vw] rounded-xl border border-[var(--nx-line-strong)] bg-[var(--nx-surface)] px-3 text-sm font-semibold text-[var(--nx-ink)]"
                      >
                        {seasonOptions(profile).map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
                      </select>
                    </label>
                  </div>
                  {stats && d && (
                    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                      <Tile label="Goles" value={String(stats.goals)} hint={d.goalsPerStart !== null ? `${d.goalsPerStart} por titularidad` : undefined} />
                      <Tile label="Asistencias" value={String(stats.assists)} />
                      <Tile label="Goles + asist." value={String(d.goalContributions)} />
                      <Tile label="Precisión de remate" value={d.shotAccuracy !== null ? `${d.shotAccuracy}%` : '—'} hint={`${stats.shotsOnTarget} de ${stats.shots} al arco`} />
                      <Tile label="Conversión" value={d.conversion !== null ? `${d.conversion}%` : '—'} hint="Goles por remate" />
                      <Tile label="Tarjetas" value={String(d.cards)} hint={`${stats.yellowCards} amarillas · ${stats.redCards} rojas`} />
                    </dl>
                  )}
                </section>

                <section aria-labelledby="seasons" className="mt-10">
                  <h2 id="seasons" className="mb-3 text-xl font-bold tracking-[-0.01em] text-[var(--nx-ink)]">Por temporada y competición</h2>
                  <div className="nx-thin-scroll overflow-x-auto rounded-2xl border border-[var(--nx-line)] bg-[var(--nx-surface)]">
                    <table className="w-full min-w-[760px] border-separate border-spacing-0">
                      <caption className="sr-only">Estadísticas de {profile.name} por temporada y competición</caption>
                      <thead>
                        <tr>
                          <th scope="col" className={`${th} sticky left-0 z-10 bg-[var(--nx-surface)] pl-4 text-left`}>Temporada</th>
                          <th scope="col" className={`${th} text-left`}>Equipo</th>
                          <th scope="col" className={th}><abbr title="Titularidades" className="no-underline">Tit</abbr></th>
                          <th scope="col" className={th}><abbr title="Goles" className="no-underline">G</abbr></th>
                          <th scope="col" className={th}><abbr title="Asistencias" className="no-underline">A</abbr></th>
                          <th scope="col" className={th}><abbr title="Remates" className="no-underline">Rem</abbr></th>
                          <th scope="col" className={th}><abbr title="Remates al arco" className="no-underline">Arco</abbr></th>
                          <th scope="col" className={th}><abbr title="Amarillas" className="no-underline">TA</abbr></th>
                          <th scope="col" className={th}><abbr title="Rojas" className="no-underline">TR</abbr></th>
                          <th scope="col" className={th}><abbr title="Faltas cometidas" className="no-underline">FC</abbr></th>
                          <th scope="col" className={th}><abbr title="Faltas recibidas" className="no-underline">FR</abbr></th>
                          <th scope="col" className={`${th} pr-4`}><abbr title="Fueras de lugar" className="no-underline">FL</abbr></th>
                        </tr>
                      </thead>
                      <tbody>
                        {profile.seasons.map((s, i) => (
                          <tr key={`${s.season}-${s.competition}-${i}`} className="group">
                            <th scope="row" className="sticky left-0 z-10 border-t border-[var(--nx-line)] bg-[var(--nx-surface)] py-2.5 pl-4 pr-3 text-left font-normal group-hover:bg-[var(--nx-surface-2)]">
                              <span className="flex items-center gap-2.5">
                                {s.competitionId ? <LeagueBadge league={s.competitionId} name={s.competition} size={20} dark={theme === 'dark'} /> : null}
                                <span className="min-w-0">
                                  <span className="block text-[13px] font-semibold text-[var(--nx-ink)]">{s.competition}</span>
                                  <span className="block text-[11px] text-[var(--nx-muted)]">{s.season}</span>
                                </span>
                              </span>
                            </th>
                            <td className={`${td} text-left group-hover:bg-[var(--nx-surface-2)]`}>
                              {s.team ? <span className="inline-flex items-center gap-2"><TeamCrest src={s.teamLogo} name={s.team} size={18} /><span className="truncate">{s.team}</span></span> : '—'}
                            </td>
                            {(['starts', 'goals', 'assists', 'shots', 'shotsOnTarget', 'yellowCards', 'redCards', 'foulsCommitted', 'foulsSuffered', 'offsides'] as const).map((k, j, arr) => (
                              <td key={k} className={`${td} group-hover:bg-[var(--nx-surface-2)] ${k === 'goals' || k === 'assists' ? 'font-bold text-[var(--nx-ink)]' : ''} ${j === arr.length - 1 ? 'pr-4' : ''}`}>{s.stats[k]}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="mt-2 text-xs text-[var(--nx-muted)]">Fuente: ESPN. Las competiciones sin datos de la fuente no aparecen.</p>
                </section>
              </>
            )}
          </>
        )}
      </div>
    </PortalPage>
  )
}
