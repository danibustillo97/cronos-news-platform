'use client'

// Internal discovery links to editorial, participation, and policy pages
// that exist and should remain reachable from every public route.

import Link from 'next/link'
import { Zap } from 'lucide-react'
import { usePortalTheme } from '@/context/ThemeContext'

export default function Footer() {
  const { theme } = usePortalTheme()
  const isDark = theme === 'dark'

  return (
    <footer className={`border-t mt-16 ${isDark ? 'border-white/10 bg-neutral-950' : 'border-neutral-200 bg-white'}`}>
      <div className="max-w-7xl mx-auto px-4 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2">
          <Zap size={20} className="text-[#FACC15] fill-[#FACC15]" strokeWidth={0} />
          <span className="flex flex-col leading-none">
            <span className={`font-black text-sm ${isDark ? 'text-white' : 'text-neutral-900'}`}>NEXUS</span>
            <span className={`text-[7px] font-bold uppercase tracking-[0.16em] ${isDark ? 'text-white/40' : 'text-neutral-400'}`}>
              Noticias que importan
            </span>
          </span>
        </Link>

        <nav aria-label="Enlaces del sitio" className={`flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs font-medium ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
          <Link href="/deportes/futbol" className="hover:text-[#FACC15] transition-colors">Fútbol</Link>
          <Link href="/deportes/futbol/tabla" className="hover:text-[#FACC15] transition-colors">Tablas</Link>
          <Link href="/jugadores" className="hover:text-[#FACC15] transition-colors">Jugadores</Link>
          <Link href="/encuestas" className="hover:text-[#FACC15] transition-colors">Encuestas</Link>
          <Link href="/about" className="hover:text-[#FACC15] transition-colors">Sobre NEXUS</Link>
          <Link href="/corrections" className="hover:text-[#FACC15] transition-colors">Correcciones</Link>
          <Link href="/cookies" className="hover:text-[#FACC15] transition-colors">Cookies</Link>
          <Link href="/terms" className="hover:text-[#FACC15] transition-colors">Términos</Link>
          <Link href="/privacy" className="hover:text-[#FACC15] transition-colors">Privacidad</Link>
          <span>© {new Date().getFullYear()} Nexus News</span>
        </nav>
      </div>
    </footer>
  )
}
