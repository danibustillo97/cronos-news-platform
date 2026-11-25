import { MetadataRoute } from 'next'
import { supabase } from '@/lib/supabaseClient'

// The standard sitemap retains permanent published article URLs, including
// older stories that have left the live-news feed. Expiration never deletes
// an article or its canonical URL.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://www.nexusnews.info'
  const { data: news } = await supabase
    .from('news')
    .select('slug, published_at, updated_at')
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(1000)

  const newsUrls: MetadataRoute.Sitemap = (news ?? []).filter(item => item.slug).map(item => ({
    url: `${baseUrl}/noticia/${encodeURIComponent(item.slug)}`,
    lastModified: item.updated_at || item.published_at || new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }))

  const staticUrls: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: 'hourly', priority: 1 },
    { url: `${baseUrl}/deportes`, lastModified: new Date(), changeFrequency: 'hourly', priority: 0.9 },
    { url: `${baseUrl}/deportes/futbol`, lastModified: new Date(), changeFrequency: 'hourly', priority: 0.9 },
    { url: `${baseUrl}/deportes/futbol/tabla`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.6 },
    { url: `${baseUrl}/explorar`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.5 },
    { url: `${baseUrl}/archivo`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.6 },
    { url: `${baseUrl}/encuestas`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.6 },
    { url: `${baseUrl}/jugadores`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.6 },
    { url: `${baseUrl}/privacy`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${baseUrl}/terms`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${baseUrl}/cookies`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${baseUrl}/about`, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${baseUrl}/corrections`, changeFrequency: 'monthly', priority: 0.4 },
  ]

  return [...staticUrls, ...newsUrls]
}
