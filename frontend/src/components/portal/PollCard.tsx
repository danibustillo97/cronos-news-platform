'use client'

// Encuestas y debates. Encuesta: opciones como botones grandes; al votar
// (o si ya votaste / está cerrada) se muestran resultados con barras.
// Debate: exactamente 2 lados enfrentados con su argumento, barra de
// porcentaje en vivo y botón de compartir.

import { useState } from 'react'
import { Check, Loader2, Share2, Swords, Vote } from 'lucide-react'
import { closesLabel, formatVotes, isClosed, leaderId, percentages, type Poll } from '@/lib/polls'
import { usePollVote } from '@/lib/usePolls'
import { useNow } from './useNow'

function shareUrl(poll: Poll): string {
  return `${window.location.origin}/encuestas#encuesta-${encodeURIComponent(poll.id)}`
}

function ShareButton({ poll, className = '' }: { poll: Poll; className?: string }) {
  const [copied, setCopied] = useState(false)
  const share = async () => {
    const url = shareUrl(poll)
    try {
      if (navigator.share) { await navigator.share({ title: poll.question, url }); return }
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch { /* cancelado por el usuario */ }
  }
  return (
    <button type="button" onClick={share} className={`inline-flex min-h-[44px] items-center gap-2 rounded-full border border-[var(--nx-line)] px-4 text-xs font-semibold text-[var(--nx-ink-2)] hover:border-[var(--nx-line-strong)] hover:text-[var(--nx-ink)] ${className}`}>
      {copied ? <Check size={14} aria-hidden="true" /> : <Share2 size={14} aria-hidden="true" />}
      {copied ? 'Enlace copiado' : 'Compartir'}
    </button>
  )
}

function Footer({ poll, now, voted }: { poll: Poll; now: Date; voted: boolean }) {
  return (
    <p className="text-xs text-[var(--nx-muted)]">
      {formatVotes(poll.totalVotes)} · {closesLabel(poll, now)}
      {voted && <span className="ml-1 font-semibold text-[var(--nx-accent-text)]">· Ya votaste</span>}
    </p>
  )
}

function ErrorLine({ show }: { show: boolean }) {
  if (!show) return null
  return <p role="alert" className="text-xs font-semibold text-[#DC2626]">No pudimos registrar tu voto. Intenta de nuevo.</p>
}

export function PollCard({ poll: initial, compact = false, bare = false }: { poll: Poll; compact?: boolean; bare?: boolean }) {
  const Tag = bare ? 'div' : 'article'
  const { poll, voted, vote, state } = usePollVote(initial)
  const now = useNow(60_000)
  const closed = isClosed(poll, now)
  const showResults = Boolean(voted) || closed
  const pcts = percentages(poll.options)
  const leader = leaderId(poll)

  return (
    <Tag id={`encuesta-${poll.id}`} className={`flex h-full flex-col gap-4 ${bare ? '' : 'rounded-2xl border border-[var(--nx-line)] bg-[var(--nx-surface)] p-5'}`}>
      {!bare && (
        <span className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--nx-accent-text)]">
          <Vote size={14} aria-hidden="true" /> Encuesta
        </span>
      )}
      <h3 className={`font-bold leading-snug text-[var(--nx-ink)] ${compact ? 'text-base' : 'text-lg'}`}>{poll.question}</h3>
      {poll.context && !compact && <p className="text-sm leading-relaxed text-[var(--nx-ink-2)]">{poll.context}</p>}

      <ul className="flex flex-col gap-2" aria-live="polite">
        {poll.options.map((o, i) => {
          const mine = voted === o.id
          if (showResults) {
            const win = o.id === leader
            return (
              <li key={o.id} className="relative overflow-hidden rounded-xl border border-[var(--nx-line)]">
                <span aria-hidden className={`absolute inset-y-0 left-0 transition-[width] duration-700 ${win ? 'bg-[#FACC15]/30' : 'bg-[var(--nx-surface-3)]'}`} style={{ width: `${pcts[i]}%` }} />
                <span className="relative flex min-h-[44px] items-center justify-between gap-3 px-3.5 text-sm">
                  <span className={`flex items-center gap-2 ${win ? 'font-bold text-[var(--nx-ink)]' : 'font-medium text-[var(--nx-ink-2)]'}`}>
                    {mine && <Check size={14} className="shrink-0 text-[var(--nx-accent-text)]" aria-label="Tu voto" />}
                    {o.label}
                  </span>
                  <span className="shrink-0 font-bold tabular-nums text-[var(--nx-ink)]">{pcts[i]}%</span>
                </span>
              </li>
            )
          }
          return (
            <li key={o.id}>
              <button
                type="button"
                disabled={state === 'sending'}
                onClick={() => vote(o.id)}
                className="flex min-h-[48px] w-full items-center justify-between gap-3 rounded-xl border border-[var(--nx-line-strong)] px-4 text-left text-sm font-semibold text-[var(--nx-ink)] transition-colors hover:border-[#FACC15] hover:bg-[var(--nx-surface-2)] disabled:opacity-60"
              >
                {o.label}
                {state === 'sending' ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : null}
              </button>
            </li>
          )
        })}
      </ul>
      <ErrorLine show={state === 'error'} />
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
        <Footer poll={poll} now={now} voted={Boolean(voted)} />
        {!compact && !bare && <ShareButton poll={poll} />}
      </div>
    </Tag>
  )
}

/** Debate: dos lados enfrentados. `hero` = versión grande de portada. */
export function DebateCard({ poll: initial, hero = false, bare = false }: { poll: Poll; hero?: boolean; bare?: boolean }) {
  const Tag = bare ? 'div' : 'article'
  const { poll, voted, vote, state } = usePollVote(initial)
  const now = useNow(60_000)
  const closed = isClosed(poll, now)
  const showResults = Boolean(voted) || closed
  const [a, b] = poll.options
  const [pa, pb] = percentages(poll.options)
  const leader = leaderId(poll)

  const side = (o: typeof a, pct: number, align: 'left' | 'right') => {
    const mine = voted === o.id
    const win = showResults && leader === o.id
    return (
      <div className={`flex min-w-0 flex-1 flex-col gap-3 rounded-xl p-4 sm:p-5 ${align === 'left' ? 'bg-[#FACC15]/[0.10] ring-1 ring-inset ring-[#FACC15]/30' : 'bg-[var(--nx-surface-2)] ring-1 ring-inset ring-[var(--nx-line)]'}`}>
        <div className="flex items-baseline justify-between gap-2">
          <span className={`text-[11px] font-bold uppercase tracking-[0.14em] ${align === 'left' ? 'text-[var(--nx-accent-text)]' : 'text-[var(--nx-muted)]'}`}>{align === 'left' ? 'Lado A' : 'Lado B'}</span>
          {showResults && <span className={`text-2xl font-bold tabular-nums ${win ? 'text-[var(--nx-ink)]' : 'text-[var(--nx-muted)]'}`}>{pct}%</span>}
        </div>
        <h4 className="text-lg font-bold leading-snug text-[var(--nx-ink)]">{o.label}</h4>
        {o.argument && <p className="text-sm leading-relaxed text-[var(--nx-ink-2)]">{o.argument}</p>}
        <div className="mt-auto pt-1">
          {showResults ? (
            mine ? <span className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-semibold text-[var(--nx-accent-text)]"><Check size={15} aria-hidden="true" /> Tu voto</span> : null
          ) : (
            <button
              type="button"
              disabled={state === 'sending'}
              onClick={() => vote(o.id)}
              className={`inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full px-4 text-sm font-bold transition-transform active:scale-[0.98] disabled:opacity-60 ${align === 'left' ? 'bg-[#FACC15] text-black' : 'bg-[var(--nx-ink)] text-[var(--nx-bg)]'}`}
            >
              {state === 'sending' && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
              Estoy con este lado
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <Tag id={`encuesta-${poll.id}`} className={`flex h-full flex-col gap-4 ${bare ? '' : `rounded-2xl border border-[var(--nx-line)] bg-[var(--nx-surface)] ${hero ? 'p-5 sm:p-7' : 'p-5'}`}`}>
      <div className={`flex flex-wrap items-center justify-between gap-2 ${bare ? 'hidden' : ''}`}>
        <span className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--nx-accent-text)]">
          <Swords size={14} aria-hidden="true" /> {hero ? 'El debate del día' : 'Debate'}
        </span>
        <span className="text-xs text-[var(--nx-muted)]">{closesLabel(poll, now)}</span>
      </div>
      <div className={hero ? 'max-w-3xl' : ''}>
        <h3 className={`text-balance font-bold leading-[1.2] tracking-[-0.01em] text-[var(--nx-ink)] ${hero ? 'text-[clamp(1.25rem,1.05rem+0.9vw,1.75rem)]' : 'text-lg'}`}>{poll.question}</h3>
        {poll.context && <p className="mt-2 text-sm leading-relaxed text-[var(--nx-ink-2)]">{poll.context}</p>}
      </div>

      {/* Barra en vivo: siempre visible si ya hay votos, para invitar a participar */}
      {(showResults || poll.totalVotes > 0) && (
        <div aria-label={`${a.label} ${pa}%, ${b.label} ${pb}%`} role="img" className="flex h-2.5 overflow-hidden rounded-full bg-[var(--nx-surface-3)]">
          <span className="h-full bg-[#FACC15] transition-[width] duration-700" style={{ width: `${pa}%` }} />
          <span className="h-full bg-[var(--nx-ink-2)] transition-[width] duration-700" style={{ width: `${pb}%` }} />
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row" aria-live="polite">
        {side(a, pa, 'left')}
        <span aria-hidden className="hidden self-center text-xs font-bold uppercase tracking-[0.2em] text-[var(--nx-muted)] sm:block">vs</span>
        {side(b, pb, 'right')}
      </div>
      <ErrorLine show={state === 'error'} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Footer poll={poll} now={now} voted={Boolean(voted)} />
        {!bare && <ShareButton poll={poll} />}
      </div>
    </Tag>
  )
}

export function PollBlock({ poll, compact, hero, bare }: { poll: Poll; compact?: boolean; hero?: boolean; bare?: boolean }) {
  return poll.kind === 'debate' ? <DebateCard poll={poll} hero={hero} bare={bare} /> : <PollCard poll={poll} compact={compact} bare={bare} />
}
