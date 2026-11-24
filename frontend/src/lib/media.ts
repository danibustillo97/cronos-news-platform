// Las imágenes reales del portal vienen de decenas de dominios de scraping
// distintos (ver next.config.ts -- solo tiene whitelisteados unos pocos
// sitios de deportes). Pasarlas por el proxy same-origin existente
// (/api/proxy-image, ya usado por Content Studio) deja usar next/image de
// verdad (object-fit, sizes, responsive, sin deformar/cortar) sin tener
// que whitelistear cada dominio nuevo cada vez que aparece una fuente.
export function proxiedImage(url: string | null | undefined): string | null {
  if (!url) return null
  if (url.startsWith('/api/proxy-image')) return url
  if (url.startsWith('/')) return url // asset local, no hace falta proxy
  return `/api/proxy-image?url=${encodeURIComponent(url)}`
}

/**
 * Fuente para mostrar una imagen sin "doble salto": las de nuestro
 * almacenamiento de Supabase van directo (sin proxy ni optimizador, ya
 * vienen comprimidas); las de terceros siguen por el proxy same-origin.
 */
export function imageSource(url: string | null | undefined): { src: string; direct: boolean } | null {
  if (!url) return null
  if (url.startsWith('/')) return { src: url, direct: true }
  try {
    const u = new URL(url)
    const supa = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host : null
    if (u.protocol === 'https:' && ((supa && u.host === supa) || u.host.endsWith('.supabase.co')) && u.pathname.startsWith('/storage/v1/object/public/')) {
      return { src: u.toString(), direct: true }
    }
  } catch {
    return null
  }
  const proxied = proxiedImage(url)
  return proxied ? { src: proxied, direct: false } : null
}
