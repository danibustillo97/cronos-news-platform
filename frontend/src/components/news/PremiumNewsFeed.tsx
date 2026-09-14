'use client';

import React, { useEffect, useState } from "react";
import { stripHtml, truncateText } from "@/lib/textUtils";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Heart, 
  MessageCircle, 
  Share2, 
  Bookmark, 
  Eye,
  Clock,
  TrendingUp,
  Star,
  Play,
  ChevronRight,
  Filter,
  Search,
  Grid,
  List,
  Zap
} from "lucide-react";

interface News {
  id: string;
  title: string;
  subtitle?: string;
  content: string;
  excerpt?: string;
  image_url: string;
  images?: string[];
  published_at: string;
  category?: string;
  author?: string;
  slug: string;
  tags?: string[];
  likes: number;
  comments: number;
  shares: number;
  views: number;
  trending?: boolean;
  featured?: boolean;
}

function timeAgo(date: string) {
  const now = new Date();
  const past = new Date(date);
  const diffMs = now.getTime() - past.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Ahora";
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 30) return `${diffDays}d`;
  return new Date(date).toLocaleDateString('es-CO');
}

function enhanceNewsData(news: News[]): News[] {
  return news.map(n => ({
    ...n,
    images: [
      n.image_url,
      `https://picsum.photos/800/600?random=${n.id}1`,
      `https://picsum.photos/800/600?random=${n.id}2`
    ].slice(0, Math.floor(Math.random() * 3) + 1),
    likes: Math.floor(Math.random() * 2500) + 100,
    comments: Math.floor(Math.random() * 150) + 10,
    shares: Math.floor(Math.random() * 80) + 5,
    views: Math.floor(Math.random() * 15000) + 500,
    trending: Math.random() > 0.7,
    featured: Math.random() > 0.8
  }));
}

function PremiumNewsCard({ news, layout = 'grid' }: { news: News, layout?: 'grid' | 'list' }) {
  const [liked, setLiked] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [localLikes, setLocalLikes] = useState(news.likes);

  const handleLike = () => {
    setLiked(!liked);
    setLocalLikes(prev => liked ? prev - 1 : prev + 1);
  };

  if (layout === 'list') {
    return (
      <motion.article
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 group cursor-pointer hover:border-yellow-500/30 transition-all duration-300"
      >
        <div className="flex gap-4">
          <div className="relative w-32 h-24 rounded-lg overflow-hidden flex-shrink-0">
            <motion.img
              whileHover={{ scale: 1.05 }}
              transition={{ duration: 0.6 }}
              src={news.image_url}
              alt={news.title}
              className="w-full h-full object-cover"
            />
            {news.trending && (
              <div className="absolute top-1 left-1 bg-yellow-500 text-black px-1.5 py-0.5 rounded text-xs font-bold">
                🔥
              </div>
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2 mb-2">
              <span className="text-xs font-bold text-yellow-400 uppercase">
                {news.category || 'Deportes'}
              </span>
              <span className="text-gray-400">•</span>
              <span className="text-xs text-gray-400 flex items-center space-x-1">
                <Clock className="w-3 h-3" />
                <span>{timeAgo(news.published_at)}</span>
              </span>
            </div>
            
            <h3 className="text-base font-bold text-white mb-2 group-hover:text-yellow-400 transition-colors line-clamp-2">
              {news.title}
            </h3>
            
            <p className="text-gray-300 text-sm line-clamp-2 mb-3">
              {news.content.substring(0, 100)}...
            </p>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3 text-sm text-gray-400">
                <div className="flex items-center space-x-1">
                  <Heart className="w-4 h-4" />
                  <span>{localLikes.toLocaleString()}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <MessageCircle className="w-4 h-4" />
                  <span>{news.comments}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Share2 className="w-4 h-4" />
                  <span>{news.shares}</span>
                </div>
              </div>
              
              <div className="flex items-center space-x-1">
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={handleLike}
                  className={`p-1.5 rounded-lg transition-colors ${
                    liked ? 'bg-yellow-500 text-black' : 'bg-gray-700 hover:bg-gray-600'
                  }`}
                >
                  <Heart className={`w-4 h-4 ${liked ? 'fill-current' : ''}`} />
                </motion.button>
                
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setBookmarked(!bookmarked)}
                  className={`p-1.5 rounded-lg transition-colors ${
                    bookmarked ? 'bg-yellow-500 text-black' : 'bg-gray-700 hover:bg-gray-600'
                  }`}
                >
                  <Bookmark className={`w-4 h-4 ${bookmarked ? 'fill-current' : ''}`} />
                </motion.button>
              </div>
            </div>
          </div>
        </div>
      </motion.article>
    );
  }

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 group cursor-pointer hover:border-yellow-500/30 transition-all duration-300"
    >
      <div className="relative mb-3">
        <motion.img
          whileHover={{ scale: 1.05 }}
          transition={{ duration: 0.6 }}
          src={news.image_url}
          alt={news.title}
          className="w-full h-40 object-cover rounded-lg"
        />
        
        {news.trending && (
          <div className="absolute top-2 left-2 bg-yellow-500 text-black px-2 py-1 rounded text-xs font-bold">
            🔥
          </div>
        )}
      </div>
      
      <div className="space-y-3">
        <div className="flex items-center space-x-2">
          <span className="text-xs font-bold text-yellow-400 uppercase">
            {news.category || 'Deportes'}
          </span>
          <span className="text-gray-400">•</span>
          <span className="text-xs text-gray-400 flex items-center space-x-1">
            <Clock className="w-3 h-3" />
            <span>{timeAgo(news.published_at)}</span>
          </span>
        </div>
        
        <div>
            <h3 className="text-xl font-bold text-white mb-2 group-hover:text-yellow-400 transition-colors line-clamp-2 leading-tight">
            {news.title}
            </h3>
            {news.subtitle && (
                <h4 className="text-sm font-medium text-gray-400 mb-2 line-clamp-2">
                    {news.subtitle}
                </h4>
            )}
            <p className="text-gray-300 text-sm line-clamp-3 leading-relaxed">
            {news.excerpt || truncateText(stripHtml(news.content), 120)}
            </p>
        </div>
        
        <div className="flex items-center justify-between pt-3 border-t border-gray-700">
          <div className="flex items-center space-x-3 text-sm text-gray-400">
            <div className="flex items-center space-x-1">
              <Heart className="w-4 h-4" />
              <span>{localLikes.toLocaleString()}</span>
            </div>
            <div className="flex items-center space-x-1">
              <MessageCircle className="w-4 h-4" />
              <span>{news.comments}</span>
            </div>
            <div className="flex items-center space-x-1">
              <Share2 className="w-4 h-4" />
              <span>{news.shares}</span>
            </div>
          </div>
          
          <div className="flex items-center space-x-1">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={handleLike}
              className={`p-1.5 rounded-lg transition-colors ${
                liked ? 'bg-yellow-500 text-black' : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              <Heart className={`w-4 h-4 ${liked ? 'fill-current' : ''}`} />
            </motion.button>
            
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setBookmarked(!bookmarked)}
              className={`p-1.5 rounded-lg transition-colors ${
                bookmarked ? 'bg-yellow-500 text-black' : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              <Bookmark className={`w-4 h-4 ${bookmarked ? 'fill-current' : ''}`} />
            </motion.button>
          </div>
        </div>
      </div>
    </motion.article>
  );
}

import { supabase } from '@/lib/supabaseClient';

export default function PremiumNewsFeed() {
  const [news, setNews] = useState<News[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');
  const [layout, setLayout] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');

  const categories = [
    { id: 'all', name: 'Todas', icon: Grid },
    { id: 'deportes', name: 'Deportes', icon: TrendingUp },
    { id: 'futbol', name: 'Fútbol', icon: Star },
    { id: 'tecnologia', name: 'Tecnología', icon: Zap },
  ];

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase
            .from('news')
            .select('*')
            .eq('status', 'published')
            .order('published_at', { ascending: false });

        if (error) throw error;
        
        if (data) {
          // Cast data to News[] and handle any missing fields gracefully if needed
          setNews(enhanceNewsData(data as any[]));
        }
      } catch (e) {
        console.error("Failed to fetch news:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filteredNews = news.filter(n => {
    const matchesCategory = activeFilter === 'all' || n.category?.toLowerCase() === activeFilter;
    const matchesSearch = searchQuery === '' || 
      n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.content.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const featuredNews = filteredNews.filter(n => n.featured);
  const regularNews = filteredNews.filter(n => !n.featured);

  return (
    <div className="space-y-8">
      {/* Header Simple */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="flex items-center justify-between mb-6"
      >
        <h1 className="text-2xl font-bold text-white">
          Noticias
        </h1>
        <div className="text-sm text-gray-400">
          {filteredNews.length} publicaciones
        </div>
      </motion.div>

      {/* Controls */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="flex flex-col sm:flex-row gap-4 items-center justify-between"
      >
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:border-yellow-500 focus:outline-none transition-colors text-sm"
          />
        </div>

        {/* Layout Toggle */}
        <div className="flex items-center space-x-1">
          <button
            onClick={() => setLayout('list')}
            className={`p-2 rounded-lg transition-colors ${
              layout === 'list' ? 'bg-yellow-500 text-black' : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            <List className="w-4 h-4" />
          </button>
          <button
            onClick={() => setLayout('grid')}
            className={`p-2 rounded-lg transition-colors ${
              layout === 'grid' ? 'bg-yellow-500 text-black' : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            <Grid className="w-4 h-4" />
          </button>
        </div>
      </motion.div>

      {/* Categories */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.3 }}
        className="flex gap-2 overflow-x-auto scrollbar-hide pb-2"
      >
        {categories.map((cat) => (
          <motion.button
            key={cat.id}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setActiveFilter(cat.id)}
            className={`flex items-center space-x-2 px-3 py-2 rounded-lg font-medium transition-all duration-300 whitespace-nowrap ${
              activeFilter === cat.id
                ? 'bg-yellow-500 text-black'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            <cat.icon className="w-4 h-4" />
            <span className="text-sm">{cat.name}</span>
          </motion.button>
        ))}
      </motion.div>

      {/* Content */}
      {loading ? (
        <div className={layout === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' : 'space-y-4'}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 animate-pulse">
              <div className="h-40 bg-gray-700 rounded-lg mb-3"></div>
              <div className="space-y-2">
                <div className="h-3 bg-gray-700 rounded w-1/3"></div>
                <div className="h-4 bg-gray-700 rounded"></div>
                <div className="h-3 bg-gray-700 rounded w-2/3"></div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className={layout === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' : 'space-y-4'}>
          {filteredNews.map((n) => (
            <PremiumNewsCard key={n.id} news={n} layout={layout} />
          ))}
          
          {filteredNews.length === 0 && (
            <div className="text-center py-20 col-span-full">
              <div className="w-16 h-16 bg-gray-800 rounded-xl mx-auto mb-4 flex items-center justify-center">
                <span className="text-gray-600 text-xl">📰</span>
              </div>
              <p className="text-gray-400 font-medium">No se encontraron noticias.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
