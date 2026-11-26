import type { Metadata } from 'next'
import PortalHome from '@/components/portal/PortalHome'
import { getHomeNews, getPortalLayoutServer } from '@/lib/homeData'
import { applyLayout, defaultLayout } from '@/lib/portalLayout'
import { jsonLdScript } from '@/lib/jsonLd'

// El home se renderiza en el servidor con la primera página de noticias.
// Esto deja titulares, enlaces y entidades editoriales en el HTML inicial.
export const revalidate = 60

const SITE = 'https://www.nexusnews.info'

export const metadata: Metadata = {
  title: 'NEXUS News: fútbol colombiano, Liga BetPlay y noticias',
  description: 'Noticias de fútbol colombiano e internacional, Liga BetPlay, partidos y resultados. El fútbol, más allá del marcador: actualidad con datos, contexto y debate.',
  alternates: { canonical: SITE },
  openGraph: {
    type: 'website',
    locale: 'es_CO',
    siteName: 'NEXUS News',
    title: 'NEXUS News: fútbol colombiano, Liga BetPlay y noticias',
    description: 'Actualidad del fútbol colombiano e internacional, resultados, datos y debates para el hincha.',
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'NEXUS News: el fútbol, más allá del marcador' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'NEXUS News: fútbol colombiano y Liga BetPlay',
    description: 'Actualidad, datos y debate del fútbol colombiano e internacional.',
    images: ['/opengraph-image'],
  },
}

export default async function HomePage() {
  const [news, layout] = await Promise.all([getHomeNews(), getPortalLayoutServer()])
  const ordered = news ? applyLayout(news, layout ?? defaultLayout()) : []
  const graph = [
    {
      '@type': 'NewsMediaOrganization',
      '@id': `${SITE}/#organization`,
      name: 'NEXUS News',
      url: SITE,
      slogan: 'El fútbol, más allá del marcador.',
      description: 'Medio digital deportivo en español para Colombia y Latinoamérica: noticias, resultados, datos, perfiles y debates de fútbol.',
      logo: { '@type': 'ImageObject', url: `${SITE}/brand/nexus-symbol.svg` },
      publishingPrinciples: `${SITE}/about#principios-editoriales`,
      correctionsPolicy: `${SITE}/corrections`,
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
