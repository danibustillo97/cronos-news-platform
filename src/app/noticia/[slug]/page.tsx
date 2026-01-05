'use client';

import React, { useEffect, useState } from "react";
import { 
  ArrowLeft,
  Heart, 
  Share2, 
  Bookmark, 
  MessageCircle,
  Eye,
  Clock,
  User,
  TrendingUp,
  ChevronRight,
  Facebook,
  Twitter,
  Copy,
  Send,
  ThumbsUp
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import AdSpace from '@/components/ads/AdSpace';

interface NewsItem {
  id: string;
  title: string;
  summary: string;
  content: string;
  image_url: string;
  author: string;
  published_at: string;
  slug: string;
  category: string;
  tags?: string[];
  league?: string;
  country?: string;
  team?: string;
  seo_score?: number;
  relevance_score?: number;
}

interface Comment {
  id: string;
  author: string;
  content: string;
  timestamp: string;
  likes: number;
  avatar: string;
}

function formatRelativeTime(date: string) {
  const now = new Date();
  const past = new Date(date);
  const diffMs = now.getTime() - past.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Ahora mismo";
  if (diffMins < 60) return `Hace ${diffMins} minuto${diffMins > 1 ? 's' : ''}`;
  if (diffHours < 24) return `Hace ${diffHours} hora${diffHours > 1 ? 's' : ''}`;
  if (diffDays < 7) return `Hace ${diffDays} día${diffDays > 1 ? 's' : ''}`;
  return new Date(date).toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function processContent(content: string): string[] {
  if (!content) return [];
  

  const cleaned = content
    .replace(/https?:\/\/[\w./\-_%#?=&]+/gi, '')
    .replace(/\s+/g, ' ') 
    .trim();
  

  const sentences = cleaned
    .split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ])/)
    .filter(sentence => sentence.length > 20);
  
  // Agrupar oraciones en párrafos de 2-4 oraciones
  const paragraphs = [];
  for (let i = 0; i < sentences.length; i += Math.floor(Math.random() * 3) + 2) {
    const paragraph = sentences.slice(i, i + Math.floor(Math.random() * 3) + 2).join(' ');
    if (paragraph.length > 50) {
      paragraphs.push(paragraph);
    }
  }
  
  return paragraphs;
}

function ShareModal({ isOpen, onClose, url, title }: {
  isOpen: boolean;
  onClose: () => void;
  url: string;
  title: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Error copying link:', err);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 50 }}
            className="fixed inset-0 flex items-center justify-center z-50 p-4"
          >
            <div className="bg-black border-2 border-yellow-500 rounded-2xl p-6 w-full max-w-md">
              <h3 className="text-xl font-bold text-white mb-4">Compartir noticia</h3>
              
              <div className="space-y-3">
                <button
                  onClick={() => window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`, '_blank')}
                  className="w-full flex items-center gap-4 p-4 bg-gray-800 hover:bg-gray-700 rounded-xl transition-colors"
                >
                  <Twitter className="text-blue-400" size={24} />
                  <span className="text-white font-medium">Compartir en Twitter</span>
                </button>
                
                <button
                  onClick={() => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank')}
                  className="w-full flex items-center gap-4 p-4 bg-gray-800 hover:bg-gray-700 rounded-xl transition-colors"
                >
                  <Facebook className="text-blue-600" size={24} />
                  <span className="text-white font-medium">Compartir en Facebook</span>
                </button>
                
                <button
                  onClick={handleCopyLink}
                  className={`w-full flex items-center gap-4 p-4 rounded-xl transition-all ${
                    copied 
                      ? 'bg-yellow-500 text-black' 
                      : 'bg-gray-800 hover:bg-gray-700 text-white'
                  }`}
                >
                  <Copy size={24} />
                  <span className="font-medium">
                    {copied ? '¡Enlace copiado!' : 'Copiar enlace'}
                  </span>
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default function PremiumNewsDetail() {
  const [newsData, setNewsData] = useState<NewsItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [liked, setLiked] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [likes, setLikes] = useState(0);
  const [comments, setComments] = useState<Comment[]>([]);
  const params = useParams();
  const slug = params.slug as string;

  useEffect(() => {
    if (!slug) return;

    const fetchNews = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('news')
          .select('*')
          .eq('slug', slug)
          .single();

        if (error) throw error;
        
        // Map DB fields to component interface
        const mappedData = {
            ...data,
            summary: data.summary || data.excerpt || data.subtitle || '',
            tags: data.tags || [],
            category: data.category || 'General',
            image_url: data.image_url || 'https://via.placeholder.com/800x600',
            author: data.author || 'Cronos News',
            content: data.content || ''
        };
        
        setNewsData(mappedData);
        
        // Simular métricas si no existen
        setLikes(data.likes || Math.floor(Math.random() * 500));
      } catch (error) {
        console.error('Error fetching news:', error);
        setNewsData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchNews();
  }, [slug]);

  const handleLike = () => {
    setLiked(!liked);
    setLikes(prev => liked ? prev - 1 : prev + 1);
  };

  const handleAddComment = () => {
    if (!newComment.trim()) return;
    
    const comment: Comment = {
      id: Date.now().toString(),
      author: 'Usuario Actual',
      content: newComment,
      timestamp: new Date().toISOString(),
      likes: 0,
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=40&h=40&fit=crop&crop=face'
    };
    
    setComments([comment, ...comments]);
    setNewComment("");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-yellow-500"></div>
      </div>
    );
  }

  if (!newsData) return null;

  const contentParagraphs = processContent(newsData.content);
  const currentUrl = `${window.location.origin}/noticia/${newsData.slug}`;

  // JSON-LD Structured Data
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: newsData.title,
    image: [newsData.image_url],
    datePublished: newsData.published_at,
    dateModified: newsData.published_at,
    author: [{
      '@type': 'Person',
      name: newsData.author || 'Nexus News Team',
    }],
    publisher: {
      '@type': 'Organization',
      name: 'Nexus News',
      logo: {
        '@type': 'ImageObject',
        url: 'https://www.nexusnews.info/logo.png' // Asegúrate de tener un logo
      }
    },
    description: newsData.summary
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white selection:bg-yellow-500/30">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      
      {/* Header Scroll Progress */}
      <div className="sticky top-0 z-40 bg-black/95 backdrop-blur-xl border-b border-yellow-500/30">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => window.history.back()}
              className="p-3 bg-gray-800 hover:bg-gray-700 rounded-full transition-colors"
            >
              <ArrowLeft className="text-yellow-400" size={20} />
            </motion.button>
            <div className="flex-1">
              <h1 className="text-white font-bold text-lg">Cronos News</h1>
              <p className="text-gray-400 text-sm">Detalle de la noticia</p>
            </div>
            <div className="flex items-center gap-2">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowShareModal(true)}
                className="p-3 bg-gray-800 hover:bg-gray-700 rounded-full transition-colors"
              >
                <Share2 className="text-yellow-400" size={20} />
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setBookmarked(!bookmarked)}
                className={`p-3 rounded-full transition-colors ${
                  bookmarked 
                    ? 'bg-yellow-500 text-black' 
                    : 'bg-gray-800 hover:bg-gray-700 text-yellow-400'
                }`}
              >
                <Bookmark size={20} className={bookmarked ? 'fill-current' : ''} />
              </motion.button>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <motion.article
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="bg-black border border-yellow-500/30 rounded-3xl overflow-hidden"
        >
          {/* Header del artículo */}
          <div className="p-8 pb-0">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center">
                <span className="text-black font-black text-xl">C</span>
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <span className="text-white font-bold text-lg">Cronos News</span>
                  <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full" />
                  <span className="text-gray-400 font-medium">{formatRelativeTime(newsData.published_at)}</span>
                </div>
                <div className="flex items-center gap-3 mt-1 text-sm">
                  <span className="text-gray-400">por {newsData.author}</span>
                  {newsData.country && (
                    <>
                      <div className="w-1 h-1 bg-gray-600 rounded-full" />
                      <span className="text-gray-400">{newsData.country}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Categoría */}
            <motion.span
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className={`inline-block px-4 py-2 rounded-full font-bold text-sm uppercase tracking-wider mb-6 ${
                newsData.category === 'banderazo rojo'
                  ? 'bg-red-600 text-white border border-red-400'
                  : 'bg-yellow-500 text-black'
              }`}
            >
              {newsData.category}
            </motion.span>

            {/* Título principal */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-3xl md:text-5xl font-black text-white leading-tight mb-6"
            >
              {newsData.title}
            </motion.h1>

            {/* Summary si existe */}
            {newsData.summary && (
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-xl text-gray-300 leading-relaxed mb-6 font-medium"
              >
                {newsData.summary}
              </motion.p>
            )}
          </div>

          {/* Imagen principal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="mt-8 mb-8"
          >
            <img
              src={newsData.image_url}
              alt={newsData.title}
              className="w-full h-96 md:h-[500px] object-cover"
              loading="lazy"
            />
          </motion.div>

          {/* Contenido del artículo */}
          <div className="px-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="prose prose-lg max-w-none"
            >
              {contentParagraphs.map((paragraph, index) => (
                <motion.p
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 + index * 0.1 }}
                  className="text-gray-300 leading-relaxed mb-6 text-justify text-lg"
                >
                  {paragraph}
                </motion.p>
              ))}
            </motion.div>

            {/* Tags */}
            {newsData.tags && newsData.tags.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                className="flex flex-wrap gap-3 mt-8 pt-6 border-t border-gray-800"
              >
                {newsData.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-4 py-2 bg-gray-800 text-yellow-400 rounded-full text-sm font-semibold border border-gray-700 hover:bg-gray-700 transition-colors cursor-pointer"
                  >
                    #{tag}
                  </span>
                ))}
              </motion.div>
            )}

            <AdSpace slotId="8962635274" label="Publicidad" className="my-12" />

            {/* Estadísticas del artículo */}
            <motion.div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-800">
              <div className="flex items-center gap-6 text-gray-400">
                <div className="flex items-center gap-2">
                  <Eye size={18} />
                  <span className="font-medium">{Math.floor(Math.random() * 5000) + 1000}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Heart size={18} />
                  <span className="font-medium">{likes}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MessageCircle size={18} />
                  <span className="font-medium">{comments.length}</span>
                </div>
              </div>
            </motion.div>

            {/* Botones de acción */}
            <div className="flex items-center justify-between mt-6 pb-8">
              <div className="flex items-center gap-3">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleLike}
                  className={`flex items-center gap-3 px-8 py-4 rounded-xl font-bold transition-all duration-300 ${
                    liked 
                      ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/20' 
                      : 'bg-gray-800 hover:bg-gray-700 text-white border border-gray-700'
                  }`}
                >
                  <Heart size={20} className={liked ? 'fill-current' : ''} />
                  {liked ? 'Te gusta' : 'Me gusta'}
                </motion.button>
                
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowComments(!showComments)}
                  className="flex items-center gap-3 px-8 py-4 rounded-xl font-bold bg-gray-800 hover:bg-gray-700 text-white border border-gray-700 transition-all duration-300"
                >
                  <MessageCircle size={20} />
                  Comentarios
                </motion.button>
              </div>
            </div>

            {/* Sección de comentarios */}
            <AnimatePresence>
              {showComments && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.4 }}
                  className="border-t border-gray-800 pt-8 pb-8"
                >
                  {/* Input para comentario */}
                  <div className="flex gap-4 mb-8">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center">
                      <User size={20} className="text-black" />
                    </div>
                    <div className="flex-1 flex gap-3">
                      <input
                        type="text"
                        placeholder="Escribe tu comentario..."
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-yellow-500 transition-colors"
                        onKeyPress={(e) => e.key === 'Enter' && handleAddComment()}
                      />
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={handleAddComment}
                        disabled={!newComment.trim()}
                        className="px-6 py-3 bg-yellow-500 hover:bg-yellow-400 text-black rounded-xl font-bold transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Send size={18} />
                      </motion.button>
                    </div>
                  </div>

                  {/* Lista de comentarios */}
                  <div className="space-y-6">
                    {comments.map((comment) => (
                      <motion.div
                        key={comment.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex gap-4"
                      >
                        <img
                          src={comment.avatar}
                          alt={comment.author}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                        <div className="flex-1">
                          <div className="bg-gray-800 rounded-2xl p-4">
                            <div className="font-bold text-white mb-2">
                              {comment.author}
                            </div>
                            <p className="text-gray-300 leading-relaxed">
                              {comment.content}
                            </p>
                          </div>
                          <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                            <span>{formatRelativeTime(comment.timestamp)}</span>
                            <button className="flex items-center gap-1 hover:text-yellow-400 transition-colors">
                              <ThumbsUp size={14} />
                              {comment.likes}
                            </button>
                            <button className="hover:text-yellow-400 transition-colors">
                              Responder
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.article>
      </main>

      {/* Modal de compartir */}
      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        url={currentUrl}
        title={newsData.title}
      />
    </div>
  );
}