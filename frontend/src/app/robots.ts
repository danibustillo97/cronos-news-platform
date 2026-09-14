import { MetadataRoute } from 'next';

// Bug real corregido: los bloques específicos para "Googlebot" y
// "Googlebot-News" (allow: '/', sin disallow) hacían que ESE crawler en
// particular ignorara el disallow del wildcard "*" -- un user-agent
// específico gana sobre el genérico, nunca se combinan. Resultado real:
// Googlebot tenía /admin/, /api/, etc. libres. Un solo bloque para todos.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/admin/',
        '/api/',
        '/_next/',
        '/auth/',
        '/dashboard/',
      ],
    },
    sitemap: 'https://www.nexusnews.info/sitemap.xml',
  };
}
