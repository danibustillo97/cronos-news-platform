
// Simple in-memory cache to prevent loading spinners on navigation
// This resets on page reload, which is fine
export const newsCache = {
  data: [] as any[],
  timestamp: 0,
  isValid: false
};

export const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const getCachedNews = () => {
  if (!newsCache.isValid) return null;
  // We can add time-based expiry if needed, but for now just returning data is fast
  return newsCache.data;
};

export const setCachedNews = (data: any[]) => {
  newsCache.data = data;
  newsCache.timestamp = Date.now();
  newsCache.isValid = true;
};

export const updateCachedItem = (item: any) => {
  if (!newsCache.isValid) return;
  const index = newsCache.data.findIndex(n => n.id === item.id);
  if (index >= 0) {
    newsCache.data[index] = { ...newsCache.data[index], ...item };
  } else {
    newsCache.data.unshift(item);
  }
};

export const removeCachedItem = (id: string) => {
  if (!newsCache.isValid) return;
  newsCache.data = newsCache.data.filter(n => n.id !== id);
};
