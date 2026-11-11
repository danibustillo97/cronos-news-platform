'use client'

// Barra persistente y discreta -- aparece SOLO cuando hay un track real
// sonando (nunca por defecto, nunca tapa la página). Permite seguir
// navegando mientras el audio sigue. El <audio> real vive en
// MediaPlayerContext; acá solo la UI y el progreso.

import { useEffect, useState } from 'react'
import { Pause, Play, X } from 'lucide-react'
import { useMediaPlayer } from '@/context/MediaPlayerContext'

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function MediaPlayerBar() {
  const { track, isPlaying, toggle, close, audioRef } = useMediaPlayer()
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)

  useEffect(() => {
    const el = audioRef.current
    if (!el) return
    const onTime = () => setProgress(el.currentTime)
    const onMeta = () => setDuration(el.duration)
    el.addEventListener('timeupdate', onTime)
    el.addEventListener('loadedmetadata', onMeta)
    return () => {
      el.removeEventListener('timeupdate', onTime)
      el.removeEventListener('loadedmetadata', onMeta)
    }
  }, [audioRef, track?.id])

  if (!track) return null
  const pct = duration > 0 ? (progress / duration) * 100 : 0

  return (
    <div className="fixed bottom-0 inset-x-0 z-40 bg-[#0B0B0B] border-t border-white/10">
      <div className="h-0.5 bg-white/10">
        <div className="h-full bg-[#E30613] transition-[width]" style={{ width: `${pct}%` }} />
      </div>
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-3">
        <button
          onClick={toggle}
          aria-label={isPlaying ? 'Pausar' : 'Reproducir'}
          className="flex-shrink-0 w-9 h-9 rounded-full bg-[#E30613] text-white flex items-center justify-center"
        >
          {isPlaying ? <Pause size={14} fill="white" /> : <Play size={14} fill="white" className="ml-0.5" />}
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-white truncate">{track.title}</p>
          <p className="text-[11px] text-neutral-500 truncate">{track.creatorName}</p>
        </div>
        <span className="hidden sm:inline text-[11px] text-neutral-500 tabular-nums flex-shrink-0">
          {formatTime(progress)} / {formatTime(duration)}
        </span>
        <button onClick={close} aria-label="Cerrar reproductor" className="flex-shrink-0 text-neutral-500 hover:text-white transition-colors">
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
