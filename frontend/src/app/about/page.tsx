import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Qué es NEXUS News y cómo contamos el deporte',
  description: 'Conoce el enfoque editorial de NEXUS News: fútbol colombiano, Liga BetPlay, datos, contexto, perfiles de jugadores y conversación con los hinchas.',
  alternates: { canonical: '/about' },
}

export default function AboutPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 text-neutral-200 sm:py-20">
      <p className="mb-3 text-[11px] font-black uppercase tracking-[0.18em] text-[#FACC15]">NEXUS / Nuestra identidad</p>
      <h1 className="mb-5 text-3xl font-black tracking-tight text-white sm:text-4xl">El fútbol, más allá del marcador.</h1>
      <p className="text-lg leading-relaxed text-neutral-300">
        NEXUS News es un medio digital deportivo en español, pensado para lectores de Colombia y Latinoamérica.
        Contamos la actualidad del fútbol colombiano e internacional y conectamos cada noticia con el contexto
        de la competición, los datos disponibles y la conversación de quienes viven el deporte.
      </p>
      <section className="mt-10 border-t border-white/10 pt-8">
        <h2 className="text-xl font-bold text-white">Qué encontrarás en NEXUS</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
            <h3 className="font-bold text-white">Actualidad con contexto</h3>
            <p className="mt-2 text-sm leading-relaxed text-neutral-400">
              Noticias de la Liga BetPlay, los clubes colombianos, la Selección y las principales competiciones internacionales.
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
            <h3 className="font-bold text-white">Datos para entender</h3>
            <p className="mt-2 text-sm leading-relaxed text-neutral-400">
              Partidos, resultados, tablas de posiciones, perfiles y comparaciones de futbolistas para leer mejor cada jornada.
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 sm:col-span-2">
            <h3 className="font-bold text-white">La voz del hincha</h3>
            <p className="mt-2 text-sm leading-relaxed text-neutral-400">
              Encuestas y debates para que la comunidad participe, contraste opiniones y ponga sobre la mesa las preguntas que deja el juego.
            </p>
          </div>
        </div>
      </section>
      <section id="principios-editoriales" className="mt-10 border-t border-white/10 pt-8">
        <h2 className="text-xl font-bold text-white">Principios editoriales</h2>
        <p className="mt-3 leading-relaxed text-neutral-300">
          Priorizamos la claridad, la precisión y la utilidad para el lector. Diferenciamos los hechos confirmados
          de las versiones en desarrollo, evitamos presentar rumores como certezas y procuramos identificar las
          fuentes que sustentan la información. El contexto y los datos deben ayudar a comprender la noticia,
          no reemplazarla ni adornarla.
        </p>
        <p className="mt-3 leading-relaxed text-neutral-300">
          Cuando una publicación contiene un error factual, la revisión y la corrección deben ser claras y proporcionales
          al impacto del dato. Consulta nuestra <Link href="/corrections" className="font-semibold text-[#FACC15] underline underline-offset-4">Política de Correcciones</Link>.
        </p>
      </section>
      <nav aria-label="Explorar NEXUS News" className="mt-10 flex flex-wrap gap-x-5 gap-y-3 border-t border-white/10 pt-6 text-sm font-semibold">
        <Link href="/deportes/futbol" className="text-[#FACC15] hover:underline">Fútbol</Link>
        <Link href="/deportes/futbol/tabla" className="text-[#FACC15] hover:underline">Tabla Liga BetPlay</Link>
        <Link href="/jugadores" className="text-[#FACC15] hover:underline">Jugadores</Link>
        <Link href="/encuestas" className="text-[#FACC15] hover:underline">Encuestas y debates</Link>
      </nav>
    </main>
  )
}
