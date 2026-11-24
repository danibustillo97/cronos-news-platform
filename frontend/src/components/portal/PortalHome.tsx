'use client'

// Raíz del home público de NEXUS.
//
//   Cabecera sticky (navbar + marcador, se esconde al bajar en mobile)
//   ESCENARIO   -- noticias / transmisión de video / radio, según Portada
//   HOME_TOP    -- banda publicitaria
//   EN LA CANCHA-- partidos + tablas de posiciones con selector de liga
//   PULSO       -- feed social de bloques mixtos + riel "Ahora" en vivo
//
// Orden de historias = contrato de Portada (types/portal.ts): fijadas
// primero, ocultas nunca, resto por recencia. Sin endpoint de layout, el
// home se comporta como siempre (destacada = la más reciente).
// `?preview=1` -> modo vista previa del admin (ver lib/usePortalLayout.ts).

import { portalFont } from './fonts'
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { MotionConfig } from 'framer-motion'
import NewsModal from '@/components/news/NewsModal'
import AdSlot from '@/components/ads/AdSlot'
import Footer from '@/components/layout/Footer'
import { usePortalTheme } from '@/context/ThemeContext'
import { useScoreboard } from '@/lib/useScoreboard'
import { usePortalLayout } from '@/lib/usePortalLayout'
import { usePortalNews } from '@/lib/usePortalNews'
import { applyLayout, resolveStage } from '@/lib/portalLayout'
import type { PortalScrollTarget } from '@/types/portal'
import type { NewsView } from '@/types/news'
import PortalHeader from './PortalHeader'
import StageNews from './StageNews'
import StageVideo from './StageVideo'
import StageSkeleton from './StageSkeleton'
import { RadioMiniPlayer, RadioProvider, StageRadio, type RadioStation } from './Radio'
import SportsHub from './SportsHub'
import PulseFeed from './PulseFeed'
import NowRail from './NowRail'
import { Skeleton } from './PortalBits'
import { PollBlock } from './PollCard'
import { usePolls } from '@/lib/usePolls'
import { inPlacement, sortPolls, type Poll } from '@/lib/polls'

const shell = 'mx-auto w-full max-w-[1600px] px-4 sm:px-6 lg:px-8'

export default function PortalHome() {
  const { theme } = usePortalTheme()
  const dark = theme === 'dark'
  const [headerHeight, setHeaderHeight] = useState(88)
  const [selected, setSelected] = useState<NewsView | null>(null)
  const returnUrl = useRef('/')

  const scrollTo = useCallback((target: PortalScrollTarget) => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    document.getElementById(`portal-${target}`)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
  }, [])

  const { layout, ready: layoutReady, preview } = usePortalLayout(scrollTo)
  const news = usePortalNews(layout)
  const { matches, loading: matchesLoading } = useScoreboard()

  const ordered = useMemo(() => applyLayout(news.items, layout), [news.items, layout])
  const stage = useMemo(() => resolveStage(layout), [layout])
  const station = useMemo<RadioStation | null>(
    () => (stage.mode === 'radio' ? { title: stage.title, logo: stage.logo, source: stage.source } : null),
    [stage],
  )

  // Con pocas historias el escenario se queda con menos "cámaras" para que
  // el Pulso no arranque vacío.
  const chapters = ordered.length >= 8 ? 3 : Math.min(2, Math.max(0, ordered.length - 1))
  const stageStories = ordered.slice(0, 1 + chapters)
  const feedStories = ordered.slice(1 + chapters)

  const loading = news.loading || !layoutReady

  // Encuestas/debates (se ocultan solos si el backend responde 404/503).
  const homePolls = usePolls('placement=home')
  const pulsePolls = usePolls('placement=pulse')
  const { featuredPoll, feedPolls } = useMemo(() => {
    const now = new Date()
    const byId = new Map<string, Poll>()
    for (const p of [...homePolls.polls, ...pulsePolls.polls]) byId.set(p.id, p)
    const all = sortPolls([...byId.values()], now)
    const featured = all.find((p) => inPlacement(p, 'home')) ?? null
    return { featuredPoll: featured, feedPolls: all.filter((p) => p.id !== featured?.id && inPlacement(p, 'pulse')) }
  }, [homePolls.polls, pulsePolls.polls])

  useEffect(() => {
    const onPop = () => { if (!window.location.pathname.includes('/noticia/')) setSelected(null) }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const openNews = useCallback((item: NewsView) => {
    if (!window.location.pathname.includes('/noticia/')) returnUrl.current = window.location.pathname + window.location.search
    setSelected(item)
    window.history.pushState({ newsId: item.id }, '', `/noticia/${item.slug}`)
  }, [])

  const closeNews = useCallback(() => {
    setSelected(null)
    window.history.pushState(null, '', returnUrl.current || '/')
  }, [])

  const renderStage = () => {
    if (loading) return <StageSkeleton />
    if (stage.mode === 'video') {
      return <StageVideo title={stage.title} poster={stage.poster} source={stage.source} stories={stageStories} onOpen={openNews} />
    }
    if (stage.mode === 'radio') return <StageRadio stories={stageStories} onOpen={openNews} />
    if (stageStories.length === 0) {
      return (
        <div className="rounded-2xl border border-dashed border-[var(--nx-line-strong)] px-6 py-24 text-center">
          <p className="text-lg font-extrabold text-[var(--nx-ink)]">
            {news.failed ? 'No pudimos cargar la portada.' : 'Todavía no hay historias publicadas.'}
          </p>
          <p className="mt-2 text-sm text-[var(--nx-muted)]">{news.failed ? 'Revisa tu conexión y recarga la página.' : 'Vuelve en un rato: la redacción está trabajando.'}</p>
        </div>
      )
    }
    return <StageNews key={stageStories.map((s) => s.id).join('|')} stories={stageStories} matches={matches} onOpen={openNews} />
  }

  const style = { '--nx-header-h': `${headerHeight}px` } as CSSProperties

  return (
    <MotionConfig reducedMotion="user">
      <div className={`nx-portal ${portalFont.className} min-h-screen overflow-x-clip`} data-theme={theme} data-preview={preview || undefined} style={style}>
        <a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[80] focus:rounded-full focus:bg-[#FACC15] focus:px-5 focus:py-3 focus:text-sm focus:font-black focus:text-black">
          Saltar al contenido
        </a>
        <PortalHeader matches={matches} onHeight={setHeaderHeight} />

        <RadioProvider station={station}>
          <NewsModal news={selected} onClose={closeNews} onNewsClick={openNews} />

          <main id="contenido" tabIndex={-1} className="outline-none">
            <h1 className="sr-only">NEXUS News: noticias de fútbol de Colombia y el mundo</h1>

            <section id="portal-stage" aria-label="Portada" className={`nx-section ${shell} pt-4 lg:pt-6`}>
              {renderStage()}
            </section>

            {featuredPoll && (
              <section aria-label={featuredPoll.kind === 'debate' ? 'El debate del día' : 'La pregunta del día'} className={`${shell} mt-8`}>
                <div className={featuredPoll.kind === 'debate' ? '' : 'mx-auto max-w-2xl'}>
                  <PollBlock poll={featuredPoll} hero />
                </div>
              </section>
            )}

            <div className={`${shell} mt-8`}>
              <aside aria-label="Publicidad" className="border-y border-[var(--nx-line)] py-3 text-center">
                <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--nx-muted)]">Publicidad</span>
                <AdSlot position="HOME_TOP" className="mt-2" />
              </aside>
            </div>

            <section id="portal-sports" aria-labelledby="sports-heading" className={`nx-section ${shell} mt-12`}>
              <SportsHub matches={matches} loading={matchesLoading} dark={dark} />
            </section>

            <section id="portal-feed" aria-labelledby="feed-heading" className={`nx-section ${shell} mt-14 pb-16`}>
              {loading ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[320px]" />)}
                </div>
              ) : (
                <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_340px]">
                  <div className="min-w-0">
                    <div className="mb-10 xl:hidden">
                      <NowRail stories={ordered} matches={matches} onOpen={openNews} variant="strip" />
                    </div>
                    <PulseFeed
                      stories={feedStories}
                      sources={ordered}
                      matches={matches}
                      polls={feedPolls}
                      dark={dark}
                      onOpen={openNews}
                      hasMore={news.hasMore}
                      loadingMore={news.loadingMore}
                      onLoadMore={news.loadMore}
                    />
                  </div>
                  <div className="hidden xl:block">
                    <div className="sticky" style={{ top: 'calc(var(--nx-header-h) + 16px)' }}>
                      <NowRail stories={ordered} matches={matches} onOpen={openNews} variant="rail" />
                    </div>
                  </div>
                </div>
              )}
            </section>
          </main>

          {station && <div aria-hidden="true" className="h-24 sm:h-0" />}
          <Footer />
          <RadioMiniPlayer />
        </RadioProvider>
      </div>
    </MotionConfig>
  )
}
