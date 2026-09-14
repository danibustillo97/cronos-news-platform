'use client';

import React, { useEffect, useState } from "react";
import { 
  MessageCircle, 
  Share2, 
  Heart, 
  Bookmark, 
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  Eye,
  TrendingUp,
  Clock,
  User,
  Send,
  ThumbsUp,
  Play
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

function cap(t?: string) {
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : "";
}

function fmt(d?: string | number | Date) {
  if (!d) return "";
  return new Date(d).toLocaleString("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function splitParas(t?: string) {
  if (!t) return [];
  const cleaned = t
    .replace(/https?:\/\/[\w./\-_%#?=&]+/gi, "")
    .replace(/([.?!])\s*/g, "$1\n\n")
    .replace(/\n{2,}/g, "\n\n")
    .replace(/\s{2,}/g, " ")
    .trim();
  return cleaned.split("\n\n").map(s => s.trim()).filter(p => p.length > 25);
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
  return fmt(date);
}

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
    trending: Math.random() > 0.6
  }));
}

function ImageCarousel({ images, alt }: { images: string[], alt: string }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  if (images.length === 1) {
    return (
      <div className="relative group overflow-hidden">
        <motion.img
          whileHover={{ scale: 1.05 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          src={images[0]}
          alt={alt}
          loading="lazy"
          className="w-full h-80 object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      </div>
    );
  }

  return (
    <div className="relative h-80 overflow-hidden group">
      <AnimatePresence mode="wait">
        <motion.img
          key={currentIndex}
          initial={{ opacity: 0, scale: 1.1 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.5 }}
          src={images[currentIndex]}
          alt={`${alt} - ${currentIndex + 1}`}
          loading="lazy"
          className="w-full h-full object-cover"
        />
      </AnimatePresence>
      
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      
      <button
        onClick={() => setCurrentIndex(prev => prev === 0 ? images.length - 1 : prev - 1)}
        className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/80 hover:bg-yellow-500 text-white hover:text-black rounded-full p-3 transition-all duration-300 opacity-0 group-hover:opacity-100 transform -translate-x-4 group-hover:translate-x-0"
      >
        <ChevronLeft size={20} />
      </button>
      <button
        onClick={() => setCurrentIndex(prev => prev === images.length - 1 ? 0 : prev + 1)}
        className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/80 hover:bg-yellow-500 text-white hover:text-black rounded-full p-3 transition-all duration-300 opacity-0 group-hover:opacity-100 transform translate-x-4 group-hover:translate-x-0"
      >
        <ChevronRight size={20} />
      </button>
      
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
        {images.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrentIndex(i)}
            className={`w-2 h-2 rounded-full transition-all duration-300 ${
              i === currentIndex ? 'bg-yellow-400 w-8' : 'bg-white/50 hover:bg-white/80'
            }`}
          />
        ))}
      </div>
    </div>
  );
}

function NewsPost({ news: n }: { news: News }) {
  const [expanded, setExpanded] = useState(false);
  const [liked, setLiked] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [localLikes, setLocalLikes] = useState(n.likes);

  const paras = splitParas(n.content);
  const visibleParas = expanded ? paras : paras.slice(0, 2);

  const handleLike = () => {
    setLiked(!liked);
    setLocalLikes(prev => liked ? prev - 1 : prev + 1);
  };

  return (
    <motion.article
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="mb-8 bg-black rounded-2xl overflow-hidden border border-yellow-500/20 hover:border-yellow-500/40 transition-all duration-500 group"
    >
      {/* Header Premium */}
      <div className="p-6 pb-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center shadow-lg shadow-yellow-500/20">
                <span className="text-black font-black text-lg">N</span>
              </div>
              {n.trending && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-2 -right-2 w-6 h-6 bg-yellow-500 rounded-full flex items-center justify-center shadow-lg"
                >
                  <TrendingUp size={14} className="text-black" />
                </motion.div>
              )}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h3 className="font-bold text-white text-lg">Cronos News</h3>
                <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full" />
                <span className="text-gray-400 text-sm font-medium">{timeAgo(n.published_at)}</span>
              </div>
              <div className="flex items-center gap-4 mt-1">
                {n.category && (
                  <span className="text-yellow-400 font-semibold text-sm uppercase tracking-wider">
                    {n.category}
                  </span>
                )}
                <div className="flex items-center gap-2 text-gray-500 text-sm">
                  <Eye size={14} />
                  <span className="font-medium">{n.views.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
          <button className="p-3 hover:bg-yellow-500/10 rounded-full transition-colors duration-300 group/more">
            <MoreHorizontal size={24} className="text-gray-400 group-hover/more:text-yellow-400 transition-colors" />
          </button>
        </div>

        {/* Título Premium */}
        <div className="mt-6">
          <h2 className="text-2xl sm:text-3xl font-black text-white leading-tight hover:text-yellow-400 transition-colors duration-300 cursor-pointer">
            {cap(n.title)}
          </h2>
        </div>
      </div>

      {/* Imagen Principal */}
      <div className="mt-6 cursor-pointer" onClick={() => window.open(`/noticia/${n.slug}`, '_blank')}>
        <ImageCarousel images={n.images || [n.image_url]} alt={n.title} />
      </div>

      {/* Contenido */}
      <div className="p-6">
        <div className="text-gray-300 leading-relaxed text-base">
          {visibleParas.map((p, i) => (
            <p key={i} className="mb-4 last:mb-0">{p}</p>
          ))}
        </div>

        {paras.length > 2 && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            onClick={() => setExpanded(!expanded)}
            className="mt-4 text-yellow-400 font-bold hover:text-yellow-300 transition-colors duration-300 text-sm uppercase tracking-wide"
          >
            {expanded ? "↑ Ocultar" : "↓ Leer más"}
          </motion.button>
        )}

        {/* Estadísticas Premium */}
        <div className="flex items-center gap-6 mt-6 pt-4 border-t border-gray-800">
          <div className="text-gray-400 text-sm font-medium">
            <span className="text-white font-bold">{localLikes.toLocaleString()}</span> likes
          </div>
          <div className="text-gray-400 text-sm font-medium">
            <span className="text-white font-bold">{n.comments}</span> comentarios
          </div>
          <div className="text-gray-400 text-sm font-medium">
            <span className="text-white font-bold">{n.shares}</span> shares
          </div>
        </div>

        {/* Acciones Premium */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-800">
          <div className="flex items-center gap-2">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleLike}
              className={`flex items-center gap-3 px-6 py-3 rounded-xl font-bold text-sm transition-all duration-300 ${
                liked 
                  ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/20' 
                  : 'bg-gray-800 hover:bg-gray-700 text-white hover:text-yellow-400 border border-gray-700'
              }`}
            >
              <Heart size={20} className={liked ? 'fill-current' : ''} />
              {liked ? 'Te gusta' : 'Me gusta'}
            </motion.button>
            
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowComments(!showComments)}
              className="flex items-center gap-3 px-6 py-3 rounded-xl font-bold text-sm bg-gray-800 hover:bg-gray-700 text-white hover:text-yellow-400 border border-gray-700 transition-all duration-300"
            >
              <MessageCircle size={20} />
              Comentar
            </motion.button>
            
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(
                `https://noticias-cronos-366i.vercel.app/noticia/${n.slug}`
              )}`, '_blank')}
              className="flex items-center gap-3 px-6 py-3 rounded-xl font-bold text-sm bg-gray-800 hover:bg-gray-700 text-white hover:text-yellow-400 border border-gray-700 transition-all duration-300"
            >
              <Share2 size={20} />
              Compartir
            </motion.button>
          </div>
          
          <motion.button
            whileHover={{ scale: 1.05, rotate: 5 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setBookmarked(!bookmarked)}
            className={`p-3 rounded-xl transition-all duration-300 ${
              bookmarked 
                ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/20' 
                : 'bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-yellow-400 border border-gray-700'
            }`}
          >
            <Bookmark size={20} className={bookmarked ? 'fill-current' : ''} />
          </motion.button>
        </div>

        {/* Comentarios Premium */}
        <AnimatePresence>
          {showComments && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="mt-6 pt-6 border-t border-gray-800 space-y-4"
            >
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center">
                  <User size={18} className="text-black" />
                </div>
                <div className="flex-1 bg-gray-800 rounded-2xl px-4 py-3 border border-gray-700">
                  <input
                    type="text"
                    placeholder="Escribe tu comentario..."
                    className="w-full bg-transparent text-white placeholder-gray-400 outline-none font-medium"
                  />
                </div>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-4 py-3 bg-yellow-500 hover:bg-yellow-400 text-black rounded-xl font-bold transition-all duration-300"
                >
                  <Send size={18} />
                </motion.button>
              </div>
              
              <div className="text-gray-400 text-sm font-medium text-center">
                {n.comments} comentarios • Próximamente disponible
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.article>
  );
}

export default function PremiumBlackYellowFeed() {
  const [news, setNews] = useState<News[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');

  const categories = ['all', 'política', 'deportes', 'tecnología', 'economía', 'cultura'];

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(
          "http://localhost:8000/api/news/published",
          { cache: "no-store" }
        );
        const data = await res.json();
        if (data?.success) {
          const sorted: News[] = data.news.sort(
            (a: News, b: News) =>
              +new Date(b.published_at) - +new Date(a.published_at)
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

  const filteredNews = activeFilter === 'all' 
    ? news 
    : news.filter(n => n.category?.toLowerCase() === activeFilter);

  return (
    <div className="min-h-screen bg-black">
      {/* Header Ultra Premium */}
      <div className="sticky top-0 z-50 bg-black/95 backdrop-blur-xl border-b border-yellow-500/30">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <motion.div 
                whileHover={{ scale: 1.05, rotate: 5 }}
                className="w-16 h-16 rounded-2xl bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center shadow-2xl shadow-yellow-500/20"
              >
                <span className="text-black font-black text-2xl">C</span>
              </motion.div>
              <div>
                <h1 className="text-3xl font-black text-white">CRONOS</h1>
                <p className="text-yellow-400 font-bold uppercase tracking-widest text-sm">Premium News</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-white font-black text-lg">
                {filteredNews.length} Noticias
              </div>
              <div className="text-gray-400 text-sm font-medium">
                Última actualización: {new Date().toLocaleTimeString('es-CO', { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}
              </div>
            </div>
          </div>
          
          {/* Filtros Premium */}
          <div className="flex gap-3 mt-6 overflow-x-auto pb-2">
            {categories.map((cat) => (
              <motion.button
                key={cat}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setActiveFilter(cat)}
                className={`px-6 py-3 rounded-xl font-bold text-sm uppercase tracking-wider whitespace-nowrap transition-all duration-300 ${
                  activeFilter === cat
                    ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/20'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-yellow-400 border border-gray-700'
                }`}
              >
                {cat === 'all' ? 'Todas' : cap(cat)}
              </motion.button>
            ))}
          </div>
        </div>
      </div>

      <main className="w-full max-w-4xl mx-auto px-4 py-8">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="mb-8 bg-black border border-gray-800 rounded-2xl p-6 animate-pulse"
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 bg-gray-800 rounded-full" />
                <div className="flex-1">
                  <div className="h-5 w-40 bg-gray-800 rounded mb-2" />
                  <div className="h-4 w-24 bg-gray-800 rounded" />
                </div>
              </div>
              <div className="h-80 w-full rounded-xl bg-gray-800 mb-6" />
              <div className="space-y-3">
                <div className="h-4 w-full bg-gray-800 rounded" />
                <div className="h-4 w-3/4 bg-gray-800 rounded" />
              </div>
            </div>
          ))
        ) : filteredNews.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 bg-gray-800 rounded-2xl mx-auto mb-6 flex items-center justify-center">
              <span className="text-gray-600 text-2xl">📰</span>
            </div>
            <p className="text-gray-400 font-medium">No hay noticias disponibles en esta categoría.</p>
          </div>
        ) : (
          filteredNews.map((n) => <NewsPost key={n.id} news={n} />)
        )}
      </main>
    </div>
  );
}