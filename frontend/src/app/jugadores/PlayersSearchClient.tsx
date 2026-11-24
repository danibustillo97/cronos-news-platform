'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowUpRight, Clock, Loader2, Search, Swords } from 'lucide-react'
import PortalPage, { pageShell } from '@/components/portal/PortalPage'
import { PlayerAvatar } from '@/components/portal/PlayerBits'
import { usePlayerSearch } from '@/lib/usePlayers'
import { POPULAR_PLAYERS, pushRecent, readRecent, safeStorage, type PlayerHit } from '@/lib/players'

function ResultCard({ hit, onVisit }: { hit: PlayerHit; onVisit: (h: PlayerHit) => void }) {
  return (
    <li className="flex items-center gap-3 rounded-2xl border border-[var(--nx-line)] bg-[var(--nx-surface)] p-3 transition-colors hover:border-[var(--nx-line-strong)]">
      <Link href={`/jugadores/${encodeURIComponent(hit.id)}`} onClick={() => onVisit(hit)} className="flex min-h-[48px] min-w-0 flex-1 items-center gap-3">
        <PlayerAvatar src={hit.image} name={hit.name} size={48} />
        <span className="min-w-0">
          <span className="block truncate text-[15px] font-semibold text-[var(--nx-ink)]">{hit.name}</span>
          <span className="block truncate text-xs text-[var(--nx-muted)]">{hit.team ?? 'Jugador'}</span>
        </span>
      </Link>
      <Link
        href={`/jugadores/comparar?a=${encodeURIComponent(hit.id)}`}
        onClick={() => onVisit(hit)}
        aria-label={`Comparar a ${hit.name}`}
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--nx-muted)] hover:bg-[var(--nx-surface-2)] hover:text-[var(--nx-ink)]"
      >
        <Swords size={17} />
      </Link>
    </li>
  )
}

export default function PlayersSearchClient() {
  const router = useRouter()
  const params = useSearchParams()
  const [query, setQuery] = useState(params.get('q') ?? '')
  const [recent, setRecent] = useState<PlayerHit[]>([])
  const { results, status } = usePlayerSearch(query)
  const q = query.trim()

  useEffect(() => { setRecent(readRecent(safeStorage())) }, [])

  // URL compartible con la búsqueda actual (sin ensuciar el historial).
  useEffect(() => {
    const t = window.setTimeout(() => {
      const next = q.length >= 2 ? `/jugadores?q=${encodeURIComponent(q)}` : '/jugadores'
      if (window.location.pathname + window.location.search !== next) router.replace(next, { scroll: false })
    }, 400)
    return () => window.clearTimeout(t)
  }, [q, router])

  const visit = (hit: PlayerHit) => setRecent(pushRecent(safeStorage(), hit))

  return (
    <PortalPage>
      <div className={`${pageShell} max-w-[1200px] pb-20 pt-8 sm:pt-12`}>
        <header className="max-w-2xl">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--nx-accent-text)]">Base de jugadores</p>
          <h1 className="mt-2 text-[clamp(1.75rem,1.4rem+1.5vw,2.5rem)] font-bold leading-[1.1] tracking-[-0.015em] text-[var(--nx-ink)]">Jugadores</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-[var(--nx-ink-2)]">Busca a cualquier futbolista, revisa sus números por temporada y compáralo con otro.</p>
        </header>

        <div className="mt-6 max-w-2xl">
          <label htmlFor="players-q" className="sr-only">Buscar jugador</label>
          <div className="flex items-center gap-2 rounded-2xl border border-[var(--nx-line-strong)] bg-[var(--nx-surface)] px-4 focus-within:border-[#FACC15]">
            <Search size={18} className="shrink-0 text-[var(--nx-muted)]" aria-hidden="true" />
            <input
              id="players-q"
              type="search"
              value={query}
              autoFocus
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ej.: Luis Díaz, Messi, Haaland"
              autoComplete="off"
              className="h-14 min-w-0 flex-1 bg-transparent text-base text-[var(--nx-ink)] placeholder:text-[var(--nx-muted)] focus:outline-none"
            />
            {status === 'loading' && <Loader2 size={16} className="shrink-0 animate-spin text-[var(--nx-muted)]" aria-hidden="true" />}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {POPULAR_PLAYERS.map((name) => (
              <button key={name} type="button" onClick={() => setQuery(name)} className="inline-flex min-h-[40px] items-center rounded-full border border-[var(--nx-line)] px-3.5 text-[13px] font-semibold text-[var(--nx-ink-2)] hover:border-[var(--nx-line-strong)] hover:text-[var(--nx-ink)]">
                {name}
              </button>
            ))}
          </div>
        </div>

        <section aria-live="polite" aria-label="Resultados" className="mt-10">
          {q.length >= 2 ? (
            <>
              <h2 className="mb-3 text-sm font-semibold text-[var(--nx-muted)]">
                {status === 'loading' ? 'Buscando…' : status === 'unavailable' ? 'La búsqueda no está disponible en este momento.' : `${results.length} resultado${results.length === 1 ? '' : 's'} para “${q}”`}
              </h2>
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {results.map((hit) => <ResultCard key={hit.id} hit={hit} onVisit={visit} />)}
              </ul>
            </>
          ) : recent.length > 0 ? (
            <>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--nx-muted)]"><Clock size={14} aria-hidden="true" /> Vistos recientemente</h2>
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {recent.map((hit) => <ResultCard key={hit.id} hit={hit} onVisit={visit} />)}
              </ul>
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-[var(--nx-line-strong)] px-6 py-12 text-center">
              <p className="text-base font-semibold text-[var(--nx-ink)]">Empieza escribiendo dos letras.</p>
              <p className="mt-1 text-sm text-[var(--nx-muted)]">O prueba con una de las sugerencias de arriba.</p>
            </div>
          )}
        </section>

        <Link href="/jugadores/comparar" className="mt-10 inline-flex min-h-[48px] items-center gap-2 rounded-full bg-[var(--nx-ink)] px-5 text-sm font-bold text-[var(--nx-bg)]">
          <Swords size={16} aria-hidden="true" /> Comparar dos jugadores <ArrowUpRight size={15} aria-hidden="true" />
        </Link>
      </div>
    </PortalPage>
  )
}
