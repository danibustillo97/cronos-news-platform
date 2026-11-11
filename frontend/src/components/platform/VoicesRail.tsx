'use client'

// VOCES -- ¿qué están diciendo/analizando? Fila horizontal de
// publicaciones con audio real embebido (AudioBlock, vía PostCard). NO
// es una galería de podcasts: son publicaciones completas que además
// tienen audio. Ninguna noticia real tiene `media.audioUrl` hoy (`news`
// no tiene esa columna todavía) -- por eso este componente, en el estado
// actual de los datos, SIEMPRE devuelve null. Queda listo para aparecer
// solo en cuanto exista una sola publicación real con audio -- no hace
// falta tocar este archivo cuando eso pase.

import SectionBand from '@/components/news/SectionBand'
import PostCard from '@/components/platform/PostCard'
import { newsToPost, type Post } from '@/lib/platform'
import type { NewsView } from '@/types/news'

export default function VoicesRail({ news, isDark, onOpen }: { news: NewsView[]; isDark: boolean; onOpen: (item: NewsView) => void }) {
  const withAudio = news.map((n) => newsToPost(n, news)).filter((post) => Boolean(post.media?.audioUrl))
  if (withAudio.length === 0) return null

  const openPost = (post: Post) => onOpen(post.source)

  return (
    <SectionBand bg={isDark ? '#0B0B0B' : '#FFFFFF'} borderColor={isDark ? 'rgba(255,255,255,0.1)' : '#E5E5E5'}>
      <section>
        <div className="flex items-baseline justify-between mb-5">
          <h2 className={`text-xl font-serif font-bold ${isDark ? 'text-white' : 'text-[#161616]'}`}>Voces</h2>
          <span className={`text-xs ${isDark ? 'text-neutral-500' : 'text-[#999]'}`}>¿Qué están diciendo?</span>
        </div>
        <div className="flex gap-6 overflow-x-auto scrollbar-hide">
          {withAudio.map((post) => (
            <div key={post.id} className="flex-shrink-0 w-80">
              <PostCard post={post} isDark={isDark} onOpen={openPost} variant="compact" />
            </div>
          ))}
        </div>
      </section>
    </SectionBand>
  )
}
