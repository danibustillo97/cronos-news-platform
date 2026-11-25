'use client'

// "En 30 segundos": la nota resumida en diapositivas tipo historias de
// Instagram, con barras de progreso dentro de la tarjeta. Arranca sola
// solo cuando la tarjeta está ≥60 % visible y se detiene fuera de
// pantalla; se pausa con el cursor encima o manteniendo presionado; tocar
// la mitad izquierda/derecha retrocede/avanza. Con "menos movimiento" no
// avanza sola. Las frases salen de la propia nota (lib/reels.ts).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import { ArrowUpRight, ChevronLeft, ChevronRight, Pause, Play, Timer } from 'lucide-react'
import { useReducedMotion } from 'framer-motion'
import { briefSlides, slideDurationMs } from '@/lib/reels'
import { proxiedImage } from '@/lib/media'
import type { NewsView } from '@/types/news'
import ReelFrame, { reelTitle } from './ReelFrame'
import { StoryLink } from './StoryLink'

export default function BriefReel({ story, onOpen }: { story: NewsView; onOpen: (s: NewsView) => void }) {
  const slides = useMemo(() => briefSlides(story), [story])
  const duration = slideDurationMs(slides.length)
  const reduce = useReducedMotion() ?? false
  const [index, setIndex] = useState(0)
  const [visible, setVisible] = useState(false)
  const [holding, setHolding] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [userPaused, setUserPaused] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const titleId = `brief-${story.id}`

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setVisible(e.intersectionRatio >= 0.6), { threshold: [0, 0.6, 1] })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const auto = !reduce && slides.length > 1
  const paused = !auto || !visible || holding || hovered || userPaused
  const last = index >= slides.length - 1
  const next = useCallback(() => setIndex((i) => Math.min(slides.length - 1, i + 1)), [slides.length])
  const prev = useCallback(() => setIndex((i) => Math.max(0, i - 1)), [])

  if (slides.length === 0) return null
  const slide = slides[index]
  const src = proxiedImage(story.image_url)

  return (
    <ReelFrame
      icon={<Timer size={12} aria-hidden="true" />}
      kind="En 30 segundos"
      tone="accent"
      time={story.published_at}
      labelledBy={titleId}
      media={
        <div
          ref={ref}
          role="group"
          aria-roledescription="carrusel"
          aria-label={`Resumen en 30 segundos: ${story.title}`}
          className="relative aspect-[4/5] w-full select-none overflow-hidden bg-neutral-950 text-white sm:aspect-square"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => { setHovered(false); setHolding(false) }}
          onPointerDown={(e) => { if (e.pointerType !== 'mouse') setHolding(true) }}
          onPointerUp={() => setHolding(false)}
          onPointerCancel={() => setHolding(false)}
        >
          {src && <Image src={src} alt="" fill sizes="(max-width: 640px) 100vw, 600px" className="scale-110 object-cover opacity-45 blur-[2px]" />}
          <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/40 to-black/80" />

          {/* Barras de progreso */}
          <div className="absolute inset-x-3 top-3 z-20 flex gap-1" aria-hidden="true">
            {slides.map((_, i) => (
              <span key={i} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/25">
                {i < index && <span className="block h-full w-full bg-white" />}
                {i === index && (auto ? (
                  <span
                    key={`${index}-run`}
                    className="block h-full w-full origin-left bg-white"
                    style={{ animation: `nx-progress ${duration}ms linear forwards`, animationPlayState: paused ? 'paused' : 'running' }}
                    onAnimationEnd={() => { if (!last) next() }}
                  />
                ) : <span className="block h-full w-full bg-white" />)}
              </span>
            ))}
          </div>

          {/* Diapositiva */}
          <div className="absolute inset-0 z-10 flex flex-col justify-center px-7 pb-14 pt-12 sm:px-10" aria-live={paused ? 'polite' : 'off'}>
            {slide.kind === 'title' && (
              <>
                <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#FACC15]">{slide.kicker}</span>
                <p className="mt-2 max-w-[38ch] text-balance text-[clamp(1.6rem,1.3rem+1.4vw,2.2rem)] font-extrabold leading-[1.08] tracking-[-0.02em]">{slide.text}</p>
                <p className="mt-4 text-sm text-white/70">Lo esencial en {slides.length - 2} claves</p>
              </>
            )}
            {slide.kind === 'point' && (
              <>
                <span className="text-[13px] font-bold tabular-nums text-[#FACC15]">{String(slide.index).padStart(2, '0')} / {String(slide.total).padStart(2, '0')}</span>
                <p className="mt-2 max-w-[38ch] text-[18px] font-semibold leading-[1.45] sm:text-[20px]">{slide.text}</p>
              </>
            )}
            {slide.kind === 'cta' && (
              <div className="flex flex-col items-start gap-4">
                <p className="text-balance text-xl font-bold leading-snug">{story.title}</p>
                <StoryLink story={story} onOpen={onOpen} className="relative z-30 inline-flex min-h-[48px] items-center gap-2 rounded-full bg-[#FACC15] px-5 text-sm font-bold text-black">
                  {slide.text} <ArrowUpRight size={16} aria-hidden="true" />
                </StoryLink>
              </div>
            )}
          </div>

          {/* Zonas táctiles: izquierda = anterior, derecha = siguiente */}
          <button type="button" onClick={prev} disabled={index === 0} aria-label="Diapositiva anterior" className="group/nav absolute inset-y-0 left-0 z-20 w-1/3 focus-visible:outline-none disabled:cursor-default">
            <span className="absolute left-2 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 group-focus-visible/nav:inline-flex sm:group-hover/nav:inline-flex group-disabled/nav:!hidden"><ChevronLeft size={20} /></span>
          </button>
          <button type="button" onClick={next} disabled={last} aria-label="Diapositiva siguiente" className={`group/nav absolute inset-y-0 right-0 z-20 w-1/3 focus-visible:outline-none disabled:cursor-default ${last ? 'pointer-events-none' : ''}`}>
            <span className="absolute right-2 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 group-focus-visible/nav:inline-flex sm:group-hover/nav:inline-flex group-disabled/nav:!hidden"><ChevronRight size={20} /></span>
          </button>
          <div className="absolute bottom-3 right-3 z-30 flex items-center gap-1">
            <span className="rounded-full bg-black/50 px-2.5 py-1 text-[11px] font-semibold tabular-nums">{index + 1}/{slides.length}</span>
            {auto && (
              <button type="button" onClick={() => setUserPaused((p) => !p)} aria-label={userPaused ? 'Reanudar' : 'Pausar'} aria-pressed={userPaused} className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-black/50 hover:bg-black/70">
                {userPaused ? <Play size={15} aria-hidden="true" /> : <Pause size={15} aria-hidden="true" />}
              </button>
            )}
          </div>
        </div>
      }
      title={
        <h3 id={titleId} className={reelTitle}>
          <StoryLink story={story} onOpen={onOpen} className="hover:underline hover:decoration-2 hover:underline-offset-4">{story.title}</StoryLink>
        </h3>
      }
      meta={['En 30 segundos', `${slides.length} diapositivas`]}
      share={{ url: `/noticia/${story.slug}`, title: story.title }}
      saveId={story.id}
      social={{ type: 'news', id: story.id }}
      more={{ href: `/noticia/${story.slug}`, label: 'Leer', onClick: (e) => { if (!e.metaKey && !e.ctrlKey && !e.shiftKey && e.button === 0) { e.preventDefault(); onOpen(story) } } }}
    />
  )
}
