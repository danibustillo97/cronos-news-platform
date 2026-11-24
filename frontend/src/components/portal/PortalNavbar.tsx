'use client'

// Navegación del portal de fútbol. Fija y corta: Inicio, Partidos, Tablas,
// Jugadores, Encuestas + "Más". Nunca pinta todas las categorías de la
// base (eso montaba ítems sobre el logo y los íconos). Debajo de lg pasa a
// un menú lateral. Incluye el buscador global (jugadores + noticias).
// Lleva su propio wrapper .nx-portal para tener los tokens de tema en
// cualquier página donde se monte.

import { portalFont } from './fonts'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronDown, Menu, Moon, Search, Sun, X, Zap } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { usePortalTheme } from '@/context/ThemeContext'
import GlobalSearch from './GlobalSearch'

interface NavItem { label: string; href: string; match: (path: string) => boolean }

export const NAV_ITEMS: NavItem[] = [
  { label: 'Inicio', href: '/', match: (p) => p === '/' },
  { label: 'Partidos', href: '/deportes/futbol?view=matches', match: (p) => p === '/deportes/futbol' },
  { label: 'Tablas', href: '/deportes/futbol/tabla', match: (p) => p.startsWith('/deportes/futbol/tabla') },
  { label: 'Jugadores', href: '/jugadores', match: (p) => p.startsWith('/jugadores') },
  { label: 'Encuestas', href: '/encuestas', match: (p) => p.startsWith('/encuestas') },
]

export const MORE_ITEMS: { label: string; href: string }[] = [
  { label: 'Comparar jugadores', href: '/jugadores/comparar' },
  { label: 'Explorar noticias', href: '/explorar' },
  { label: 'Otros deportes', href: '/deportes' },
]

export default function PortalNavbar() {
  const { theme, toggleTheme } = usePortalTheme()
  const isDark = theme === 'dark'
  const pathname = usePathname() ?? '/'
  const [menuOpen, setMenuOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const moreRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!moreOpen) return
    const onDown = (e: MouseEvent) => { if (!moreRef.current?.contains(e.target as Node)) setMoreOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMoreOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [moreOpen])

  // Atajos: Ctrl/Cmd+K o "/" abren el buscador.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => { setMenuOpen(false); setMoreOpen(false) }, [pathname])

  useEffect(() => {
    if (!menuOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey) }
  }, [menuOpen])

  const iconBtn = 'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--nx-ink-2)] transition-colors hover:bg-[var(--nx-surface-2)] hover:text-[var(--nx-ink)]'

  return (
    <div className={`nx-portal ${portalFont.className}`} data-theme={theme} style={{ background: 'transparent' }}>
      <header className="border-b border-[var(--nx-line)] bg-[var(--nx-bg)]/95 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-[1600px] items-center gap-4 px-4 sm:px-6 lg:px-8">
          <Link href="/" aria-label="NEXUS News, inicio" className="flex shrink-0 items-center gap-2">
            <Zap size={22} className="fill-[#FACC15] text-[#FACC15]" strokeWidth={0} aria-hidden="true" />
            <span className="flex flex-col leading-none">
              <span className="text-[17px] font-extrabold tracking-tight text-[var(--nx-ink)]">NEXUS</span>
              <span className="mt-0.5 text-[8px] font-bold uppercase tracking-[0.22em] text-[var(--nx-muted)]">Fútbol</span>
            </span>
          </Link>

          <nav aria-label="Principal" className="ml-4 hidden min-w-0 items-center gap-1 lg:flex">
            {NAV_ITEMS.map((item) => {
              const active = item.match(pathname)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`relative inline-flex h-11 items-center rounded-full px-3.5 text-[13px] font-semibold transition-colors ${
                    active ? 'text-[var(--nx-ink)]' : 'text-[var(--nx-muted)] hover:text-[var(--nx-ink)]'
                  }`}
                >
                  {item.label}
                  {active && <span aria-hidden className="absolute inset-x-3.5 -bottom-[7px] h-0.5 rounded-full bg-[#FACC15]" />}
                </Link>
              )
            })}
            <div ref={moreRef} className="relative">
              <button
                type="button"
                aria-expanded={moreOpen}
                aria-haspopup="menu"
                onClick={() => setMoreOpen((v) => !v)}
                className="inline-flex h-11 items-center gap-1 rounded-full px-3.5 text-[13px] font-semibold text-[var(--nx-muted)] hover:text-[var(--nx-ink)]"
              >
                Más <ChevronDown size={14} className={`transition-transform ${moreOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
              </button>
              {moreOpen && (
                <div role="menu" className="absolute left-0 top-full z-10 mt-2 w-56 overflow-hidden rounded-xl border border-[var(--nx-line)] bg-[var(--nx-surface)] p-1.5 shadow-2xl">
                  {MORE_ITEMS.map((item) => (
                    <Link key={item.href} role="menuitem" href={item.href} className="flex min-h-[44px] items-center rounded-lg px-3 text-sm font-semibold text-[var(--nx-ink-2)] hover:bg-[var(--nx-surface-2)] hover:text-[var(--nx-ink)]">
                      {item.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label="Buscar jugadores y noticias"
              className="hidden h-10 items-center gap-2 rounded-full border border-[var(--nx-line)] pl-3 pr-2 text-[13px] text-[var(--nx-muted)] transition-colors hover:border-[var(--nx-line-strong)] hover:text-[var(--nx-ink)] md:inline-flex"
            >
              <Search size={15} aria-hidden="true" />
              <span className="whitespace-nowrap pr-6 text-left">Buscar</span>
              <kbd className="whitespace-nowrap rounded border border-[var(--nx-line)] px-1.5 py-0.5 text-[10px] font-semibold">Ctrl K</kbd>
            </button>
            <button type="button" onClick={() => setSearchOpen(true)} aria-label="Buscar" className={`${iconBtn} md:hidden`}>
              <Search size={19} />
            </button>
            <button type="button" onClick={toggleTheme} aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'} className={iconBtn}>
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button type="button" onClick={() => setMenuOpen(true)} aria-label="Abrir menú" aria-expanded={menuOpen} className={`${iconBtn} lg:hidden`}>
              <Menu size={21} />
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            key="menu"
            className="fixed inset-0 z-[70] lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button type="button" aria-label="Cerrar menú" className="absolute inset-0 bg-black/60" onClick={() => setMenuOpen(false)} />
            <motion.nav
              aria-label="Menú"
              className="absolute inset-y-0 right-0 flex w-[min(86vw,360px)] flex-col bg-[var(--nx-bg)] shadow-2xl"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'tween', duration: 0.22 }}
            >
              <div className="flex h-14 items-center justify-between border-b border-[var(--nx-line)] px-4">
                <span className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--nx-muted)]">Menú</span>
                <button type="button" onClick={() => setMenuOpen(false)} aria-label="Cerrar menú" className={iconBtn}><X size={20} /></button>
              </div>
              <ul className="flex-1 overflow-y-auto p-2">
                {NAV_ITEMS.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href} aria-current={item.match(pathname) ? 'page' : undefined} className={`flex min-h-[52px] items-center rounded-xl px-4 text-[17px] font-bold ${item.match(pathname) ? 'bg-[var(--nx-surface-2)] text-[var(--nx-ink)]' : 'text-[var(--nx-ink-2)]'}`}>
                      {item.label}
                    </Link>
                  </li>
                ))}
                <li className="mx-4 my-2 border-t border-[var(--nx-line)]" aria-hidden="true" />
                {MORE_ITEMS.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href} className="flex min-h-[48px] items-center rounded-xl px-4 text-[15px] font-semibold text-[var(--nx-muted)]">{item.label}</Link>
                  </li>
                ))}
              </ul>
            </motion.nav>
          </motion.div>
        )}
      </AnimatePresence>

      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  )
}
