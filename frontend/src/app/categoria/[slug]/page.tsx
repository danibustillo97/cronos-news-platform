'use client'

// Antes era un link roto en el nav (categoria/futbol, etc. sin página
// real). Filtra por la columna `category` real -- si todavía no hay
// historias reales en ese tema, lo dice honestamente, no inventa nada.
//
// El toolbar de subtemas (sección 10 del brief) se deriva de los `tags`
// que YA vienen en los artículos de esta categoría -- nunca de una
// taxonomía separada que podría no tener ninguna historia real todavía
// (news.category es texto libre, sin FK a categories/topics -- ver
// backend/app/domain/category). Así el filtro contextual siempre tiene
// contenido real detrás.

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import ModernNavbar from '@/components/ui/ModernNavbar'
import Footer from '@/components/layout/Footer'
import NewsCard from '@/components/news/NewsCard'
import FilterToolbar from '@/components/ui/FilterToolbar'
import { supabase } from '@/lib/supabaseClient'
import type { NewsView } from '@/types/news'
import { usePortalTheme } from '@/context/ThemeContext'

const MAX_TAGS = 6

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export default function CategoriaPage() {
  const { theme } = usePortalTheme()
  const isDark = theme === 'dark'
  const params = useParams<{ slug: string }>()
  const [news, setNews] = useState<NewsView[] | null>(null)
  const [label, setLabel] = useState('')
  const [tag, setTag] = useState('todos')

  useEffect(() => {
    setTag('todos')
    supabase.from('news').select('*').eq('status', 'published').order('published_at', { ascending: false }).limit(200)
      .then(({ data }) => {
        const all = (data || []) as NewsView[]
        const targetSlug = slugify(params.slug ?? '')

        const matches = all.filter((n) => {
          const category = (n.category ?? '').trim()
          if (!category) return false
          return slugify(category) === targetSlug || slugify(category).includes(targetSlug)
        })

        setNews(matches)
        setLabel(matches[0]?.category ?? params.slug)
      })
  }, [params.slug])

  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const n of news ?? []) {
      for (const t of n.tags ?? []) {
        const clean = t.trim()
        if (!clean) continue
        counts.set(clean, (counts.get(clean) ?? 0) + 1)
      }
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, MAX_TAGS)
  }, [news])

  const toolbarItems = [{ id: 'todos', label: 'Todos' }, ...tagCounts.map(([t]) => ({ id: t, label: t }))]
  const visibleNews = news === null ? null : tag === 'todos' ? news : news.filter((n) => (n.tags ?? []).includes(tag))

  return (
    <div className={`min-h-screen transition-colors duration-200 ${isDark ? 'bg-[#0B0B0B] text-white' : 'bg-neutral-50 text-neutral-900'}`}>
      <ModernNavbar />
      <main className="max-w-7xl mx-auto px-4 pt-8 pb-16">
        <h1 className="text-3xl font-black mb-4 capitalize">{label}</h1>

        {tagCounts.length > 0 && (
          <div className="mb-6 -mx-4 px-4">
            <FilterToolbar items={toolbarItems} active={tag} onChange={setTag} isDark={isDark} />
          </div>
        )}

        {visibleNews === null ? (
          <div className="animate-spin h-8 w-8 border-t-4 border-b-4 border-[#E30613] rounded-full" />
        ) : visibleNews.length === 0 ? (
          <div className="text-neutral-500">
            <p>Todavía no hay historias publicadas en este tema.</p>
            <Link href="/" className="text-[#E30613] font-semibold text-sm mt-2 inline-block">← Volver al inicio</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
            {visibleNews.map(n => (
              <Link key={n.id} href={`/noticia/${n.slug}`} className="h-full block">
                <NewsCard news={n} darkMode={isDark} />
              </Link>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  )
}
