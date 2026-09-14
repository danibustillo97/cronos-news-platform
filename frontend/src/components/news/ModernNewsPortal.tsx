'use client'

// Portal público -- restaurado y depurado (sección "RESTORE PUBLIC PORTAL").
// Presentación editorial organizada (Destacada / Ahora), nunca 20 cards
// idénticas. El modal de historia usa el MISMO patrón que ya funcionaba
// antes: estado local + history.pushState para que la URL se vea como
// /noticia/[slug] mientras el usuario sigue en el portal, PERO esa misma
// URL, visitada directo/compartida/refrescada, sirve la página real y
// completa (src/app/noticia/[slug]/page.tsx -- SSR, SEO, JSON-LD ya
// implementados ahí). Se intentó el patrón de rutas interceptoras de
// Next.js (@modal/(.)noticia) pero pegó un bug interno del framework
// (`initialTree is not iterable`, reproducible incluso con caché
// limpia) -- se optó por el mecanismo ya probado en vez de perseguir un
// bug de Next.js bajo esta sesión.

import React, { useEffect, useState } from 'react'
import Image from 'next/image'
import { Clock, User, Mail } from 'lucide-react'
import ModernNavbar from '@/components/ui/ModernNavbar'
import NewsModal from '@/components/news/NewsModal'
import NewsCard from '@/components/news/NewsCard'
import AdSlot from '@/components/ads/AdSlot'
import VideoStories from '@/components/news/VideoStories'
import { proxiedImage } from '@/lib/media'
import type { NewsView } from '@/types/news'
import { supabase } from '@/lib/supabaseClient'

const formatDate = (dateString: string) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  return new Intl.DateTimeFormat('es-CO', {
    day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
  }).format(date)
}

export default function ModernNewsPortal() {
  const [news, setNews] = useState<NewsView[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedNews, setSelectedNews] = useState<NewsView | null>(null)

  useEffect(() => {
    supabase
      .from('news')
      .select('*')
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(30)
      .then(({ data, error }) => {
        if (error) { console.error(error); setLoading(false); return }
        setNews((data || []) as NewsView[])
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    const handlePopState = () => {
      if (!window.location.pathname.includes('/noticia/')) setSelectedNews(null)
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const openNews = (item: NewsView) => {
    setSelectedNews(item)
    window.history.pushState({ newsId: item.id }, '', `/noticia/${item.slug}`)
  }

  const closeNews = () => {
    setSelectedNews(null)
    window.history.pushState(null, '', '/')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <div className="animate-spin h-12 w-12 border-t-4 border-b-4 border-red-600 rounded-full" />
      </div>
    )
  }

  // Jerarquía editorial real, no un dump de los últimos registros:
  // 1 destacada, 3 secundarias, el resto en "Ahora" -- todo real, sin
  // inventar categorías/tendencias.
  const featured = news[0]
  const secondary = news.slice(1, 4)
  const feed = news.slice(4)
  const heroImage = featured ? proxiedImage(featured.image_url) : null

  return (
    <div className="bg-[#0a0a0a] min-h-screen text-white">
      <ModernNavbar />

      <NewsModal news={selectedNews} onClose={closeNews} onNewsClick={openNews} />

      <main className="max-w-7xl mx-auto px-4 pt-24 pb-16 space-y-10">
        <VideoStories />

        {!featured ? (
          <div className="text-center py-24 text-neutral-500">
            <p className="text-lg font-semibold text-white mb-1">Todavía no hay historias publicadas.</p>
            <p className="text-sm">Volvé pronto.</p>
          </div>
        ) : (
          <>
            {/* DESTACADA */}
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <button onClick={() => openNews(featured)} className="lg:col-span-8 block group text-left">
                <div className="relative h-[320px] sm:h-[420px] lg:h-[480px] rounded-2xl overflow-hidden bg-neutral-900">
                  {heroImage ? (
                    <Image
                      src={heroImage}
                      alt={featured.title}
                      fill
                      priority
                      sizes="(max-width: 1024px) 100vw, 900px"
                      className="object-cover transition-transform duration-700 group-hover:scale-[1.02]"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-neutral-800 to-neutral-950">
                      <span className="text-red-500 font-black text-2xl">Nexus News</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent p-6 flex flex-col justify-end">
                    <span className="text-red-500 text-[11px] font-bold uppercase tracking-widest mb-2">
                      {featured.category || 'Destacada'}
                    </span>
                    <h1 className="text-white text-2xl sm:text-4xl font-black leading-tight mb-3 group-hover:text-neutral-200 transition-colors">
                      {featured.title}
                    </h1>
                    <div className="flex gap-4 text-neutral-300 text-sm">
                      <span className="flex items-center gap-1"><Clock size={14} /> {formatDate(featured.published_at)}</span>
                      {featured.author && <span className="flex items-center gap-1"><User size={14} /> {featured.author}</span>}
                    </div>
                  </div>
                </div>
              </button>

              <div className="lg:col-span-4 flex flex-col gap-4">
                {secondary.map((story) => {
                  const img = proxiedImage(story.image_url)
                  return (
                    <button
                      key={story.id}
                      onClick={() => openNews(story)}
                      className="group relative flex-1 rounded-xl overflow-hidden shadow-sm bg-white/5 border border-white/10 flex flex-row h-[140px] sm:h-[160px] text-left"
                    >
                      <div className="w-2/5 relative overflow-hidden bg-neutral-900 flex-shrink-0">
                        {img ? (
                          <Image
                            src={img}
                            alt={story.title}
                            fill
                            sizes="200px"
                            className="object-cover transition-transform duration-500 group-hover:scale-110"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <span className="text-red-500/60 font-black text-xs">NN</span>
                          </div>
                        )}
                      </div>
                      <div className="w-3/5 p-4 flex flex-col justify-center">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-red-500 text-[10px] font-bold uppercase tracking-wider">
                            {story.category || 'Noticia'}
                          </span>
                        </div>
                        <h3 className="text-sm font-bold text-white leading-snug group-hover:text-red-400 transition-colors line-clamp-3">
                          {story.title}
                        </h3>
                      </div>
                    </button>
                  )
                })}
              </div>
            </section>

            <AdSlot position="HOME_TOP" />

            {/* AHORA */}
            {feed.length > 0 && (
              <section className="space-y-6">
                <h2 className="text-xl font-bold flex items-center gap-2 text-white">
                  <span className="w-1.5 h-6 bg-red-600 rounded-full" />
                  Ahora
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {feed.map((story, idx) => (
                    <React.Fragment key={story.id}>
                      <div className="h-full">
                        <NewsCard news={story} onClick={() => openNews(story)} darkMode />
                      </div>
                      {idx === 5 && (
                        <div className="sm:col-span-2 lg:col-span-3">
                          <AdSlot position="HOME_FEED" />
                        </div>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        {/* NEWSLETTER */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-6 max-w-md mx-auto text-center">
          <h3 className="font-bold mb-2 flex items-center justify-center gap-2 text-white">
            <Mail size={18} /> Newsletter
          </h3>
          <p className="text-sm text-neutral-400 mb-3">Recibe las mejores noticias deportivas.</p>
          <form className="flex gap-2" onSubmit={(e) => e.preventDefault()}>
            <input type="email" placeholder="Tu email" className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-neutral-500" />
            <button type="submit" className="bg-red-600 hover:bg-red-700 transition-colors text-white px-4 py-2 rounded-lg font-bold text-sm">
              Unirme
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}
