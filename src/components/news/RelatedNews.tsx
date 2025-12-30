"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import NewsCard from '@/components/news/NewsCard';
import { RefreshCw } from 'lucide-react';

interface News {
  id: string;
  title: string;
  subtitle?: string;
  content: string;
  excerpt?: string;
  image_url: string;
  published_at: string;
  category?: string;
  slug: string;
  status?: string;
}

interface RelatedNewsProps {
  currentNewsId: string;
  category?: string;
  onNewsClick: (news: News) => void;
}

export default function RelatedNews({ currentNewsId, category, onNewsClick }: RelatedNewsProps) {
  const [relatedNews, setRelatedNews] = useState<News[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRelated = async () => {
      setLoading(true);
      try {
        let query = supabase
          .from('news')
          .select('*')
          .eq('status', 'published')
          .neq('id', currentNewsId) // Exclude current news
          .limit(4);

        // First try to fetch by same category
        if (category) {
            const { data: categoryData } = await query.eq('category', category);
            
            // If we have enough category matches, use them
            if (categoryData && categoryData.length >= 3) {
                setRelatedNews(categoryData);
                setLoading(false);
                return;
            }
        }

        // If not enough category matches or no category, fetch latest general news
        // Reset query for general fetch
        const { data: generalData } = await supabase
            .from('news')
            .select('*')
            .eq('status', 'published')
            .neq('id', currentNewsId)
            .order('published_at', { ascending: false })
            .limit(4);
            
        setRelatedNews(generalData || []);

      } catch (error) {
        console.error("Error fetching related news:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchRelated();
  }, [currentNewsId, category]);

  if (loading) return (
    <div className="flex justify-center py-12">
        <RefreshCw className="animate-spin text-neutral-400" />
    </div>
  );

  if (relatedNews.length === 0) return null;

  return (
    <div className="mt-16 pt-12 border-t border-neutral-200">
      <h3 className="text-2xl font-black text-neutral-900 mb-8 flex items-center gap-3">
        <span className="w-1.5 h-8 bg-red-600 rounded-full"></span>
        Podría interesarte
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
        {relatedNews.map((news) => (
          <div key={news.id} className="h-full transform transition-all hover:scale-[1.02]">
            <NewsCard 
                news={news} 
                onClick={() => onNewsClick(news)}
                darkMode={false}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
