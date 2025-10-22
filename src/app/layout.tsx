import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import AppLayoutClient from './AppLayoutClient' // Importas el componente cliente

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
        <AppLayoutClient>{children}</AppLayoutClient>
      </body>
    </html>
  )
}
