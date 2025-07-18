'use client'

import { PlayIcon, PauseIcon, RadioIcon } from 'lucide-react'
import { useRef, useState, useEffect } from 'react'
import clsx from 'clsx'

const RadioBar = () => {
  const [playing, setPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const streamUrl = 'https://icecast.radiofrance.fr/fip-midfi.mp3'
  const radioStatus = 'live'

  const togglePlay = () => {
    if (!audioRef.current) return

    if (playing) {
      audioRef.current.pause()
    } else {
      audioRef.current.play().catch((e) => console.error('Play failed:', e))
    }

    setPlaying(!playing)
  }

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
      }
    }
  }, [])

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 px-0 py-0 bg-black">
      <div
        className="relative w-full flex items-center justify-between p-4 overflow-hidden"
        style={{
          backgroundColor: '#000',
        }}
      >
        {/* Fondo animado amarillo, sin bordes grises */}
        <div className="absolute inset-0 opacity-20 pointer-events-none z-0">
          <svg viewBox="0 0 1200 120" preserveAspectRatio="none" className="w-full h-full">
            <path d="M0,0 C300,100 900,0 1200,100 L1200,0 L0,0 Z" fill="#FFD700" />
          </svg>
        </div>

        {/* Audio */}
        <audio ref={audioRef} src={streamUrl} preload="none" />

        {/* Controles */}
        <div className="flex items-center gap-4 relative z-10">
          <button
            onClick={togglePlay}
            className="p-3 bg-yellow-400 text-black rounded-full shadow-md hover:scale-105 transition"
          >
            {playing ? <PauseIcon className="w-5 h-5" /> : <PlayIcon className="w-5 h-5" />}
          </button>

          <div>
            <p className="text-white font-semibold text-sm">Radio Noirs Virals</p>
            <div className="flex items-center gap-2">
              <RadioIcon className="w-3 h-3 text-white" />
              <span
                className={clsx(
                  'text-xs font-bold',
                  radioStatus === 'live' ? 'text-green-400' : 'text-orange-400'
                )}
              >
                {radioStatus === 'live' ? 'EN VIVO' : 'AUTO DJ'}
              </span>
            </div>
          </div>
        </div>

        {/* Ecualizador animado */}
        {playing && (
          <div className="absolute right-4 top-1/2 transform -translate-y-1/2 flex gap-[3px] z-10">
            {[0.3, 0.5, 0.4, 0.6, 0.35].map((duration, i) => (
              <div
                key={i}
                className="w-[4px] h-5 bg-yellow-400 rounded-sm animate-eq"
                style={{
                  animationDuration: `${duration}s`,
                  animationDelay: `${i * 0.1}s`,
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Animación CSS para las barras */}
      <style jsx>{`
        @keyframes eqBounce {
          0%,
          100% {
            transform: scaleY(0.4);
          }
          50% {
            transform: scaleY(1);
          }
        }

        .animate-eq {
          animation-name: eqBounce;
          animation-timing-function: ease-in-out;
          animation-iteration-count: infinite;
          transform-origin: bottom;
        }
      `}</style>
    </div>
  )
}

export default RadioBar
