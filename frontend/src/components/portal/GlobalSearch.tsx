'use client'

// Buscador global: jugadores (/api/players/search) + noticias publicadas
// (Supabase, título). Resultados al instante con debounce; si el
// endpoint de jugadores no existe todavía, esa sección se omite.

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Loader2, Newspaper, Search, User, X } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { filterCurrentNews, newsQueryFloor } from '@/lib/newsFreshness'
import { usePlayerSearch } from '@/lib/usePlayers'
import { proxiedImage } from '@/lib/media'
import { POPULAR_PLAYERS } from '@/lib/players'
import { timeAgo } from '@/lib/feedComposer'
import { TeamCrest } from './Crest'

interface NewsHit { id: string; title: string; slug: string; published_at: string; category: string | null }

function useNewsSearch(query: string) {
  const [hits, setHits] = useState<NewsHit[]>([])
  const [loading, setLoading] = useState(false)
  const q = query.trim()
  useEffect(() => {
    if (q.length < 2) { setHits([]); setLoading(false); return }
    let cancelled = false
    setLoading(true)
    const timer = window.setTimeout(() => {
      const safe = q.replace(/[%_,()]/g, ' ')
      supabase.from('news').select('id,title,slug,published_at,category').eq('status', 'published').gte('published_at', newsQueryFloor())
        .ilike('title', `%${safe}%`).order('published_at', { ascending: false }).limit(6)
        .then(({ data, error }) => {
          if (cancelled) return
          setHits(error ? [] : filterCurrentNews((data ?? []) as NewsHit[]))
          setLoading(false)
        })
    }, 250)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [q])
  return { hits, loading }
}

export default function GlobalSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const players = usePlayerSearch(open ? query : '')
  const news = useNewsSearch(open ? query : '')
  const q = query.trim()

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const t = window.setTimeout(() => inputRef.current?.focus(), 30)
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = prev; window.clearTimeout(t); window.removeEventListener('keydown', onKey) }
  }, [open, onClose])

  if (!open) return null
  const busy = players.status === 'loading' || news.loading
  const showPlayers = players.status !== 'unavailable'
  const nothing = q.length >= 2 && !busy && news.hits.length === 0 && (players.results.length === 0)

  return (
    <div className="fixed inset-0 z-[75]" role="dialog" aria-modal="true" aria-label="Buscar en NEXUS">
      <button type="button" aria-label="Cerrar búsqueda" className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative mx-auto flex h-full w-full max-w-2xl flex-col bg-[var(--nx-bg)] sm:mt-[10vh] sm:h-auto sm:max-h-[75vh] sm:rounded-2xl sm:border sm:border-[var(--nx-line)] sm:shadow-2xl">
        <div className="flex items-center gap-2 border-b border-[var(--nx-line)] px-3 py-2">
          <Search size={18} className="ml-1 shrink-0 text-[var(--nx-muted)]" aria-hidden="true" />
          <label htmlFor="global-search" className="sr-only">Buscar jugadores y noticias</label>
          <input
            ref={inputRef}
            id="global-search"
            type="text"
            role="searchbox"
            enterKeyHint="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Busca un jugador o una noticia"
            autoComplete="off"
            className="h-12 min-w-0 flex-1 bg-transparent text-base text-[var(--nx-ink)] placeholder:text-[var(--nx-muted)] focus:outline-none focus-visible:!outline-none"
          />
          {busy && <Loader2 size={16} className="shrink-0 animate-spin text-[var(--nx-muted)]" aria-hidden="true" />}
          <button type="button" onClick={onClose} aria-label="Cerrar" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--nx-muted)] hover:bg-[var(--nx-surface-2)]">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2" aria-live="polite">
          {q.length < 2 ? (
            <div className="p-3">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--nx-muted)]">Búsquedas populares</p>
              <ul className="flex flex-wrap gap-2">
                {POPULAR_PLAYERS.map((name) => (
                  <li key={name}>
                    <button type="button" onClick={() => setQuery(name)} className="inline-flex min-h-[40px] items-center rounded-full border border-[var(--nx-line)] px-3.5 text-sm font-semibold text-[var(--nx-ink-2)] hover:border-[var(--nx-line-strong)] hover:text-[var(--nx-ink)]">
                      {name}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <>
              {showPlayers && players.results.length > 0 && (
                <section aria-label="Jugadores" className="mb-2">
                  <p className="px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--nx-muted)]">Jugadores</p>
                  <ul>
                    {players.results.slice(0, 6).map((p) => (
                      <li key={p.id}>
                        <Link href={`/jugadores/${encodeURIComponent(p.id)}`} onClick={onClose} className="flex min-h-[56px] items-center gap-3 rounded-xl px-3 hover:bg-[var(--nx-surface-2)]">
                          {p.image ? (
                            <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-[var(--nx-surface-2)]">
                              <Image src={proxiedImage(p.image) ?? ''} alt="" fill sizes="40px" className="object-cover" />
                            </span>
                          ) : <TeamCrest src={null} name={p.name} size={40} />}
                          <span className="min-w-0">
                            <span className="block truncate text-[15px] font-semibold text-[var(--nx-ink)]">{p.name}</span>
                            <span className="block truncate text-xs text-[var(--nx-muted)]">{p.team ?? 'Jugador'}</span>
                          </span>
                          <User size={15} className="ml-auto shrink-0 text-[var(--nx-muted)]" aria-hidden="true" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {news.hits.length > 0 && (
                <section aria-label="Noticias">
                  <p className="px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--nx-muted)]">Noticias</p>
                  <ul>
                    {news.hits.map((n) => (
                      <li key={n.id}>
                        <Link href={`/noticia/${n.slug}`} onClick={onClose} className="flex min-h-[56px] items-center gap-3 rounded-xl px-3 py-2 hover:bg-[var(--nx-surface-2)]">
                          <Newspaper size={16} className="shrink-0 text-[var(--nx-accent-text)]" aria-hidden="true" />
                          <span className="min-w-0">
                            <span className="block text-[15px] font-semibold leading-snug text-[var(--nx-ink)]">{n.title}</span>
                            <span className="block text-xs text-[var(--nx-muted)]">{n.category ?? 'Noticia'} · {timeAgo(n.published_at)}</span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {nothing && <p className="px-3 py-8 text-center text-sm text-[var(--nx-muted)]">Sin resultados para “{q}”.</p>}
              <Link href={`/jugadores?q=${encodeURIComponent(q)}`} onClick={onClose} className="mt-1 flex min-h-[48px] items-center justify-center rounded-xl text-sm font-semibold text-[var(--nx-accent-text)] hover:bg-[var(--nx-surface-2)]">
                Ver todos los jugadores para “{q}”
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
