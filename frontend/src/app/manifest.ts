import type { MetadataRoute } from 'next'

// App instalable (Android/escritorio). iOS usa además apple-touch-icon y
// las metas appleWebApp de app/layout.tsx.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'NEXUS News',
    short_name: 'NEXUS',
    description: 'Noticias deportivas, partidos en directo, análisis y datos de Colombia y el mundo.',
    id: '/?app=nexus',
    start_url: '/?source=pwa',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0B0D0F',
    theme_color: '#0B0D0F',
    lang: 'es-CO',
    categories: ['sports', 'news'],
    icons: [
      { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    ],
    shortcuts: [
      { name: 'Partidos', url: '/deportes/futbol?view=matches', icons: [{ src: '/favicon.svg', sizes: 'any' }] },
      { name: 'Tablas', url: '/deportes/futbol/tabla', icons: [{ src: '/favicon.svg', sizes: 'any' }] },
    ],
  }
}
