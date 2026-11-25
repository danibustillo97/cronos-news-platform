'use client'

// /parleys: combinadas del día (Hoy / Mañana) y cuotas por partido. "Arma
// tu parley": toca cuotas para armar tu propia combinada (máx. 6, una por
// partido), con cuota y probabilidad de mercado combinadas y un simulador
// de 10.000 jornadas (estadística con probabilidades del mercado, no
// predicción). "La afición dice": % de la encuesta automática del partido.
// Aviso legal, "+18" y "Juega con responsabilidad" siempre visibles.
// Sin enlaces a operadores ni lenguaje de garantía.

import { useEffect, useMemo, useState } from 'react'
import { Check, ChevronUp, Dices, Share2, Ticket, Trash2, X } from 'lucide-react'
import PortalPage, { pageShell } from '@/components/portal/PortalPage'
import { Skeleton } from '@/components/portal/PortalBits'
import { TeamCrest, LeagueBadge } from '@/components/portal/Crest'
import { FormChips, ResponsibleBadges } from '@/components/portal/FeedExtras'
import { usePicks } from '@/lib/usePicks'
import { formatOdds, formatProbability, groupByDay, impliedX12, safeText, selectionsForMatch, type PickMatch, type PicksData } from '@/lib/picks'
import { combinedOdds, combinedProbability, formatCop, readSlip, saveSlip, simulate, slipShareText, toggleSelection, type Selection, type SimulationResult } from '@/lib/slip'
import { normalizePolls, percentages, type Poll } from '@/lib/polls'
import { safeStorage } from '@/lib/players'
import { kickoffLabel } from '@/lib/feedComposer'

const DEFAULT_DISCLAIMER = 'Contenido informativo basado en cuotas de mercado; no es una recomendación de apuesta ni garantiza resultados. Solo para mayores de 18 años. Juega con responsabilidad.'
const STAKE = 10_000
const RUNS = 10_000

// ------------------------------------------------------------------ afición

function useMatchPolls() {
  const [byMatch, setByMatch] = useState<Map<string, Poll>>(() => new Map())
  useEffect(() => {
    let cancelled = false
    fetch('/api/polls?placement=pulse')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: unknown) => {
        if (cancelled) return
        const map = new Map<string, Poll>()
        for (const p of normalizePolls(d)) {
          const m = p.newsId?.match(/^match:[^:]+:(.+)$/)
          if (m) map.set(m[1], p)
        }
        setByMatch(map)
      })
      .catch(() => { /* sin encuestas */ })
    return () => { cancelled = true }
  }, [])
  return byMatch
}

function Community({ poll }: { poll: Poll }) {
  if (poll.totalVotes === 0) return null
  const pcts = percentages(poll.options)
  return (
    <p className="text-[11px] leading-snug text-[var(--nx-muted)]">
      <span className="font-bold text-[var(--nx-ink-2)]">La afición dice:</span>{' '}
      {poll.options.map((o, i) => `${o.label} ${pcts[i]} %`).join(' · ')} <span className="whitespace-nowrap">({poll.totalVotes} votos)</span>
    </p>
  )
}

// --------------------------------------------------------- cuotas por partido

function MatchOdds({ m, now, slip, onPick, poll }: { m: PickMatch; now: Date; slip: Selection[]; onPick: (s: Selection) => void; poll?: Poll }) {
  const sels = selectionsForMatch(m)
  const current = slip.find((s) => s.matchId === m.id)
  const imp = m.odds.x12 ? impliedX12(m.odds.x12) : null
  const matchName = `${m.home.name} vs ${m.away.name}`
  const cell = (s: (typeof sels)[number]) => {
    const on = current?.pick === s.pick && current.market === s.market
    return (
      <button
        key={s.pick}
        type="button"
        aria-pressed={on}
        aria-label={`${s.label} en ${matchName}: cuota ${formatOdds(s.odds)}, probabilidad ${formatProbability(s.probability)}`}
        onClick={() => onPick({ matchId: m.id, match: matchName, market: s.market, pick: s.pick, label: s.label, odds: s.odds, probability: s.probability })}
        className={`flex min-h-[56px] flex-col items-center justify-center rounded-xl px-1 py-1.5 transition-all active:scale-95 ${on ? 'bg-[#FACC15] text-black ring-2 ring-[#FACC15]' : 'bg-[var(--nx-surface-2)] text-[var(--nx-ink)] hover:ring-1 hover:ring-[var(--nx-line-strong)]'}`}
      >
        <span className={`text-[10px] font-bold uppercase tracking-[0.08em] ${on ? 'text-black/70' : 'text-[var(--nx-muted)]'}`}>{s.short}</span>
        <span className="text-[15px] font-bold tabular-nums">{formatOdds(s.odds)}</span>
        <span className={`text-[10px] tabular-nums ${on ? 'text-black/70' : 'text-[var(--nx-muted)]'}`}>{Math.round(s.probability * 100)} %</span>
      </button>
    )
  }
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
      {sels.length === 0 ? <p className="text-xs text-[var(--nx-muted)]">Sin cuotas disponibles.</p> : (
        <>
          {imp && <div className="grid grid-cols-3 gap-2" aria-label="1X2: toca para agregar a tu parley">{sels.filter((s) => s.market === '1X2').map(cell)}</div>}
          {sels.some((s) => s.market === 'Goles') && <div className="grid grid-cols-2 gap-2" aria-label="Goles">{sels.filter((s) => s.market === 'Goles').map(cell)}</div>}
        </>
      )}
      {poll && <Community poll={poll} />}
    </li>
  )
}

// ------------------------------------------------------------------- boleto

function DistributionBar({ result, n }: { result: SimulationResult; n: number }) {
  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full bg-[var(--nx-surface-3)]" role="img" aria-label={result.hitsDistribution.map((c, k) => `${k} aciertos: ${Math.round((c / result.runs) * 100)} %`).join(', ')}>
        {result.hitsDistribution.map((c, k) => (
          <span key={k} className="h-full" style={{ width: `${(c / result.runs) * 100}%`, background: k === n ? '#16A34A' : `rgba(250,204,21,${0.25 + (0.6 * k) / Math.max(1, n)})` }} />
        ))}
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-[var(--nx-muted)]">
        {result.hitsDistribution.map((c, k) => <span key={k}>{k}/{n} aciertos: {Math.round((c / result.runs) * 100)} %</span>)}
      </div>
    </div>
  )
}

function SlipPanel({ slip, onRemove, onClear, disclaimer }: { slip: Selection[]; onRemove: (s: Selection) => void; onClear: () => void; disclaimer: string }) {
  const [result, setResult] = useState<SimulationResult | null>(null)
  const [shared, setShared] = useState(false)
  const odds = combinedOdds(slip)
  const prob = combinedProbability(slip)
  useEffect(() => { setResult(null) }, [slip])

  const share = async () => {
    const text = slipShareText(slip)
    try {
      if (navigator.share) { await navigator.share({ title: 'Mi parley en NEXUS', text }); return }
      await navigator.clipboard.writeText(text)
      setShared(true)
      window.setTimeout(() => setShared(false), 1800)
    } catch { /* cancelado */ }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-base font-bold text-[var(--nx-ink)]"><Ticket size={16} className="text-[var(--nx-accent-text)]" aria-hidden="true" /> Arma tu parley</h2>
        {slip.length > 0 && <button type="button" onClick={onClear} className="inline-flex min-h-[40px] items-center gap-1 text-xs font-semibold text-[var(--nx-muted)] hover:text-[var(--nx-ink)]"><Trash2 size={13} aria-hidden="true" /> Vaciar</button>}
      </div>
      {slip.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--nx-line-strong)] p-4 text-center text-[13px] text-[var(--nx-muted)]">Toca las cuotas de los partidos para armar tu combinada (hasta 6, una por partido).</p>
      ) : (
        <>
          <ul className="divide-y divide-[var(--nx-line)] rounded-xl border border-[var(--nx-line)]">
            {slip.map((s) => (
              <li key={s.matchId} className="flex items-center gap-2 px-3 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-bold text-[var(--nx-ink)]">{s.label}</span>
                  <span className="block truncate text-[11px] text-[var(--nx-muted)]">{s.match}</span>
                </span>
                <span className="text-right"><span className="block text-[14px] font-bold tabular-nums text-[var(--nx-ink)]">{formatOdds(s.odds)}</span><span className="block text-[10px] text-[var(--nx-muted)]">{formatProbability(s.probability)}</span></span>
                <button type="button" onClick={() => onRemove(s)} aria-label={`Quitar ${s.label}`} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--nx-muted)] hover:bg-[var(--nx-surface-2)]"><X size={15} /></button>
              </li>
            ))}
          </ul>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-[var(--nx-surface-2)] p-3"><p className="text-[11px] text-[var(--nx-muted)]">Cuota combinada</p><p className="text-xl font-bold tabular-nums text-[var(--nx-ink)]">{formatOdds(odds)}</p></div>
            <div className="rounded-xl bg-[var(--nx-surface-2)] p-3"><p className="text-[11px] text-[var(--nx-muted)]">Probabilidad de mercado</p><p className="text-xl font-bold tabular-nums text-[var(--nx-ink)]">{(prob * 100).toFixed(prob < 0.1 ? 1 : 0).replace('.', ',')} %</p></div>
          </div>
          <button type="button" onClick={() => setResult(simulate(slip, RUNS, STAKE))} className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full bg-[var(--nx-ink)] text-sm font-bold text-[var(--nx-bg)] active:scale-[0.98]">
            <Dices size={16} aria-hidden="true" /> Simular 10.000 jornadas
          </button>
          {result && (
            <div className="space-y-2 rounded-xl border border-[var(--nx-line)] p-3" aria-live="polite">
              <p className="text-[13px] text-[var(--nx-ink-2)]">En <strong>{RUNS.toLocaleString('es-CO')}</strong> jornadas simuladas, la combinada salió en <strong className="text-[var(--nx-ink)]">{(result.winRate * 100).toFixed(1).replace('.', ',')} %</strong>.</p>
              <p className="text-[13px] text-[var(--nx-ink-2)]">Por cada {formatCop(STAKE)}: retorno promedio <strong className="text-[var(--nx-ink)]">{formatCop(result.averagePayout)}</strong> ({result.averageNet >= 0 ? '+' : ''}{formatCop(result.averageNet)} en promedio).</p>
              <DistributionBar result={result} n={slip.length} />
              <p className="text-[11px] text-[var(--nx-muted)]">Simulación estadística con las probabilidades del mercado y partidos independientes. No es una predicción.</p>
            </div>
          )}
          <button type="button" onClick={share} className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full border border-[var(--nx-line)] text-sm font-semibold text-[var(--nx-ink-2)]">
            {shared ? <Check size={15} aria-hidden="true" /> : <Share2 size={15} aria-hidden="true" />} {shared ? 'Copiado' : 'Compartir mi parley'}
          </button>
        </>
      )}
      <ResponsibleBadges />
      <p className="text-[11px] leading-relaxed text-[var(--nx-muted)]">{disclaimer}</p>
    </div>
  )
}

// --------------------------------------------------------------------- página

function Parlays({ data, now }: { data: PicksData; now: Date }) {
  return (
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
  )
}

export default function ParleysClient() {
  const { data, loaded } = usePicks()
  const polls = useMatchPolls()
  const now = useMemo(() => new Date(), [])
  const [slip, setSlip] = useState<Selection[]>([])
  const [note, setNote] = useState<string | null>(null)
  const [sheet, setSheet] = useState(false)
  const provider = data?.matches[0]?.provider ?? 'DraftKings'
  const disclaimer = data?.disclaimer ?? DEFAULT_DISCLAIMER
  const days = useMemo(() => (data ? groupByDay(data.matches) : []), [data])

  useEffect(() => { setSlip(readSlip(safeStorage())) }, [])
  // Si una selección guardada ya no está entre los partidos disponibles, se descarta.
  useEffect(() => {
    if (!data) return
    setSlip((s) => s.filter((x) => data.matches.some((m) => m.id === x.matchId)))
  }, [data])
  useEffect(() => { saveSlip(safeStorage(), slip) }, [slip])

  const pick = (s: Selection) => {
    const r = toggleSelection(slip, s)
    setSlip(r.slip)
    setNote(r.error)
    if (r.error) window.setTimeout(() => setNote(null), 2500)
    try { navigator.vibrate?.(8) } catch { /* sin vibración */ }
  }
  const remove = (s: Selection) => setSlip((cur) => cur.filter((x) => x.matchId !== s.matchId))
  const clear = () => setSlip([])

  return (
    <PortalPage>
      <div className={`${pageShell} max-w-[1200px] pb-28 pt-8 sm:pt-12 lg:pb-20`}>
        <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--nx-accent-text)]"><Ticket size={14} aria-hidden="true" /> Cuotas reales del mercado</p>
        <h1 className="mt-2 text-[clamp(1.75rem,1.4rem+1.5vw,2.5rem)] font-bold leading-[1.1] tracking-[-0.015em] text-[var(--nx-ink)]">Parley del día</h1>
        <ResponsibleBadges className="mt-3" />
        <p className="mt-3 max-w-3xl rounded-xl border border-[var(--nx-line)] bg-[var(--nx-surface)] p-3 text-[13px] leading-relaxed text-[var(--nx-ink-2)]">{disclaimer}</p>

        {!loaded ? (
          <div className="mt-8 grid gap-4 md:grid-cols-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-64" />)}</div>
        ) : !data || (data.parlays.length === 0 && data.matches.length === 0) ? (
          <p className="mt-8 rounded-2xl border border-dashed border-[var(--nx-line-strong)] px-6 py-14 text-center text-sm text-[var(--nx-muted)]">No hay cuotas disponibles para las próximas 48 horas.</p>
        ) : (
          <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="min-w-0 space-y-10">
              {data.parlays.length > 0 && (
                <section aria-labelledby="parlays-h">
                  <h2 id="parlays-h" className="mb-4 text-xl font-bold tracking-[-0.01em] text-[var(--nx-ink)]">Combinadas del día</h2>
                  <Parlays data={data} now={now} />
                </section>
              )}
              {days.map((g) => (
                <section key={g.day} aria-labelledby={`day-${g.day}`}>
                  <h2 id={`day-${g.day}`} className="text-xl font-bold tracking-[-0.01em] text-[var(--nx-ink)]">{g.label}</h2>
                  <p className="mb-4 mt-1 text-sm text-[var(--nx-muted)]">Toca una cuota para sumarla a tu parley. Probabilidad implícita sin el margen del operador · racha G/E/P (más reciente a la derecha).</p>
                  <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {g.matches.map((m) => <MatchOdds key={m.id} m={m} now={now} slip={slip} onPick={pick} poll={polls.get(m.id)} />)}
                  </ul>
                </section>
              ))}
              <p className="text-xs text-[var(--nx-muted)]">Datos: cuotas {provider} vía ESPN + racha últimos 5 partidos.{data.generatedAt ? ` Actualizado ${new Date(data.generatedAt).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })}.` : ''}</p>
            </div>
            {/* Boleto: columna fija en desktop */}
            <aside aria-label="Tu parley" className="hidden lg:block">
              <div className="sticky top-24 rounded-2xl border border-[var(--nx-line)] bg-[var(--nx-surface)] p-4">
                <SlipPanel slip={slip} onRemove={remove} onClear={clear} disclaimer={disclaimer} />
              </div>
            </aside>
          </div>
        )}
      </div>

      {note && <p role="alert" className="fixed inset-x-4 bottom-24 z-[70] mx-auto max-w-sm rounded-full bg-[#DC2626] px-4 py-2 text-center text-sm font-semibold text-white shadow-xl">{note}</p>}

      {/* Boleto en teléfono/tablet: barra inferior que se expande */}
      {loaded && data && (
        <div className="nx-portal fixed inset-x-0 bottom-0 z-[60] lg:hidden" style={{ background: 'transparent', bottom: 'var(--nx-tabbar-h, 0px)' }}>
          {sheet && <button type="button" aria-label="Cerrar parley" className="fixed inset-0 bg-black/50" onClick={() => setSheet(false)} />}
          <div className={`relative rounded-t-[22px] border-t border-[var(--nx-line)] bg-[var(--nx-bg)] shadow-2xl ${sheet ? 'max-h-[80svh] overflow-y-auto' : ''}`}>
            <button type="button" onClick={() => setSheet((v) => !v)} aria-expanded={sheet} className="flex min-h-[56px] w-full items-center gap-3 px-4 pb-[env(safe-area-inset-bottom,0px)] text-left">
              <span className="inline-flex h-9 min-w-9 items-center justify-center rounded-full bg-[#FACC15] px-2 text-sm font-bold text-black">{slip.length}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-bold text-[var(--nx-ink)]">Tu parley</span>
                <span className="block text-[12px] text-[var(--nx-muted)]">{slip.length === 0 ? 'Toca cuotas para armarlo' : `Cuota ${formatOdds(combinedOdds(slip))} · mercado ${(combinedProbability(slip) * 100).toFixed(0)} %`}</span>
              </span>
              <ChevronUp size={18} className={`text-[var(--nx-muted)] transition-transform ${sheet ? 'rotate-180' : ''}`} aria-hidden="true" />
            </button>
            {sheet && <div className="px-4 pb-[calc(env(safe-area-inset-bottom,0px)+16px)]"><SlipPanel slip={slip} onRemove={remove} onClear={clear} disclaimer={disclaimer} /></div>}
          </div>
        </div>
      )}
    </PortalPage>
  )
}
