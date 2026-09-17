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
import { usePortalTheme } from '@/context/ThemeContext'

const formatDate = (dateString: string) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  return new Intl.DateTimeFormat('es-CO', {
    day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
  }).format(date)
}

export default function ModernNewsPortal() {
  const { theme } = usePortalTheme()
  const isDark = theme === 'dark'
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
      <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-[#0a0a0a]' : 'bg-neutral-50'}`}>
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
    <div className={`min-h-screen relative overflow-x-hidden transition-colors duration-200 ${
      isDark ? 'bg-[#050505] text-white' : 'bg-neutral-50 text-neutral-900'
    }`}>
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className={`absolute -top-20 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full blur-3xl ${isDark ? 'bg-red-600/10' : 'bg-red-500/[0.06]'}`} />
        <div className={`absolute top-40 right-0 h-80 w-80 rounded-full blur-3xl ${isDark ? 'bg-amber-400/5' : 'bg-amber-400/[0.06]'}`} />
      </div>

      <ModernNavbar />

      <NewsModal news={selectedNews} onClose={closeNews} onNewsClick={openNews} />

      <main className="relative max-w-7xl mx-auto px-4 pt-20 pb-16 space-y-10">
        <VideoStories />

        {!featured ? (
          <div className={`text-center py-24 rounded-3xl border border-dashed ${isDark ? 'text-neutral-500 border-white/10 bg-white/3' : 'text-neutral-400 border-neutral-300 bg-white'}`}>
            <p className={`text-lg font-semibold mb-1 ${isDark ? 'text-white' : 'text-neutral-900'}`}>Todavía no hay historias publicadas.</p>
            <p className="text-sm">Volvé pronto.</p>
          </div>
        ) : (
          <>
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <button onClick={() => openNews(featured)} className="lg:col-span-8 block group text-left">
                <div className="relative aspect-[4/3] sm:aspect-[16/10] lg:aspect-[16/9] max-h-[520px] w-full rounded-[28px] overflow-hidden bg-neutral-900 border border-white/10 shadow-[0_30px_80px_rgba(0,0,0,0.55)]">
                  {heroImage ? (
                    <Image
                      src={heroImage}
                      alt={featured.title}
                      fill
                      priority
                      sizes="(max-width: 1024px) 100vw, 900px"
                      className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-neutral-800 to-neutral-950">
                      <span className="text-red-500 font-black text-2xl">Nexus News</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/45 to-transparent" />
                  <div className="absolute inset-0 p-6 sm:p-8 flex flex-col justify-end">
                    <span className="mb-3 inline-flex w-fit rounded-full border border-red-400/40 bg-red-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.24em] text-red-300">
                      {featured.category || 'Destacada'}
                    </span>
                    <h1 className="text-white text-2xl sm:text-4xl lg:text-5xl font-black leading-[0.95] mb-3 max-w-3xl group-hover:text-neutral-200 transition-colors">
                      {featured.title}
                    </h1>
                    <div className="flex flex-wrap gap-4 text-sm text-neutral-200">
                      <span className="flex items-center gap-1.5"><Clock size={14} /> {formatDate(featured.published_at)}</span>
                      {featured.author && <span className="flex items-center gap-1.5"><User size={14} /> {featured.author}</span>}
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
                      className={`group relative flex-1 rounded-2xl overflow-hidden border flex flex-row h-[150px] sm:h-[165px] text-left transition-colors ${
                        isDark
                          ? 'border-white/10 bg-white/5 shadow-[0_15px_35px_rgba(0,0,0,0.3)] hover:border-white/20'
                          : 'border-neutral-200 bg-white shadow-[0_10px_25px_rgba(15,23,42,0.08)] hover:border-neutral-300'
                      }`}
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
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-neutral-800 to-neutral-950">
                            <span className="text-red-500/60 font-black text-xs">NN</span>
                          </div>
                        )}
                      </div>
                      <div className="w-3/5 p-4 flex flex-col justify-center">
                        <span className="mb-2 text-red-400 text-[10px] font-bold uppercase tracking-[0.18em]">
                          {story.category || 'Noticia'}
                        </span>
                        <h3 className={`text-sm font-bold leading-snug group-hover:text-red-400 transition-colors line-clamp-3 ${isDark ? 'text-white' : 'text-neutral-900'}`}>
                          {story.title}
                        </h3>
                      </div>
                    </button>
                  )
                })}
              </div>
            </section>

            <AdSlot position="HOME_TOP" />

            {feed.length > 0 && (
              <section className="space-y-6">
                <div className="flex items-center gap-3">
                  <span className="w-1.5 h-7 bg-red-600 rounded-full" />
                  <h2 className={`text-2xl font-black ${isDark ? 'text-white' : 'text-neutral-900'}`}>Ahora</h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {feed.map((story, idx) => (
                    <React.Fragment key={story.id}>
                      <div className="h-full">
                        <NewsCard news={story} onClick={() => openNews(story)} darkMode={isDark} />
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

        <div className={`rounded-[24px] p-6 max-w-md mx-auto text-center border ${
          isDark
            ? 'bg-gradient-to-r from-white/5 via-white/[0.08] to-white/5 border-white/10 shadow-[0_20px_40px_rgba(0,0,0,0.25)]'
            : 'bg-white border-neutral-200 shadow-[0_15px_35px_rgba(15,23,42,0.08)]'
        }`}>
          <h3 className={`font-bold mb-2 flex items-center justify-center gap-2 ${isDark ? 'text-white' : 'text-neutral-900'}`}>
            <Mail size={18} className="text-red-400" /> Newsletter
          </h3>
          <p className={`text-sm mb-3 ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>Recibe las mejores noticias deportivas.</p>
          <form className="flex gap-2" onSubmit={(e) => e.preventDefault()}>
            <input
              type="email" placeholder="Tu email"
              className={`flex-1 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-red-500/60 border ${
                isDark ? 'bg-black/30 border-white/10 text-white placeholder:text-neutral-500' : 'bg-neutral-50 border-neutral-200 text-neutral-900 placeholder:text-neutral-400'
              }`}
            />
            <button type="submit" className="bg-red-600 hover:bg-red-700 transition-colors text-white px-4 py-2.5 rounded-xl font-bold text-sm shadow-[0_10px_25px_rgba(239,68,68,0.35)]">
              Unirme
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}
