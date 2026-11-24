'use client'

// /parleys: todas las combinadas del día y las cuotas por partido (1X2
// con probabilidad implícita sin margen, más/menos goles y racha G/E/P).
// Aviso legal, "+18" y "Juega con responsabilidad" siempre visibles.
// Sin enlaces a operadores ni lenguaje de garantía.

import { Ticket } from 'lucide-react'
import PortalPage, { pageShell } from '@/components/portal/PortalPage'
import { Skeleton } from '@/components/portal/PortalBits'
import { TeamCrest, LeagueBadge } from '@/components/portal/Crest'
import { FormChips, ResponsibleBadges } from '@/components/portal/FeedExtras'
import { usePicks } from '@/lib/usePicks'
import { formatOdds, formatProbability, impliedX12, safeText, type PickMatch } from '@/lib/picks'
import { kickoffLabel } from '@/lib/feedComposer'

function OddCell({ label, odds, pct }: { label: string; odds: number; pct?: number }) {
  return (
    <div className="flex flex-col items-center rounded-xl bg-[var(--nx-surface-2)] px-2 py-2">
      <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--nx-muted)]">{label}</span>
      <span className="text-base font-bold tabular-nums text-[var(--nx-ink)]">{formatOdds(odds)}</span>
      {pct !== undefined && <span className="text-[11px] tabular-nums text-[var(--nx-muted)]">{pct} %</span>}
    </div>
  )
}

function MatchOdds({ m, now }: { m: PickMatch; now: Date }) {
  const x = m.odds.x12
  const imp = x ? impliedX12(x) : null
  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-[var(--nx-line)] bg-[var(--nx-surface)] p-4">
      <div className="flex items-center justify-between gap-2 text-[11px] font-semibold text-[var(--nx-muted)]">
        <span className="flex min-w-0 items-center gap-1.5"><LeagueBadge league={m.league} name={m.leagueName} size={16} /><span className="truncate uppercase tracking-[0.1em]">{m.leagueName}</span></span>
        <span className="shrink-0">{kickoffLabel(m.date, now)}</span>
      </div>
      {[m.home, m.away].map((t, i) => (
        <div key={i} className="flex items-center gap-2.5">
          <TeamCrest src={t.logo} name={t.name} size={26} />
          <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-[var(--nx-ink)]">{t.name}</span>
          <FormChips form={t.form} />
        </div>
      ))}
      {x && imp ? (
        <div className="grid grid-cols-3 gap-2" aria-label="Cuotas 1X2 con probabilidad implícita">
          <OddCell label="Local" odds={x.home} pct={imp.home} />
          <OddCell label="Empate" odds={x.draw} pct={imp.draw} />
          <OddCell label="Visitante" odds={x.away} pct={imp.away} />
        </div>
      ) : <p className="text-xs text-[var(--nx-muted)]">Sin cuotas 1X2 disponibles.</p>}
      {m.odds.overUnder && (
        <div className="grid grid-cols-2 gap-2" aria-label={`Más o menos de ${m.odds.overUnder.line} goles`}>
          <OddCell label={`Más de ${String(m.odds.overUnder.line).replace('.', ',')}`} odds={m.odds.overUnder.over} />
          <OddCell label={`Menos de ${String(m.odds.overUnder.line).replace('.', ',')}`} odds={m.odds.overUnder.under} />
        </div>
      )}
    </li>
  )
}

export default function ParleysClient() {
  const { data, loaded } = usePicks()
  const now = new Date()
  const provider = data?.matches[0]?.provider ?? 'DraftKings'

  return (
    <PortalPage>
      <div className={`${pageShell} max-w-[1100px] pb-20 pt-8 sm:pt-12`}>
        <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--nx-accent-text)]"><Ticket size={14} aria-hidden="true" /> Cuotas reales del mercado</p>
        <h1 className="mt-2 text-[clamp(1.75rem,1.4rem+1.5vw,2.5rem)] font-bold leading-[1.1] tracking-[-0.015em] text-[var(--nx-ink)]">Parley del día</h1>
        <ResponsibleBadges className="mt-3" />
        <p className="mt-3 max-w-3xl rounded-xl border border-[var(--nx-line)] bg-[var(--nx-surface)] p-3 text-[13px] leading-relaxed text-[var(--nx-ink-2)]">
          {data?.disclaimer ?? 'Contenido informativo basado en cuotas de mercado; no es una recomendación de apuesta ni garantiza resultados. Solo para mayores de 18 años. Juega con responsabilidad.'}
        </p>

        {!loaded ? (
          <div className="mt-8 grid gap-4 md:grid-cols-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-64" />)}</div>
        ) : !data || (data.parlays.length === 0 && data.matches.length === 0) ? (
          <p className="mt-8 rounded-2xl border border-dashed border-[var(--nx-line-strong)] px-6 py-14 text-center text-sm text-[var(--nx-muted)]">No hay cuotas disponibles para las próximas 48 horas.</p>
        ) : (
          <>
            {data.parlays.length > 0 && (
              <section aria-labelledby="parlays-h" className="mt-10">
                <h2 id="parlays-h" className="mb-4 text-xl font-bold tracking-[-0.01em] text-[var(--nx-ink)]">Combinadas</h2>
                <div className="grid gap-4 md:grid-cols-2">
                  {data.parlays.map((p) => (
                    <article key={p.name} className="flex flex-col gap-3 rounded-2xl border border-[var(--nx-line)] bg-[var(--nx-surface)] p-5">
                      <div>
                        <h3 className="text-lg font-bold text-[var(--nx-ink)]">{p.name}</h3>
                        {safeText(p.description) && <p className="text-sm text-[var(--nx-ink-2)]">{safeText(p.description)}</p>}
                      </div>
                      <ol className="divide-y divide-[var(--nx-line)]">
                        {p.picks.map((pk, i) => {
                          const m = data.matches.find((x) => x.id === pk.matchId)
                          return (
                            <li key={`${pk.matchId}-${i}`} className="flex items-start gap-3 py-2.5">
                              <span className="mt-0.5 flex shrink-0 -space-x-1.5"><TeamCrest src={m?.home.logo} name={m?.home.name ?? pk.match} size={22} /><TeamCrest src={m?.away.logo} name={m?.away.name ?? pk.match} size={22} /></span>
                              <span className="min-w-0 flex-1">
                                <span className="block text-[14px] font-bold text-[var(--nx-ink)]">{pk.label}</span>
                                <span className="block text-[12px] text-[var(--nx-muted)]">{pk.match} · {pk.leagueName}{pk.date ? ` · ${kickoffLabel(pk.date, now)}` : ''}</span>
                                {safeText(pk.reason) && <span className="mt-0.5 block text-[12px] text-[var(--nx-ink-2)]">{safeText(pk.reason)}</span>}
                              </span>
                              <span className="shrink-0 text-right"><span className="block font-bold tabular-nums text-[var(--nx-ink)]">{formatOdds(pk.odds)}</span><span className="block text-[11px] text-[var(--nx-muted)]">{formatProbability(pk.probability)}</span></span>
                            </li>
                          )
                        })}
                      </ol>
                      <div className="mt-auto flex items-center justify-between rounded-xl bg-[var(--nx-surface-2)] px-3 py-2.5">
                        <span className="text-[13px] font-semibold text-[var(--nx-ink-2)]">Cuota combinada</span>
                        <span className="text-right"><span className="block text-xl font-bold tabular-nums text-[var(--nx-ink)]">{formatOdds(p.odds)}</span><span className="block text-[11px] text-[var(--nx-muted)]">Probabilidad de mercado {formatProbability(p.probability)}</span></span>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}

            {data.matches.length > 0 && (
              <section aria-labelledby="odds-h" className="mt-12">
                <h2 id="odds-h" className="text-xl font-bold tracking-[-0.01em] text-[var(--nx-ink)]">Cuotas por partido</h2>
                <p className="mb-4 mt-1 text-sm text-[var(--nx-muted)]">Probabilidad implícita sin el margen del operador. Racha: G ganado, E empatado, P perdido (más reciente a la derecha).</p>
                <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {data.matches.map((m) => <MatchOdds key={m.id} m={m} now={now} />)}
                </ul>
              </section>
            )}
            <p className="mt-10 text-xs text-[var(--nx-muted)]">Datos: cuotas {provider} vía ESPN + racha últimos 5 partidos. Actualizado {data.generatedAt ? new Date(data.generatedAt).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' }) : ''}.</p>
            <ResponsibleBadges className="mt-3" />
          </>
        )}
      </div>
    </PortalPage>
  )
}
