'use client'

// Reproductor de la transmisión en vivo del Escenario.
// - YouTube / Twitch / Facebook / Kick: iframe oficial del proveedor (sus propios
//   controles), arranca silenciado para respetar las políticas de autoplay.
// - HLS (.m3u8) y archivos directos: <video> propio con controles grandes
//   (≥44 px): reproducir/pausar, sonido, volumen, ir al vivo y pantalla
//   completa. HLS nativo en Safari, hls.js bajo demanda en el resto.

import { useCallback, useEffect, useRef, useState } from 'react'
import { Maximize, Pause, Play, RotateCcw, Volume2, VolumeX, Radio } from 'lucide-react'
import { twitchEmbedUrl, type VideoSource } from '@/lib/streamSource'
import { attachMediaSource } from '@/lib/hlsLoader'

function ProviderFrame({ src, title }: { src: string; title: string }) {
  return (
    <iframe
      src={src}
      title={title}
      className="absolute inset-0 h-full w-full border-0"
      allow="autoplay; encrypted-media; picture-in-picture; fullscreen; clipboard-write"
      allowFullScreen
      referrerPolicy="strict-origin-when-cross-origin"
    />
  )
}

function TwitchFrame({ source, title }: { source: Extract<VideoSource, { kind: 'twitch' }>; title: string }) {
  const [hostName, setHostName] = useState<string | null>(null)
  useEffect(() => { setHostName(window.location.hostname) }, [])
  if (!hostName) return null
  return <ProviderFrame src={twitchEmbedUrl(source, hostName)} title={title} />
}

const ctrlBtn = 'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white transition-colors hover:bg-white/15'

function NativeVideo({ url, title, poster, live }: { url: string; title: string; poster: string | null; live: boolean }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(true)
  const [volume, setVolume] = useState(0.8)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [waiting, setWaiting] = useState(true)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    let cleanup: (() => void) | null = null
    let cancelled = false
    setError(null)
    setWaiting(true)
    attachMediaSource(video, url, (message) => setError(message))
      .then((fn) => {
        if (cancelled) { fn(); return }
        cleanup = fn
        video.muted = true
        video.play().catch(() => setPlaying(false))
      })
      .catch(() => setError('No se pudo cargar el reproductor.'))
    return () => { cancelled = true; cleanup?.() }
  }, [url, attempt])

  const toggle = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    if (v.paused) v.play().catch(() => setError('El navegador bloqueó la reproducción. Toca de nuevo.'))
    else v.pause()
  }, [])

  const toggleMute = () => {
    const v = videoRef.current
    if (!v) return
    v.muted = !v.muted
    if (!v.muted && v.volume === 0) v.volume = 0.8
    setMuted(v.muted)
  }

  const goLive = () => {
    const v = videoRef.current
    if (!v || v.seekable.length === 0) return
    v.currentTime = Math.max(0, v.seekable.end(v.seekable.length - 1) - 2)
    v.play().catch(() => {})
  }

  const fullscreen = () => {
    const el = wrapRef.current as (HTMLDivElement & { webkitRequestFullscreen?: () => void }) | null
    const v = videoRef.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null
    if (document.fullscreenElement) { document.exitFullscreen().catch(() => {}); return }
    if (el?.requestFullscreen) el.requestFullscreen().catch(() => v?.webkitEnterFullscreen?.())
    else if (v?.webkitEnterFullscreen) v.webkitEnterFullscreen()
  }

  return (
    <div ref={wrapRef} className="group absolute inset-0 bg-black">
      <video
        ref={videoRef}
        className="h-full w-full object-contain"
        playsInline
        muted
        poster={poster ?? undefined}
        aria-label={title}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onWaiting={() => setWaiting(true)}
        onPlaying={() => { setWaiting(false); setError(null) }}
        onVolumeChange={(e) => { setMuted(e.currentTarget.muted); setVolume(e.currentTarget.volume) }}
        onError={() => setError('La señal no está disponible en este momento.')}
        onClick={toggle}
      />

      {waiting && !error && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden="true">
          <span className="h-12 w-12 animate-spin rounded-full border-2 border-white/20 border-t-[#FACC15]" />
        </div>
      )}

      {error && (
        <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 p-6 text-center">
          <p className="max-w-sm text-sm font-bold text-white">{error}</p>
          <button type="button" onClick={() => setAttempt((n) => n + 1)} className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-[#FACC15] px-5 text-sm font-black text-black">
            <RotateCcw size={16} aria-hidden="true" /> Reintentar
          </button>
        </div>
      )}

      {muted && playing && !error && (
        <button type="button" onClick={toggleMute} className="absolute left-1/2 top-4 inline-flex min-h-[44px] -translate-x-1/2 items-center gap-2 rounded-full bg-white px-5 text-sm font-black text-black shadow-lg">
          <VolumeX size={16} aria-hidden="true" /> Activar sonido
        </button>
      )}

      <div className="absolute inset-x-0 bottom-0 flex items-center gap-1 bg-gradient-to-t from-black/90 to-transparent px-2 pb-2 pt-10 sm:gap-2 sm:px-3">
        <button type="button" onClick={toggle} className={ctrlBtn} aria-label={playing ? 'Pausar' : 'Reproducir'}>
          {playing ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-0.5" />}
        </button>
        <button type="button" onClick={toggleMute} className={ctrlBtn} aria-label={muted ? 'Activar sonido' : 'Silenciar'}>
          {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
        </button>
        <label className="hidden items-center sm:flex">
          <span className="sr-only">Volumen</span>
          <input
            type="range" min={0} max={1} step={0.05}
            value={muted ? 0 : volume}
            onChange={(e) => {
              const v = videoRef.current
              if (!v) return
              v.volume = Number(e.target.value)
              v.muted = v.volume === 0
            }}
            className="nx-range w-24"
          />
        </label>
        <span className="flex-1" />
        {live && (
          <button type="button" onClick={goLive} className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-3 text-xs font-black uppercase tracking-[0.12em] text-white hover:bg-white/15">
            <Radio size={14} className="text-[var(--nx-live)]" aria-hidden="true" /> Ir al vivo
          </button>
        )}
        <button type="button" onClick={fullscreen} className={ctrlBtn} aria-label="Pantalla completa">
          <Maximize size={18} />
        </button>
      </div>
    </div>
  )
}

export default function VideoPlayer({ source, title, poster }: { source: VideoSource; title: string; poster: string | null }) {
  return (
    <div className="relative aspect-video max-h-[min(520px,62vh)] w-full overflow-hidden bg-black">
      {source.kind === 'youtube' || source.kind === 'facebook' || source.kind === 'kick' ? <ProviderFrame src={source.embedUrl} title={title} />
        : source.kind === 'twitch' ? <TwitchFrame source={source} title={title} />
        : <NativeVideo url={source.url} title={title} poster={poster} live={source.kind === 'hls'} />}
    </div>
  )
}
