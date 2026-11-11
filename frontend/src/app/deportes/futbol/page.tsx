'use client'

// Fútbol: sección 5 del brief -- toolbar de ligas reales (las 8 que
// backend/app/presentation/api/sports.py soporta) + toolbar de vista
// (?view=), ambas deep-linkable. `leagues=<id>` ya lo acepta
// /api/sports/scoreboard -- no hace falta filtrar en el cliente.

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import ModernNavbar from '@/components/ui/ModernNavbar'
import Footer from '@/components/layout/Footer'
import FilterToolbar from '@/components/ui/FilterToolbar'
import MatchRow from '@/components/news/MatchRow'
import NewsCard from '@/components/news/NewsCard'
import StandingsTable, { type StandingsRow } from '@/components/news/StandingsTable'
import { useScoreboard } from '@/lib/useScoreboard'
import { supabase } from '@/lib/supabaseClient'
import { apiUrl } from '@/studio/lab/api-client'
import { usePortalTheme } from '@/context/ThemeContext'
import { isSportsCategory } from '@/lib/newsCategory'
import { FOOTBALL_LEAGUES, DEFAULT_LEAGUE } from '@/lib/sportsLeagues'
import type { NewsView } from '@/types/news'

const VIEWS = [
  { id: 'live', label: 'En vivo' },
  { id: 'matches', label: 'Partidos' },
  { id: 'results', label: 'Resultados' },
  { id: 'standings', label: 'Tablas' },
  { id: 'tournaments', label: 'Torneos' },
  { id: 'teams', label: 'Equipos' },
  { id: 'news', label: 'Noticias' },
]

function EmptyState({ isDark, label }: { isDark: boolean; label: string }) {
  return (
    <div className={`text-center py-16 border border-dashed ${isDark ? 'text-neutral-500 border-white/10' : 'text-[#999] border-[#E5E5E5]'}`}>
      {label}
    </div>
  )
}

function FutbolContent() {
  const { theme } = usePortalTheme()
  const isDark = theme === 'dark'
  const router = useRouter()
  const searchParams = useSearchParams()
  const view = searchParams.get('view') ?? 'matches'
  const league = searchParams.get('league') ?? DEFAULT_LEAGUE

  const { matches, loading: matchesLoading } = useScoreboard(league)
  const [table, setTable] = useState<StandingsRow[]>([])
  const [tableLoading, setTableLoading] = useState(false)
  const [news, setNews] = useState<NewsView[] | null>(null)

  const setParams = (next: { view?: string; league?: string }) => {
    const params = new URLSearchParams(searchParams.toString())
    if (next.view) params.set('view', next.view)
    if (next.league) params.set('league', next.league)
    router.push(`/deportes/futbol?${params.toString()}`, { scroll: false })
  }

  useEffect(() => {
    if (view !== 'standings') return
    let cancelled = false
    setTableLoading(true)
    fetch(apiUrl(`/api/sports/standings?league=${league}`))
      .then((res) => (res.ok ? res.json() : { table: [] }))
      .then((data) => { if (!cancelled) setTable(data.table || []) })
      .catch(() => { if (!cancelled) setTable([]) })
      .finally(() => { if (!cancelled) setTableLoading(false) })
    return () => { cancelled = true }
  }, [view, league])

  useEffect(() => {
    if (view !== 'news') return
    supabase
      .from('news')
      .select('*')
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(60)
      .then(({ data }) => {
        setNews(((data || []) as NewsView[]).filter((n) => isSportsCategory(n.category)))
      })
  }, [view])

  const leagueLabel = FOOTBALL_LEAGUES.find((l) => l.id === league)?.label ?? league
  const live = matches.filter((m) => m.status === 'live')
  const scheduled = matches.filter((m) => m.status === 'scheduled')
  const finished = matches.filter((m) => m.status === 'finished')

  return (
    <div className={`min-h-screen transition-colors duration-200 ${isDark ? 'bg-[#0B0B0B] text-white' : 'bg-[#F7F7F5] text-[#161616]'}`}>
      <ModernNavbar />

      <div className="max-w-7xl mx-auto px-4 pt-8">
        <Link href="/deportes" className={`text-xs font-bold ${isDark ? 'text-neutral-400' : 'text-[#666]'} hover:text-[#E30613]`}>← Deportes</Link>
        <h1 className="text-3xl font-black mt-2 mb-6">Fútbol</h1>

        <div className="flex gap-1 mb-2 overflow-x-auto scrollbar-hide">
          {FOOTBALL_LEAGUES.map((l) => (
            <button
              key={l.id}
              onClick={() => setParams({ league: l.id })}
              className={`flex-shrink-0 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.06em] rounded-sm whitespace-nowrap ${
                league === l.id ? 'bg-[#E30613] text-white' : isDark ? 'bg-white/5 text-neutral-400 hover:text-white' : 'bg-[#F0F0F0] text-[#666] hover:text-[#161616]'
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4">
        <FilterToolbar
          items={VIEWS.map((v) => ({ ...v, disabled: v.id === 'tournaments' || v.id === 'teams' }))}
          active={view}
          onChange={(id) => setParams({ view: id })}
          isDark={isDark}
        />
      </div>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <h2 className={`text-xs font-bold uppercase tracking-[0.12em] mb-4 ${isDark ? 'text-white/60' : 'text-[#666]'}`}>{leagueLabel}</h2>

        {(view === 'live') && (
          matchesLoading ? <p className="text-sm text-neutral-500">Cargando...</p> :
          live.length === 0 ? <EmptyState isDark={isDark} label="No hay partidos en vivo en esta competición." /> :
          <div role="list">{live.map((m) => <MatchRow key={m.id} match={m} variant="list" isDark={isDark} />)}</div>
        )}

        {view === 'matches' && (
          matchesLoading ? <p className="text-sm text-neutral-500">Cargando...</p> :
          scheduled.length === 0 && live.length === 0 ? <EmptyState isDark={isDark} label="Sin partidos próximos en esta competición." /> :
          <div role="list">{[...live, ...scheduled].map((m) => <MatchRow key={m.id} match={m} variant="list" isDark={isDark} />)}</div>
        )}

        {view === 'results' && (
          finished.length === 0 ? <EmptyState isDark={isDark} label="Sin resultados recientes en esta competición." /> :
          <div role="list">{finished.map((m) => <MatchRow key={m.id} match={m} variant="list" isDark={isDark} />)}</div>
        )}

        {view === 'standings' && (
          tableLoading ? <p className="text-sm text-neutral-500">Cargando...</p> :
          table.length === 0 ? <EmptyState isDark={isDark} label="Tabla no disponible para esta competición por ahora." /> :
          <div className={`border p-5 max-w-2xl ${isDark ? 'bg-white/[0.03] border-white/10' : 'bg-white border-[#E5E5E5]'}`}>
            <StandingsTable table={table} isDark={isDark} full />
            <Link href={`/deportes/futbol/tabla?league=${league}`} className="inline-block mt-3 text-xs font-bold text-[#E30613] hover:opacity-70">
              Ver como página completa →
            </Link>
          </div>
        )}

        {(view === 'tournaments' || view === 'teams') && (
          <EmptyState isDark={isDark} label={`${view === 'tournaments' ? 'Torneos' : 'Equipos'} -- próximamente. Todavía no hay datos reales de esta vista.`} />
        )}

        {view === 'news' && (
          news === null ? <p className="text-sm text-neutral-500">Cargando...</p> :
          news.length === 0 ? <EmptyState isDark={isDark} label="Todavía no hay noticias de fútbol publicadas." /> :
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {news.map((n) => (
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

export default function FutbolPage() {
  return (
    <Suspense fallback={null}>
      <FutbolContent />
    </Suspense>
  )
}
