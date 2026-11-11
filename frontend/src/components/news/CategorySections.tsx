'use client'

// Columnas editoriales reales -- las categorías que de verdad tienen
// volumen ahora mismo, nunca un "Colombia / Mundo / Economía" hardcodeado
// que podría quedar vacío. Fútbol/deporte se excluye porque ya tiene su
// propia sección dedicada (SportsSection) -- no se duplica la misma nota.
// Cada columna: una historia principal con foto real + hasta 2 titulares
// compactos, no tres columnas idénticas.

import Link from 'next/link'
import { Clock } from 'lucide-react'
import EditorialImage from '@/components/news/EditorialImage'
import SectionBand from '@/components/news/SectionBand'
import { proxiedImage } from '@/lib/media'
import { isSportsCategory } from '@/lib/newsCategory'
import type { NewsView } from '@/types/news'

function slugifyCategory(name: string): string {
  return name.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

const formatRelative = (dateString: string) => {
  const diffMs = Date.now() - new Date(dateString).getTime()
  const hours = Math.floor(diffMs / 3_600_000)
  if (hours < 1) return 'Hace unos minutos'
  if (hours < 24) return `Hace ${hours} hora${hours === 1 ? '' : 's'}`
  const days = Math.floor(hours / 24)
  return `Hace ${days} día${days === 1 ? '' : 's'}`
}

export default function CategorySections({ news, isDark }: { news: NewsView[]; isDark: boolean }) {
  const byCategory = new Map<string, NewsView[]>()
  for (const item of news) {
    if (!item.category || isSportsCategory(item.category)) continue
    const list = byCategory.get(item.category) ?? []
    list.push(item)
    byCategory.set(item.category, list)
  }

  const topCategories = Array.from(byCategory.entries())
    .filter(([, items]) => items.length >= 2)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 3)

  if (topCategories.length === 0) return null

  return (
    <SectionBand bg={isDark ? '#0B0B0B' : '#F7F7F5'} borderColor={isDark ? 'rgba(255,255,255,0.1)' : '#E5E5E5'}>
    <section className="grid grid-cols-4 md:grid-cols-8 lg:grid-cols-12 gap-x-6 gap-y-10">
      {topCategories.map(([category, items]) => {
        const [lead, ...rest] = items
        return (
          <div key={category} className="col-span-4">
            <div className={`flex items-center justify-between mb-3.5 pb-2 border-b-2 ${isDark ? 'border-white/20' : 'border-[#161616]'}`}>
              <h3 className={`font-bold text-sm uppercase tracking-[0.08em] ${isDark ? 'text-white' : 'text-[#161616]'}`}>
                {category}
              </h3>
              <Link
                href={`/categoria/${slugifyCategory(category)}`}
                className="text-xs font-bold text-[#E30613] hover:opacity-70 transition-opacity"
              >
                Ver más →
              </Link>
            </div>

            <Link href={`/noticia/${lead.slug}`} className="block group mb-4">
              <EditorialImage src={proxiedImage(lead.image_url)} alt={lead.title} sizes="360px" className="rounded-sm mb-2.5" />
              <h4 className={`font-serif font-bold text-lg leading-snug group-hover:opacity-70 transition-opacity ${isDark ? 'text-white' : 'text-[#161616]'}`}>
                {lead.title}
              </h4>
              <p className={`text-xs mt-1 ${isDark ? 'text-neutral-500' : 'text-[#999]'}`}>{formatRelative(lead.published_at)}</p>
            </Link>

            <div className="space-y-3">
              {rest.slice(0, 2).map((item) => (
                <Link key={item.id} href={`/noticia/${item.slug}`} className="flex items-start gap-2 group">
                  <div className={`w-1.5 h-1.5 mt-2 flex-shrink-0 ${isDark ? 'bg-neutral-600' : 'bg-neutral-300'}`} />
                  <div className="min-w-0">
                    <p className={`text-sm font-medium leading-snug group-hover:opacity-70 transition-opacity line-clamp-2 ${isDark ? 'text-neutral-200' : 'text-[#333]'}`}>
                      {item.title}
                    </p>
                    <p className={`text-[11px] mt-0.5 flex items-center gap-1 ${isDark ? 'text-neutral-500' : 'text-[#999]'}`}>
                      <Clock size={10} /> {formatRelative(item.published_at)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )
      })}
    </section>
    </SectionBand>
  )
}
