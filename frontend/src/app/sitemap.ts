import { MetadataRoute } from 'next';
import { supabase } from '@/lib/supabaseClient';

// Bug real corregido: apuntaba a /noticias/[slug] (plural) -- la ruta
// real del portal es /noticia/[slug] (singular, ver src/app/noticia/).
// Toda URL de historia en el sitemap era un 404. También sacado el
// /noticias estático (esa página no existe).
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://www.nexusnews.info';

  const { data: news } = await supabase
    .from('news')
    .select('slug, published_at, updated_at')
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(1000);

  const newsUrls: MetadataRoute.Sitemap =
    (news ?? []).filter(item => item.slug).map((item) => ({
      url: `${baseUrl}/noticia/${item.slug}`,
      lastModified: item.updated_at || item.published_at || new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.8,
    }));

  const staticUrls: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: 'hourly', priority: 1 },
    { url: `${baseUrl}/deportes`, lastModified: new Date(), changeFrequency: 'hourly', priority: 0.9 },
    { url: `${baseUrl}/deportes/futbol`, lastModified: new Date(), changeFrequency: 'hourly', priority: 0.9 },
    { url: `${baseUrl}/deportes/futbol/tabla`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.6 },
    { url: `${baseUrl}/explorar`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.5 },
  ];

  return [...staticUrls, ...newsUrls];
}
