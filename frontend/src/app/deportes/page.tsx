import DeportesClient from './DeportesClient'

export default function DeportesPage() {
  const seoIntro = (
    <header className="mb-3">
      <h1 className="text-3xl font-black tracking-tight">Deportes en vivo y resultados</h1>
      <p className="mt-2 max-w-3xl text-sm opacity-75">
        Sigue partidos en vivo, próximos encuentros, resultados y tablas. NEXUS News reúne la actualidad deportiva de Colombia y el mundo, con foco en el fútbol colombiano.
      </p>
    </header>
  )

  return <DeportesClient seoIntro={seoIntro} />
}
