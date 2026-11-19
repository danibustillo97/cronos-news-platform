'use client'

// Reproductor de video embebido dentro de una publicación -- nunca una
// página o sección aparte. Funcional de verdad (no un mockup): play/pause
// real sobre <video>, poster real, controles nativos una vez iniciado.
// Hoy ningún Post real trae `media.videoUrl` (no existe esa columna en
// `news` todavía) -- este componente solo se monta cuando el dato existe,
// nunca se fuerza con una URL de muestra.

import { useRef, useState } from 'react'
import { Play } from 'lucide-react'

export default function VideoBlock({ videoUrl, posterUrl, title }: { videoUrl: string; posterUrl: string | null; title: string }) {
  const ref = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)

  const start = (e: React.MouseEvent) => {
    e.stopPropagation()
    ref.current?.play()
    setPlaying(true)
  }

  return (
    <div className="relative w-full aspect-video bg-black rounded-sm overflow-hidden" onClick={(e) => e.stopPropagation()}>
      <video
        ref={ref}
        src={videoUrl}
        poster={posterUrl ?? undefined}
        controls={playing}
        onPause={() => setPlaying(false)}
        className="w-full h-full object-contain bg-black"
        aria-label={title}
      />
      {!playing && (
        <button
          onClick={start}
          aria-label={`Reproducir video: ${title}`}
          className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/30 transition-colors"
        >
          <span className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center">
            <Play size={22} className="text-black ml-1" fill="black" />
          </span>
        </button>
      )}
    </div>
  )
}
