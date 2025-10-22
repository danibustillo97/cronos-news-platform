'use client'

import { PlayIcon, PauseIcon, RadioIcon, Volume2, VolumeX } from 'lucide-react'
import { useRef, useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import clsx from 'clsx'

const RadioBar = () => {
  const [playing, setPlaying] = useState(false)
  const [volume, setVolume] = useState(0.8)
  const [muted, setMuted] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const streamUrl = 'https://streaming.intermediacolombia.com:8073/stream'
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

  const toggleMute = () => {
    if (!audioRef.current) return
    
    if (muted) {
      audioRef.current.volume = volume
      setMuted(false)
    } else {
      audioRef.current.volume = 0
      setMuted(true)
    }
  }

  const handleVolumeChange = (newVolume: number) => {
    if (!audioRef.current) return
    
    setVolume(newVolume)
    if (!muted) {
      audioRef.current.volume = newVolume
    }
  }

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = muted ? 0 : volume
    }
  }, [volume, muted])

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
      }
    }
  }, [])

  return (
    <motion.div
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
      className="fixed bottom-0 left-0 right-0 z-50 glass border-t border-yellow-500/20"
    >
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Left Section - Radio Info */}
          <div className="flex items-center space-x-4">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={togglePlay}
              className="w-12 h-12 gradient-primary rounded-xl flex items-center justify-center shadow-glow"
            >
              {playing ? <PauseIcon className="w-6 h-6 text-black" /> : <PlayIcon className="w-6 h-6 text-black" />}
            </motion.button>

            <div>
              <h3 className="text-lg font-bold text-white">SportPulse Radio</h3>
              <div className="flex items-center space-x-2">
                <RadioIcon className="w-4 h-4 text-yellow-400" />
                <motion.span
                  animate={{ opacity: [1, 0.5, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                  className={clsx(
                    'text-sm font-bold',
                    radioStatus === 'live' ? 'text-green-400' : 'text-orange-400'
                  )}
                >
                  {radioStatus === 'live' ? 'EN VIVO' : 'AUTO DJ'}
                </motion.span>
              </div>
            </div>
          </div>

          {/* Center Section - Visualizer */}
          <AnimatePresence>
            {playing && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="flex items-center space-x-1"
              >
                {[0.3, 0.5, 0.4, 0.6, 0.35, 0.4, 0.3, 0.5].map((duration, i) => (
                  <motion.div
                    key={i}
                    animate={{ scaleY: [0.4, 1, 0.4] }}
                    transition={{
                      duration: duration,
                      repeat: Infinity,
                      delay: i * 0.1,
                    }}
                    className="w-1 h-6 gradient-primary rounded-full"
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Right Section - Controls */}
          <div className="flex items-center space-x-4">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={toggleMute}
              className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors"
            >
              {muted ? <VolumeX className="w-5 h-5 text-gray-400" /> : <Volume2 className="w-5 h-5 text-gray-400" />}
            </motion.button>

            <div className="flex items-center space-x-2">
              <VolumeX className="w-4 h-4 text-gray-400" />
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={muted ? 0 : volume}
                onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                className="w-20 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
              />
              <Volume2 className="w-4 h-4 text-gray-400" />
            </div>

            <div className="text-xs text-gray-400 font-medium">
              {Math.round((muted ? 0 : volume) * 100)}%
            </div>
          </div>
        </div>
      </div>

      {/* Audio */}
      <audio ref={audioRef} src={streamUrl} preload="none" />

      {/* Custom Slider Styles */}
      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #fbbf24;
          cursor: pointer;
          box-shadow: 0 0 0 2px #1f2937;
        }

        .slider::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #fbbf24;
          cursor: pointer;
          border: none;
          box-shadow: 0 0 0 2px #1f2937;
        }
      `}</style>
    </motion.div>
  )
}

export default RadioBar
