import TablaClient from './TablaClient'

export default function TablaPage() {
  const seoIntro = (
    <header className="mt-2 max-w-3xl">
      <h1 className="text-3xl font-black tracking-tight">Tabla de posiciones de la Liga BetPlay</h1>
      <p className="mt-2 text-sm opacity-75">
        Consulta la clasificación del fútbol colombiano, revisa puntos y partidos jugados, y cambia de competición para explorar las tablas de otras ligas.
      </p>
    </header>
  )

  return <TablaClient seoIntro={seoIntro} />
}
