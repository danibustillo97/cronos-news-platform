import './globals.css'
import type { Metadata } from 'next'
import { Inter, Source_Serif_4 } from 'next/font/google'
import AppLayoutClient from './AppLayoutClient'
import { apiUrl } from '@/studio/lab/api-client'

const inter = Inter({ subsets: ['latin'] })

// Editorial display serif -- headlines only (lead story, section leads).
// Never replaces Inter for nav/metadata/UI, per the homepage redesign's
// typographic hierarchy: serif for editorial voice, sans for chrome.
const sourceSerif = Source_Serif_4({ subsets: ['latin'], variable: '--font-serif', weight: ['600', '700', '900'] })

// Site title/description/keywords are editable from /admin (AdminSeoTags,
// backed by GET/PUT /api/settings/seo) -- these constants are ONLY the
// fallback used if that fetch fails, so a backend outage never breaks the
// site's <head>. They must never drift into being treated as the source
// of truth again; the real values live in Supabase's `site_settings` row.
const FALLBACK_SEO = {
  title: 'Nexus News | Noticias Deportivas al Instante',
  description: 'El mejor portal de noticias deportivas con análisis IA en tiempo real. Cobertura de fútbol, NBA, F1 y más.',
  keywords: ['deportes', 'noticias', 'fútbol', 'NBA', 'F1', 'resultados en vivo'],
}

async function getSeoSettings(): Promise<{ title: string; description: string; keywords: string[] }> {
  try {
    const res = await fetch(apiUrl('/api/settings/seo'), { next: { revalidate: 60 } })
    if (!res.ok) return FALLBACK_SEO
    const data = await res.json()
    return { title: data.siteTitle, description: data.metaDescription, keywords: data.keywords }
  } catch {
    return FALLBACK_SEO
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const seo = await getSeoSettings()
  return {
  metadataBase: new URL('https://www.nexusnews.info'),
  title: {
    default: seo.title,
    template: '%s | Nexus News'
  },
  description: seo.description,
  keywords: seo.keywords,
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
      <body className={`${inter.className} ${sourceSerif.variable} bg-neutral-950 text-white selection:bg-yellow-400 selection:text-black overflow-x-hidden max-w-full`}>
        <AppLayoutClient>{children}</AppLayoutClient>
      </body>
    </html>
  )
}
