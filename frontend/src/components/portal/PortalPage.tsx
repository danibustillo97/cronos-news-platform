'use client'

// Envoltorio para páginas públicas nuevas (jugadores, encuestas): tema,
// navbar fija, contenedor y footer con la misma identidad del home.

import { portalFont } from './fonts'
import type { ReactNode } from 'react'
import Footer from '@/components/layout/Footer'
import { usePortalTheme } from '@/context/ThemeContext'
import PortalNavbar from './PortalNavbar'
import PwaClient from './PwaClient'

export const pageShell = 'mx-auto w-full px-4 sm:px-6 lg:px-8'

export default function PortalPage({ children }: { children: ReactNode }) {
  const { theme } = usePortalTheme()
  return (
    <div className={`nx-portal ${portalFont.className} min-h-screen overflow-x-clip`} data-theme={theme}>
      <a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[80] focus:rounded-full focus:bg-[#FACC15] focus:px-5 focus:py-3 focus:text-sm focus:font-bold focus:text-black">
        Saltar al contenido
      </a>
      <div className="sticky top-0 z-50"><PortalNavbar /></div>
      <main id="contenido" tabIndex={-1} className="outline-none">{children}</main>
      <Footer />
      <PwaClient />
    </div>
  )
}
