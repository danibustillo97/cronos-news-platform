import FutbolClient from './FutbolClient'

export default function FutbolPage() {
  const seoIntro = (
    <header className="mt-2 mb-6 max-w-3xl">
      <h1 className="text-3xl font-black tracking-tight">Fútbol colombiano e internacional</h1>
      <p className="mt-2 text-sm opacity-75">
        Sigue la Liga BetPlay, la Selección Colombia y las principales ligas del mundo. Consulta partidos, resultados, tablas y noticias de fútbol con contexto.
      </p>
    </header>
  )

  return <FutbolClient seoIntro={seoIntro} />
}
