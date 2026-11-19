'use client'

// Estado global de reproducción persistente -- preparado para audio real
// (podcast, nota de voz, radio en vivo) que hoy no existe todavía en
// NEXUS (ver lib/platform.ts: ningún Post real trae media.audioUrl). El
// <audio> real vive ACÁ, en el Provider -- no en cada AudioBlock -- para
// que sobreviva cuando el usuario navega lejos de la publicación que lo
// empezó. Sin infraestructura de streaming real conectada todavía
// (deliberado, según el brief): esto es el componente y el estado, listo
// para que un futuro NGINX/HLS/media service solo tenga que llenar
// `audioUrl` con una URL real.

import { createContext, useContext, useEffect, useRef, useState } from 'react'

export interface PlayerTrack {
  id: string
  title: string
  creatorName: string
  audioUrl: string
}

interface MediaPlayerContextValue {
  track: PlayerTrack | null
  isPlaying: boolean
  play: (track: PlayerTrack) => void
  toggle: () => void
  close: () => void
  audioRef: React.RefObject<HTMLAudioElement | null>
}

const MediaPlayerContext = createContext<MediaPlayerContextValue | null>(null)

export function MediaPlayerProvider({ children }: { children: React.ReactNode }) {
  const [track, setTrack] = useState<PlayerTrack | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    if (!track) return
    audioRef.current?.play()
    setIsPlaying(true)
  }, [track])

  const play = (next: PlayerTrack) => {
    if (track?.id === next.id) {
      toggle()
      return
    }
    setTrack(next)
  }

  const toggle = () => {
    if (!audioRef.current) return
    if (isPlaying) { audioRef.current.pause(); setIsPlaying(false) } else { audioRef.current.play(); setIsPlaying(true) }
  }

  const close = () => {
    audioRef.current?.pause()
    setTrack(null)
    setIsPlaying(false)
  }

  return (
    <MediaPlayerContext.Provider value={{ track, isPlaying, play, toggle, close, audioRef }}>
      {children}
      <audio ref={audioRef} src={track?.audioUrl} onEnded={close} onPause={() => setIsPlaying(false)} onPlay={() => setIsPlaying(true)} />
    </MediaPlayerContext.Provider>
  )
}

export function useMediaPlayer() {
  const ctx = useContext(MediaPlayerContext)
  if (!ctx) throw new Error('useMediaPlayer debe usarse dentro de MediaPlayerProvider')
  return ctx
}
