import type { Metadata } from 'next'
import Link from 'next/link'
import DeportesClient from './DeportesClient'

export const metadata: Metadata = {
  title: 'Deportes en Colombia: fútbol, partidos y resultados',
  description: 'Sigue la actualidad deportiva de Colombia y el mundo: fútbol, partidos, resultados, tablas de posiciones y noticias con contexto en NEXUS News.',
  alternates: { canonical: '/deportes' },
}

export default function DeportesPage() {
  const seoIntro = (
    <header className="mb-5 max-w-4xl">
      <p className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-[var(--nx-accent-text)]">NEXUS / Deportes</p>
      <h1 className="text-3xl font-black tracking-tight">Deportes en Colombia y el mundo</h1>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed opacity-75">
        Sigue noticias deportivas, partidos, resultados y tablas de posiciones. NEXUS News tiene foco en el fútbol
        colombiano y conecta la actualidad de la Liga BetPlay con las competiciones internacionales, los datos
        de cada jornada y la opinión de los hinchas.
      </p>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed opacity-75">
        Esta sección reúne las rutas principales para seguir el calendario, consultar marcadores y encontrar
        noticias. Puedes pasar de la actualidad a la clasificación o profundizar en el rendimiento de los jugadores
        sin perder el hilo de la competición.
      </p>
      <nav aria-label="Secciones deportivas" className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm font-bold">
        <Link href="/deportes/futbol" className="text-[var(--nx-accent-text)] hover:underline">Fútbol</Link>
        <Link href="/deportes/futbol/tabla" className="text-[var(--nx-accent-text)] hover:underline">Tabla Liga BetPlay</Link>
        <Link href="/jugadores" className="text-[var(--nx-accent-text)] hover:underline">Jugadores</Link>
        <Link href="/encuestas" className="text-[var(--nx-accent-text)] hover:underline">Debates</Link>
      </nav>
    </header>
  )
  return <DeportesClient seoIntro={seoIntro} />
}
