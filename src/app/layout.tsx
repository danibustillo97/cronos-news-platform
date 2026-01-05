import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import AppLayoutClient from './AppLayoutClient' // Importas el componente cliente

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  metadataBase: new URL('https://www.nexusnews.info'),
  title: {
    default: 'Nexus News | Noticias Deportivas al Instante',
    template: '%s | Nexus News'
  },
  description: 'El mejor portal de noticias deportivas con análisis IA en tiempo real. Cobertura de fútbol, NBA, F1 y más.',
  keywords: ['deportes', 'noticias', 'fútbol', 'NBA', 'F1', 'resultados en vivo'],
  authors: [{ name: 'Nexus News Team' }],
  creator: 'Nexus News',
  publisher: 'Nexus News',
  openGraph: {
    type: 'website',
    locale: 'es_ES',
    url: 'https://www.nexusnews.info',
    title: 'Nexus News | Noticias Deportivas al Instante',
    description: 'El mejor portal de noticias deportivas con análisis IA en tiempo real.',
    siteName: 'Nexus News',
    images: [
      {
        url: '/og-image.jpg', // Asegúrate de tener esta imagen en public/
        width: 1200,
        height: 630,
        alt: 'Nexus News - Noticias Deportivas',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Nexus News | Noticias Deportivas',
    description: 'Noticias deportivas al instante con IA.',
    creator: '@nexusnews',
    images: ['/og-image.jpg'],
  },
  verification: {
    google: 'tu-codigo-de-verificacion-google', // Placeholder
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
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
