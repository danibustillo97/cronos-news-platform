'use client'

import React, { useState, useEffect } from 'react'
import { Menu, X, Search, Sun, Moon } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import Link from 'next/link'
import { usePortalTheme } from '@/context/ThemeContext'
import { apiUrl } from '@/studio/lab/api-client'
import BrandLockup from '@/components/brand/BrandLockup'

interface SportCategory {
  id: string
  name: string
  slug: string
  sortOrder: number
  active: boolean
}

interface CategoryGroup {
  name: string
  slug: string
  active: boolean
  categories: SportCategory[]
}

interface CategoriesResponse {
  groups?: CategoryGroup[]
}

interface NavLink {
  name: string
  href: string
}

export default function ModernNavbar() {
  const { theme, toggleTheme } = usePortalTheme()
  const isDark = theme === 'dark'
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [sportCategories, setSportCategories] = useState<SportCategory[]>([])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    let cancelled = false

    fetch(apiUrl('/api/categories'), { next: { revalidate: 300 } })
      .then((response) => {
        if (!response.ok) throw new Error(`No se pudieron cargar las categorías: ${response.status}`)
        return response.json() as Promise<CategoriesResponse>
      })
      .then((data) => {
        if (cancelled) return
        const groups = data.groups ?? []
        const sportsGroup = groups.find((group) =>
          group.active && (group.slug.toLowerCase() === 'deportes' || group.name.toLowerCase() === 'deportes')
        )
        const categories = (sportsGroup?.categories ?? [])
          .filter((category) => category.active)
          .sort((a, b) => a.sortOrder - b.sortOrder)
        setSportCategories(categories)
      })
      .catch((error) => {
        console.error('[ModernNavbar] Error cargando categorías deportivas:', error)
        if (!cancelled) setSportCategories([])
      })

    return () => { cancelled = true }
  }, [])

  const navLinks: NavLink[] = [
    { name: 'Inicio', href: '/' },
    ...sportCategories.map((category) => ({
      name: category.name,
      href: `/categoria/${category.slug}`,
    })),
    { name: 'Deportes', href: '/deportes' },
  ]

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
          <Link href="/" aria-label="NEXUS News, inicio" className="flex min-w-0 flex-shrink-0 items-center">
            <BrandLockup
              size={32}
              nameClassName={`font-black text-lg tracking-tight whitespace-nowrap ${isDark ? 'text-white' : 'text-neutral-900'}`}
              subLabelClassName={`mt-0.5 text-[8px] font-bold uppercase tracking-[0.16em] whitespace-nowrap ${isDark ? 'text-white/45' : 'text-neutral-400'}`}
            />
          </Link>

          <nav aria-label="Categorías deportivas" className="hidden md:flex min-w-0 items-center gap-5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                href={link.href}
                className={`shrink-0 text-[11px] font-bold uppercase tracking-[0.12em] transition-colors ${
                  isDark ? 'text-white/70 hover:text-white' : 'text-[#666] hover:text-[#161616]'
                }`}
              >
                {link.name}
              </Link>
            ))}
          </nav>

          <div className={`hidden md:flex shrink-0 items-center gap-3 ${isDark ? 'text-white/80' : 'text-neutral-600'}`}>
            <button aria-label="Buscar" className="hover:text-[#FACC15] transition">
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
            <nav aria-label="Categorías deportivas" className="flex flex-col gap-6 overflow-y-auto max-h-[calc(100dvh-6rem)]">
              {navLinks.map((link) => (
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
