'use client'

// Antes era un link roto en el nav (categoria/futbol, etc. sin página
// real). Filtra por la columna `category` real -- si todavía no hay
// historias reales en ese tema, lo dice honestamente, no inventa nada.

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import ModernNavbar from '@/components/ui/ModernNavbar'
import NewsCard from '@/components/news/NewsCard'
import { supabase } from '@/lib/supabaseClient'
import type { NewsView } from '@/types/news'
import { usePortalTheme } from '@/context/ThemeContext'

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export default function CategoriaPage() {
  const { theme } = usePortalTheme()
  const isDark = theme === 'dark'
  const params = useParams<{ slug: string }>()
  const [news, setNews] = useState<NewsView[] | null>(null)
  const [label, setLabel] = useState('')

  useEffect(() => {
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

  return (
    <div className={`min-h-screen transition-colors duration-200 ${isDark ? 'bg-[#0a0a0a] text-white' : 'bg-neutral-50 text-neutral-900'}`}>
      <ModernNavbar />
      <main className="max-w-7xl mx-auto px-4 pt-20 pb-16">
        <h1 className="text-3xl font-black mb-8 capitalize">{label}</h1>

        {news === null ? (
          <div className="animate-spin h-8 w-8 border-t-4 border-b-4 border-red-600 rounded-full" />
        ) : news.length === 0 ? (
          <div className="text-neutral-500">
            <p>Todavía no hay historias publicadas en este tema.</p>
            <Link href="/" className="text-red-500 font-semibold text-sm mt-2 inline-block">← Volver al inicio</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {news.map(n => (
              <Link key={n.id} href={`/noticia/${n.slug}`} className="h-full block">
                <NewsCard news={n} darkMode={isDark} />
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
