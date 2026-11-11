'use client'

// NEXUS Pulse -- "¿qué está pasando ahora?", nada más. Fino, discreto,
// una sola línea por partido. Prioriza en vivo, luego lo más relevante
// (finales recientes y próximos) -- nunca la lista completa que ya vive
// en la sección Deportes (esa responde una pregunta distinta: "¿qué está
// pasando en el mundo del fútbol?", ver SportsSection.tsx). Fetch
// resuelto UNA sola vez en ModernNewsPortal.tsx.

import type { Match } from '@/types/sports'
import MatchRow from '@/components/news/MatchRow'

const MAX_SHOWN = 8

export default function ScoreTicker({ matches }: { matches: Match[] }) {
  const live = matches.filter((m) => m.status === 'live')
  const rest = matches.filter((m) => m.status !== 'live')
  const shown = [...live, ...rest].slice(0, MAX_SHOWN)
  if (shown.length === 0) return null

  return (
    <div className="w-full overflow-x-auto scrollbar-hide bg-[#0B0B0B] border-t border-white/[0.06]" role="region" aria-label="Resultados deportivos en vivo">
      <div className="flex items-center h-8 max-w-7xl mx-auto" role="list">
        <span className={`flex items-center h-full gap-1.5 text-white text-[10px] font-bold uppercase tracking-[0.12em] px-3 flex-shrink-0 ${live.length > 0 ? 'bg-[#E30613]' : 'bg-neutral-800'}`}>
          {live.length > 0 && <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" aria-hidden="true" />}
          Pulse
        </span>
        {shown.map((m) => <MatchRow key={m.id} match={m} variant="ticker" />)}
      </div>
    </div>
  )
}
