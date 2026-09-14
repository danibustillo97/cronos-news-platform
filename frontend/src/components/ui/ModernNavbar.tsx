'use client'

import React, { useState, useEffect } from 'react'
import { Menu, X, Search, Bell } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import Link from 'next/link'

export default function ModernNavbar() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const navLinks = [
    { name: 'Inicio', href: '/' },
    { name: 'Fútbol', href: '/categoria/futbol' },
    { name: 'Baloncesto', href: '/categoria/baloncesto' },
    { name: 'Tenis', href: '/categoria/tenis' },
    { name: 'Motor', href: '/categoria/motor' },
    { name: 'Opinión', href: '/categoria/opinion' },
  ]

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 bg-white transition-all duration-200
        ${scrolled ? 'shadow-sm' : ''}`}
      >
        <div
          className={`max-w-7xl mx-auto px-4 flex items-center justify-between transition-all duration-200
          ${scrolled ? 'h-14' : 'h-16'}`}
        >
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-red-600 rounded-md flex items-center justify-center text-white font-black text-lg">
              N
            </div>
            <span className="font-black text-xl tracking-tight text-neutral-900">
              NEXUS<span className="text-red-600">NEWS</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-6">
            {navLinks.map(link => (
              <Link
                key={link.name}
                href={link.href}
                className="text-sm font-semibold text-neutral-800 hover:text-red-600 transition-colors"
              >
                {link.name}
              </Link>
            ))}
          </nav>

          {/* Icons */}
          <div className="hidden md:flex items-center gap-4 text-neutral-700">
            <Search size={20} className="hover:text-red-600 transition" />
            <Bell size={20} className="hover:text-red-600 transition" />
          </div>

          {/* Mobile */}
          <button
            className="md:hidden text-neutral-800"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </header>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="fixed inset-0 z-40 bg-white pt-20 px-6 md:hidden"
          >
            <nav className="flex flex-col gap-6">
              {navLinks.map(link => (
                <Link
                  key={link.name}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="text-xl font-semibold text-neutral-900 border-b pb-3"
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
