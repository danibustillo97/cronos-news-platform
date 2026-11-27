import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Política de Correcciones y Actualizaciones',
  description: 'Conoce los criterios de NEXUS News para revisar errores, contrastar datos y actualizar noticias deportivas con transparencia.',
  alternates: { canonical: '/corrections' },
}

export default function CorrectionsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 text-neutral-200 sm:py-20">
      <p className="mb-3 text-[11px] font-black uppercase tracking-[0.18em] text-[#FACC15]">Transparencia editorial</p>
      <h1 className="mb-5 text-3xl font-black tracking-tight text-white sm:text-4xl">Política de Correcciones</h1>
      <p className="leading-relaxed text-neutral-300">
        La precisión importa. NEXUS News distingue entre una actualización de última hora, un cambio de contexto
        y la corrección de un dato equivocado. Esta política explica cómo deben tratarse los errores materiales
        en una noticia deportiva.
      </p>
      <section className="mt-8">
        <h2 className="text-xl font-bold text-white">Qué consideramos una corrección</h2>
        <p className="mt-3 leading-relaxed text-neutral-300">
          Una corrección procede cuando una publicación contiene un dato factual incorrecto o una atribución
          que puede inducir a error: por ejemplo, un marcador, una fecha, una cifra, el nombre de una persona
          o una declaración atribuida de forma imprecisa. Los cambios posteriores de un partido o una competición
          se presentan como actualizaciones, no como si el dato anterior nunca hubiera existido.
        </p>
      </section>
      <section className="mt-8">
        <h2 className="text-xl font-bold text-white">Cómo se revisa un posible error</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 leading-relaxed text-neutral-300">
          <li>Identificar la noticia y el fragmento concreto que requiere revisión.</li>
          <li>Contrastar el dato con una fuente identificable y, cuando sea posible, con una fuente primaria.</li>
          <li>Determinar si corresponde corregir el texto, añadir contexto o publicar una actualización.</li>
          <li>Cuando el cambio sea material, explicar qué se corrigió sin alterar artificialmente la fecha original de publicación.</li>
        </ol>
      </section>
      <section className="mt-8">
        <h2 className="text-xl font-bold text-white">Qué debe incluir una solicitud</h2>
        <p className="mt-3 leading-relaxed text-neutral-300">
          Para facilitar la revisión, incluye la URL de la noticia, el texto que consideras incorrecto,
          la corrección propuesta y un enlace o documento que permita verificarla. Las opiniones, desacuerdos
          editoriales y cambios de pronóstico no constituyen por sí solos errores factuales.
        </p>
      </section>
      <p className="mt-8 border-t border-white/10 pt-6 text-sm leading-relaxed text-neutral-400">
        Las correcciones materiales deben quedar identificadas con claridad para que el lector pueda distinguir
        la información original de la versión corregida.
      </p>
    </main>
  )
}
