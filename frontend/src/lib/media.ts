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
