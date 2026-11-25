import type { Metadata } from 'next'
import { OTHER_SPORTS } from '@/lib/sportsLeagues'

type Props = {
  children: React.ReactNode
  params: Promise<{ sport: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { sport } = await params
  const selected = OTHER_SPORTS.find((item) => item.id === sport)
  const label = selected?.label ?? 'Deporte'

  return {
    title: `${label} en NEXUS News`,
    description: `Información de ${label.toLowerCase()} en NEXUS News. Esta sección se habilitará cuando exista una fuente de resultados y estadísticas verificable.`,
    alternates: { canonical: `/deportes/${encodeURIComponent(sport)}` },
    // No indexar páginas provisionales que todavía no ofrecen datos editoriales o deportivos propios.
    robots: { index: false, follow: true },
  }
}

export default function SportLayout({ children }: Props) {
  return children
}
