import { useCallback, useEffect, useState } from 'react';
import type { NewsItem } from '@/studio/shared/types';
import { fetchLatestNews } from './news.engine';

/**
 * `onSelect` fires for both explicit selection and the initial auto-select
 * of the newest article, so callers can drive title/script side effects
 * from a single place.
 */
export function useNews(onSelect: (item: NewsItem) => void) {
  const [searchTerm, setSearchTerm] = useState('');
  const [news, setNews] = useState<NewsItem[]>([]);
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null);

  const handleNewsSelect = useCallback(
    (item: NewsItem) => {
      setSelectedNews(item);
      onSelect(item);
    },
    [onSelect]
  );

  useEffect(() => {
    let cancelled = false;

    fetchLatestNews()
      .then(data => {
        if (cancelled || data.length === 0) {
          return;
        }
        setNews(data);
        setSelectedNews(current => {
          if (current) {
            return current;
          }
          onSelect(data[0]);
          return data[0];
        });
      })
      .catch(error => console.error('[Studio] Failed to load news', error));

    return () => {
      cancelled = true;
    };
    // Runs once on mount — onSelect is only needed for the initial auto-select.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { searchTerm, setSearchTerm, news, selectedNews, setSelectedNews, handleNewsSelect };
}
