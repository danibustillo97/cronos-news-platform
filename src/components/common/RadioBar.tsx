'use client'

import { PlayIcon, PauseIcon } from 'lucide-react'
import { useState } from 'react'

const RadioBar = () => {
  const [playing, setPlaying] = useState(false)

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-neutral-900 border-t border-neutral-700 px-4 py-2 flex items-center justify-between z-50">
      <div className="flex items-center gap-4">
        <button
          onClick={() => setPlaying(!playing)}
          className="p-2 bg-yellow-400 text-black rounded-full"
        >
          {playing ? <PauseIcon className="w-5 h-5" /> : <PlayIcon className="w-5 h-5" />}
        </button>
        <div>
          <p className="text-white font-semibold">Radio Deportiva</p>
          <p className="text-neutral-400 text-xs">Transmisión en vivo</p>
        </div>
      </div>

      <button className="text-sm text-yellow-400 underline">Índice</button>
    </div>
  )
}

export default RadioBar
