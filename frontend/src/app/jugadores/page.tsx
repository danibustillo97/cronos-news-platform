import type { Metadata } from 'next'
import { Suspense } from 'react'
import PlayersSearchClient from './PlayersSearchClient'

export const metadata: Metadata = {
  title: 'Jugadores',
  description: 'Busca jugadores de fútbol, consulta sus estadísticas por temporada y compáralos cara a cara.',
}

export default function PlayersPage() {
  return (
    <Suspense>
      <PlayersSearchClient />
    </Suspense>
  )
}
