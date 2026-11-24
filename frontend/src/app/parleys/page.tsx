import type { Metadata } from 'next'
import ParleysClient from './ParleysClient'

export const metadata: Metadata = {
  title: 'Parley del día',
  description: 'Combinadas del día construidas con cuotas reales de mercado y la racha reciente de cada equipo. Contenido informativo para mayores de 18 años.',
  robots: { index: true, follow: true },
}

export default function ParleysPage() {
  return <ParleysClient />
}
