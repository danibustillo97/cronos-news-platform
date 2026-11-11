'use client'

// Sección 8 del brief: la arquitectura debe permitir agregar deportes sin
// rediseñar todo el hub, pero sección 19 prohíbe inventar datos falsos.
// Esta página es el estado intermedio honesto: existe una ruta real y
// visible en el switcher de /deportes, pero mientras no haya una
// integración de datos real para ese deporte (no hay ninguna en backend
// hoy -- ver backend/app/presentation/api/sports.py, solo fútbol/ESPN),
// se lo dice claramente en vez de simular contenido.

import { useParams } from 'next/navigation'
import Link from 'next/link'
import ModernNavbar from '@/components/ui/ModernNavbar'
import Footer from '@/components/layout/Footer'
import { usePortalTheme } from '@/context/ThemeContext'
import { OTHER_SPORTS } from '@/lib/sportsLeagues'

export default function SportPlaceholderPage() {
  const { theme } = usePortalTheme()
  const isDark = theme === 'dark'
  const params = useParams<{ sport: string }>()
  const sport = OTHER_SPORTS.find((s) => s.id === params.sport)
  const label = sport?.label ?? params.sport

  return (
    <div className={`min-h-screen transition-colors duration-200 ${isDark ? 'bg-[#0B0B0B] text-white' : 'bg-[#F7F7F5] text-[#161616]'}`}>
      <ModernNavbar />

      <main className="max-w-3xl mx-auto px-4 pt-8 pb-24">
        <Link href="/deportes" className={`text-xs font-bold ${isDark ? 'text-neutral-400' : 'text-[#666]'} hover:text-[#E30613]`}>← Deportes</Link>
        <h1 className="text-3xl font-black mt-2 mb-4 capitalize">{label}</h1>

        <div className={`border border-dashed p-10 text-center ${isDark ? 'border-white/10' : 'border-[#E5E5E5]'}`}>
          <p className={`text-lg font-semibold mb-2 ${isDark ? 'text-white' : 'text-[#161616]'}`}>Próximamente.</p>
          <p className={`text-sm max-w-md mx-auto ${isDark ? 'text-neutral-400' : 'text-[#666]'}`}>
            Todavía no tenemos una fuente de datos en vivo para {label.toLowerCase()}. Cuando la tengamos, esta página mostrará resultados, calendarios y tablas reales -- igual que Fútbol.
          </p>
        </div>

        <Link href="/deportes/futbol" className="inline-block mt-6 text-xs font-bold text-[#E30613] hover:opacity-70">
          Ver Fútbol en vivo →
        </Link>
      </main>

      <Footer />
    </div>
  )
}
