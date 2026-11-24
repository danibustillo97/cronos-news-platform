'use client'

// Escenario -- modo video: la transmisión en vivo REEMPLAZA a la
// destacada, que sigue a la vista en la columna "Mientras tanto".

import type { NewsView } from '@/types/news'
import type { VideoSource } from '@/lib/streamSource'
import VideoPlayer from './VideoPlayer'
import StageSideStories from './StageSideStories'
import { LiveBadge } from './PortalBits'

export default function StageVideo({
  title, poster, source, stories, onOpen,
}: {
  title: string
  poster: string | null
  source: VideoSource
  stories: NewsView[]
  onOpen: (s: NewsView) => void
}) {
  return (
    <div className={`grid gap-4 ${stories.length > 0 ? 'lg:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-cols-[minmax(0,1fr)_380px]' : ''}`}>
      <section aria-labelledby="stage-video-title" className="overflow-hidden rounded-2xl bg-black text-white shadow-[var(--nx-shadow)] ring-1 ring-[var(--nx-line)]">
        <VideoPlayer source={source} title={title} poster={poster} />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-white/10 px-4 py-4 sm:px-6">
          <LiveBadge size="lg" />
          <h2 id="stage-video-title" className="min-w-0 flex-1 text-lg font-extrabold leading-[1.15] tracking-[-0.01em] line-clamp-2 sm:text-xl">{title}</h2>
          <span className="text-xs font-semibold text-white/60">Transmisión de NEXUS</span>
        </div>
      </section>
      <StageSideStories stories={stories} onOpen={onOpen} />
    </div>
  )
}
