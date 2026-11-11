'use client'

// "Ahora" -- ¿qué está pasando ahora mismo? Layout puro: 1 destacada
// horizontal + grid compacto 2 columnas. La tarjeta en sí (autor,
// formato, medio, acciones) vive en PostCard -- este componente solo
// decide tamaño/posición/jerarquía, nunca duplica su renderizado (ver
// discusión 2026-09-24: LeadPost/CompactPost quedaban obsoletos en
// cuanto PostCard existió).

import SectionBand from '@/components/news/SectionBand'
import PostCard from '@/components/platform/PostCard'
import { newsToPost } from '@/lib/platform'
import type { NewsView } from '@/types/news'

const MAX_POSTS = 7

export default function NowStream({
  items, isDark, onOpen,
}: {
  items: NewsView[]
  isDark: boolean
  onOpen: (item: NewsView) => void
}) {
  const posts = items.slice(0, MAX_POSTS).map((n) => newsToPost(n, items))
  if (posts.length === 0) return null
  const [lead, ...rest] = posts
  const openPost = (post: ReturnType<typeof newsToPost>) => onOpen(post.source)

  return (
    <SectionBand bg={isDark ? '#0D0D0C' : '#F1F1EE'} borderColor={isDark ? 'rgba(255,255,255,0.1)' : '#E5E5E5'}>
      <section>
        <div className="flex items-baseline justify-between mb-4">
          <h2 className={`text-xl font-serif font-bold ${isDark ? 'text-white' : 'text-[#161616]'}`}>Ahora</h2>
          <span className={`text-xs ${isDark ? 'text-neutral-500' : 'text-[#999]'}`}>¿Qué está pasando?</span>
        </div>

        <div className={`pb-6 mb-6 border-b ${isDark ? 'border-white/10' : 'border-[#E5E5E5]'}`}>
          <PostCard post={lead} isDark={isDark} onOpen={openPost} variant="feature" />
        </div>

        {rest.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
            {rest.map((post) => (
              <PostCard key={post.id} post={post} isDark={isDark} onOpen={openPost} variant="compact" />
            ))}
          </div>
        )}
      </section>
    </SectionBand>
  )
}
