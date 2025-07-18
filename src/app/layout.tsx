
import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Navbar from '@/components/Navbar'
import LiveScoresWidget from '@/components/widgets/LiveScoresWidget'
import StandingsWidget from '@/components/widgets/StandingsWidget'
import NewsFeed from '@/components/news/NewsFeed'
import RadioBar from '@/components/common/RadioBar'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'FutPulse - Noticias, Marcadores en Vivo y Más',
  description: 'Todo sobre fútbol en un solo lugar',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${inter.className} bg-neutral-950 text-white`}>
        {/* NAVBAR - ocupa 64px */}
        <div className="h-16">
          <Navbar />
        </div>

        {/* CONTENIDO PRINCIPAL: ASIDES + MAIN */}
        <div className="h-[calc(100vh-64px-64px)] flex overflow-hidden">
          {/* ASIDE IZQUIERDO */}
          <aside className="hidden lg:block w-[300px] border-r border-neutral-800 overflow-y-auto h-full p-4">
            <LiveScoresWidget />
          </aside>

          {/* CENTRO */}
          <main className="flex-1 overflow-y-auto h-full p-4 max-w-3xl mx-auto">
        
            {children}
          </main>

          {/* ASIDE DERECHO */}
          <aside className="hidden xl:block w-[300px] border-l border-neutral-800 overflow-y-auto h-full p-4">
            <StandingsWidget />
          </aside>
        </div>

        {/* BARRA INFERIOR - RADIO - ocupa 64px */}
        <div className="h-16">
          <RadioBar />
        </div>
      </body>
    </html>
  )
}
