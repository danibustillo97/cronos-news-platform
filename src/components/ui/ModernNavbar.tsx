'use client'

import React, { useState, useEffect } from 'react'
import { Menu, X, Search, Bell, User } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'

interface ModernNavbarProps {
  onCategorySelect?: (category: string) => void
  activeCategory?: string
}

export default function ModernNavbar({ onCategorySelect, activeCategory = 'Inicio' }: ModernNavbarProps) {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const navLinks = [
    { name: 'Inicio', value: 'Todas' },
    { name: 'Fútbol', value: 'Futbol' },
    { name: 'Baloncesto', value: 'Baloncesto' },
    { name: 'Tenis', value: 'Tenis' },
    { name: 'Motor', value: 'Motor' },
    { name: 'Opinión', value: 'Opinion' },
  ]

  const handleNavClick = (value: string) => {
    if (onCategorySelect) {
      onCategorySelect(value)
    }
    setIsMobileMenuOpen(false)
  }

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          isScrolled 
            ? 'bg-white/95 backdrop-blur-md shadow-sm py-3 text-neutral-800' 
            : 'bg-gradient-to-b from-black/80 to-transparent py-5 text-white'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div 
              className="flex-shrink-0 flex items-center gap-2 cursor-pointer group"
              onClick={() => handleNavClick('Todas')}
            >
              <div className="w-9 h-9 bg-red-600 rounded-lg flex items-center justify-center text-white font-black text-xl shadow-lg transform group-hover:scale-105 transition-transform">
                N
              </div>
              <span className={`font-black text-2xl tracking-tighter ${isScrolled ? 'text-neutral-900' : 'text-white'}`}>
                NEXUS<span className="text-red-600">NEWS</span>
              </span>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center space-x-6">
              {navLinks.map((link) => {
                const isActive = activeCategory === link.value || (activeCategory === 'Inicio' && link.value === 'Todas');
                return (
                  <button
                    key={link.name}
                    onClick={() => handleNavClick(link.value)}
                    className={`relative text-sm font-bold uppercase tracking-wider transition-colors duration-200 group py-2 ${
                      isScrolled 
                        ? (isActive ? 'text-red-600' : 'text-neutral-600 hover:text-red-600') 
                        : (isActive ? 'text-white' : 'text-white/80 hover:text-white')
                    }`}
                  >
                    {link.name}
                    <span className={`absolute bottom-0 left-0 h-0.5 bg-red-600 transition-all duration-300 ${
                      isActive ? 'w-full' : 'w-0 group-hover:w-full'
                    }`} />
                  </button>
                )
              })}
            </nav>

            {/* Right Icons */}
            <div className="hidden md:flex items-center gap-4">
              <button className={`transition-colors duration-200 ${
                isScrolled 
                  ? 'text-neutral-600 hover:text-red-600' 
                  : 'text-white/90 hover:text-white'
              }`}>
                <Search size={22} />
              </button>
              <button className={`transition-colors duration-200 ${
                isScrolled 
                  ? 'text-neutral-600 hover:text-red-600' 
                  : 'text-white/90 hover:text-white'
              }`}>
                <Bell size={22} />
              </button>
              <button className="flex items-center gap-2 bg-red-600 text-white px-5 py-2 rounded-full text-sm font-bold hover:bg-red-700 transition-all shadow-lg hover:shadow-red-500/30 transform hover:-translate-y-0.5">
                <User size={16} />
                <span>Ingresar</span>
              </button>
            </div>

            {/* Mobile Menu Button */}
            <button
              className="md:hidden p-2 text-neutral-800"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? (
                <X size={24} className={isScrolled ? 'text-neutral-900' : 'text-white'} />
              ) : (
                <Menu size={24} className={isScrolled ? 'text-neutral-900' : 'text-white'} />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, x: '100%' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: '100%' }}
            transition={{ type: 'tween', duration: 0.3 }}
            className="fixed inset-0 z-40 bg-white md:hidden pt-24 px-6"
          >
            <nav className="flex flex-col space-y-6">
              {navLinks.map((link) => {
                 const isActive = activeCategory === link.value || (activeCategory === 'Inicio' && link.value === 'Todas');
                 return (
                  <button
                    key={link.name}
                    onClick={() => handleNavClick(link.value)}
                    className={`text-2xl font-bold text-left border-b border-neutral-100 pb-4 transition-colors ${
                      isActive ? 'text-red-600' : 'text-neutral-900 hover:text-red-600'
                    }`}
                  >
                    {link.name}
                  </button>
                )
              })}
              <div className="pt-6 flex flex-col gap-4">
                <button className="w-full bg-red-600 text-white py-3 rounded-xl font-bold text-lg shadow-lg">
                  Iniciar Sesión
                </button>
                <button className="w-full bg-neutral-100 text-neutral-900 py-3 rounded-xl font-bold text-lg">
                  Suscribirse
                </button>
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
