'use client'

// SPORTS PULSE -- deportes deja de ser "una categoría más" y pasa a ser
// un módulo compuesto con sensación de producto propio: una tira de
// competiciones (DATA, navegación rápida) sobre partidos/tabla (DATA
// densa) y, debajo, cobertura real de creadores (EDITORIAL, más
// respirada). Reemplaza a SportsSection.tsx (superseded, no se borra por
// si algo más lo referencia).

import { useState } from 'react'
import Link from 'next/link'
import { Radio } from 'lucide-react'
import MatchRow from '@/components/news/MatchRow'
import StandingsPanel from '@/components/news/StandingsPanel'
import SectionBand from '@/components/news/SectionBand'
import PostCard from '@/components/platform/PostCard'
import CoverageRail from '@/components/platform/CoverageRail'
import FilterToolbar from '@/components/ui/FilterToolbar'
import { isSportsCategory } from '@/lib/newsCategory'
import { newsToPost, buildCoverage, type Post } from '@/lib/platform'
import { useScoreboard } from '@/lib/useScoreboard'
import { FOOTBALL_LEAGUES } from '@/lib/sportsLeagues'
import type { NewsView } from '@/types/news'
import type { Match } from '@/types/sports'

const LEAGUE_TABS = [{ id: 'all', label: 'Todo' }, ...FOOTBALL_LEAGUES.map((l) => ({ id: l.id, label: l.label }))]

export default function SportsPulse({
  news, matches: defaultMatches, isDark, onOpen,
}: {
  news: NewsView[]
  matches: Match[]
  isDark: boolean
  onOpen: (item: NewsView) => void
}) {
  const [league, setLeague] = useState('all')
  const { matches: leagueMatches } = useScoreboard(league === 'all' ? undefined : league)
  const matches = league === 'all' ? defaultMatches : leagueMatches

  const sportsNews = news.filter((item) => isSportsCategory(item.category))
  if (sportsNews.length === 0 && defaultMatches.length === 0) return null

  const live = matches.filter((m) => m.status === 'live').slice(0, 3)
  const scheduled = matches.filter((m) => m.status === 'scheduled').slice(0, 3)
  const coverage = buildCoverage(matches.length > 0 ? matches : defaultMatches, sportsNews)
  const coveragePostIds = new Set(coverage?.posts.map((p) => p.id) ?? [])
  const restPosts: Post[] = sportsNews
    .filter((n) => !coveragePostIds.has(n.id))
    .slice(0, 4)
    .map((n) => newsToPost(n, sportsNews))

  const openPost = (post: Post) => onOpen(post.source)

  return (
    <SectionBand bg={isDark ? '#0B0B0B' : '#FFFFFF'} borderColor="#E50914">
      <section>
        <div className="flex items-baseline justify-between mb-4">
          <div className="flex items-center gap-3">
            <h2 className={`text-xl font-serif font-bold ${isDark ? 'text-white' : 'text-[#161616]'}`}>Sports Pulse</h2>
            {live.length > 0 && (
              <span className="inline-flex items-center gap-1.5 bg-[#E30613] text-white text-[10px] font-bold uppercase tracking-[0.1em] px-2 py-1 rounded-sm">
                <Radio size={11} className="animate-pulse" /> {live.length} en vivo
              </span>
            )}
          </div>
          <Link href="/deportes" className="text-xs font-bold text-[#E30613] hover:opacity-70 transition-opacity">
            Ir al hub de deportes →
          </Link>
        </div>

        <div className="-mx-4 px-4 mb-6">
          <FilterToolbar items={LEAGUE_TABS} active={league} onChange={setLeague} isDark={isDark} />
        </div>

        <div className="grid grid-cols-4 md:grid-cols-8 lg:grid-cols-12 gap-6">
          <div className="col-span-4 md:col-span-5 lg:col-span-7 space-y-6">
            {(live.length > 0 || scheduled.length > 0) && (
              <div>
                <p className={`text-[10px] font-bold uppercase tracking-[0.12em] mb-2 ${isDark ? 'text-white/50' : 'text-[#999]'}`}>
                  {live.length > 0 ? 'En vivo ahora' : 'Próximos partidos'}
                </p>
                <div className={`border ${isDark ? 'border-white/10' : 'border-[#E5E5E5]'}`}>
                  {[...live, ...scheduled].slice(0, 3).map((m) => (
                    <MatchRow key={m.id} match={m} variant="list" isDark={isDark} />
                  ))}
                </div>
              </div>
            )}
            {live.length === 0 && scheduled.length === 0 && (
              <p className={`text-sm py-6 text-center border border-dashed ${isDark ? 'text-neutral-500 border-white/10' : 'text-[#999] border-[#E5E5E5]'}`}>
                Sin partidos en vivo o próximos en esta competición.
              </p>
            )}

            {coverage && (
              <div>
                <p className={`text-[10px] font-bold uppercase tracking-[0.12em] mb-2 ${isDark ? 'text-white/50' : 'text-[#999]'}`}>Cobertura</p>
                <CoverageRail coverage={coverage} isDark={isDark} onOpen={openPost} />
              </div>
            )}

            {restPosts.length > 0 && (
              <div>
                <p className={`text-[10px] font-bold uppercase tracking-[0.12em] mb-3 ${isDark ? 'text-white/50' : 'text-[#999]'}`}>Publicaciones de creadores</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
                  {restPosts.map((post) => (
                    <PostCard key={post.id} post={post} isDark={isDark} onOpen={openPost} variant="compact" />
                  ))}
                </div>
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
