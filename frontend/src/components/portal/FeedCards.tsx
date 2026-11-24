'use client'

// Tarjetas del feed "Pulso". Cada formato responde una necesidad distinta
// (leer, entender rápido, citar, seguir un partido, ver cifras) -- por eso
// tienen tamaños y tratamientos visuales distintos, no la misma card
// repetida en secuencia.

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowUpRight, Hash, Play, Quote, Search, Swords, Timer, TrendingUp, Trophy } from 'lucide-react'
import { proxiedImage } from '@/lib/media'
import { timeAgo } from '@/lib/feedComposer'
import { estimateReadMinutes } from '@/lib/readTime'
import { useStandings } from '@/lib/useStandings'
import { LEAGUE_LABELS } from '@/lib/leagueLogos'
import type { NewsView } from '@/types/news'
import { StoryLink } from './StoryLink'
import { TeamCrest, LeagueBadge } from './Crest'
import { Kicker, Skeleton } from './PortalBits'

type Open = (s: NewsView) => void

const cardBase = 'group relative flex h-full flex-col overflow-hidden rounded-2xl border border-[var(--nx-line)] bg-[var(--nx-surface)] transition-colors hover:border-[var(--nx-line-strong)]'

function Meta({ story, now }: { story: NewsView; now: Date }) {
  const minutes = estimateReadMinutes(story.content, story.excerpt)
  return (
    <span className="flex flex-wrap items-center gap-x-2 text-[11px] font-semibold text-[var(--nx-muted)]">
      <span>{timeAgo(story.published_at, now)}</span>
      {minutes > 0 && <><span aria-hidden>·</span><span>{minutes} min</span></>}
      {story.source && <><span aria-hidden>·</span><span className="truncate">{story.source.split('·')[0].trim()}</span></>}
    </span>
  )
}

function Cover({ story, sizes, className }: { story: NewsView; sizes: string; className: string }) {
  const src = proxiedImage(story.image_url)
  return (
    <span className={`relative block overflow-hidden bg-[var(--nx-surface-2)] ${className}`}>
      {src ? (
        <Image src={src} alt="" fill sizes={sizes} className="object-cover transition-transform duration-700 group-hover:scale-[1.04]" />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center text-xl font-black text-[var(--nx-accent-text)]/40">NEXUS</span>
      )}
    </span>
  )
}

export function StoryCard({ story, size, now, onOpen }: { story: NewsView; size: 'lead' | 'wide' | 'standard'; now: Date; onOpen: Open }) {
  if (size === 'lead') {
    return (
      <article className={`${cardBase} min-h-[360px] bg-neutral-950 text-white sm:min-h-[460px]`}>
        <Cover story={story} sizes="(max-width: 640px) 100vw, (max-width: 1280px) 66vw, 760px" className="!absolute inset-0" />
        <span aria-hidden className="absolute inset-x-0 bottom-0 h-3/4 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />
        <div className="relative mt-auto p-5 sm:p-7">
          <Kicker className="!text-[#FACC15]">{story.category || 'Historia'}</Kicker>
          <h3 className="mt-2 text-balance text-[clamp(1.25rem,1rem+1vw,1.875rem)] font-extrabold leading-[1.15] tracking-[-0.01em] line-clamp-3">
            <StoryLink story={story} onOpen={onOpen} className="after:absolute after:inset-0 after:content-['']">{story.title}</StoryLink>
          </h3>
          {story.excerpt && <p className="mt-2.5 max-w-xl text-[15px] leading-relaxed text-white/80 line-clamp-2">{story.excerpt}</p>}
          <span className="mt-4 block [&_*]:!text-white/70"><Meta story={story} now={now} /></span>
        </div>
      </article>
    )
  }
  if (size === 'wide') {
    return (
      <article className={`${cardBase} sm:flex-row`}>
        <Cover story={story} sizes="(max-width: 640px) 100vw, 400px" className="aspect-[16/10] sm:aspect-auto sm:w-1/2" />
        <div className="flex flex-1 flex-col gap-2 p-5">
          <Kicker>{story.category || 'Historia'}</Kicker>
          <h3 className="text-lg font-extrabold leading-snug tracking-[-0.005em] text-[var(--nx-ink)] line-clamp-3">
            <StoryLink story={story} onOpen={onOpen} className="after:absolute after:inset-0 after:content-['']">{story.title}</StoryLink>
          </h3>
          {story.excerpt && <p className="text-sm leading-relaxed text-[var(--nx-ink-2)] line-clamp-3">{story.excerpt}</p>}
          <span className="mt-auto pt-2"><Meta story={story} now={now} /></span>
        </div>
      </article>
    )
  }
  return (
    <article className={cardBase}>
      <Cover story={story} sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 400px" className="aspect-[16/10]" />
      <div className="flex flex-1 flex-col gap-2 p-4">
        <Kicker>{story.category || 'Historia'}</Kicker>
        <h3 className="text-base font-bold leading-snug text-[var(--nx-ink)] line-clamp-3">
          <StoryLink story={story} onOpen={onOpen} className="after:absolute after:inset-0 after:content-['']">{story.title}</StoryLink>
        </h3>
        <span className="mt-auto pt-1"><Meta story={story} now={now} /></span>
      </div>
    </article>
  )
}

export function BriefCard({ story, points, onOpen }: { story: NewsView; points: string[]; onOpen: Open }) {
  return (
    <article className="relative flex h-full flex-col gap-4 overflow-hidden rounded-2xl bg-[#FACC15] p-5 text-black">
      <span className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em]">
        <Timer size={14} aria-hidden="true" /> En 30 segundos
      </span>
      <h3 className="text-base font-extrabold leading-snug line-clamp-3">{story.title}</h3>
      <ol className="flex flex-col gap-2.5">
        {points.map((point, i) => (
          <li key={i} className="flex gap-3 text-sm font-semibold leading-snug">
            <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-black text-[10px] font-black text-[#FACC15]">{i + 1}</span>
            <span>{point}</span>
          </li>
        ))}
      </ol>
      <StoryLink story={story} onOpen={onOpen} className="mt-auto inline-flex min-h-[44px] items-center gap-1.5 self-start rounded-full bg-black px-4 text-xs font-black text-white" ariaLabel={`Leer completa: ${story.title}`}>
        Leer completa <ArrowUpRight size={14} aria-hidden="true" />
      </StoryLink>
    </article>
  )
}

export function QuoteCard({ story, quote, onOpen }: { story: NewsView; quote: string; onOpen: Open }) {
  return (
    <figure className={`${cardBase} justify-between gap-5 p-6`}>
      <Quote size={36} className="text-[var(--nx-accent-text)]" fill="currentColor" aria-hidden="true" />
      <blockquote className="text-balance text-lg font-bold leading-snug text-[var(--nx-ink)] sm:text-xl">
        “{quote}”
      </blockquote>
      <figcaption className="border-t border-[var(--nx-line)] pt-3">
        <Kicker>Declaración</Kicker>
        <StoryLink story={story} onOpen={onOpen} className="mt-1 block text-sm font-bold leading-snug text-[var(--nx-ink-2)] after:absolute after:inset-0 after:content-[''] hover:text-[var(--nx-ink)]">
          {story.title}
        </StoryLink>
      </figcaption>
    </figure>
  )
}

export function StatCard({ stats }: { stats: { label: string; value: number }[] }) {
  return (
    <article className={`${cardBase} gap-4 p-5`}>
      <span className="inline-flex items-center gap-2"><TrendingUp size={14} className="text-[var(--nx-accent-text)]" aria-hidden="true" /><Kicker>El día en cifras</Kicker></span>
      <dl className="grid grid-cols-3 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="flex flex-col">
            <dt className="mb-2 text-[10px] font-black uppercase tracking-[0.12em] text-[var(--nx-muted)]">{s.label}</dt>
            <dd className="text-3xl font-extrabold tabular-nums leading-none text-[var(--nx-ink)] sm:text-4xl">{s.value}</dd>
          </div>
        ))}
      </dl>
      <Link href="/deportes/futbol" className="mt-auto inline-flex min-h-[44px] items-center gap-1.5 self-start text-xs font-bold text-[var(--nx-accent-text)] hover:underline">
        Ver la jornada <ArrowUpRight size={14} aria-hidden="true" />
      </Link>
    </article>
  )
}

export function TrendingCard({ topics, active, onSelect }: { topics: { tag: string; count: number }[]; active: string | null; onSelect: (tag: string | null) => void }) {
  return (
    <article className={`${cardBase} gap-4 p-5`}>
      <span className="inline-flex items-center gap-2"><Hash size={14} className="text-[var(--nx-accent-text)]" aria-hidden="true" /><Kicker>Se habla de</Kicker></span>
      <ul className="flex flex-wrap gap-2">
        {topics.map((t, i) => {
          const on = active?.toLowerCase() === t.tag.toLowerCase()
          return (
            <li key={t.tag}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => onSelect(on ? null : t.tag)}
                className={`inline-flex min-h-[44px] items-center gap-2 rounded-full border px-4 text-sm font-bold transition-colors ${
                  on ? 'border-transparent bg-[#FACC15] text-black' : 'border-[var(--nx-line)] text-[var(--nx-ink)] hover:border-[var(--nx-line-strong)]'
                } ${i === 0 ? 'text-base' : ''}`}
              >
                {t.tag}
                {t.count > 1 && <span className="text-[11px] tabular-nums opacity-60">{t.count}</span>}
              </button>
            </li>
          )
        })}
      </ul>
      <p className="mt-auto text-[11px] text-[var(--nx-muted)]">Toca un tema para filtrar el Pulso.</p>
    </article>
  )
}

export function VideoCard({ story, embedUrl, onOpen }: { story: NewsView; embedUrl: string; onOpen: Open }) {
  const [playing, setPlaying] = useState(false)
  const id = embedUrl.match(/\/embed\/([A-Za-z0-9_-]{11})/)?.[1] ?? null
  const thumb = id ? proxiedImage(`https://i.ytimg.com/vi/${id}/hqdefault.jpg`) : proxiedImage(story.image_url)
  return (
    <article className={cardBase}>
      <div className="relative aspect-video bg-black">
        {playing ? (
          <iframe
            src={`${embedUrl}${embedUrl.includes('?') ? '&' : '?'}autoplay=1`}
            title={story.title}
            className="absolute inset-0 h-full w-full border-0"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
          />
        ) : (
          <button type="button" onClick={() => setPlaying(true)} className="group/play absolute inset-0" aria-label={`Reproducir video: ${story.title}`}>
            {thumb && <Image src={thumb} alt="" fill sizes="(max-width: 640px) 100vw, 400px" className="object-cover opacity-90" />}
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-[#FACC15] text-black shadow-xl transition-transform group-hover/play:scale-110">
                <Play size={26} fill="currentColor" className="ml-1" aria-hidden="true" />
              </span>
            </span>
          </button>
        )}
      </div>
      <div className="flex flex-col gap-1.5 p-4">
        <Kicker>Video</Kicker>
        <StoryLink story={story} onOpen={onOpen} className="text-base font-bold leading-snug text-[var(--nx-ink)] line-clamp-2 hover:underline">{story.title}</StoryLink>
      </div>
    </article>
  )
}

export function StandingsSnippet({ league, dark, className }: { league: string; dark: boolean; className: string }) {
  const { table, loading } = useStandings(league)
  const label = LEAGUE_LABELS[league] ?? league
  if (loading) return <li className={className}><Skeleton className="h-full min-h-[300px]" /></li>
  if (table.length === 0) return null
  return (
    <li className={className}>
      <article className={`${cardBase} gap-3 p-5`}>
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-2"><Trophy size={14} className="text-[var(--nx-accent-text)]" aria-hidden="true" /><Kicker>Así va la tabla</Kicker></span>
          <LeagueBadge league={league} name={label} size={22} dark={dark} />
        </div>
        <h3 className="text-base font-extrabold text-[var(--nx-ink)]">{label}</h3>
        <ol className="flex flex-col">
          {table.slice(0, 5).map((row) => (
            <li key={`${row.rank}-${row.team}`} className="flex min-h-[40px] items-center gap-3 border-t border-[var(--nx-line)] first:border-t-0">
              <span className="w-5 text-center text-xs font-black tabular-nums text-[var(--nx-muted)]">{row.rank}</span>
              <TeamCrest src={row.logo} name={row.team} size={22} />
              <span className="min-w-0 flex-1 truncate text-sm font-bold text-[var(--nx-ink)]">{row.team}</span>
              <span className="text-[11px] tabular-nums text-[var(--nx-muted)]">{row.played} PJ</span>
              <span className="w-8 text-right text-sm font-black tabular-nums text-[var(--nx-ink)]">{row.points}</span>
            </li>
          ))}
        </ol>
        <Link href={`/deportes/futbol/tabla?league=${league}`} className="mt-auto inline-flex min-h-[44px] items-center gap-1.5 self-start text-xs font-bold text-[var(--nx-accent-text)] hover:underline">
          Tabla completa <ArrowUpRight size={14} aria-hidden="true" />
        </Link>
      </article>
    </li>
  )
}

/** Herramienta: comparador de jugadores (no muestra datos inventados, solo invita a usarlo). */
export function PlayersToolCard() {
  return (
    <article className={`${cardBase} justify-between gap-5 p-5`}>
      <div>
        <span className="inline-flex items-center gap-2"><Swords size={14} className="text-[var(--nx-accent-text)]" aria-hidden="true" /><Kicker>Cara a cara</Kicker></span>
        <h3 className="mt-2 text-lg font-bold leading-snug text-[var(--nx-ink)]">Compara a dos jugadores, estadística por estadística</h3>
        <p className="mt-2 text-sm leading-relaxed text-[var(--nx-ink-2)]">Goles, asistencias, remates y disciplina por temporada y competición.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href="/jugadores/comparar" className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-[var(--nx-ink)] px-4 text-xs font-bold text-[var(--nx-bg)]">
          Comparar jugadores <ArrowUpRight size={14} aria-hidden="true" />
        </Link>
        <Link href="/jugadores" className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-[var(--nx-line)] px-4 text-xs font-semibold text-[var(--nx-ink-2)] hover:border-[var(--nx-line-strong)]">
          <Search size={14} aria-hidden="true" /> Buscar
        </Link>
      </div>
    </article>
  )
}
