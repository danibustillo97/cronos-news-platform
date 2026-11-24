import PortalHome from '@/components/portal/PortalHome'
import { getHomeNews, getPortalLayoutServer } from '@/lib/homeData'
import { applyLayout, defaultLayout } from '@/lib/portalLayout'
import { jsonLdScript } from '@/lib/jsonLd'

// El home se renderiza en el servidor con la primera página de noticias
// (SEO: enlaces y titulares en el HTML inicial) y se regenera cada minuto.
export const revalidate = 60

const SITE = 'https://www.nexusnews.info'

export default async function HomePage() {
  const [news, layout] = await Promise.all([getHomeNews(), getPortalLayoutServer()])
  const ordered = news ? applyLayout(news, layout ?? defaultLayout()) : []
  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Portada de NEXUS News',
    itemListOrder: 'https://schema.org/ItemListOrderDescending',
    numberOfItems: Math.min(ordered.length, 20),
    itemListElement: ordered.slice(0, 20).map((n, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${SITE}/noticia/${n.slug}`,
      name: n.title,
    })),
  }
  return (
    <>
      {ordered.length > 0 && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(itemList) }} />
      )}
      <PortalHome initialNews={news} initialLayout={layout} />
    </>
  )
}
