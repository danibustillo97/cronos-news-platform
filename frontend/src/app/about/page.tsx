import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sobre Nexus News',
  description: 'Identidad editorial y propósito de Nexus News.',
}

export default function AboutPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-20 text-neutral-200">
      <h1 className="mb-6 text-3xl font-bold">Sobre Nexus News</h1>
      <p>
        Nexus News es una plataforma editorial de información deportiva. El propietario
        debe completar la descripción institucional, la razón social y los datos de contacto reales
        antes de publicar una afirmación empresarial definitiva.
      </p>
    </main>
  )
}
