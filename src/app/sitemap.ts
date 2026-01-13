import { MetadataRoute } from 'next';
import { supabase } from '@/lib/supabaseClient';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://www.nexusnews.info';

  const { data: news } = await supabase
    .from('news')
    .select('slug, updated_at')
    .eq('status', 'published')
    .order('updated_at', { ascending: false })
    .limit(100);

  const newsUrls =
    news?.map((item) => ({
      url: `${baseUrl}/noticias/${item.slug}`,
      lastModified: item.updated_at ?? new Date(),
      changeFrequency: 'hourly' as const,
      priority: 0.9,
    })) ?? [];

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 1,
    },
    {
      url: `${baseUrl}/noticias`,
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 0.9,
    },
    ...newsUrls,
  ];
}
