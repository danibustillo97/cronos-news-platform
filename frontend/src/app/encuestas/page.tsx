import type { Metadata } from 'next'
import PollsClient from './PollsClient'

export const metadata: Metadata = {
  title: 'Encuestas de fútbol colombiano y debates de la Liga BetPlay',
  description: 'Vota en las encuestas de fútbol de NEXUS News y participa en debates sobre Liga BetPlay, clubes colombianos, Selección y fútbol internacional.',
  alternates: { canonical: '/encuestas' },
}

export default function PollsPage() {
  return <PollsClient />
}
