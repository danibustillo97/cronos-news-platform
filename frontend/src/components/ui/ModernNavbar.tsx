'use client'

import React, { useState, useEffect } from 'react'
import { Menu, X, Search, Bell, Sun, Moon } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { usePortalTheme } from '@/context/ThemeContext'

function slugifyCategory(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export default function ModernNavbar() {
  const { theme, toggleTheme } = usePortalTheme()
  const isDark = theme === 'dark'
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [navLinks, setNavLinks] = useState<{ name: string; href: string }[]>([
    { name: 'Inicio', href: '/' },
    { name: 'Fútbol', href: '/categoria/futbol' },
    { name: 'Baloncesto', href: '/categoria/baloncesto' },
    { name: 'Tenis', href: '/categoria/tenis' },
    { name: 'Motor', href: '/categoria/motor' },
    { name: 'Opinión', href: '/categoria/opinion' },
  ])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', onScroll)

    const loadCategories = async () => {
      const { data } = await supabase
        .from('news')
        .select('category')
        .eq('status', 'published')
        .not('category', 'is', null)
        .limit(50)

      const uniqueCategories = Array.from(
        new Set((data ?? []).map((item) => (item.category ?? '').trim()).filter(Boolean))
      )
        .slice(0, 6)
        .map((name) => ({ name, href: `/categoria/${slugifyCategory(name)}` }))

      if (uniqueCategories.length > 0) {
        setNavLinks([{ name: 'Inicio', href: '/' }, ...uniqueCategories])
      }
    }

    loadCategories()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 backdrop-blur-xl transition-colors duration-200 ${
          isDark
            ? `border-b border-white/10 ${scrolled ? 'bg-neutral-950/90 shadow-[0_10px_30px_rgba(0,0,0,0.35)]' : 'bg-neutral-950/70'}`
            : `border-b border-neutral-200 ${scrolled ? 'bg-white/95 shadow-[0_10px_30px_rgba(15,23,42,0.08)]' : 'bg-white/80'}`
        }`}
      >
        <div
          className={`max-w-7xl mx-auto px-4 flex items-center justify-between transition-all duration-200 ${
            scrolled ? 'h-12' : 'h-14'
          }`}
        >
          <Link href="/" className="flex items-center gap-2 min-w-0 flex-shrink-0">
            <div className="w-7 h-7 bg-red-600 rounded-md flex items-center justify-center text-white font-black text-base shadow-[0_0_18px_rgba(239,68,68,0.6)]">
              N
            </div>
            <span className={`font-black text-lg tracking-tight whitespace-nowrap ${isDark ? 'text-white' : 'text-neutral-900'}`}>
              NEXUS<span className="text-red-500">NEWS</span>
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map(link => (
              <Link
                key={link.name}
                href={link.href}
                className={`px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-[0.12em] transition-colors ${
                  isDark ? 'text-white/70 hover:text-white hover:bg-white/10' : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100'
                }`}
              >
                {link.name}
              </Link>
            ))}
          </nav>

          <div className={`hidden md:flex items-center gap-3 ${isDark ? 'text-white/80' : 'text-neutral-600'}`}>
            <button aria-label="Buscar" className="hover:text-red-500 transition">
              <Search size={17} />
            </button>
            <button aria-label="Notificaciones" className="hover:text-red-500 transition">
              <Bell size={17} />
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
            <button
              onClick={toggleTheme}
              aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
              className={isDark ? 'text-white/80' : 'text-neutral-600'}
            >
              {isDark ? <Sun size={20} /> : <Moon size={20} />}
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
