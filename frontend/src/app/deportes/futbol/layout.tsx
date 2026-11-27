import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Fútbol colombiano e internacional',
  description: 'Sigue la Liga BetPlay y las principales ligas del mundo: partidos, resultados, tablas de posiciones y noticias de fútbol en NEXUS News.',
  alternates: { canonical: '/deportes/futbol' },
}

export default function FutbolLayout({ children }: { children: React.ReactNode }) {
  return children
}
