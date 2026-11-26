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

  // Static URLs omit lastModified: generating a sitemap is not a page update.
  // Article URLs below use real database timestamps only.
  const staticUrls: MetadataRoute.Sitemap = [
    { url: baseUrl, changeFrequency: 'hourly', priority: 1 },
    { url: `${baseUrl}/deportes`, changeFrequency: 'hourly', priority: 0.9 },
    { url: `${baseUrl}/deportes/futbol`, changeFrequency: 'hourly', priority: 0.9 },
    { url: `${baseUrl}/deportes/futbol/tabla`, changeFrequency: 'daily', priority: 0.6 },
    { url: `${baseUrl}/explorar`, changeFrequency: 'weekly', priority: 0.5 },
    { url: `${baseUrl}/archivo`, changeFrequency: 'daily', priority: 0.6 },
    { url: `${baseUrl}/encuestas`, changeFrequency: 'daily', priority: 0.6 },
    { url: `${baseUrl}/jugadores`, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${baseUrl}/privacy`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${baseUrl}/terms`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${baseUrl}/cookies`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${baseUrl}/about`, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${baseUrl}/corrections`, changeFrequency: 'monthly', priority: 0.4 },
  ]

  return [...staticUrls, ...newsUrls]
}
