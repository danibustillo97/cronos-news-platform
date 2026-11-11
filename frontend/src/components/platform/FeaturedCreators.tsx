'use client'

// "Creadores destacados" -- perfil editorial, no una fila de avatares
// tipo Instagram. Ranking real por volumen de publicación (nunca
// "seguidores": ese dato no existe en NEXUS todavía). Cada tarjeta
// enlaza al perfil real del creador (/creador/[slug]), que lista sus
// publicaciones reales.

import Link from 'next/link'
import SectionBand from '@/components/news/SectionBand'
import CreatorBadge, { creatorHref } from '@/components/platform/CreatorBadge'
import { topCreators } from '@/lib/platform'
import type { NewsView } from '@/types/news'

export default function FeaturedCreators({ news, isDark }: { news: NewsView[]; isDark: boolean }) {
  const creators = topCreators(news, 6, 2)
  if (creators.length === 0) return null

  return (
    <SectionBand bg={isDark ? '#0B0B0B' : '#FFFFFF'} borderColor={isDark ? 'rgba(255,255,255,0.1)' : '#E5E5E5'}>
      <section>
        <div className="flex items-baseline justify-between mb-5">
          <h2 className={`text-xl font-serif font-bold ${isDark ? 'text-white' : 'text-[#161616]'}`}>Creadores destacados</h2>
          <span className={`text-xs ${isDark ? 'text-neutral-500' : 'text-[#999]'}`}>Por volumen de cobertura</span>
        </div>

        <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-1">
          {creators.map((creator) => (
            <Link
              key={creator.id}
              href={creatorHref(creator)}
              className={`flex-shrink-0 w-56 border p-4 transition-colors ${isDark ? 'border-white/10 hover:border-white/25' : 'border-[#E5E5E5] hover:border-[#161616]'}`}
            >
              <CreatorBadge creator={creator} isDark={isDark} size={30} asLink={false} />
              <p className={`text-xs mt-3 ${isDark ? 'text-neutral-500' : 'text-[#999]'}`}>
                {creator.specialty ? `Especialista en ${creator.specialty}` : 'Creador de contenido'}
              </p>
              <p className={`text-xs font-bold mt-2 ${isDark ? 'text-white/70' : 'text-[#333]'}`}>
                {creator.postCount} publicaciones
              </p>
            </Link>
          ))}
        </div>
      </section>
    </SectionBand>
  )
}
