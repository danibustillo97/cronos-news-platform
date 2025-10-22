'use client'

import { ReactNode } from 'react'

export default function NewsEditorLayout({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-black via-[#141414] to-black px-2">
      <div className="w-full max-w-2xl rounded-3xl shadow-2xl border border-yellow-500/40 bg-[#181818] relative overflow-hidden">
        {/* Barra superior amarilla */}
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-400 opacity-90 rounded-t-3xl z-10" />
        {/* Cabecera */}
        <header className="flex items-center gap-3 px-6 pt-8 pb-4">
          <span className="text-yellow-400 text-2xl">📝</span>
          <h2 className="text-2xl font-extrabold tracking-tight text-white">Editor de Noticia</h2>
        </header>
        <section className="p-6 pt-2">
          {children}
        </section>
      </div>
    </main>
  )
}
