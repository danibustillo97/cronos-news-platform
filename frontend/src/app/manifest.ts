import type { MetadataRoute } from 'next'

// App instalable (Android/escritorio). iOS usa además apple-touch-icon y
// las metas appleWebApp de app/layout.tsx.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'NEXUS Fútbol',
    short_name: 'NEXUS',
    description: 'Noticias, partidos en vivo, tablas y datos del fútbol de Colombia y el mundo.',
    id: '/?app=nexus',
    start_url: '/?source=pwa',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0a0a0a',
    theme_color: '#0a0a0a',
    lang: 'es-CO',
    categories: ['sports', 'news'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Partidos', url: '/deportes/futbol?view=matches', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
      { name: 'Tablas', url: '/deportes/futbol/tabla', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
    ],
  }
}
