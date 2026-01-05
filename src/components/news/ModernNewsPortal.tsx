'use client'

import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Clock, Share2, MessageCircle, ChevronRight, TrendingUp, Calendar, User, Zap, Mail } from 'lucide-react'
import OptimizedLiveScoresWidget from '@/components/widgets/OptimizedLiveScoresWidget'
import OptimizedStandingsWidget from '@/components/widgets/OptimizedStandingsWidget'
import Link from 'next/link'
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
    minute: '2-digit' 
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
    const handlePopState = (event: PopStateEvent) => {
      
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
    // Revert URL to home
    window.history.pushState(null, '', '/')
  }

  useEffect(() => {

    const channel = supabase
      .channel('public:news')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'news' }, (payload) => {
        const newNewsItem = payload.new as any
        

        if (newNewsItem.status === 'published') {
           const formattedNews: News = {
              id: newNewsItem.id,
              title: newNewsItem.title,
              subtitle: newNewsItem.subtitle,
              content: newNewsItem.content,
              excerpt: newNewsItem.excerpt,
              image_url: newNewsItem.image_url || 'https://via.placeholder.com/800x600',
              published_at: newNewsItem.published_at,
              category: newNewsItem.category || 'General',
              author: newNewsItem.author,
              slug: newNewsItem.slug
           }

           if (activeCategory === 'Todas' || activeCategory === 'Inicio' || formattedNews.category === activeCategory) {
               setNews(prev => [formattedNews, ...prev])
           }
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [activeCategory])

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
      const items = (data || []).map((d: any) => ({
        id: d.id,
        title: d.title,
        subtitle: d.subtitle || d.summary || '',
        content: d.content,
        excerpt: d.excerpt || d.summary || '',
        image_url: d.image_url || 'https://via.placeholder.com/800x600',
        published_at: d.published_at,
        category: d.category || 'General',
        author: d.author,
        slug: d.slug
      })) as News[]
      console.log('Fetched news:', items)
      setNews(items)
    } catch (error) {
      console.error('Error fetching news:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading && news.length === 0) {
    return (
      <div className="min-h-screen bg-neutral-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-red-600"></div>
      </div>
    )
  }

  const mainStory = news[0]
  const topStories = news.slice(1, 4)
  const sortedTopStories = [...topStories].sort((a, b) => {
    const catA = (a.category || '').toLowerCase()
    const catB = (b.category || '').toLowerCase()
    if (catA !== catB) return catA.localeCompare(catB)
    const dateA = a.published_at ? new Date(a.published_at).getTime() : 0
    const dateB = b.published_at ? new Date(b.published_at).getTime() : 0
    return dateB - dateA
  })
  const listStories = news.slice(4)

  // Dynamic font size for hero title
  const getHeroTitleClass = (title: string) => {
    const len = title.length
    if (len > 80) return 'text-2xl md:text-3xl lg:text-4xl'
    if (len > 50) return 'text-3xl md:text-4xl lg:text-5xl'
    return 'text-4xl md:text-5xl lg:text-6xl'
  }

  return (
    <div className="bg-[#f4f4f4] min-h-screen font-sans text-neutral-800 pb-12">
      <ModernNavbar activeCategory={activeCategory} onCategorySelect={setActiveCategory} />
      
      {/* Modal de Noticias */}
      <NewsModal 
        news={selectedNews} 
        onClose={handleCloseNews} 
        onNewsClick={handleOpenNews}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8 pt-24">
        
        {/* STORIES SECTION */}
        <VideoStories />

        {/* HERO SECTION - Grid Layout tipo Zona Cero */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Main Story (Left - Large) */}
          <div className="lg:col-span-8 group cursor-pointer" onClick={() => mainStory && handleOpenNews(mainStory)}>
            {mainStory && (
              <div className="relative h-[400px] md:h-[500px] rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                <img 
                  src={mainStory.image_url || 'https://via.placeholder.com/800x600'} 
                  alt={mainStory.title}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent flex flex-col justify-end p-6 md:p-8">
                  <span className="inline-block bg-red-600 text-white text-xs font-bold px-3 py-1 rounded-sm mb-3 w-fit uppercase tracking-wider">
                    {mainStory.category || 'Deportes'}
                  </span>
                  <h1 className={`${getHeroTitleClass(mainStory.title)} font-black text-white leading-none mb-3 group-hover:text-red-400 transition-colors drop-shadow-lg`}>
                    {mainStory.title}
                  </h1>
                  <div className="flex items-center gap-4 mt-2 text-neutral-300 text-sm font-medium">
                    <span className="flex items-center gap-1"><Clock size={14} /> {formatDate(mainStory.published_at)}</span>
                    <span className="flex items-center gap-1"><User size={14} /> {mainStory.author || 'Redacción'}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Secondary Stories (Right - Stacked) - Optimized Layout */}
          <div className="lg:col-span-4 flex flex-col gap-4">
            {sortedTopStories.map((story) => (
              <div 
                key={story.id} 
                className="relative flex-1 rounded-xl overflow-hidden group cursor-pointer shadow-sm bg-white border border-neutral-100 flex flex-row h-[160px]"
                onClick={() => handleOpenNews(story)}
              >
                 <div className="w-2/5 relative overflow-hidden">
                    <img 
                      src={story.image_url || 'https://via.placeholder.com/400x300'} 
                      alt={story.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                 </div>
                 <div className="w-3/5 p-4 flex flex-col justify-center relative">
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

        {/* BANNERS / ADS SEPARATOR */}
        <AdSpace slotId="8962635274" className="w-full" />

        {/* CONTENT GRID */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Main Feed */}
          <div className="lg:col-span-8 space-y-8">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3 mb-6">
              <h2 className="text-xl font-bold text-neutral-900 flex items-center gap-2">
                <TrendingUp className="text-red-600" size={20} />
                Últimas Noticias
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {listStories.map((story, idx) => {
                const showAd = (idx + 1) % 6 === 0;
                const showNewsletter = idx === 3; // Show newsletter after 4th item

                return (
                  <React.Fragment key={story.id}>
                    <NewsCard 
                        news={story} 
                        onClick={() => handleOpenNews(story)} 
                    />
                    
                    {/* Newsletter Interruption */}
                    {showNewsletter && (
                       <div className="md:col-span-2 bg-gradient-to-r from-red-600 to-red-800 rounded-xl p-6 text-white shadow-lg my-2 flex flex-col md:flex-row items-center justify-between gap-6">
                          <div className="flex-1">
                             <div className="flex items-center gap-2 mb-2">
                                <Mail className="text-red-200" />
                                <span className="font-bold text-red-100 uppercase text-xs tracking-wider">Newsletter</span>
                             </div>
                             <h3 className="text-xl font-bold mb-1">¡Mantente al día!</h3>
                             <p className="text-red-100 text-sm">Las mejores noticias deportivas directamente en tu bandeja de entrada.</p>
                          </div>
                          <div className="flex w-full md:w-auto gap-2">
                             <input 
                               type="email" 
                               placeholder="Tu email" 
                               className="px-4 py-2 rounded-lg text-neutral-900 focus:outline-none w-full md:w-64"
                             />
                             <button className="bg-neutral-900 hover:bg-black text-white font-bold px-4 py-2 rounded-lg transition-colors">
                                Suscribirse
                             </button>
                          </div>
                       </div>
                    )}

                    {/* Ad Space */}
                    {showAd && (
                      <div className="md:col-span-2">
                        <AdSpace slotId="8962635274" />
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>

            {/* Load More Button */}
            <div className="flex justify-center pt-8">
              <button className="px-8 py-3 bg-white border border-neutral-200 text-neutral-900 font-bold rounded-full hover:bg-neutral-50 hover:border-neutral-300 transition-all shadow-sm">
                Cargar más noticias
              </button>
            </div>
          </div>

          {/* Sidebar */}
          <aside className="lg:col-span-4 space-y-6">
            
            {/* Widget: Live Scores */}
            <div className="bg-white rounded-xl shadow-sm p-4 border border-neutral-200">
              <div className="flex items-center justify-between mb-4 border-b border-neutral-100 pb-2">
                <h3 className="font-bold text-neutral-900 flex items-center gap-2">
                   <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse"></span>
                   Marcadores en Vivo
                </h3>
              </div>
              <OptimizedLiveScoresWidget />
            </div>

            {/* Ad Sidebar 1 */}
            <div className="h-64 rounded-xl border border-neutral-200 bg-neutral-100 flex items-center justify-center text-neutral-400 font-bold tracking-widest text-xs">
              AD SIDEBAR
            </div>

            {/* Widget: Standings */}
            <div className="bg-white rounded-xl shadow-sm p-4 border border-neutral-200">
               <div className="flex items-center justify-between mb-4 border-b border-neutral-100 pb-2">
                <h3 className="font-bold text-neutral-900">
                   Tabla de Posiciones
                </h3>
              </div>
              <OptimizedStandingsWidget />
            </div>

            {/* Ad Sidebar 2 */}
            <div className="h-64 rounded-xl border border-neutral-200 bg-neutral-100 flex items-center justify-center text-neutral-400 font-bold tracking-widest text-xs">
              AD SIDEBAR
            </div>

            {/* Most Read */}
            <div className="bg-white rounded-xl shadow-sm p-6 border border-neutral-200">
              <h3 className="text-lg font-bold text-neutral-900 mb-4 flex items-center gap-2">
                <Zap className="text-yellow-500 fill-yellow-500" size={18} />
                Lo más leído
              </h3>
              <ul className="space-y-5">
                {[1, 2, 3, 4, 5].map((i) => (
                  <li key={i} className="flex gap-4 group cursor-pointer items-start">
                    <span className="text-2xl font-black text-neutral-200 group-hover:text-red-600 transition-colors leading-none mt-1">
                      0{i}
                    </span>
                    <p className="text-sm font-medium text-neutral-700 group-hover:text-neutral-900 transition-colors line-clamp-2">
                      La increíble remontada del equipo local sorprende a todos los analistas deportivos.
                    </p>
                  </li>
                ))}
              </ul>
            </div>

          </aside>
        </section>

      </main>
      
      {/* Footer Simple */}
      <footer className="bg-white border-t border-neutral-200 text-neutral-600 py-12 mt-12">
        <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-1 md:col-span-2">
            <h2 className="text-2xl font-black text-neutral-900 mb-4 tracking-tighter">NEXUS<span className="text-red-600">NEWS</span></h2>
            <p className="text-neutral-500 text-sm max-w-md">
              La plataforma líder en noticias deportivas impulsada por inteligencia artificial. Cobertura en tiempo real, análisis profundos y la mejor experiencia de usuario.
            </p>
          </div>
          <div>
            <h3 className="font-bold mb-4 text-neutral-900">Secciones</h3>
            <ul className="space-y-2 text-sm">
              <li><a href="#" className="hover:text-red-600 transition-colors">Fútbol Internacional</a></li>
              <li><a href="#" className="hover:text-red-600 transition-colors">Liga Local</a></li>
              <li><a href="#" className="hover:text-red-600 transition-colors">Tenis</a></li>
              <li><a href="#" className="hover:text-red-600 transition-colors">Motor</a></li>
            </ul>
          </div>
          <div>
            <h3 className="font-bold mb-4 text-neutral-900">Legal</h3>
            <ul className="space-y-2 text-sm">
              <li><a href="#" className="hover:text-red-600 transition-colors">Términos y Condiciones</a></li>
              <li><a href="#" className="hover:text-red-600 transition-colors">Política de Privacidad</a></li>
              <li><a href="#" className="hover:text-red-600 transition-colors">Contacto</a></li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 mt-12 pt-8 border-t border-neutral-100 text-center text-xs text-neutral-400">
          © 2024 Nexus News. Todos los derechos reservados.
        </div>
      </footer>
    </div>
  )
}
