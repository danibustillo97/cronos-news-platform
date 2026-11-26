import type { Metadata } from 'next'
import { Suspense } from 'react'
import CompareClient from './CompareClient'

export const metadata: Metadata = {
  title: 'Comparar futbolistas',
  description: 'Compara a dos futbolistas por temporada y competición con las herramientas de NEXUS News.',
  robots: { index: false, follow: true },
}

export default function ComparePage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-4 pb-16 pt-8">
      <header className="mb-6 max-w-3xl">
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#FACC15]">NEXUS / Comparador</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-white">Comparar futbolistas</h1>
        <p className="mt-3 text-sm leading-relaxed text-neutral-400">
          Contrasta el rendimiento de dos jugadores por temporada y competición. Esta herramienta crea comparaciones
          a partir de la selección del usuario; los resultados individuales no son páginas editoriales independientes.
        </p>
      </header>
      <Suspense fallback={null}>
        <CompareClient />
      </Suspense>
    </main>
  )
}
