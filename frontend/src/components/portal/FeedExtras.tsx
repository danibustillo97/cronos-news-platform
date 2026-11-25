'use client'

// Tarjetas nuevas del feed, con el mismo marco (ReelFrame):
// - Cápsulas (efeméride, ¿sabías que…?, leyenda, momento histórico) en
//   diapositivas tipo "En 30 segundos", con los colores de /og/capsule.
// - Parley del día con cuotas reales. Siempre visibles: aviso legal,
//   "+18" y "Juega con responsabilidad". Sin enlaces a casas de apuestas.

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { CalendarDays, ChevronLeft, ChevronRight, Crown, Flame, Lightbulb, Pause, Play, Ticket } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { CAPSULE_ACCENT, CAPSULE_LABEL, SLIDE_IMAGE_MAX_WAIT_MS, capsuleDateLabel, capsuleImages, capsuleOgUrl, capsuleSlideImage, slideReady, type Capsule } from '@/lib/capsules'
import { formChips, formatOdds, formatProbability, safeText, type PicksData } from '@/lib/picks'
import { slideDurationMs } from '@/lib/reels'
import { monogram } from '@/lib/leagueLogos'
import { imageSource } from '@/lib/media'
import { kickoffLabel } from '@/lib/feedComposer'
import ReelFrame, { reelTitle } from './ReelFrame'
import { TeamCrest } from './Crest'

// ---------------------------------------------------------------- cápsulas

const KIND_ICON = {
  efemeride: CalendarDays,
  sabias_que: Lightbulb,
  leyenda: Crown,
  momento: Flame,
} as const

export function CapsuleCard({ capsule }: { capsule: Capsule }) {
  const reduce = useReducedMotion() ?? false
  const accent = CAPSULE_ACCENT[capsule.kind]
  const Icon = KIND_ICON[capsule.kind]
  const total = capsule.slides.length + 1 // portada + diapositivas
  const duration = slideDurationMs(total)
  const [index, setIndex] = useState(0)
  const [visible, setVisible] = useState(false)
  const [hold, setHold] = useState(false)
  const [userPaused, setUserPaused] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const titleId = `cap-${capsule.id}`
  const dateLabel = capsuleDateLabel(capsule, new Date())
  // Imágenes ya decodificadas (precargadas al hacerse visible la tarjeta).
  const [loaded, setLoaded] = useState<Set<string>>(() => new Set())
  const [waited, setWaited] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setVisible(e.intersectionRatio >= 0.6), { threshold: [0, 0.6, 1] })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  // Precarga de TODAS las diapositivas en cuanto la tarjeta se ve.
  const preloaded = useRef(false)
  useEffect(() => {
    if (!visible || preloaded.current) return
    preloaded.current = true
    for (const url of capsuleImages(capsule)) {
      const src = imageSource(url)?.src
      if (!src) continue
      const img = new window.Image()
      img.decoding = 'async'
      img.src = src
      const done = () => setLoaded((prev) => (prev.has(url) ? prev : new Set(prev).add(url)))
      ;(img.decode ? img.decode() : Promise.reject()).then(done, () => { img.onload = done; if (img.complete && img.naturalWidth) done() })
    }
  }, [visible, capsule])

  const slideImg = capsuleSlideImage(capsule, index)
  const imgLoaded = slideImg ? loaded.has(slideImg) : false
  // Máximo 1,5 s esperando la foto de esta diapositiva; luego sigue con fondo tipográfico.
  useEffect(() => {
    setWaited(false)
    if (!slideImg) return
    const t = window.setTimeout(() => setWaited(true), SLIDE_IMAGE_MAX_WAIT_MS)
    return () => window.clearTimeout(t)
  }, [index, slideImg])
  const ready = slideReady({ image: slideImg, loaded: imgLoaded, waitedMs: waited ? SLIDE_IMAGE_MAX_WAIT_MS : 0 })
  const auto = !reduce && total > 1
  const paused = !auto || !visible || hold || userPaused || !ready
  const last = index >= total - 1
  const next = useCallback(() => setIndex((i) => Math.min(total - 1, i + 1)), [total])
  const prev = useCallback(() => setIndex((i) => Math.max(0, i - 1)), [])
  const slide = index > 0 ? capsule.slides[index - 1] : null
  // Nunca conservar la foto anterior mientras llega la de la diapositiva actual:
  // eso desincroniza visualmente la imagen del texto. Si aún carga, mostramos fondo.
  const bgSource = imageSource(imgLoaded ? slideImg : null)
  const bg = bgSource?.src ?? null
  const name = capsule.subject ?? capsule.title

  return (
    <ReelFrame
      icon={<Icon size={12} aria-hidden="true" />}
      kind={CAPSULE_LABEL[capsule.kind]}
      tone="accent"
      labelledBy={titleId}
      media={
        <div
          ref={ref}
          role="group"
          aria-roledescription="carrusel"
          aria-label={`${CAPSULE_LABEL[capsule.kind]}: ${capsule.title}`}
          className="relative aspect-[4/5] w-full select-none overflow-hidden bg-[#0A0A0A] text-white sm:aspect-square"
          style={{ backgroundImage: `radial-gradient(120% 70% at 20% 0%, ${accent}33 0%, #0A0A0A 60%)` }}
          onMouseEnter={() => setHold(true)}
          onMouseLeave={() => setHold(false)}
          onPointerDown={(e) => { if (e.pointerType !== 'mouse') setHold(true) }}
          onPointerUp={() => setHold(false)}
          onPointerCancel={() => setHold(false)}
        >
          <AnimatePresence initial={false}>
            {bg && (
              <motion.div key={bg} className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: index === 0 ? 0.6 : 0.35 }} exit={{ opacity: 0 }} transition={{ duration: reduce ? 0 : 0.35 }}>
                <Image src={bg} alt="" fill sizes="(max-width: 640px) 100vw, 600px" unoptimized={bgSource?.direct} className="object-cover" />
              </motion.div>
            )}
          </AnimatePresence>
          {bg && <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/30 to-black/85" />}
          {capsule.kind === 'leyenda' && <div aria-hidden className="absolute inset-0 shadow-[inset_0_0_0_2px_rgba(212,175,55,0.4)]" />}

          <div className="absolute inset-x-3 top-3 z-20 flex gap-1" aria-hidden="true">
            {Array.from({ length: total }).map((_, i) => (
              <span key={i} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/25">
                {i < index && <span className="block h-full w-full bg-white" />}
                {i === index && (auto ? (
                  <span key={`${index}-run`} className="block h-full w-full origin-left bg-white" style={{ animation: `nx-progress ${duration}ms linear forwards`, animationPlayState: paused ? 'paused' : 'running' }} onAnimationEnd={() => { if (!last) next() }} />
                ) : <span className="block h-full w-full bg-white" />)}
              </span>
            ))}
          </div>

          <div className="absolute inset-0 z-10 flex flex-col justify-center px-7 pb-14 pt-12 sm:px-10">
            {index === 0 ? (
              capsule.kind === 'efemeride' ? (
                <>
                  <span className="text-[12px] font-bold uppercase tracking-[0.18em]" style={{ color: accent }}>{dateLabel?.startsWith('Un día') ? 'Un día como hoy' : dateLabel ?? 'Efeméride'}</span>
                  {capsule.year && <span className="mt-1 text-[clamp(4.5rem,3.6rem+5vw,6.5rem)] font-bold leading-none tracking-[-0.04em] tabular-nums">{capsule.year}</span>}
                  <p className="mt-3 text-balance text-[clamp(1.25rem,1.05rem+1vw,1.6rem)] font-bold leading-snug">{capsule.title}</p>
                </>
              ) : capsule.kind === 'leyenda' ? (
                <div className="flex flex-col items-start">
                  {!bg && <span className="mb-4 inline-flex h-20 w-20 items-center justify-center rounded-full text-2xl font-bold text-black" style={{ background: `linear-gradient(135deg, ${accent}, #8a6d1a)` }}>{monogram(name)}</span>}
                  <span className="text-[12px] font-bold uppercase tracking-[0.18em]" style={{ color: accent }}>Leyendas{capsule.year ? ` · ${capsule.year}` : ''}</span>
                  <p className="mt-2 text-balance text-[clamp(1.7rem,1.3rem+2vw,2.4rem)] font-bold leading-[1.08] tracking-[-0.02em]">{name}</p>
                  {capsule.subject && <p className="mt-2 text-base text-white/80">{capsule.title}</p>}
                </div>
              ) : (
                <>
                  <span className="text-[12px] font-bold uppercase tracking-[0.18em]" style={{ color: accent }}>{CAPSULE_LABEL[capsule.kind]}{capsule.year ? ` · ${capsule.year}` : ''}</span>
                  <p className="mt-3 text-balance text-[clamp(1.6rem,1.25rem+1.8vw,2.3rem)] font-bold leading-[1.1] tracking-[-0.02em]">{capsule.title}</p>
                </>
              )
            ) : (
              <>
                <span className="text-5xl font-bold tabular-nums leading-none" style={{ color: accent }}>{index}</span>
                <p className="mt-4 text-[clamp(1.1rem,1rem+0.6vw,1.4rem)] font-semibold leading-[1.4]">{slide?.text}</p>
              </>
            )}
          </div>

          <button type="button" onClick={prev} disabled={index === 0} aria-label="Diapositiva anterior" className="group/nav absolute inset-y-0 left-0 z-20 w-1/3 focus-visible:outline-none disabled:cursor-default">
            <span className="absolute left-2 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 group-focus-visible/nav:inline-flex sm:group-hover/nav:inline-flex group-disabled/nav:!hidden"><ChevronLeft size={20} /></span>
          </button>
          <button type="button" onClick={next} disabled={last} aria-label="Diapositiva siguiente" className={`group/nav absolute inset-y-0 right-0 z-20 w-1/3 focus-visible:outline-none disabled:cursor-default ${last ? 'pointer-events-none' : ''}`}>
            <span className="absolute right-2 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 group-focus-visible/nav:inline-flex sm:group-hover/nav:inline-flex group-disabled/nav:!hidden"><ChevronRight size={20} /></span>
          </button>
          <div className="absolute bottom-3 right-3 z-30 flex items-center gap-1">
            <span className="rounded-full bg-black/50 px-2.5 py-1 text-[11px] font-semibold tabular-nums">{index + 1}/{total}</span>
            {auto && (
              <button type="button" onClick={() => setUserPaused((p) => !p)} aria-label={userPaused ? 'Reanudar' : 'Pausar'} aria-pressed={userPaused} className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-black/50 hover:bg-black/70">
                {userPaused ? <Play size={15} aria-hidden="true" /> : <Pause size={15} aria-hidden="true" />}
              </button>
            )}
          </div>
        </div>
      }
      title={<h3 id={titleId} className={reelTitle}>{capsule.title}</h3>}
      meta={[capsule.subject && capsule.subject !== capsule.title ? capsule.subject : null, dateLabel].filter(Boolean).join(' · ') || undefined}
      share={{ url: capsuleOgUrl(capsule, 1), title: capsule.title }}
      saveId={`cap-${capsule.id}`}
      social={{ type: 'capsule', id: capsule.id }}
      more={capsule.kind === 'leyenda' ? { href: '/leyendas', label: 'Más leyendas' } : undefined}
    />
  )
}

// ------------------------------------------------------------ parley del día

export function ResponsibleBadges({ className = '' }: { className?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <span className="inline-flex h-6 items-center rounded-full border-2 border-[#DC2626] px-2 text-[11px] font-black text-[#DC2626]" aria-label="Solo mayores de 18 años">+18</span>
      <span className="text-[12px] font-bold text-[var(--nx-ink)]">Juega con responsabilidad</span>
    </div>
  )
}

export function FormChips({ form }: { form: string }) {
  const chips = formChips(form)
  if (chips.length === 0) return null
  return (
    <span className="inline-flex gap-0.5" aria-label={`Últimos partidos: ${chips.map((c) => c.label).join(', ')}`}>
      {chips.map((c, i) => (
        <span key={i} aria-hidden="true" className={`inline-flex h-[18px] w-[18px] items-center justify-center rounded text-[10px] font-bold ${c.letter === 'G' ? 'bg-[#16A34A] text-white' : c.letter === 'E' ? 'bg-[var(--nx-surface-3)] text-[var(--nx-ink-2)]' : 'bg-[#DC2626] text-white'}`}>{c.letter}</span>
      ))}
    </span>
  )
}

export function PicksCard({ data }: { data: PicksData | null }) {
  const [active, setActive] = useState(0)
  if (!data || data.parlays.length === 0) return null
  const parlay = data.parlays[Math.min(active, data.parlays.length - 1)]
  const byId = new Map(data.matches.map((m) => [m.id, m]))
  const provider = data.matches[0]?.provider ?? 'DraftKings'
  const now = new Date()
  return (
    <li className="nx-snap-item">
      <ReelFrame
        icon={<Ticket size={12} aria-hidden="true" />}
        kind="Parley del día"
        tone="accent"
        time={data.generatedAt || null}
        body={
          <div className="flex flex-col gap-3">
            <ResponsibleBadges />
            {data.parlays.length > 1 && (
              <div role="tablist" aria-label="Parleys" className="nx-snap-x -mx-1 flex gap-1.5 overflow-x-auto px-1">
                {data.parlays.map((p, i) => (
                  <button key={p.name} type="button" role="tab" aria-selected={i === active} onClick={() => setActive(i)} className={`inline-flex min-h-[36px] shrink-0 items-center rounded-full border px-3 text-xs font-bold ${i === active ? 'border-transparent bg-[var(--nx-ink)] text-[var(--nx-bg)]' : 'border-[var(--nx-line)] text-[var(--nx-ink-2)]'}`}>{p.name}</button>
                ))}
              </div>
            )}
            <div>
              <h3 className="text-lg font-bold text-[var(--nx-ink)]">{parlay.name}</h3>
              {safeText(parlay.description) && <p className="text-sm text-[var(--nx-ink-2)]">{safeText(parlay.description)}</p>}
            </div>
            <ol className="divide-y divide-[var(--nx-line)] rounded-xl border border-[var(--nx-line)]">
              {parlay.picks.map((pk, i) => {
                const m = byId.get(pk.matchId)
                return (
                  <li key={`${pk.matchId}-${i}`} className="flex items-center gap-3 px-3 py-2.5">
                    <span className="flex shrink-0 -space-x-1.5">
                      <TeamCrest src={m?.home.logo} name={m?.home.name ?? pk.match} size={24} />
                      <TeamCrest src={m?.away.logo} name={m?.away.name ?? pk.match} size={24} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] font-bold leading-snug text-[var(--nx-ink)]">{pk.label}</span>
                      <span className="block truncate text-[12px] text-[var(--nx-muted)]">{pk.match} · {pk.leagueName}{pk.date ? ` · ${kickoffLabel(pk.date, now)}` : ''}</span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-[15px] font-bold tabular-nums text-[var(--nx-ink)]">{formatOdds(pk.odds)}</span>
                      <span className="block text-[11px] tabular-nums text-[var(--nx-muted)]">{formatProbability(pk.probability)}</span>
                    </span>
                  </li>
                )
              })}
            </ol>
            <div className="flex items-center justify-between rounded-xl bg-[var(--nx-surface-2)] px-3 py-2.5">
              <span className="text-[13px] font-semibold text-[var(--nx-ink-2)]">Cuota combinada</span>
              <span className="text-right">
                <span className="block text-xl font-bold tabular-nums text-[var(--nx-ink)]">{formatOdds(parlay.odds)}</span>
                <span className="block text-[11px] text-[var(--nx-muted)]">Probabilidad de mercado {formatProbability(parlay.probability)}</span>
              </span>
            </div>
            <p className="text-[12px] leading-relaxed text-[var(--nx-muted)]">{data.disclaimer}</p>
          </div>
        }
        meta={`Datos: cuotas ${provider} vía ESPN + racha últimos 5`}
        share={{ url: '/parleys', title: 'Parley del día · NEXUS' }}
        social={{ type: 'picks', id: 'today' }}
        more={{ href: '/parleys', label: 'Ver todos' }}
      />
    </li>
  )
}
