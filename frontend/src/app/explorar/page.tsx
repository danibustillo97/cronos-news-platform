'use client'

// "Explorar" -- sección 11 del brief: evita que el navbar tenga que crecer
// para dar cabida a 100 categorías. Lee el árbol real de taxonomía
// (backend/app/presentation/api/categories.py -- category_groups/
// categories/topics en Supabase, "the source of truth" según su propio
// docstring), no una lista hardcodeada. Cada chip de categoría/tema
// enlaza a /categoria/[slug], que ya filtra contra la columna real
// `news.category` con matching flexible.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import ModernNavbar from '@/components/ui/ModernNavbar'
import Footer from '@/components/layout/Footer'
import { apiUrl } from '@/studio/lab/api-client'
import { usePortalTheme } from '@/context/ThemeContext'
import { FOOTBALL_LEAGUES } from '@/lib/sportsLeagues'

interface Topic { id: string; name: string; slug: string }
interface Category { id: string; name: string; slug: string; topics: Topic[] }
interface CategoryGroup { id: string; name: string; slug: string; categories: Category[] }

function Chip({ href, label, isDark }: { href: string; label: string; isDark: boolean }) {
  return (
    <Link
      href={href}
      className={`inline-block px-3 py-1.5 text-xs font-semibold rounded-full border transition-colors ${
        isDark ? 'border-white/15 text-neutral-200 hover:border-[#E30613] hover:text-white' : 'border-[#E5E5E5] text-[#333] hover:border-[#E30613] hover:text-[#161616]'
      }`}
    >
      {label}
    </Link>
  )
}

export default function ExplorarPage() {
  const { theme } = usePortalTheme()
  const isDark = theme === 'dark'
  const [groups, setGroups] = useState<CategoryGroup[] | null>(null)

  useEffect(() => {
    fetch(apiUrl('/api/categories'))
      .then((res) => (res.ok ? res.json() : { groups: [] }))
      .then((data) => setGroups(data.groups ?? []))
      .catch(() => setGroups([]))
  }, [])

  return (
    <div className={`min-h-screen transition-colors duration-200 ${isDark ? 'bg-[#0B0B0B] text-white' : 'bg-[#F7F7F5] text-[#161616]'}`}>
      <ModernNavbar />

      <main className="max-w-5xl mx-auto px-4 pt-8 pb-24">
        <h1 className="text-3xl font-black mb-2">Explorar</h1>
        <p className={`text-sm mb-10 ${isDark ? 'text-neutral-400' : 'text-[#666]'}`}>
          Todos los temas y competiciones de NEXUS en un solo lugar.
        </p>

        <section className="mb-12">
          <h2 className={`text-xs font-bold uppercase tracking-[0.12em] mb-3 ${isDark ? 'text-white/60' : 'text-[#666]'}`}>Fútbol -- ligas y copas</h2>
          <div className="flex flex-wrap gap-2">
            {FOOTBALL_LEAGUES.map((l) => (
              <Chip key={l.id} href={`/deportes/futbol?view=standings&league=${l.id}`} label={l.label} isDark={isDark} />
            ))}
          </div>
        </section>

        {groups === null ? (
          <p className="text-sm text-neutral-500">Cargando...</p>
        ) : groups.length === 0 ? (
          <div className={`text-center py-16 border border-dashed ${isDark ? 'text-neutral-500 border-white/10' : 'text-[#999] border-[#E5E5E5]'}`}>
            Todavía no hay categorías configuradas.
          </div>
        ) : (
          groups.map((group) => (
            <section key={group.id} className="mb-10">
              <h2 className={`text-xs font-bold uppercase tracking-[0.12em] mb-3 ${isDark ? 'text-white/60' : 'text-[#666]'}`}>{group.name}</h2>
              <div className="flex flex-wrap gap-2 mb-4">
                {group.categories.map((cat) => (
                  <Chip key={cat.id} href={`/categoria/${cat.slug}`} label={cat.name} isDark={isDark} />
                ))}
              </div>
              {group.categories.some((c) => c.topics.length > 0) && (
                <div className="flex flex-wrap gap-2">
                  {group.categories.flatMap((c) => c.topics).map((topic) => (
                    <Chip key={topic.id} href={`/categoria/${topic.slug}`} label={topic.name} isDark={isDark} />
                  ))}
                </div>
              )}
            </section>
          ))
        )}
      </main>

      <Footer />
    </div>
  )
}
