'use client'

import { FC, ReactNode } from 'react'
import Link from 'next/link'
import { Goal, Home, Newspaper, Settings } from 'lucide-react'
import LiveScoresWidget from '@/components/widgets/LiveScoresWidget'
import Image from 'next/image'

interface Props {
  children: ReactNode
}

const MainLayout: FC<Props> = ({ children }) => {
  return (
    <div className="flex min-h-screen bg-neutral-900 text-white">
      {/* Aside izquierdo */}
      <aside className="w-72 bg-neutral-950 border-r border-neutral-800 p-5 hidden md:flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-2 mb-8">
            <Image src="/logo.svg" alt="Logo" width={28} height={28} />
            <h1 className="text-xl font-extrabold tracking-tight text-white">
              EstadioPRO
            </h1>
          </div>

          <nav className="space-y-4">
            <Link
              href="/"
              className="flex items-center gap-3 text-sm hover:text-yellow-400 transition"
            >
              <Home className="w-4 h-4" /> Inicio
            </Link>
            <Link
              href="/noticias"
              className="flex items-center gap-3 text-sm hover:text-yellow-400 transition"
            >
              <Newspaper className="w-4 h-4" /> Noticias
            </Link>
            <Link
              href="/configuracion"
              className="flex items-center gap-3 text-sm hover:text-yellow-400 transition"
            >
              <Settings className="w-4 h-4" /> Configuración
            </Link>
          </nav>
        </div>

        {/* Marcadores en vivo */}
        <div className="mt-10">
          <h2 className="text-yellow-500 font-semibold text-sm mb-2">
            ⚽ Marcadores en vivo
          </h2>
          <LiveScoresWidget />
        </div>
      </aside>

      {/* Contenido principal */}
      <div className="flex-1 flex flex-col">
        {/* Navbar */}
        <header className="h-16 px-6 flex items-center justify-between bg-neutral-950 border-b border-neutral-800 shadow-md z-10">
          <div className="flex items-center gap-2 md:hidden">
            <Image src="/logo.svg" alt="Logo" width={24} height={24} />
            <span className="text-white text-base font-semibold">EstadioPRO</span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm text-neutral-300">
            <Link href="/" className="hover:text-yellow-400 transition">
              Inicio
            </Link>
            <Link href="/noticias" className="hover:text-yellow-400 transition">
              Noticias
            </Link>
            <Link href="/contacto" className="hover:text-yellow-400 transition">
              Contacto
            </Link>
          </nav>
        </header>

        {/* Contenido Scrollable */}
        <main className="flex-1 overflow-y-auto p-6 bg-neutral-900">
          {children}
        </main>
      </div>
    </div>
  )
}

export default MainLayout
