import type { Metadata } from 'next'
import { Suspense } from 'react'
import PlayersSearchClient from './PlayersSearchClient'

export const metadata: Metadata = {
  title: 'Estadísticas y comparador de jugadores',
  description: 'Busca futbolistas, consulta sus estadísticas por temporada y compara su rendimiento entre competiciones con las herramientas de NEXUS News.',
  alternates: { canonical: '/jugadores' },
}

export default function PlayersPage() {
  return (
    <Suspense>
      <PlayersSearchClient />
    </Suspense>
  )
}
