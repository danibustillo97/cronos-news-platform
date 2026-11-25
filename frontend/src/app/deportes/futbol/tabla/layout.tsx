import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tabla de posiciones de la Liga BetPlay y otras ligas',
  description: 'Consulta la tabla de posiciones de la Liga BetPlay, revisa puntos, partidos jugados y clasificación, y explora las tablas de las principales ligas de fútbol.',
  alternates: { canonical: '/deportes/futbol/tabla' },
}

export default function TablaLayout({ children }: { children: React.ReactNode }) {
  return children
}
