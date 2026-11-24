import type { Metadata } from 'next'
import LegendsClient from './LegendsClient'

export const metadata: Metadata = {
  title: 'Leyendas del fútbol',
  description: 'Las figuras que hicieron historia en el fútbol colombiano y mundial.',
}

export default function LegendsPage() {
  return <LegendsClient />
}
