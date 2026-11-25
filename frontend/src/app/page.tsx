import PortalHome from '@/components/portal/PortalHome'
import { getHomeNews, getPortalLayoutServer } from '@/lib/homeData'
import { applyLayout, defaultLayout } from '@/lib/portalLayout'
import { jsonLdScript } from '@/lib/jsonLd'

// El home se renderiza en el servidor con la primera página de noticias.
// Esto deja titulares, enlaces y entidades editoriales en el HTML inicial.
export const revalidate = 60

const SITE = 'https://www.nexusnews.info'

export default async function HomePage() {
  const [news, layout] = await Promise.all([getHomeNews(), getPortalLayoutServer()])
  const ordered = news ? applyLayout(news, layout ?? defaultLayout()) : []
  const graph = [
    {
      '@type': 'Organization',
      '@id': `${SITE}/#organization`,
      name: 'Nexus News',
      url: SITE,
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE}/#website`,
      name: 'Nexus News',
      url: SITE,
      inLanguage: 'es-CO',
      publisher: { '@id': `${SITE}/#organization` },
    },
    ...(ordered.length > 0 ? [{
      '@type': 'ItemList',
      name: 'Portada de NEXUS News',
      itemListOrder: 'https://schema.org/ItemListOrderDescending',
      numberOfItems: Math.min(ordered.length, 20),
      itemListElement: ordered.slice(0, 20).map((n, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: `${SITE}/noticia/${encodeURIComponent(n.slug)}`,
        name: n.title,
      })),
    }] : []),
  ]
  const structuredData = { '@context': 'https://schema.org', '@graph': graph }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(structuredData) }} />
      <PortalHome initialNews={news} initialLayout={layout} />
    </>
  )
}
