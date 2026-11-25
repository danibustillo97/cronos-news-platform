'use client'

// Tabla de posiciones como página propia, indexable y compartible --
// sección 16 del brief ("evitar depender exclusivamente de estados
// visuales si una sección merece una URL indexable"). Mismo componente
// StandingsTable que el hub y el widget del home -- una sola fuente de
// verdad para cómo se ve una tabla en todo NEXUS.

import { Suspense, useEffect, useState, type ReactNode } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import ModernNavbar from '@/components/portal/PortalNavbar'
import Footer from '@/components/layout/Footer'
import { StandingsGroups } from '@/components/news/StandingsTable'
import { normalizeStandingsResponse, type CompetitionFormat, type StandingsGroup } from '@/lib/standings'
import { apiUrl } from '@/studio/lab/api-client'
import { usePortalTheme } from '@/context/ThemeContext'
import { FOOTBALL_LEAGUES, DEFAULT_LEAGUE } from '@/lib/sportsLeagues'

function TablaContent({ seoIntro }: { seoIntro: ReactNode }) {
  const { theme } = usePortalTheme()
  const isDark = theme === 'dark'
  const router = useRouter()
  const searchParams = useSearchParams()
  const league = searchParams.get('league') ?? DEFAULT_LEAGUE

  const [groups, setGroups] = useState<StandingsGroup[]>([])
  const [format, setFormat] = useState<CompetitionFormat | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(apiUrl(`/api/sports/standings?league=${league}`))
      .then((res) => (res.ok ? res.json() : { table: [] }))
      .then((data: unknown) => {
        if (cancelled) return
        const n = normalizeStandingsResponse(data)
        setGroups(n.groups)
        setFormat(n.format)
      })
      .catch(() => { if (!cancelled) { setGroups([]); setFormat(null) } })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [league])

  const leagueLabel = FOOTBALL_LEAGUES.find((l) => l.id === league)?.label ?? league

  return (
    <div className={`min-h-screen transition-colors duration-200 ${isDark ? 'bg-[#0B0B0B] text-white' : 'bg-[#F7F7F5] text-[#161616]'}`}>
      <ModernNavbar />

      <main className="max-w-3xl mx-auto px-4 pt-8 pb-16">
        <Link href="/deportes/futbol" className={`text-xs font-bold ${isDark ? 'text-neutral-400' : 'text-[#666]'} hover:text-[#FACC15]`}>← Fútbol</Link>
        {seoIntro}
        <h2 className="text-xl font-bold mt-4 mb-6">Competición: {leagueLabel}</h2>

        <div className="flex gap-1 mb-6 overflow-x-auto scrollbar-hide">
          {FOOTBALL_LEAGUES.map((l) => (
            <button
              key={l.id}
              onClick={() => router.push(`/deportes/futbol/tabla?league=${l.id}`, { scroll: false })}
              className={`flex-shrink-0 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.06em] rounded-sm whitespace-nowrap ${
                league === l.id ? 'bg-[#FACC15] text-black' : isDark ? 'bg-white/5 text-neutral-400 hover:text-black' : 'bg-[#F0F0F0] text-[#666] hover:text-[#161616]'
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-sm text-neutral-500">Cargando...</p>
        ) : groups.length === 0 ? (
          <div className={`text-center py-16 border border-dashed ${isDark ? 'text-neutral-500 border-white/10' : 'text-[#999] border-[#E5E5E5]'}`}>
            Tabla no disponible para esta competición por ahora.
          </div>
        ) : (
          <div className={`border p-5 ${isDark ? 'bg-white/[0.03] border-white/10' : 'bg-white border-[#E5E5E5]'}`}>
            <StandingsGroups groups={groups} league={league} />
            {format && (
              <p className={`mt-4 text-[13px] leading-relaxed ${isDark ? 'text-neutral-400' : 'text-[#555]'}`}>
                <span className="font-bold">¿Cómo se juega?</span> {format.summary}
              </p>
            )}
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}

export default function TablaPage({ seoIntro }: { seoIntro: ReactNode }) {
  return (
    <Suspense fallback={null}>
      <TablaContent seoIntro={seoIntro} />
    </Suspense>
  )
}
