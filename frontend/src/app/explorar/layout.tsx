import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Explorar categorías, deportes y competiciones',
  description: 'Explora las categorías editoriales, ligas y competiciones de NEXUS News. Encuentra noticias, partidos y contenido de fútbol colombiano e internacional.',
  alternates: { canonical: '/explorar' },
}

export default function ExplorarLayout({ children }: { children: React.ReactNode }) {
  return children
}
