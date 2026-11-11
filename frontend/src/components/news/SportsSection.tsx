'use client'

// "¿Qué está pasando en el mundo del fútbol?" -- distinto de Pulse
// ("¿qué está pasando ahora?"). Por eso esta sección NO repite la lista
// de partidos que ya vive en NEXUS Pulse (arriba, siempre visible) --
// acá va lo editorial: historia principal, secundarias, y la tabla en
// vivo con acceso a la tabla completa (StandingsPanel.tsx, misma
// instancia única del sitio -- no se duplica su fetch en ningún otro
// lado).

import Link from 'next/link'
import EditorialImage from '@/components/news/EditorialImage'
import StandingsPanel from '@/components/news/StandingsPanel'
import SectionBand from '@/components/news/SectionBand'
import { proxiedImage } from '@/lib/media'
import { isSportsCategory } from '@/lib/newsCategory'
import type { NewsView } from '@/types/news'

export default function SportsSection({
  news, isDark, onOpen,
}: {
  news: NewsView[]
  isDark: boolean
  onOpen: (item: NewsView) => void
}) {
  const sportsNews = news.filter((item) => isSportsCategory(item.category))
  const featured = sportsNews[0]
  const secondary = sportsNews.slice(1, 3)

  if (!featured) return null

  return (
    <SectionBand bg={isDark ? '#0B0B0B' : '#FFFFFF'} borderColor="#E50914">
      <section>
        <div className="flex items-baseline justify-between mb-5">
          <h2 className={`text-xl font-serif font-bold ${isDark ? 'text-white' : 'text-[#161616]'}`}>Fútbol / Deportes</h2>
          <Link href="/deportes" className="text-xs font-bold text-[#E30613] hover:opacity-70 transition-opacity">
            Ir al hub de deportes →
          </Link>
        </div>

        <div className="grid grid-cols-4 md:grid-cols-8 lg:grid-cols-12 gap-6">
          <div className="col-span-4 md:col-span-5 lg:col-span-7">
            <button onClick={() => onOpen(featured)} className="group block text-left mb-6">
              <EditorialImage src={proxiedImage(featured.image_url)} alt={featured.title} sizes="(max-width: 1024px) 100vw, 620px" className="rounded-sm mb-3" />
              <span className="text-[#E30613] text-[10px] font-bold uppercase tracking-[0.14em]">{featured.category}</span>
              <h3 className={`text-xl font-serif font-bold leading-snug mt-1.5 group-hover:opacity-70 transition-opacity ${isDark ? 'text-white' : 'text-[#161616]'}`}>
                {featured.title}
              </h3>
            </button>

            {secondary.length > 0 && (
              <div className={`space-y-3 border-t pt-3 ${isDark ? 'border-white/10' : 'border-[#E5E5E5]'}`}>
                {secondary.map((item) => (
                  <button key={item.id} onClick={() => onOpen(item)} className="group flex items-start gap-2 w-full text-left">
                    <div className={`w-1.5 h-1.5 mt-2 flex-shrink-0 ${isDark ? 'bg-neutral-600' : 'bg-neutral-300'}`} />
                    <h4 className={`text-sm font-medium leading-snug group-hover:opacity-70 transition-opacity line-clamp-2 ${isDark ? 'text-neutral-200' : 'text-[#333]'}`}>
                      {item.title}
                    </h4>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="col-span-4 md:col-span-3 lg:col-span-5">
            <StandingsPanel />
          </div>
        </div>
      </section>
    </SectionBand>
  )
}
