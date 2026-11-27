import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Deportes en vivo, resultados y noticias',
  description: 'Sigue los deportes de Colombia y el mundo en NEXUS News: partidos en vivo, próximos encuentros, resultados, tablas y noticias con contexto.',
  alternates: { canonical: '/deportes' },
}

export default function DeportesLayout({ children }: { children: React.ReactNode }) {
  return children
}
