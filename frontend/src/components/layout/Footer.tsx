'use client'

// Only links to pages that actually exist (/terms, /privacy) -- no
// fabricated "Contacto"/"Sobre nosotros" pages or social profile URls
// that don't exist yet.

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
          <Zap size={20} className="text-[#E30613] fill-[#E30613]" strokeWidth={0} />
          <span className="flex flex-col leading-none">
            <span className={`font-black text-sm ${isDark ? 'text-white' : 'text-neutral-900'}`}>NEXUS</span>
            <span className={`text-[7px] font-bold uppercase tracking-[0.16em] ${isDark ? 'text-white/40' : 'text-neutral-400'}`}>
              Noticias que importan
            </span>
          </span>
        </Link>

        <div className={`flex items-center gap-6 text-xs font-medium ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
          <Link href="/terms" className="hover:text-[#E30613] transition-colors">Términos</Link>
          <Link href="/privacy" className="hover:text-[#E30613] transition-colors">Privacidad</Link>
          <span>© {new Date().getFullYear()} Nexus News</span>
        </div>
      </div>
    </footer>
  )
}
