import type { Metadata } from 'next'
import Link from 'next/link'
import FutbolClient from './FutbolClient'

export const metadata: Metadata = {
  title: 'Fútbol colombiano e internacional: noticias y resultados',
  description: 'Noticias de fútbol colombiano, Liga BetPlay, Selección Colombia y ligas internacionales. Consulta partidos, resultados y tablas en NEXUS News.',
  alternates: { canonical: '/deportes/futbol' },
}

export default function FutbolPage() {
  const seoIntro = (
    <header className="mt-2 mb-6 max-w-4xl">
      <p className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-[var(--nx-accent-text)]">NEXUS / Fútbol</p>
      <h1 className="text-3xl font-black tracking-tight">Fútbol colombiano e internacional</h1>
      <p className="mt-3 text-sm leading-relaxed opacity-75">
        La Liga BetPlay, los clubes del país y la Selección Colombia tienen un lugar central en nuestra cobertura.
        También seguimos las principales ligas y copas internacionales para conectar lo que pasa en Colombia
        con las historias del fútbol mundial.
      </p>
      <p className="mt-3 text-sm leading-relaxed opacity-75">
        Aquí puedes seguir la actualidad, consultar partidos y resultados, revisar las tablas de posiciones
        y encontrar contexto sobre equipos y futbolistas. La idea no es repetir el marcador: es explicar qué
        significa para la competición y qué preguntas deja para la siguiente jornada.
      </p>
      <nav aria-label="Herramientas de fútbol" className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm font-bold">
        <Link href="/deportes/futbol/tabla" className="text-[var(--nx-accent-text)] hover:underline">Tabla de posiciones Liga BetPlay</Link>
        <Link href="/jugadores" className="text-[var(--nx-accent-text)] hover:underline">Estadísticas de jugadores</Link>
        <Link href="/encuestas" className="text-[var(--nx-accent-text)] hover:underline">Debates de fútbol</Link>
      </nav>
    </header>
  )
  return <FutbolClient seoIntro={seoIntro} />
}
