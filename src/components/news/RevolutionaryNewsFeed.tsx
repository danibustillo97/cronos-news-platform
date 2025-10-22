'use client';

import React, { useEffect, useState } from "react";
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
  Zap,
  ThumbsUp,
  Send,
  MoreHorizontal,
  User,
  Calendar,
  Tag
} from "lucide-react";

interface News {
  id: string;
  title: string;
  content: string;
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
  video?: boolean;
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
    featured: Math.random() > 0.8,
    video: Math.random() > 0.6
  }));
}

function RevolutionaryNewsCard({ news, layout = 'grid' }: { news: News, layout?: 'grid' | 'list' }) {
  const [liked, setLiked] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [localLikes, setLocalLikes] = useState(news.likes);
  const [commentText, setCommentText] = useState('');

  const handleLike = () => {
    setLiked(!liked);
    setLocalLikes(prev => liked ? prev - 1 : prev + 1);
  };

  const handleComment = () => {
    if (commentText.trim()) {
      setCommentText('');
      setShowComments(false);
    }
  };

  if (layout === 'list') {
    return (
      <motion.article
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="bg-gradient-to-r from-gray-800/50 to-gray-900/50 border border-gray-700/50 rounded-2xl p-6 group cursor-pointer hover:border-yellow-500/30 transition-all duration-500 backdrop-blur-sm"
      >
        <div className="flex gap-6">
          <div className="relative w-48 h-32 rounded-2xl overflow-hidden flex-shrink-0">
            <motion.img
              whileHover={{ scale: 1.05 }}
              transition={{ duration: 0.6 }}
              src={news.image_url}
              alt={news.title}
              className="w-full h-full object-cover"
            />
            {news.trending && (
              <div className="absolute top-3 left-3 bg-gradient-to-r from-red-500 to-red-600 text-white px-3 py-1 rounded-xl text-xs font-bold flex items-center space-x-1">
                <TrendingUp className="w-3 h-3" />
                <span>TRENDING</span>
              </div>
            )}
            {news.video && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <motion.div
                  whileHover={{ scale: 1.1 }}
                  className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center"
                >
                  <Play className="w-6 h-6 text-white ml-1" />
                </motion.div>
              </div>
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-3 mb-3">
              <span className="text-xs font-bold text-yellow-400 uppercase tracking-wider bg-yellow-400/10 px-2 py-1 rounded-lg">
                {news.category || 'Deportes'}
              </span>
              <span className="text-gray-400">•</span>
              <span className="text-xs text-gray-400 flex items-center space-x-1">
                <Clock className="w-3 h-3" />
                <span>{timeAgo(news.published_at)}</span>
              </span>
              {news.featured && (
                <span className="text-xs font-bold text-purple-400 bg-purple-400/10 px-2 py-1 rounded-lg flex items-center space-x-1">
                  <Star className="w-3 h-3" />
                  <span>DESTACADO</span>
                </span>
              )}
            </div>
            
            <h3 className="text-xl font-bold text-white mb-3 group-hover:text-yellow-400 transition-colors line-clamp-2">
              {news.title}
            </h3>
            
            <p className="text-gray-300 text-sm line-clamp-2 mb-4 leading-relaxed">
              {news.content.substring(0, 150)}...
            </p>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4 text-sm text-gray-400">
                <div className="flex items-center space-x-1">
                  <Eye className="w-4 h-4" />
                  <span>{news.views.toLocaleString()}</span>
                </div>
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
              
              <div className="flex items-center space-x-2">
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={handleLike}
                  className={`p-2 rounded-xl transition-all duration-300 ${
                    liked ? 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg shadow-red-500/30' : 'bg-gray-700/50 hover:bg-gray-600/50 text-gray-400'
                  }`}
                >
                  <Heart className={`w-4 h-4 ${liked ? 'fill-current' : ''}`} />
                </motion.button>
                
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setBookmarked(!bookmarked)}
                  className={`p-2 rounded-xl transition-all duration-300 ${
                    bookmarked ? 'bg-gradient-to-r from-yellow-500 to-yellow-600 text-black shadow-lg shadow-yellow-500/30' : 'bg-gray-700/50 hover:bg-gray-600/50 text-gray-400'
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
          <div className="absolute top-2 left-2 bg-red-500 text-white px-2 py-1 rounded text-xs font-bold flex items-center space-x-1">
            <TrendingUp className="w-3 h-3" />
            <span>TRENDING</span>
          </div>
        )}
        
        {news.featured && (
          <div className="absolute top-2 right-2 bg-purple-500 text-white px-2 py-1 rounded text-xs font-bold flex items-center space-x-1">
            <Star className="w-3 h-3" />
            <span>DESTACADO</span>
          </div>
        )}

        {news.video && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-lg">
            <motion.div
              whileHover={{ scale: 1.1 }}
              className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center"
            >
              <Play className="w-6 h-6 text-white ml-1" />
            </motion.div>
          </div>
        )}
      </div>
      
      <div className="space-y-3">
        <div className="flex items-center space-x-2">
          <span className="text-xs font-bold text-yellow-400 uppercase bg-yellow-400/10 px-2 py-1 rounded">
            {news.category || 'Deportes'}
          </span>
          <span className="text-gray-400">•</span>
          <span className="text-xs text-gray-400 flex items-center space-x-1">
            <Clock className="w-3 h-3" />
            <span>{timeAgo(news.published_at)}</span>
          </span>
        </div>
        
        <h3 className="text-base font-bold text-white group-hover:text-yellow-400 transition-colors line-clamp-2">
          {news.title}
        </h3>
        
        <p className="text-gray-300 text-sm line-clamp-2">
          {news.content.substring(0, 100)}...
        </p>
        
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
              className={`p-1.5 rounded-lg transition-all duration-300 ${
                liked ? 'bg-red-500 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-400'
              }`}
            >
              <Heart className={`w-4 h-4 ${liked ? 'fill-current' : ''}`} />
            </motion.button>
            
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setBookmarked(!bookmarked)}
              className={`p-1.5 rounded-lg transition-all duration-300 ${
                bookmarked ? 'bg-yellow-500 text-black' : 'bg-gray-700 hover:bg-gray-600 text-gray-400'
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

export default function RevolutionaryNewsFeed() {
  const [news, setNews] = useState<News[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');
  const [layout, setLayout] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');

  const categories = [
    { id: 'all', name: 'Todas', icon: Grid, color: 'text-gray-400' },
    { id: 'deportes', name: 'Deportes', icon: TrendingUp, color: 'text-yellow-400' },
    { id: 'futbol', name: 'Fútbol', icon: Star, color: 'text-green-400' },
    { id: 'tecnologia', name: 'Tecnología', icon: Zap, color: 'text-blue-400' },
    { id: 'video', name: 'Videos', icon: Play, color: 'text-purple-400' },
  ];

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("http://localhost:8000/api/news/published", {
          cache: "no-store"
        });
        const data = await res.json();
        if (data?.success) {
          const sorted: News[] = data.news.sort(
            (a: News, b: News) => +new Date(b.published_at) - +new Date(a.published_at)
          );
          setNews(enhanceNewsData(sorted));
        }
      } catch (e) {
        console.error(e);
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
      {/* Compact Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center space-y-4"
      >
        <div className="flex items-center justify-center space-x-3">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-400 via-yellow-500 to-yellow-600 flex items-center justify-center shadow-lg shadow-yellow-500/30"
          >
            <span className="text-black font-black text-lg">⚽</span>
          </motion.div>
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-white">
              <span className="bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-600 bg-clip-text text-transparent">
                SportPulse
              </span>
            </h1>
            <p className="text-sm text-gray-400 font-medium">Sports News</p>
          </div>
        </div>
      </motion.div>

      {/* Compact Controls */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="flex flex-col sm:flex-row gap-4 items-center justify-between"
      >
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar noticias..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:border-yellow-500/50 focus:outline-none transition-all duration-300 text-sm"
          />
        </div>

        {/* Layout Toggle */}
        <div className="flex items-center space-x-1">
          <button
            onClick={() => setLayout('list')}
            className={`p-2 rounded-lg transition-all duration-300 ${
              layout === 'list' ? 'bg-yellow-500 text-black' : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            <List className="w-4 h-4" />
          </button>
          <button
            onClick={() => setLayout('grid')}
            className={`p-2 rounded-lg transition-all duration-300 ${
              layout === 'grid' ? 'bg-yellow-500 text-black' : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            <Grid className="w-4 h-4" />
          </button>
        </div>
      </motion.div>

      {/* Compact Categories */}
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
            className={`flex items-center space-x-2 px-3 py-2 rounded-lg font-medium transition-all duration-300 whitespace-nowrap text-sm ${
              activeFilter === cat.id
                ? 'bg-yellow-500 text-black'
                : 'bg-gray-800 text-gray-300 hover:text-yellow-400'
            }`}
          >
            <cat.icon className={`w-4 h-4 ${cat.color}`} />
            <span>{cat.name}</span>
          </motion.button>
        ))}
      </motion.div>

      {/* Revolutionary Content */}
      {loading ? (
        <div className={layout === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' : 'space-y-6'}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 border border-gray-700/50 rounded-2xl p-6 animate-pulse">
              <div className="h-48 bg-gray-700/50 rounded-2xl mb-4"></div>
              <div className="space-y-3">
                <div className="h-4 bg-gray-700/50 rounded w-1/3"></div>
                <div className="h-6 bg-gray-700/50 rounded"></div>
                <div className="h-4 bg-gray-700/50 rounded w-2/3"></div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-8">
          {/* Featured News */}
          {featuredNews.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="text-lg font-bold text-white mb-4 flex items-center space-x-2">
                <Star className="w-5 h-5 text-purple-400" />
                <span>Destacadas</span>
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {featuredNews.slice(0, 2).map((n) => (
                  <RevolutionaryNewsCard key={n.id} news={n} layout="grid" />
                ))}
              </div>
            </motion.div>
          )}

          {/* Regular News */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <h2 className="text-lg font-bold text-white mb-4 flex items-center space-x-2">
              <TrendingUp className="w-5 h-5 text-yellow-400" />
              <span>Últimas Noticias</span>
            </h2>
            <div className={layout === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' : 'space-y-4'}>
              {regularNews.map((n) => (
                <RevolutionaryNewsCard key={n.id} news={n} layout={layout} />
              ))}
            </div>
          </motion.div>

          {filteredNews.length === 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6 }}
              className="text-center py-20"
            >
              <div className="w-24 h-24 bg-gradient-to-br from-gray-800/50 to-gray-900/50 rounded-3xl mx-auto mb-6 flex items-center justify-center">
                <span className="text-gray-600 text-3xl">📰</span>
              </div>
              <p className="text-gray-400 font-medium text-lg">No se encontraron noticias revolucionarias.</p>
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
}
