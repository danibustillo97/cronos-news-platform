import type { Metadata } from 'next'
import { Suspense } from 'react'
import PortalPage, { pageShell } from '@/components/portal/PortalPage'
import PlayersSearchClient from './PlayersSearchClient'

export const metadata: Metadata = {
  title: 'Estadísticas y comparador de jugadores',
  description: 'Busca futbolistas, consulta sus estadísticas por temporada y compara su rendimiento entre competiciones con las herramientas de NEXUS News.',
  alternates: { canonical: '/jugadores' },
}

export default function PlayersPage() {
  return (
    <PortalPage>
      <div className={`${pageShell} max-w-[1200px] pt-8 sm:pt-12`}>
        <header className="max-w-2xl">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--nx-accent-text)]">Base de jugadores</p>
          <h1 className="mt-2 text-[clamp(1.75rem,1.4rem+1.5vw,2.5rem)] font-bold leading-[1.1] tracking-[-0.015em] text-[var(--nx-ink)]">Estadísticas y comparador de jugadores</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-[var(--nx-ink-2)]">
            Busca futbolistas, revisa sus números por temporada y compáralos por rendimiento y competición. Encuentra perfiles de la Liga BetPlay y del fútbol internacional.
          </p>
        </header>
      </div>
      <Suspense fallback={null}>
        <PlayersSearchClient />
      </Suspense>
    </PortalPage>
  )
}
