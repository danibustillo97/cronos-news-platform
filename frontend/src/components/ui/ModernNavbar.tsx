'use client'

// Arquitectura de navegación híbrida (ver brief 2026-09): rutas reales
// fijas para las secciones que tienen experiencia propia -- el navbar NO
// crece con la taxonomía (esa la resuelve /explorar, alimentada por
// /api/categories). Deportes deja de ser un filtro de categoría más y
// pasa a ser el hub real (/deportes), con su propio toolbar de
// competiciones/vistas -- ver app/deportes/page.tsx.

import React, { useState, useEffect } from 'react'
import { Menu, X, Search, Zap, Sun, Moon } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import Link from 'next/link'
import { usePortalTheme } from '@/context/ThemeContext'

const NAV_LINKS: { name: string; href: string }[] = [
  { name: 'Inicio', href: '/' },
  { name: 'Política', href: '/categoria/politica' },
  { name: 'Mundo', href: '/categoria/mundo' },
  { name: 'Empresas', href: '/categoria/empresas' },
  { name: 'Sociedad', href: '/categoria/sociedad' },
  { name: 'Deportes', href: '/deportes' },
  { name: 'Explorar', href: '/explorar' },
]

export default function ModernNavbar() {
  const { theme, toggleTheme } = usePortalTheme()
  const isDark = theme === 'dark'
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const navLinks = NAV_LINKS

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <>
      <header
        className={`transition-colors duration-200 ${
          isDark ? 'bg-[#0B0B0B] border-b border-white/10' : 'bg-white border-b border-[#E5E5E5]'
        }`}
      >
        <div
          className={`max-w-7xl mx-auto px-4 flex items-center justify-between transition-all duration-200 ${
            scrolled ? 'h-12' : 'h-14'
          }`}
        >
          <Link href="/" className="flex items-center gap-2 min-w-0 flex-shrink-0">
            <Zap size={26} className="text-[#E30613] fill-[#E30613] flex-shrink-0" strokeWidth={0} />
            <span className="flex flex-col leading-none">
              <span className={`font-black text-lg tracking-tight whitespace-nowrap ${isDark ? 'text-white' : 'text-neutral-900'}`}>
                NEXUS
              </span>
              <span className={`text-[8px] font-bold uppercase tracking-[0.16em] whitespace-nowrap ${isDark ? 'text-white/40' : 'text-neutral-400'}`}>
                Noticias que importan
              </span>
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-6">
            {navLinks.map(link => (
              <Link
                key={link.name}
                href={link.href}
                className={`text-[11px] font-bold uppercase tracking-[0.12em] transition-colors ${
                  isDark ? 'text-white/70 hover:text-white' : 'text-[#666] hover:text-[#161616]'
                }`}
              >
                {link.name}
              </Link>
            ))}
          </nav>

          <div className={`hidden md:flex items-center gap-3 ${isDark ? 'text-white/80' : 'text-neutral-600'}`}>
            <button aria-label="Buscar" className="hover:text-[#E30613] transition">
              <Search size={17} />
            </button>
            <button
              onClick={toggleTheme}
              aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
              className={`p-1.5 rounded-full transition-colors ${isDark ? 'hover:bg-white/10' : 'hover:bg-neutral-100'}`}
            >
              {isDark ? <Sun size={17} /> : <Moon size={17} />}
            </button>
          </div>

          <div className="flex items-center gap-1 md:hidden">
            <button aria-label="Buscar" className={`p-2 ${isDark ? 'text-white/80' : 'text-neutral-600'}`}>
              <Search size={19} />
            </button>
            <button
              onClick={toggleTheme}
              aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
              className={`p-2 ${isDark ? 'text-white/80' : 'text-neutral-600'}`}
            >
              {isDark ? <Sun size={19} /> : <Moon size={19} />}
            </button>
            <button
              className={isDark ? 'text-white p-2' : 'text-neutral-900 p-2'}
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Abrir menú"
            >
              {mobileOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className={`fixed inset-0 z-40 pt-20 px-6 md:hidden ${isDark ? 'bg-neutral-950' : 'bg-white'}`}
          >
            <nav className="flex flex-col gap-6">
              {navLinks.map(link => (
                <Link
                  key={link.name}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={`text-lg font-bold uppercase tracking-wide pb-3 border-b ${
                    isDark ? 'text-white border-white/10' : 'text-neutral-900 border-neutral-200'
                  }`}
                >
                  {link.name}
                </Link>
              ))}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
