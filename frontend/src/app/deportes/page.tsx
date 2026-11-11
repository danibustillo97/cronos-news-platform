'use client'

// Hub de deportes real -- responde "¿qué está pasando en el deporte?" con
// una experiencia completa (en vivo, próximos, resultados, tablas,
// noticias), no una lista de artículos filtrada por categoría. Reutiliza
// exactamente la infraestructura ya real: useScoreboard (proxy ESPN,
// backend/app/presentation/api/sports.py) y StandingsTable. El toolbar de
// vista es deep-linkable (?view=) para que cada pestaña tenga URL propia
// y compartible, tal como pide la sección 16 del brief.

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Radio } from 'lucide-react'
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
import { FOOTBALL_LEAGUES, DEFAULT_LEAGUE, OTHER_SPORTS } from '@/lib/sportsLeagues'
import type { NewsView } from '@/types/news'
import type { Match } from '@/types/sports'

const VIEWS = [
  { id: 'todo', label: 'Todo' },
  { id: 'live', label: 'En vivo' },
  { id: 'matches', label: 'Partidos' },
  { id: 'results', label: 'Resultados' },
  { id: 'standings', label: 'Tablas' },
]

function EmptyState({ isDark, label }: { isDark: boolean; label: string }) {
  return (
    <div className={`text-center py-16 border border-dashed ${isDark ? 'text-neutral-500 border-white/10' : 'text-[#999] border-[#E5E5E5]'}`}>
      {label}
    </div>
  )
}

function DeportesContent() {
  const { theme } = usePortalTheme()
  const isDark = theme === 'dark'
  const router = useRouter()
  const searchParams = useSearchParams()
  const view = searchParams.get('view') ?? 'todo'

  const { matches, loading: matchesLoading } = useScoreboard()
  const [news, setNews] = useState<NewsView[] | null>(null)
  const [league, setLeague] = useState(DEFAULT_LEAGUE)
  const [table, setTable] = useState<StandingsRow[]>([])
  const [tableLoading, setTableLoading] = useState(false)

  useEffect(() => {
    supabase
      .from('news')
      .select('*')
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(60)
      .then(({ data }) => {
        setNews(((data || []) as NewsView[]).filter((n) => isSportsCategory(n.category)))
      })
  }, [])

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

  const setView = (id: string) => router.push(id === 'todo' ? '/deportes' : `/deportes?view=${id}`, { scroll: false })

  const live = matches.filter((m) => m.status === 'live')
  const scheduled = matches.filter((m) => m.status === 'scheduled')
  const finished = matches.filter((m) => m.status === 'finished')

  return (
    <div className={`min-h-screen transition-colors duration-200 ${isDark ? 'bg-[#0B0B0B] text-white' : 'bg-[#F7F7F5] text-[#161616]'}`}>
      <ModernNavbar />

      <div className="max-w-7xl mx-auto px-4 pt-8">
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-3xl font-black">Deportes</h1>
          {live.length > 0 && (
            <span className="inline-flex items-center gap-1.5 bg-[#E30613] text-white text-[10px] font-bold uppercase tracking-[0.1em] px-2 py-1 rounded-sm">
              <Radio size={11} /> {live.length} en vivo
            </span>
          )}
        </div>
        <p className={`text-sm mb-6 ${isDark ? 'text-neutral-400' : 'text-[#666]'}`}>
          Resultados, tablas y noticias -- fútbol en vivo hoy, más deportes próximamente.
        </p>

        <div className="flex items-center gap-2 mb-2 overflow-x-auto scrollbar-hide">
          <Link
            href="/deportes/futbol"
            className={`flex-shrink-0 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.08em] rounded-sm whitespace-nowrap ${isDark ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-[#161616] text-white hover:opacity-80'}`}
          >
            Fútbol
          </Link>
          {OTHER_SPORTS.map((s) => (
            <Link
              key={s.id}
              href={`/deportes/${s.id}`}
              className={`flex-shrink-0 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.08em] rounded-sm border whitespace-nowrap ${isDark ? 'border-white/10 text-neutral-400 hover:text-white' : 'border-[#E5E5E5] text-[#999] hover:text-[#161616]'}`}
            >
              {s.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4">
        <FilterToolbar items={VIEWS} active={view} onChange={setView} isDark={isDark} />
      </div>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {view === 'todo' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
            <section>
              <h2 className={`text-xs font-bold uppercase tracking-[0.12em] mb-3 ${isDark ? 'text-white/60' : 'text-[#666]'}`}>En vivo</h2>
              {matchesLoading ? (
                <p className="text-sm text-neutral-500">Cargando...</p>
              ) : live.length === 0 ? (
                <EmptyState isDark={isDark} label="No hay partidos en vivo en este momento." />
              ) : (
                <div role="list">{live.map((m) => <MatchRow key={m.id} match={m} variant="list" isDark={isDark} />)}</div>
              )}
            </section>
            <section>
              <h2 className={`text-xs font-bold uppercase tracking-[0.12em] mb-3 ${isDark ? 'text-white/60' : 'text-[#666]'}`}>Próximos partidos</h2>
              {scheduled.length === 0 ? (
                <EmptyState isDark={isDark} label="Sin próximos partidos por ahora." />
              ) : (
                <div role="list">{scheduled.slice(0, 6).map((m) => <MatchRow key={m.id} match={m} variant="list" isDark={isDark} />)}</div>
              )}
            </section>
          </div>
        )}

        {view === 'live' && (
          live.length === 0
            ? <EmptyState isDark={isDark} label="No hay partidos en vivo en este momento." />
            : <div role="list">{live.map((m) => <MatchRow key={m.id} match={m} variant="list" isDark={isDark} />)}</div>
        )}

        {view === 'matches' && (
          scheduled.length === 0
            ? <EmptyState isDark={isDark} label="Sin próximos partidos por ahora." />
            : <div role="list">{scheduled.map((m) => <MatchRow key={m.id} match={m} variant="list" isDark={isDark} />)}</div>
        )}

        {view === 'results' && (
          finished.length === 0
            ? <EmptyState isDark={isDark} label="Sin resultados recientes." />
            : <div role="list">{finished.map((m) => <MatchRow key={m.id} match={m} variant="list" isDark={isDark} />)}</div>
        )}

        {view === 'standings' && (
          <div>
            <div className="flex gap-1 mb-5 overflow-x-auto scrollbar-hide border-b pb-2" style={{ borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#E5E5E5' }}>
              {FOOTBALL_LEAGUES.map((l) => (
                <button
                  key={l.id}
                  onClick={() => setLeague(l.id)}
                  className={`px-2.5 py-1 text-[11px] font-bold whitespace-nowrap rounded-sm ${league === l.id ? 'bg-[#E30613] text-white' : isDark ? 'text-neutral-400 hover:text-white' : 'text-[#666] hover:text-[#161616]'}`}
                >
                  {l.label}
                </button>
              ))}
            </div>
            {tableLoading ? (
              <p className="text-sm text-neutral-500">Cargando...</p>
            ) : table.length === 0 ? (
              <EmptyState isDark={isDark} label="Tabla no disponible para esta competición por ahora." />
            ) : (
              <div className={`border p-5 max-w-2xl ${isDark ? 'bg-white/[0.03] border-white/10' : 'bg-white border-[#E5E5E5]'}`}>
                <StandingsTable table={table} isDark={isDark} full />
              </div>
            )}
          </div>
        )}

        <section className="mt-14">
          <h2 className={`text-xl font-serif font-bold mb-5 ${isDark ? 'text-white' : 'text-[#161616]'}`}>Noticias deportivas</h2>
          {news === null ? (
            <p className="text-sm text-neutral-500">Cargando...</p>
          ) : news.length === 0 ? (
            <EmptyState isDark={isDark} label="Todavía no hay noticias deportivas publicadas." />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {news.map((n) => (
                <Link key={n.id} href={`/noticia/${n.slug}`} className="h-full block">
                  <NewsCard news={n} darkMode={isDark} />
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>

      <Footer />
    </div>
  )
}

export default function DeportesPage() {
  return (
    <Suspense fallback={null}>
      <DeportesContent />
    </Suspense>
  )
}
