/* NEXUS service worker (escrito a mano, sin dependencias).
 * - Estáticos (/_next/static, /icons, fuentes, imágenes): caché primero.
 * - Páginas y /api: red primero; sin red, lo último guardado o "Sin conexión".
 * Solo se registra en producción o con NEXT_PUBLIC_ENABLE_SW=1. */
const VERSION = 'nexus-v2'
const STATIC = `${VERSION}-static`
const PAGES = `${VERSION}-pages`
const SHELL = ['/offline.html', '/favicon.svg', '/brand/nexus-symbol.svg', '/manifest.webmanifest']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(STATIC).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

function isStatic(url) {
  return url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/') || /\.(?:woff2?|png|svg|ico|webp)$/.test(url.pathname)
}

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/admin') || url.pathname.startsWith('/api/auth')) return

  if (isStatic(url)) {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(STATIC).then((c) => c.put(req, copy)) }
        return res
      })),
    )
    return
  }

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && (req.mode === 'navigate' || url.pathname.startsWith('/api/'))) {
          const copy = res.clone()
          caches.open(PAGES).then((c) => c.put(req, copy))
        }
        return res
      })
      .catch(async () => {
        const hit = await caches.match(req)
        if (hit) return hit
        if (req.mode === 'navigate') return (await caches.match('/offline.html')) || Response.error()
        return new Response(JSON.stringify({ detail: 'Sin conexión' }), { status: 503, headers: { 'Content-Type': 'application/json' } })
      }),
  )
})
