'use client'

// Portal público -- identidad de medio editorial digital (no dashboard,
// no portal genérico de cards). Este componente es la RAÍZ DE COMPOSICIÓN:
// hace el mismo fetch a Supabase de siempre, resuelve el marcador
// deportivo UNA sola vez (consumido solo por NEXUS Pulse -- Front Page y
// Deportes ya NO repiten esa misma lista, cada sección responde una
// pregunta editorial distinta, ver el comentario en SportsSection.tsx),
// y ordena las secciones. Header + Pulse viven en un único wrapper
// `sticky` (no dos elementos `fixed` independientes que haya que
// sincronizar a mano) -- así nunca hay layout shift ni huecos cuando
// Pulse no tiene partidos que mostrar.
//
// Cada sección de abajo tiene su propio fondo sutil (Ahora ligeramente
// gris, Deportes con acento rojo superior, Cerca de ti cálido, Contexto
// siempre oscuro) -- la diferenciación viene de composición + tipografía
// + espaciado, nunca de colores fuertes ni de convertir cada sección en
// una "caja".
//
// El modal de historia usa el MISMO patrón que ya funcionaba antes:
// estado local + history.pushState para que la URL se vea como
// /noticia/[slug] mientras el usuario sigue en el portal, PERO esa misma
// URL, visitada directo/compartida/refrescada, sirve la página real y
// completa (src/app/noticia/[slug]/page.tsx -- SSR, SEO, JSON-LD ya
// implementados ahí).

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import ModernNavbar from '@/components/ui/ModernNavbar'
import NewsModal from '@/components/news/NewsModal'
import AdSlot from '@/components/ads/AdSlot'
import ScoreTicker from '@/components/news/ScoreTicker'
import FrontPage from '@/components/news/FrontPage'
import TopicsRow from '@/components/news/TopicsRow'
import Footer from '@/components/layout/Footer'
import type { NewsView } from '@/types/news'
import { supabase } from '@/lib/supabaseClient'
import { useScoreboard } from '@/lib/useScoreboard'
import { usePortalTheme } from '@/context/ThemeContext'

// Cada una de estas decide SU PROPIA banda de fondo (ver SectionBand.tsx)
// desde adentro, solo en la rama donde de verdad va a renderizar
// contenido -- así un módulo sin datos reales se oculta por completo, sin
// dejar un bloque de color vacío en la página. Orden real (ver
// lib/sections.config.ts): Ahora -> Sports Pulse -> Actualidad ->
// Historias -> Ciudad -> Voces -> Creadores.
const NowStream = dynamic(() => import('@/components/news/NowStream'))
const SportsPulse = dynamic(() => import('@/components/platform/SportsPulse'))
const CategorySections = dynamic(() => import('@/components/news/CategorySections'))
const InContext = dynamic(() => import('@/components/news/InContext'))
const NearYou = dynamic(() => import('@/components/news/NearYou'))
const VoicesRail = dynamic(() => import('@/components/platform/VoicesRail'))
const CreatorSpotlight = dynamic(() => import('@/components/platform/CreatorSpotlight'))

export default function ModernNewsPortal() {
  const { theme } = usePortalTheme()
  const isDark = theme === 'dark'
  const [news, setNews] = useState<NewsView[]>([])
  const [loading, setLoading] = useState(true)
  const { matches } = useScoreboard()
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
      <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-[#0B0B0B]' : 'bg-[#F7F7F5]'}`}>
        <div className="animate-spin h-10 w-10 border-t-2 border-b-2 border-[#E30613] rounded-full" />
      </div>
    )
  }

  // Jerarquía editorial real: 1 lead + 3 secundarias en el front page (1
  // prominente + 2 compactas, ver FrontPage.tsx); el resto ("feed")
  // alimenta cada sección de abajo según criterio propio (tema/formato/
  // ubicación), no un dump secuencial de los últimos registros.
  const featured = news[0]
  const secondary = news.slice(1, 4)
  const feed = news.slice(4)
  const baseBg = isDark ? '#0B0B0B' : '#F7F7F5'

  return (
    <div className={`min-h-screen transition-colors duration-200 ${isDark ? 'text-white' : 'text-[#161616]'}`} style={{ background: baseBg }}>
      <div className="sticky top-0 z-50">
        <ModernNavbar />
        <ScoreTicker matches={matches} />
      </div>

      <NewsModal news={selectedNews} onClose={closeNews} onNewsClick={openNews} />

      {!featured ? (
        <div className="max-w-7xl mx-auto px-4 py-10">
          <div className={`text-center py-24 border border-dashed ${isDark ? 'text-neutral-500 border-white/10' : 'text-[#999] border-[#E5E5E5]'}`}>
            <p className={`text-lg font-semibold mb-1 ${isDark ? 'text-white' : 'text-[#161616]'}`}>Todavía no hay historias publicadas.</p>
            <p className="text-sm">Volvé pronto.</p>
          </div>
        </div>
      ) : (
        <>
          {/* FRONT PAGE -- LIVE SLOT + secundarias. "¿qué es lo más importante ahora mismo?" */}
          <div className="max-w-7xl mx-auto px-4 pt-8 space-y-10">
            <FrontPage featured={featured} secondary={secondary} matches={matches} isDark={isDark} onOpen={openNews} />
            <TopicsRow news={news} isDark={isDark} />
            <div>
              <div className={`border-t ${isDark ? 'border-white/10' : 'border-[#E5E5E5]'}`} />
              <div className="text-center py-4">
                <span className={`text-[10px] font-bold uppercase tracking-[0.14em] ${isDark ? 'text-neutral-600' : 'text-[#999]'}`}>
                  Publicidad
                </span>
                <div className="mt-2">
                  <AdSlot position="HOME_TOP" />
                </div>
              </div>
              <div className={`border-b ${isDark ? 'border-white/10' : 'border-[#E5E5E5]'}`} />
            </div>
          </div>

          {/* AHORA -- "¿qué está pasando?" (continúa el mismo capítulo que el LiveSlot de arriba) */}
          <NowStream items={feed} isDark={isDark} onOpen={openNews} />

          {/* SPORTS PULSE -- "¿qué está pasando en el deporte?" -- en vivo + próximos + tabla + cobertura */}
          <SportsPulse news={feed} matches={matches} isDark={isDark} onOpen={openNews} />

          {/* ACTUALIDAD -- "¿qué necesito saber?" -- top categorías reales por volumen */}
          <CategorySections news={feed} isDark={isDark} />

          {/* HISTORIAS -- "¿qué vale la pena profundizar?" -- ruptura oscura deliberada */}
          <InContext news={feed} onOpen={openNews} />

          {/* CIUDAD -- "¿qué está pasando cerca?" */}
          <NearYou news={feed} isDark={isDark} onOpen={openNews} />

          {/* VOCES -- "¿qué están diciendo/analizando?" -- se autooculta sin audio real */}
          <VoicesRail news={feed} isDark={isDark} onOpen={openNews} />

          {/* CREADORES -- "¿quién lo está contando?" -- cierra con la misma gramática asimétrica que abrió */}
          <CreatorSpotlight news={news} isDark={isDark} onOpen={openNews} />
        </>
      )}

      <Footer />
    </div>
  )
}
