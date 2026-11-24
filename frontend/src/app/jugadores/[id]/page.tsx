import type { Metadata } from 'next'
import PlayerProfileClient from './PlayerProfileClient'

export const metadata: Metadata = { title: 'Perfil de jugador' }

export default async function PlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <PlayerProfileClient id={decodeURIComponent(id)} />
}
