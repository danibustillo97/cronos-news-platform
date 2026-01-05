import { MetadataRoute } from 'next';
import { supabase } from '@/lib/supabaseClient';
import slugify from 'slugify';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://www.nexusnews.info';

  // Obtener las últimas noticias para el sitemap
  const { data: news } = await supabase
    .from('news')
    .select('title, created_at')
    .order('created_at', { ascending: false })
    .limit(50);

  const newsUrls = (news || []).map((item) => ({
    url: `${baseUrl}/noticia/${slugify(item.title, { lower: true, strict: true })}`,
    lastModified: new Date(item.created_at),
    changeFrequency: 'daily' as const,
    priority: 0.8,
  }));

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'always',
      priority: 1,
    },
    ...newsUrls,
  ];
}
