'use client'

// Internal discovery links to editorial, participation, and policy pages
// that exist and should remain reachable from every public route.

import Link from 'next/link'
import BrandLockup from '@/components/brand/BrandLockup'
import { usePortalTheme } from '@/context/ThemeContext'

export default function Footer() {
  const { theme } = usePortalTheme()
  const isDark = theme === 'dark'

  return (
    <footer className={`border-t mt-16 ${isDark ? 'border-white/10 bg-neutral-950' : 'border-neutral-200 bg-white'}`}>
      <div className="max-w-7xl mx-auto px-4 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <Link href="/" aria-label="NEXUS News, inicio" className="flex items-center">
          <BrandLockup
            size={32}
            nameClassName={`font-black text-sm ${isDark ? 'text-white' : 'text-neutral-900'}`}
            subLabelClassName={`mt-0.5 text-[7px] font-bold uppercase tracking-[0.16em] ${isDark ? 'text-white/45' : 'text-neutral-400'}`}
          />
        </Link>

        <nav aria-label="Enlaces del sitio" className={`flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs font-medium ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
          <Link href="/deportes/futbol" className="hover:text-[#FACC15] transition-colors">Fútbol</Link>
          <Link href="/deportes/futbol/tabla" className="hover:text-[#FACC15] transition-colors">Tablas</Link>
          <Link href="/jugadores" className="hover:text-[#FACC15] transition-colors">Jugadores</Link>
          <Link href="/encuestas" className="hover:text-[#FACC15] transition-colors">Encuestas</Link>
          <Link href="/archivo" className="hover:text-[#FACC15] transition-colors">Archivo</Link>
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
