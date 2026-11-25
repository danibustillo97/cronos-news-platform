import type { Metadata } from 'next'
import PollsClient from './PollsClient'

export const metadata: Metadata = {
  title: 'Encuestas y debates de fútbol',
  description: 'Participa en las encuestas y debates de NEXUS News. Vota, compara opiniones y comparte tu punto de vista sobre el fútbol colombiano e internacional.',
  alternates: { canonical: '/encuestas' },
}

export default function PollsPage() {
  return <PollsClient />
}
