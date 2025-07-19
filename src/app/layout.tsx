import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Navbar from '@/components/Navbar'
import LiveScoresWidget from '@/components/widgets/LiveScoresWidget'
import StandingsWidget from '@/components/widgets/StandingsWidget'
import RadioBar from '@/components/common/RadioBar'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'FutPulse - Noticias, Marcadores en Vivo y Más',
  description: 'Todo sobre fútbol en un solo lugar',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        {/* Google AdSense */}
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-9550834544643550"
          crossOrigin="anonymous"
        ></script>
      </head>

      <body className={`${inter.className} bg-neutral-950 text-white selection:bg-yellow-400 selection:text-black overflow-x-hidden max-w-full`}>

        {/* NAVBAR */}
        <header className="h-16 shadow-md bg-neutral-950 border-b border-neutral-800 z-50 sticky top-0">
          <Navbar />
        </header>

        {/* SLIDER DE MARCADORES EN MÓVIL */}
        <section className="lg:hidden w-full border-y border-neutral-800 overflow-x-auto py-2 scrollbar-hide backdrop-blur-sm bg-neutral-950/90">
          <div className="flex gap-4 px-4 animate-fade-in">
            <LiveScoresWidget horizontal />
          </div>
        </section>

        {/* CONTENIDO PRINCIPAL */}
        <div className="flex h-[calc(100vh-64px-64px)] overflow-hidden">
          {/* ASIDE IZQUIERDO */}
          <aside className="hidden custom-scroll overflow-y-auto lg:block w-[240px] border-r border-neutral-800 overflow-y-auto h-full p-3 bg-neutral-950 custom-scroll">
            <LiveScoresWidget />
          </aside>

          {/* CONTENIDO CENTRAL */}
          <main className="flex-1 overflow-y-auto overflow-x-hidden h-full p-4 md:px-6 max-w-3xl mx-auto">

            {children}
          </main>

          {/* ASIDE DERECHO */}
          <aside className="hidden xl:block w-[240px] border-l border-neutral-800 overflow-y-auto h-full p-3 bg-neutral-950">
            <StandingsWidget />
          </aside>
        </div>

        {/* BARRA DE RADIO */}
        <footer className="h-16 shadow-inner border-t border-neutral-800 bg-neutral-950 z-50">
          <RadioBar />
        </footer>
      </body>
    </html>
  )
}
