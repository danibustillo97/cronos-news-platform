'use client'

// Radio en vivo del Escenario. Un único <audio> vive en RadioProvider
// (raíz del home), así la señal sigue sonando mientras el usuario hace
// scroll o lee una historia en el modal. Nunca arranca sola: la primera
// reproducción siempre la pide el usuario. Pausar una señal en vivo la
// corta (deja de descargar) y al volver a reproducir se engancha al vivo.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Image from 'next/image'
import { Pause, Play, Radio as RadioIcon, Volume2, VolumeX, X, Loader2 } from 'lucide-react'
import type { AudioSource } from '@/lib/streamSource'
import { attachMediaSource } from '@/lib/hlsLoader'
import { proxiedImage } from '@/lib/media'
import type { NewsView } from '@/types/news'
import { LiveBadge } from './PortalBits'
import StageSideStories from './StageSideStories'

type RadioStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'error'

interface RadioStation { title: string; logo: string | null; source: AudioSource }

interface RadioContextValue {
  station: RadioStation | null
  status: RadioStatus
  volume: number
  muted: boolean
  started: boolean
  stageVisible: boolean
  dismissed: boolean
  toggle: () => void
  stop: () => void
  setVolume: (v: number) => void
  toggleMute: () => void
  setStageVisible: (v: boolean) => void
  dismiss: () => void
}

const RadioContext = createContext<RadioContextValue | null>(null)

export function useRadio(): RadioContextValue | null {
  return useContext(RadioContext)
}

export function RadioProvider({ station, children }: { station: RadioStation | null; children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const detachRef = useRef<(() => void) | null>(null)
  const [status, setStatus] = useState<RadioStatus>('idle')
  const [volume, setVolumeState] = useState(0.9)
  const [muted, setMuted] = useState(false)
  const [started, setStarted] = useState(false)
  const [stageVisible, setStageVisible] = useState(true)
  const [dismissed, setDismissed] = useState(false)
  const url = station?.source.url ?? null

  const detach = useCallback(() => {
    detachRef.current?.()
    detachRef.current = null
  }, [])

  // Cambió la señal (o se apagó el modo radio): cortar y volver a reposo.
  useEffect(() => {
    audioRef.current?.pause()
    detach()
    setStatus('idle')
    setStarted(false)
    setDismissed(false)
  }, [url, detach])

  useEffect(() => () => detach(), [detach])

  const play = useCallback(async () => {
    const audio = audioRef.current
    if (!audio || !url) return
    setStarted(true)
    setDismissed(false)
    setStatus('loading')
    try {
      if (!detachRef.current) detachRef.current = await attachMediaSource(audio, url, () => setStatus('error'))
      audio.volume = volume
      audio.muted = muted
      await audio.play()
    } catch {
      setStatus('error')
    }
  }, [url, volume, muted])

  const stop = useCallback(() => {
    audioRef.current?.pause()
    detach()
    setStatus((s) => (s === 'error' ? s : 'paused'))
  }, [detach])

  const toggle = useCallback(() => {
    if (status === 'playing' || status === 'loading') stop()
    else void play()
  }, [status, play, stop])

  const setVolume = useCallback((v: number) => {
    setVolumeState(v)
    if (audioRef.current) { audioRef.current.volume = v; audioRef.current.muted = v === 0 }
    setMuted(v === 0)
  }, [])

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      const next = !m
      if (audioRef.current) audioRef.current.muted = next
      return next
    })
  }, [])

  const dismiss = useCallback(() => { stop(); setDismissed(true) }, [stop])

  const value = useMemo<RadioContextValue>(() => ({
    station, status, volume, muted, started, stageVisible, dismissed,
    toggle, stop, setVolume, toggleMute, setStageVisible, dismiss,
  }), [station, status, volume, muted, started, stageVisible, dismissed, toggle, stop, setVolume, toggleMute, dismiss])

  return (
    <RadioContext.Provider value={value}>
      {children}
      <audio
        ref={audioRef}
        preload="none"
        onPlaying={() => setStatus('playing')}
        onWaiting={() => setStatus((s) => (s === 'playing' ? 'loading' : s))}
        onPause={() => setStatus((s) => (s === 'error' ? s : 'paused'))}
        onError={() => { if (detachRef.current) setStatus('error') }}
      />
    </RadioContext.Provider>
  )
}

function statusLine(status: RadioStatus, started: boolean): string {
  if (status === 'loading') return 'Conectando con la señal…'
  if (status === 'playing') return 'Sonando en vivo'
  if (status === 'error') return 'La señal no responde. Intenta de nuevo en un momento.'
  if (started) return 'En pausa'
  return 'Toca para escuchar en vivo'
}

function StationArt({ station, size, playing }: { station: RadioStation; size: number; playing: boolean }) {
  const [failed, setFailed] = useState(false)
  const logo = failed ? null : proxiedImage(station.logo)
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-[#FACC15] to-[#b45309] text-black" style={{ width: size, height: size }}>
      {logo ? (
        <Image src={logo} alt="" fill sizes={`${size * 2}px`} className="object-cover" onError={() => setFailed(true)} />
      ) : (
        <RadioIcon size={Math.round(size * 0.42)} aria-hidden="true" />
      )}
      {playing && <span aria-hidden className="absolute inset-0 rounded-2xl ring-2 ring-inset ring-white/40" />}
    </span>
  )
}

function PlayButton({ radio, size = 'lg' }: { radio: RadioContextValue; size?: 'lg' | 'sm' }) {
  const busy = radio.status === 'loading'
  const active = radio.status === 'playing' || busy
  const dims = size === 'lg' ? 'h-16 w-16' : 'h-11 w-11'
  const icon = size === 'lg' ? 26 : 18
  return (
    <button
      type="button"
      onClick={radio.toggle}
      aria-label={active ? `Pausar ${radio.station?.title ?? 'radio'}` : `Escuchar ${radio.station?.title ?? 'radio'} en vivo`}
      className={`${dims} inline-flex shrink-0 items-center justify-center rounded-full bg-[#FACC15] text-black shadow-[0_10px_30px_-10px_rgba(250,204,21,0.7)] transition-transform hover:scale-105 active:scale-95`}
    >
      {busy ? <Loader2 size={icon} className="animate-spin" aria-hidden="true" />
        : active ? <Pause size={icon} fill="currentColor" aria-hidden="true" />
        : <Play size={icon} fill="currentColor" className="ml-1" aria-hidden="true" />}
    </button>
  )
}

function VolumeControl({ radio, className = '' }: { radio: RadioContextValue; className?: string }) {
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <button type="button" onClick={radio.toggleMute} aria-label={radio.muted ? 'Activar sonido' : 'Silenciar'} className="inline-flex h-11 w-11 items-center justify-center rounded-full text-current hover:bg-white/10">
        {radio.muted || radio.volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
      </button>
      <label className="flex items-center">
        <span className="sr-only">Volumen de la radio</span>
        <input
          type="range" min={0} max={1} step={0.05}
          value={radio.muted ? 0 : radio.volume}
          onChange={(e) => radio.setVolume(Number(e.target.value))}
          className="nx-range w-24 sm:w-28"
        />
      </label>
    </div>
  )
}

function Equalizer({ playing, className = '' }: { playing: boolean; className?: string }) {
  return (
    <span className={`nx-eq ${className}`} data-playing={playing} aria-hidden="true">
      <span /><span /><span /><span /><span />
    </span>
  )
}

export function StageRadio({ stories, onOpen }: { stories: NewsView[]; onOpen: (s: NewsView) => void }) {
  const radio = useRadio()
  const cardRef = useRef<HTMLElement>(null)
  const setStageVisible = radio?.setStageVisible

  useEffect(() => {
    const el = cardRef.current
    if (!el || !setStageVisible) return
    const io = new IntersectionObserver(([entry]) => setStageVisible(entry.isIntersecting), { threshold: 0.15 })
    io.observe(el)
    return () => { io.disconnect(); setStageVisible(false) }
  }, [setStageVisible])

  if (!radio?.station) return null
  const { station, status, started } = radio
  const playing = status === 'playing'

  return (
    <div className={`grid gap-4 ${stories.length > 0 ? 'lg:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-cols-[minmax(0,1fr)_380px]' : ''}`}>
      <section
        ref={cardRef}
        aria-labelledby="stage-radio-title"
        className="nx-grain relative isolate overflow-hidden rounded-2xl bg-[#0A0A0A] text-white shadow-[var(--nx-shadow)] ring-1 ring-[var(--nx-line)]"
      >
        <div aria-hidden className="absolute -left-32 -top-32 -z-10 h-96 w-96 rounded-full bg-[#FACC15]/20 blur-3xl" />
        <div aria-hidden className="absolute -bottom-40 right-0 -z-10 h-96 w-96 rounded-full bg-[#DC2626]/20 blur-3xl" />
        <div className="flex min-h-[300px] flex-col justify-between gap-6 p-5 sm:p-8 lg:min-h-[400px] lg:max-h-[520px]">
          <div className="flex items-center justify-between gap-3">
            <LiveBadge size="lg" label="Radio en vivo" />
            <Equalizer playing={playing} className="h-8 text-[#FACC15]" />
          </div>
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end">
            <StationArt station={station} size={96} playing={playing} />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#FACC15]">NEXUS Radio</p>
              <h2 id="stage-radio-title" className="mt-1 text-balance text-[clamp(1.375rem,1.05rem+1.6vw,2.5rem)] font-extrabold leading-[1.12] tracking-[-0.01em] line-clamp-3">{station.title}</h2>
              <p className="mt-2 text-sm text-white/70" aria-live="polite">{statusLine(status, started)}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <PlayButton radio={radio} />
            <VolumeControl radio={radio} className="text-white" />
            <p className="w-full text-xs text-white/50 sm:ml-auto sm:w-auto">Sigue sonando mientras navegas el portal.</p>
          </div>
        </div>
      </section>
      <StageSideStories stories={stories} onOpen={onOpen} />
    </div>
  )
}

/** Mini reproductor persistente: aparece cuando el escenario sale de pantalla. */
export function RadioMiniPlayer() {
  const radio = useRadio()
  if (!radio?.station || radio.dismissed || radio.stageVisible) return null
  const { station, status } = radio
  const playing = status === 'playing'
  return (
    <div
      role="region"
      aria-label="Reproductor de radio en vivo"
      className="fixed inset-x-0 bottom-0 z-[65] px-0 sm:inset-x-auto sm:bottom-4 sm:left-4 sm:w-[400px]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-center gap-3 border-t border-white/10 bg-[#0A0A0A]/95 px-3 py-2 text-white shadow-2xl backdrop-blur-md sm:rounded-2xl sm:border">
        <StationArt station={station} size={44} playing={playing} />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-[#F87171]">
            <span className="nx-live-dot" style={{ width: 6, height: 6 }} aria-hidden="true" /> En vivo
            <Equalizer playing={playing} className="h-3 text-[#FACC15]" />
          </p>
          <p className="truncate text-sm font-bold">{station.title}</p>
        </div>
        <VolumeControl radio={radio} className="text-white max-md:hidden" />
        <PlayButton radio={radio} size="sm" />
        <button type="button" onClick={radio.dismiss} aria-label="Cerrar reproductor" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white/60 hover:bg-white/10 hover:text-white">
          <X size={18} />
        </button>
      </div>
    </div>
  )
}

export type { RadioStation }
