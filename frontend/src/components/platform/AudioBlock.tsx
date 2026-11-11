'use client'

// Disparador de audio embebido dentro de una publicación -- estilo
// editorial propio, no el control nativo del navegador. El <audio> real
// NO vive acá (ver MediaPlayerContext.tsx): togglear play acá arranca
// (o pausa) el reproductor PERSISTENTE, así el audio sigue sonando
// aunque el usuario navegue lejos de esta publicación. Solo se monta
// cuando el Post trae `media.audioUrl` real -- hoy ningún artículo
// publicado lo tiene.

import { Pause, Play } from 'lucide-react'
import { useMediaPlayer } from '@/context/MediaPlayerContext'

export default function AudioBlock({
  trackId, audioUrl, title, creatorName, isDark,
}: {
  trackId: string
  audioUrl: string
  title: string
  creatorName: string
  isDark: boolean
}) {
  const { track, isPlaying, play } = useMediaPlayer()
  const isActive = track?.id === trackId
  const showPause = isActive && isPlaying

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className={`flex items-center gap-3 p-3 rounded-sm border ${isDark ? 'border-white/10 bg-white/[0.02]' : 'border-[#E5E5E5] bg-[#FAFAFA]'}`}
    >
      <button
        onClick={() => play({ id: trackId, title, creatorName, audioUrl })}
        aria-label={showPause ? 'Pausar' : 'Reproducir'}
        className="flex-shrink-0 w-9 h-9 rounded-full bg-[#E30613] text-white flex items-center justify-center"
      >
        {showPause ? <Pause size={15} fill="white" /> : <Play size={15} fill="white" className="ml-0.5" />}
      </button>
      <div className="min-w-0 flex-1">
        <p className={`text-xs font-bold truncate ${isDark ? 'text-white' : 'text-[#161616]'}`}>{title}</p>
        <p className={`text-[11px] truncate ${isDark ? 'text-neutral-500' : 'text-[#999]'}`}>
          {isActive ? (showPause ? 'Reproduciendo' : 'En pausa') : 'Audio'}
        </p>
      </div>
    </div>
  )
}
