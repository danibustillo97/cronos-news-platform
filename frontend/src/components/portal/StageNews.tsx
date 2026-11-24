'use client'

// Escenario -- modo noticias. La portada funciona como una consola de
// dirección: la historia activa ocupa el escenario y las siguientes son
// "cámaras" en una tira compacta. Las cámaras rotan solas (barra de
// progreso fina); la rotación se pausa al pasar el cursor, al enfocar con
// teclado, cuando el escenario sale de pantalla, con el botón de pausa y
// siempre si el usuario pide menos movimiento. Pasar el cursor/enfocar una
// cámara la pone en el escenario; un clic la abre.
//
// Alturas: desktop ≤ 520 px y ≤ ~62vh (imagen + tira), tablet ~440 px,
// teléfono = imagen 16:9 con el texto DEBAJO (nunca texto sobre una
// imagen alta). Tipografía contenida, de medio deportivo premium.

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import Image from 'next/image'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Clock, Pause, Play } from 'lucide-react'
import { proxiedImage } from '@/lib/media'
import { estimateReadMinutes } from '@/lib/readTime'
import { timeAgo } from '@/lib/feedComposer'
import type { NewsView } from '@/types/news'
import type { Match } from '@/types/sports'
import { StoryLink } from './StoryLink'
import { useNow } from './useNow'
import StageMatchSpine from './StageMatchSpine'

const ROTATE_MS = 7_000
const STRIP_H = 88
// Alto de la imagen: tablet 352 (+ tira 88 = 440); desktop hasta 432 (+88 = 520), nunca más de 62vh en total.
const IMAGE_H = `clamp(300px, calc(62vh - ${STRIP_H}px), 432px)`

function StageBackdrop({ story, priority }: { story: NewsView; priority: boolean }) {
  const src = proxiedImage(story.image_url)
  if (!src) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(circle_at_30%_20%,#3a300a,#0A0A0A_70%)]">
        <span className="text-3xl font-extrabold tracking-tight text-[#FACC15]/40">NEXUS</span>
      </div>
    )
  }
  return (
    <Image
      src={src}
      alt={story.title}
      fill
      priority={priority}
      sizes="(max-width: 1280px) 100vw, 1200px"
      className="object-cover object-[60%_35%]"
    />
  )
}

function CameraThumb({ story }: { story: NewsView }) {
  const src = proxiedImage(story.image_url)
  return (
    <span className="relative block h-12 w-16 shrink-0 overflow-hidden rounded-md bg-[var(--nx-surface-3)] lg:h-14 lg:w-20">
      {src && <Image src={src} alt="" fill sizes="80px" className="object-cover" />}
    </span>
  )
}

export default function StageNews({
  stories, matches, onOpen,
}: {
  stories: NewsView[]
  matches: Match[]
  onOpen: (story: NewsView) => void
}) {
  const reduce = useReducedMotion() ?? false
  const now = useNow()
  const cameras = stories.slice(0, 4)
  const [active, setActive] = useState(0)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [inView, setInView] = useState(true)
  const [userPaused, setUserPaused] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  const rotating = cameras.length > 1 && !reduce
  const paused = !rotating || hovered || focused || !inView || userPaused

  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.35 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const advance = useCallback(() => setActive((i) => (i + 1) % Math.max(1, cameras.length)), [cameras.length])

  const current = cameras[Math.min(active, cameras.length - 1)]
  if (!current) return null
  const readMinutes = estimateReadMinutes(current.content, current.excerpt)
  const kicker = current.category || 'Portada'

  return (
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_300px]" style={{ '--nx-stage-img': IMAGE_H } as CSSProperties}>
      <div
        ref={rootRef}
        className="overflow-hidden rounded-2xl bg-[var(--nx-surface)] ring-1 ring-[var(--nx-line)]"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setFocused(true)}
        onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false) }}
      >
        <div className="relative sm:h-[352px] lg:h-[var(--nx-stage-img)]">
          {/* Imagen: 16:9 en teléfono; en tablet/desktop llena el escenario */}
          <div className="relative aspect-video w-full overflow-hidden bg-neutral-900 sm:absolute sm:inset-0 sm:aspect-auto">
            <AnimatePresence initial={false}>
              <motion.div
                key={current.id}
                className="absolute inset-0"
                initial={reduce ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={reduce ? undefined : { opacity: 0 }}
                transition={{ duration: 0.7, ease: 'easeOut' }}
              >
                <StageBackdrop story={current} priority={active === 0} />
              </motion.div>
            </AnimatePresence>
            {/* Gradiente de legibilidad solo donde va el texto (abajo-izquierda), sin lavar la foto */}
            <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 hidden h-[62%] bg-gradient-to-t from-black/75 via-black/25 to-transparent sm:block" />
            <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 hidden w-1/2 bg-gradient-to-r from-black/30 to-transparent lg:block" />
            {/* Progreso de la rotación: línea fina en el borde inferior de la imagen; su animationend avanza la cámara. */}
            {cameras.length > 1 && (
              <span aria-hidden className="absolute inset-x-0 bottom-0 z-10 h-[2px] bg-white/15">
                {rotating ? (
                  <span
                    key={`${current.id}-${active}`}
                    className="block h-full w-full origin-left bg-[#FACC15]"
                    style={{ animation: `nx-progress ${ROTATE_MS}ms linear forwards`, animationPlayState: paused ? 'paused' : 'running' }}
                    onAnimationEnd={advance}
                  />
                ) : null}
              </span>
            )}
          </div>

          {/* Texto: debajo de la imagen en teléfono, sobre la imagen desde sm */}
          <div className="px-4 pb-4 pt-3.5 sm:absolute sm:inset-x-0 sm:bottom-0 sm:px-7 sm:pb-7 lg:px-10 lg:pb-9">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={current.id}
                className="max-w-[40rem]"
                initial={reduce ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? undefined : { opacity: 0 }}
                transition={{ duration: 0.25 }}
              >
                <p className="mb-2.5 flex flex-wrap items-center gap-x-2 text-[11px] font-semibold uppercase tracking-[0.14em]">
                  <span className="text-[var(--nx-accent-text)] sm:text-[#FACC15]">{kicker}</span>
                  <span aria-hidden className="text-[var(--nx-muted)] sm:text-white/50">·</span>
                  <span className="font-semibold normal-case tracking-normal text-[var(--nx-muted)] sm:text-white/75">{timeAgo(current.published_at, now)}</span>
                </p>
                <h2 className="min-h-[3.45em] text-balance text-[clamp(1.375rem,1.1rem+1.2vw,2.25rem)] font-bold leading-[1.15] tracking-[-0.015em] text-[var(--nx-ink)] line-clamp-3 sm:min-h-0 sm:text-white">
                  <StoryLink story={current} onOpen={onOpen} className="after:absolute after:inset-0 after:content-[''] hover:underline hover:decoration-2 hover:underline-offset-4">
                    {current.title}
                  </StoryLink>
                </h2>
                {current.excerpt && (
                  <p className="mt-3 max-w-[34rem] text-[15px] leading-relaxed text-white/80 line-clamp-2 max-md:hidden">{current.excerpt}</p>
                )}
                {readMinutes > 0 && (
                  <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-[var(--nx-muted)] sm:text-white/70">
                    <Clock size={12} aria-hidden="true" /> {readMinutes} min de lectura
                  </p>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Tira de cámaras. La activa no repite su título: en tablet/desktop
            queda marcada como "En pantalla"; en teléfono se oculta. */}
        {cameras.length > 1 && (
          <nav aria-label="Historias de portada" className="flex items-center gap-1 border-t border-[var(--nx-line)] py-2.5 pl-3 pr-1.5 sm:h-[88px]">
            <ol className="nx-snap-x flex min-w-0 flex-1 gap-2 overflow-x-auto lg:grid lg:overflow-visible" style={{ gridTemplateColumns: `repeat(${cameras.length}, minmax(0, 1fr))` }}>
              {cameras.map((story, index) => {
                const isActive = index === active
                return (
                  <li key={story.id} className={`w-[80%] shrink-0 sm:w-[46%] lg:w-auto ${isActive ? 'max-sm:hidden' : ''}`}>
                    <StoryLink
                      story={story}
                      onOpen={onOpen}
                      onMouseEnter={() => setActive(index)}
                      onFocus={() => setActive(index)}
                      ariaLabel={`${isActive ? 'En pantalla: ' : ''}${story.title}`}
                      className={`flex h-16 items-center gap-3 rounded-lg px-2 transition-colors ${
                        isActive ? 'bg-[var(--nx-surface-2)] ring-1 ring-inset ring-[var(--nx-line-strong)]' : 'hover:bg-[var(--nx-surface-2)]'
                      }`}
                    >
                      <CameraThumb story={story} />
                      {isActive ? (
                        <span className="min-w-0">
                          <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--nx-accent-text)]">
                            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[var(--nx-accent)]" /> En pantalla
                          </span>
                          <span className="mt-0.5 block text-xs text-[var(--nx-muted)]">{index + 1} de {cameras.length}</span>
                        </span>
                      ) : (
                        <span className="min-w-0">
                          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--nx-muted)]">{story.category || 'Portada'}</span>
                          <span className="mt-0.5 text-[13px] font-semibold leading-[1.3] text-[var(--nx-ink)] line-clamp-2">{story.title}</span>
                        </span>
                      )}
                    </StoryLink>
                  </li>
                )
              })}
            </ol>
            {rotating && (
              <button
                type="button"
                onClick={() => setUserPaused((p) => !p)}
                aria-pressed={userPaused}
                aria-label={userPaused ? 'Reanudar rotación de portada' : 'Pausar rotación de portada'}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--nx-muted)] hover:bg-[var(--nx-surface-2)] hover:text-[var(--nx-ink)]"
              >
                {userPaused ? <Play size={15} aria-hidden="true" /> : <Pause size={15} aria-hidden="true" />}
              </button>
            )}
          </nav>
        )}
      </div>

      <StageMatchSpine matches={matches} className="hidden h-[calc(var(--nx-stage-img)_+_88px)] xl:flex" />
    </div>
  )
}
