'use client'

// Columna lateral del Escenario (solo ≥ 1280 px; nunca más alta que el escenario): el pulso del
// partido -- en vivo, el próximo y el último resultado. Datos reales del
// scoreboard; sin partidos, un estado vacío diseñado.

import Link from 'next/link'
import { CalendarClock } from 'lucide-react'
import type { Match } from '@/types/sports'
import { featuredMatches } from '@/lib/feedComposer'
import { usePortalTheme } from '@/context/ThemeContext'
import { MatchCard } from './MatchCard'
import { Kicker } from './PortalBits'
import { useNow } from './useNow'

export default function StageMatchSpine({ matches, className = '' }: { matches: Match[]; className?: string }) {
  const now = useNow(60_000)
  const { theme } = usePortalTheme()
  const picked = featuredMatches(matches, now, 3)
  return (
    <aside aria-label="Pulso del partido" className={`min-h-0 flex-col gap-2 overflow-hidden ${className}`}>
      <div className="flex items-center justify-between px-1">
        <Kicker>Pulso del partido</Kicker>
        <Link href="/deportes/futbol" className="inline-flex min-h-[44px] items-center text-xs font-bold text-[var(--nx-muted)] hover:text-[var(--nx-ink)]">Ver todo</Link>
      </div>
      {picked.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-[var(--nx-line-strong)] p-6 text-center">
          <CalendarClock size={28} className="text-[var(--nx-muted)]" aria-hidden="true" />
          <p className="text-sm font-bold text-[var(--nx-ink)]">Sin partidos en este momento</p>
          <p className="text-xs text-[var(--nx-muted)]">Cuando ruede el balón, el marcador aparece aquí solo.</p>
        </div>
      ) : (
        <div className="nx-thin-scroll flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto">
          {picked.map((m) => <MatchCard key={m.id} match={m} dark={theme === 'dark'} className="!h-auto shrink-0" />)}
        </div>
      )}
    </aside>
  )
}
