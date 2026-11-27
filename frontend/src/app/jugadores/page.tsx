import type { Metadata } from 'next'
import { Suspense } from 'react'
import Link from 'next/link'
import PortalPage, { pageShell } from '@/components/portal/PortalPage'
import PlayersSearchClient from './PlayersSearchClient'

export const metadata: Metadata = {
  title: 'Estadísticas de futbolistas y comparador de jugadores',
  description: 'Busca jugadores de la Liga BetPlay y del fútbol internacional. Consulta sus perfiles y compara el rendimiento por temporada y competición.',
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
          <p className="mt-3 text-sm leading-relaxed text-[var(--nx-muted)]">
            La ficha de un jugador gana valor cuando se lee junto al torneo en el que compite: por eso NEXUS conecta
            los perfiles con la actualidad de los clubes, las tablas de posiciones y las preguntas que deja cada jornada.
          </p>
          <nav aria-label="Explorar jugadores y competiciones" className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold">
            <Link href="/deportes/futbol/tabla" className="text-[var(--nx-accent-text)] hover:underline">Tabla Liga BetPlay</Link>
            <Link href="/deportes/futbol" className="text-[var(--nx-accent-text)] hover:underline">Noticias de fútbol</Link>
            <Link href="/encuestas" className="text-[var(--nx-accent-text)] hover:underline">Debates de fútbol</Link>
          </nav>
        </header>
      </div>
      <Suspense fallback={null}>
        <PlayersSearchClient />
      </Suspense>
    </PortalPage>
  )
}
