'use client'

// Piezas compartidas de jugadores: avatar (foto o monograma si la foto
// falla -- ESPN adivina la URL y a veces da 404) y buscador en línea.

import { useState } from 'react'
import Image from 'next/image'
import { Loader2, Search } from 'lucide-react'
import { monogram, monogramHue } from '@/lib/leagueLogos'
import { usePlayerSearch } from '@/lib/usePlayers'
import type { PlayerHit } from '@/lib/players'
import { proxiedImage } from '@/lib/media'

function isEspn(url: string): boolean {
  try { return /(^|\.)espncdn\.com$/.test(new URL(url).hostname) } catch { return false }
}

export function PlayerAvatar({ src, name, size = 56, className = '' }: { src: string | null | undefined; name: string; size?: number; className?: string }) {
  const [failed, setFailed] = useState<string | null>(null)
  const hue = monogramHue(name)
  if (!src || failed === src) {
    return (
      <span
        aria-hidden="true"
        className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold tracking-tight text-white ${className}`}
        style={{ width: size, height: size, fontSize: Math.round(size * 0.36), background: `linear-gradient(135deg, hsl(${hue} 40% 36%), hsl(${(hue + 40) % 360} 45% 20%))` }}
      >
        {monogram(name)}
      </span>
    )
  }
  const url = isEspn(src) ? src : proxiedImage(src) ?? src
  return (
    <span className={`relative inline-block shrink-0 overflow-hidden rounded-full bg-[var(--nx-surface-2)] ${className}`} style={{ width: size, height: size }}>
      <Image src={url} alt="" fill sizes={`${size * 2}px`} className="object-cover object-top" onError={() => setFailed(src)} />
    </span>
  )
}

export function PlayerSearchBox({
  onPick, placeholder = 'Busca un jugador', autoFocus = false, initial = '', id = 'player-search',
}: {
  onPick: (hit: PlayerHit) => void
  placeholder?: string
  autoFocus?: boolean
  initial?: string
  id?: string
}) {
  const [query, setQuery] = useState(initial)
  const { results, status } = usePlayerSearch(query)
  const q = query.trim()
  return (
    <div className="relative">
      <label htmlFor={id} className="sr-only">{placeholder}</label>
      <div className="flex items-center gap-2 rounded-xl border border-[var(--nx-line-strong)] bg-[var(--nx-surface)] px-3 focus-within:border-[#FACC15]">
        <Search size={16} className="shrink-0 text-[var(--nx-muted)]" aria-hidden="true" />
        <input
          id={id}
          type="search"
          value={query}
          autoFocus={autoFocus}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          className="h-12 min-w-0 flex-1 bg-transparent text-[15px] text-[var(--nx-ink)] placeholder:text-[var(--nx-muted)] focus:outline-none"
        />
        {status === 'loading' && <Loader2 size={15} className="shrink-0 animate-spin text-[var(--nx-muted)]" aria-hidden="true" />}
      </div>
      {q.length >= 2 && status !== 'loading' && (
        <ul className="mt-2 max-h-72 overflow-y-auto rounded-xl border border-[var(--nx-line)] bg-[var(--nx-surface)] p-1" aria-live="polite">
          {status === 'unavailable' && <li className="px-3 py-3 text-sm text-[var(--nx-muted)]">La búsqueda de jugadores no está disponible ahora.</li>}
          {status === 'ready' && results.length === 0 && <li className="px-3 py-3 text-sm text-[var(--nx-muted)]">Sin resultados para “{q}”.</li>}
          {results.slice(0, 8).map((hit) => (
            <li key={hit.id}>
              <button type="button" onClick={() => { onPick(hit); setQuery('') }} className="flex min-h-[52px] w-full items-center gap-3 rounded-lg px-2 text-left hover:bg-[var(--nx-surface-2)]">
                <PlayerAvatar src={hit.image} name={hit.name} size={36} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-[var(--nx-ink)]">{hit.name}</span>
                  <span className="block truncate text-xs text-[var(--nx-muted)]">{hit.team ?? 'Jugador'}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
