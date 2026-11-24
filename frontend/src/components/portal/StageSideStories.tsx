'use client'

// Columna "Mientras tanto" de los escenarios de video y radio: la
// destacada sigue a un toque, con las siguientes como capítulos.

import Image from 'next/image'
import { proxiedImage } from '@/lib/media'
import { timeAgo } from '@/lib/feedComposer'
import type { NewsView } from '@/types/news'
import { StoryLink } from './StoryLink'
import { Kicker } from './PortalBits'
import { useNow } from './useNow'

export default function StageSideStories({ stories, onOpen }: { stories: NewsView[]; onOpen: (s: NewsView) => void }) {
  const now = useNow()
  const [featured, ...rest] = stories
  if (!featured) return null
  const src = proxiedImage(featured.image_url)
  return (
    <aside aria-label="Mientras tanto en NEXUS" className="flex min-w-0 flex-col gap-3">
      <Kicker className="px-1">Mientras tanto</Kicker>
      <StoryLink story={featured} onOpen={onOpen} className="group relative block overflow-hidden rounded-2xl bg-neutral-900 text-white ring-1 ring-[var(--nx-line)]">
        <span className="relative block aspect-[16/10]">
          {src && <Image src={src} alt={featured.title} fill sizes="(max-width: 1024px) 100vw, 380px" className="object-cover transition-transform duration-700 group-hover:scale-[1.03]" />}
          <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
        </span>
        <span className="absolute inset-x-0 bottom-0 p-4">
          <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#FACC15]">{featured.category || 'Portada'} · {timeAgo(featured.published_at, now)}</span>
          <span className="mt-1 text-base font-extrabold leading-snug line-clamp-3">{featured.title}</span>
        </span>
      </StoryLink>
      <ol className="flex flex-col divide-y divide-[var(--nx-line)] rounded-2xl border border-[var(--nx-line)] bg-[var(--nx-surface)]">
        {rest.slice(0, 3).map((story, i) => (
          <li key={story.id}>
            <StoryLink story={story} onOpen={onOpen} className="flex min-h-[56px] gap-3 p-3 transition-colors hover:bg-[var(--nx-surface-2)]">
              <span className="text-sm font-extrabold tabular-nums text-[var(--nx-accent-text)]">{String(i + 2).padStart(2, '0')}</span>
              <span className="min-w-0">
                <span className="text-sm font-bold leading-snug text-[var(--nx-ink)] line-clamp-2">{story.title}</span>
                <span className="mt-0.5 block text-[11px] text-[var(--nx-muted)]">{timeAgo(story.published_at, now)}</span>
              </span>
            </StoryLink>
          </li>
        ))}
      </ol>
    </aside>
  )
}
