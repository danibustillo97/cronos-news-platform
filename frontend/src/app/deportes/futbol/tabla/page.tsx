'use client'

// Tabla de posiciones como página propia, indexable y compartible --
// sección 16 del brief ("evitar depender exclusivamente de estados
// visuales si una sección merece una URL indexable"). Mismo componente
// StandingsTable que el hub y el widget del home -- una sola fuente de
// verdad para cómo se ve una tabla en todo NEXUS.

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import ModernNavbar from '@/components/ui/ModernNavbar'
import Footer from '@/components/layout/Footer'
import StandingsTable, { type StandingsRow } from '@/components/news/StandingsTable'
import { apiUrl } from '@/studio/lab/api-client'
import { usePortalTheme } from '@/context/ThemeContext'
import { FOOTBALL_LEAGUES, DEFAULT_LEAGUE } from '@/lib/sportsLeagues'

function TablaContent() {
  const { theme } = usePortalTheme()
  const isDark = theme === 'dark'
  const router = useRouter()
  const searchParams = useSearchParams()
  const league = searchParams.get('league') ?? DEFAULT_LEAGUE

  const [table, setTable] = useState<StandingsRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(apiUrl(`/api/sports/standings?league=${league}`))
      .then((res) => (res.ok ? res.json() : { table: [] }))
      .then((data) => { if (!cancelled) setTable(data.table || []) })
      .catch(() => { if (!cancelled) setTable([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [league])

  const leagueLabel = FOOTBALL_LEAGUES.find((l) => l.id === league)?.label ?? league

  return (
    <div className={`min-h-screen transition-colors duration-200 ${isDark ? 'bg-[#0B0B0B] text-white' : 'bg-[#F7F7F5] text-[#161616]'}`}>
      <ModernNavbar />

      <main className="max-w-3xl mx-auto px-4 pt-8 pb-16">
        <Link href="/deportes/futbol" className={`text-xs font-bold ${isDark ? 'text-neutral-400' : 'text-[#666]'} hover:text-[#E30613]`}>← Fútbol</Link>
        <h1 className="text-3xl font-black mt-2 mb-6">Tabla de posiciones -- {leagueLabel}</h1>

        <div className="flex gap-1 mb-6 overflow-x-auto scrollbar-hide">
          {FOOTBALL_LEAGUES.map((l) => (
            <button
              key={l.id}
              onClick={() => router.push(`/deportes/futbol/tabla?league=${l.id}`, { scroll: false })}
              className={`flex-shrink-0 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.06em] rounded-sm whitespace-nowrap ${
                league === l.id ? 'bg-[#E30613] text-white' : isDark ? 'bg-white/5 text-neutral-400 hover:text-white' : 'bg-[#F0F0F0] text-[#666] hover:text-[#161616]'
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-sm text-neutral-500">Cargando...</p>
        ) : table.length === 0 ? (
          <div className={`text-center py-16 border border-dashed ${isDark ? 'text-neutral-500 border-white/10' : 'text-[#999] border-[#E5E5E5]'}`}>
            Tabla no disponible para esta competición por ahora.
          </div>
        ) : (
          <div className={`border p-5 ${isDark ? 'bg-white/[0.03] border-white/10' : 'bg-white border-[#E5E5E5]'}`}>
            <StandingsTable table={table} isDark={isDark} full />
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}

export default function TablaPage() {
  return (
    <Suspense fallback={null}>
      <TablaContent />
    </Suspense>
  )
}
