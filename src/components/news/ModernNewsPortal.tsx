'use client'

import React, { useEffect, useState } from 'react'
import { Clock, TrendingUp, User, Mail } from 'lucide-react'
import ModernNavbar from '@/components/ui/ModernNavbar'
import NewsModal from '@/components/news/NewsModal'
import NewsCard from '@/components/news/NewsCard'
import AdSpace from '@/components/ads/AdSpace'
import VideoStories from '@/components/news/VideoStories'
import type { NewsView } from '@/types/news'
import { supabase } from '@/lib/supabaseClient'

type News = NewsView

const formatDate = (dateString: string) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  return new Intl.DateTimeFormat('es-CO', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export default function ModernNewsPortal() {
  const [news, setNews] = useState<News[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedNews, setSelectedNews] = useState<News | null>(null)
  const [activeCategory, setActiveCategory] = useState('Todas')

  useEffect(() => {
    fetchNews(activeCategory)
  }, [activeCategory])

  useEffect(() => {
    const handlePopState = () => {
      if (!window.location.pathname.includes('/noticia/')) {
        setSelectedNews(null)
      }
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const handleOpenNews = (newsItem: News) => {
    setSelectedNews(newsItem)
    window.history.pushState({ newsId: newsItem.id }, '', `/noticia/${newsItem.slug}`)
  }

  const handleCloseNews = () => {
    setSelectedNews(null)
    window.history.pushState(null, '', '/')
  }

  const fetchNews = async (category: string = 'Todas') => {
    setLoading(true)
    try {
      let query = supabase
        .from('news')
        .select('*')
        .eq('status', 'published')
        .order('published_at', { ascending: false })
        .limit(30)

      if (category !== 'Todas' && category !== 'Inicio') {
        query = query.eq('category', category)
      }

      const { data, error } = await query
      if (error) throw error

      setNews(
        (data || []).map((d: any) => ({
          id: d.id,
          title: d.title,
          subtitle: d.subtitle || '',
          content: d.content,
          excerpt: d.excerpt || '',
          image_url: d.image_url || 'https://via.placeholder.com/800x600',
          published_at: d.published_at,
          category: d.category || 'General',
          author: d.author,
          slug: d.slug,
        }))
      )
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (loading && news.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-16 w-16 border-t-4 border-b-4 border-red-600 rounded-full" />
      </div>
    )
  }

  const mainStory = news[0]
  const topStories = news.slice(1, 4)
  const listStories = news.slice(4)

  return (
    <div className="bg-[#f4f4f4] min-h-screen text-neutral-800">
      <ModernNavbar />

      <NewsModal news={selectedNews} onClose={handleCloseNews} onNewsClick={handleOpenNews} />

      <main className="max-w-7xl mx-auto px-4 pt-24 space-y-8">
        <VideoStories />

        {/* HERO */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 cursor-pointer" onClick={() => mainStory && handleOpenNews(mainStory)}>
            {mainStory && (
              <div className="relative h-[450px] rounded-xl overflow-hidden">
                <img src={mainStory.image_url} alt={mainStory.title} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 to-transparent p-6 flex flex-col justify-end">
                  <h1 className="text-white text-4xl font-black mb-3">{mainStory.title}</h1>
                  <div className="flex gap-4 text-neutral-300 text-sm">
                    <span className="flex items-center gap-1"><Clock size={14} /> {formatDate(mainStory.published_at)}</span>
                    <span className="flex items-center gap-1"><User size={14} /> {mainStory.author || 'Redacción'}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-4 flex flex-col gap-4">
            {topStories.map((story) => (
              <div
                key={story.id}
                className="relative flex-1 rounded-xl overflow-hidden group cursor-pointer shadow-sm bg-white border border-neutral-100 flex flex-row h-[160px]"
                onClick={() => handleOpenNews(story)}
              >
                {/* Imagen */}
                <div className="w-2/5 relative overflow-hidden">
                  <img
                    src={story.image_url || 'https://via.placeholder.com/400x300'}
                    alt={story.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                </div>

                {/* Texto */}
                <div className="w-3/5 p-4 flex flex-col justify-center">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-red-600 text-[10px] font-bold uppercase tracking-wider">
                      {story.category || 'Noticia'}
                    </span>
                    <span className="text-[10px] text-neutral-400">
                      {formatDate(story.published_at).split(',')[0]}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-neutral-900 leading-snug group-hover:text-red-600 transition-colors line-clamp-3">
                    {story.title}
                  </h3>
                </div>
              </div>
            ))}
          </div>

        </section>

        <AdSpace slotId="8962635274" />

        {/* FEED */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 space-y-6">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <TrendingUp className="text-red-600" size={20} />
              Últimas Noticias
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {listStories.map((story, idx) => (
                <React.Fragment key={story.id}>
                  <NewsCard news={story} onClick={() => handleOpenNews(story)} />
                  {(idx + 1) % 6 === 0 && <AdSpace slotId="8962635274" />}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* SIDEBAR LIMPIA */}
          <aside className="lg:col-span-4 space-y-6">
            <AdSpace slotId="8962635274" />

            <div className="bg-white rounded-xl p-6">
              <h3 className="font-bold mb-2 flex items-center gap-2">
                <Mail size={18} /> Newsletter
              </h3>
              <p className="text-sm text-neutral-600 mb-3">
                Recibe las mejores noticias deportivas.
              </p>
              <input type="email" placeholder="Tu email" className="w-full border rounded-lg px-3 py-2 mb-2" />
              <button className="w-full bg-neutral-900 text-white py-2 rounded-lg font-bold">
                Suscribirme
              </button>
            </div>

            <AdSpace slotId="8962635274" />
          </aside>
        </section>
      </main>
    </div>
  )
}
