'use client'

// CREADORES -- ¿quién lo está contando? El protagonista es lo que el
// creador publicó, no su avatar. 1 creador grande (su publicación más
// reciente, PostCard `feature`) + hasta 3 en compacto -- mismo esqueleto
// asimétrico 7/5 que "Ahora", cerrando la home con la misma gramática
// visual con la que abrió. Ranking real por volumen/actividad reciente
// (nunca "seguidores": ese dato no existe).

import SectionBand from '@/components/news/SectionBand'
import PostCard from '@/components/platform/PostCard'
import { newsToPost, topCreators, type Post } from '@/lib/platform'
import type { NewsView } from '@/types/news'

export default function CreatorSpotlight({ news, isDark, onOpen }: { news: NewsView[]; isDark: boolean; onOpen: (item: NewsView) => void }) {
  const creators = topCreators(news, 4, 1)
  if (creators.length === 0) return null

  const latestByCreator: Post[] = creators
    .map((creator) => news.filter((n) => (n.author || 'Nexus News') === creator.name).sort((a, b) => +new Date(b.published_at) - +new Date(a.published_at))[0])
    .filter((n): n is NewsView => Boolean(n))
    .map((n) => newsToPost(n, news))

  const [spotlight, ...rest] = latestByCreator
  if (!spotlight) return null
  const openPost = (post: Post) => onOpen(post.source)

  return (
    <SectionBand bg={isDark ? '#0B0B0B' : '#FFFFFF'} borderColor={isDark ? 'rgba(255,255,255,0.1)' : '#E5E5E5'}>
      <section>
        <div className="flex items-baseline justify-between mb-5">
          <h2 className={`text-xl font-serif font-bold ${isDark ? 'text-white' : 'text-[#161616]'}`}>Creadores contando el día</h2>
          <span className={`text-xs ${isDark ? 'text-neutral-500' : 'text-[#999]'}`}>¿Quién lo está contando?</span>
        </div>

        <div className="grid grid-cols-4 md:grid-cols-8 lg:grid-cols-12 gap-x-8 gap-y-8">
          <div className="col-span-4 md:col-span-8 lg:col-span-7">
            <PostCard post={spotlight} isDark={isDark} onOpen={openPost} variant="feature" />
          </div>

          {rest.length > 0 && (
            <div className={`col-span-4 lg:col-span-5 flex flex-col gap-5 lg:pl-8 lg:border-l ${isDark ? 'lg:border-white/10' : 'lg:border-[#E5E5E5]'}`}>
              {rest.map((post) => (
                <div key={post.id} className={`pb-5 border-b last:border-0 last:pb-0 ${isDark ? 'border-white/10' : 'border-[#E5E5E5]'}`}>
                  <PostCard post={post} isDark={isDark} onOpen={openPost} variant="compact" />
                </div>
              ))}
            </div>
          )}
        </div>

        <p className={`text-xs mt-6 ${isDark ? 'text-neutral-500' : 'text-[#999]'}`}>
          {creators.reduce((sum, c) => sum + c.postCount, 0)} publicaciones de {creators.length} creadores esta semana
        </p>
      </section>
    </SectionBand>
  )
}
