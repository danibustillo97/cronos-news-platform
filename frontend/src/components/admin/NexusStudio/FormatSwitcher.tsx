'use client'

// Sección 10/12: cambiar de formato nunca deforma ni pierde contenido --
// las posiciones de TemplateElement son fracciones del canvas (0..1) y el
// crop de imagen usa el focal point real ya guardado en cada clip
// (Preview.tsx's drawImageCoverFocal), así que cambiar `format` sencillamente
// hace que el mismo contenido se recomponga solo, sin mutar ningún clip.

import type { CompositionFormat } from '@/types/studio'

const FORMATS: { id: CompositionFormat; label: string; ratio: string }[] = [
  { id: 'REEL_9X16', label: 'Reel', ratio: '9:16' },
  { id: 'FEED_4X5', label: 'Feed', ratio: '4:5' },
  { id: 'SQUARE_1X1', label: 'Cuadrado', ratio: '1:1' },
  { id: 'LANDSCAPE_16X9', label: 'Horizontal', ratio: '16:9' },
]

export default function FormatSwitcher({
  format, onChange, locked = false,
}: {
  format: CompositionFormat
  onChange: (format: CompositionFormat) => void
  locked?: boolean
}) {
  return (
    <div className="flex items-center gap-1">
      {FORMATS.map((f) => (
        <button
          key={f.id}
          onClick={() => onChange(f.id)}
          disabled={locked && f.id !== 'FEED_4X5'}
          title={locked && f.id !== 'FEED_4X5' ? 'Premium Editorial mantiene la proporción 4:5' : undefined}
          className={`px-2.5 py-1 rounded-sm text-[11px] font-bold transition-colors ${
            f.id === format ? 'bg-red-600 text-white' : 'bg-white/5 text-white/50 hover:text-white'
          } ${locked && f.id !== 'FEED_4X5' ? 'opacity-30 cursor-not-allowed' : ''}`}
        >
          {f.label} <span className="opacity-60">{f.ratio}</span>
        </button>
      ))}
    </div>
  )
}
