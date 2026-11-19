import { supabase } from '@/lib/supabaseClient';
import type { LayoutMode, NewsItem } from '@/studio/shared/types';

export async function fetchLatestNews(limit = 20): Promise<NewsItem[]> {
  const { data } = await supabase
    .from('news')
    .select('id, title, image_url, category, created_at, slug, content')
    .order('created_at', { ascending: false })
    .limit(limit);

  return data ?? [];
}

export const resolveLayoutForNews = (news: NewsItem): Exclude<LayoutMode, 'auto'> => {
  const category = news.category.toLowerCase();
  const titleLength = news.title.length;

  if (category.includes('urgente') || category.includes('breaking')) {
    return 'breaking';
  }

  if (category.includes('deporte') || category.includes('fútbol')) {
    return 'overlay';
  }

  if (titleLength > 90) {
    return 'split';
  }

  return 'overlay';
};
