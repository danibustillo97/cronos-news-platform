import type { Metadata } from 'next'
import Link from 'next/link'
import TablaClient from './TablaClient'

const year = new Date().getFullYear()

export const metadata: Metadata = {
  title: 'Tabla de posiciones Liga BetPlay ' + year,
  description: 'Consulta la tabla de posiciones de la Liga BetPlay: clasificación, puntos, partidos disputados y datos de la competición en NEXUS News.',
  alternates: { canonical: '/deportes/futbol/tabla' },
}

export default function TablaPage() {
  const seoIntro = (
    <header className="mt-2 max-w-3xl">
      <p className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-[var(--nx-accent-text)]">NEXUS / Clasificación</p>
      <h1 className="text-3xl font-black tracking-tight">Tabla de posiciones de la Liga BetPlay {year}</h1>
      <p className="mt-3 text-sm leading-relaxed opacity-75">
        Consulta la clasificación del fútbol colombiano y revisa la posición, los puntos y los partidos disputados
        que muestra la competición. La tabla permite seguir el recorrido de cada club a lo largo del torneo y
        entender cómo cambia el panorama después de cada jornada.
      </p>
      <p className="mt-3 text-sm leading-relaxed opacity-75">
        También puedes cambiar de competición para explorar las tablas de otras ligas. Usa esta página como punto
        de referencia y vuelve a las noticias de fútbol para conocer el contexto de los resultados.
      </p>
      <nav aria-label="Más información de fútbol" className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm font-bold">
        <Link href="/deportes/futbol" className="text-[var(--nx-accent-text)] hover:underline">Noticias de fútbol</Link>
        <Link href="/deportes" className="text-[var(--nx-accent-text)] hover:underline">Todos los deportes</Link>
      </nav>
    </header>
  )
  return <TablaClient seoIntro={seoIntro} />
}
