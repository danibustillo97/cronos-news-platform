import type { Metadata } from 'next'
import PollsClient from './PollsClient'

export const metadata: Metadata = {
  title: 'Encuestas y debates',
  description: 'Vota en las encuestas y debates de la comunidad NEXUS.',
}

export default function PollsPage() {
  return <PollsClient />
}
