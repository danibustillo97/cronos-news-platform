'use client';

import React, { useState } from "react";
import {
  ArrowLeft,
  Share2,
  Bookmark,
  MessageCircle,
  User,
  Send
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import AdSpace from '@/components/ads/AdSpace';

/* =======================
   TIPOS
======================= */

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
  country?: string;
}

interface Comment {
  id: string;
  author: string;
  content: string;
  timestamp: string;
}

/* =======================
   UTILS
======================= */

function formatRelativeTime(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `Hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Hace ${hrs} h`;
  return new Date(date).toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function processContent(content: string) {
  return content
    ?.split(/\n+/)
    .map(p => p.trim())
    .filter(p => p.length > 60) || [];
}

/* =======================
   COMPONENTE PRINCIPAL
======================= */

export default function ArticleClient({ news }: { news: NewsItem }) {
  const [bookmarked, setBookmarked] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [comments, setComments] = useState<Comment[]>([]);

  const paragraphs = processContent(news.content);
  const url = `https://www.nexusnews.info/noticia/${news.slug}`;

  const addComment = () => {
    if (!newComment.trim()) return;
    setComments(prev => [
      {
        id: Date.now().toString(),
        author: 'Lector',
        content: newComment,
        timestamp: new Date().toISOString(),
      },
      ...prev
    ]);
    setNewComment('');
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white selection:bg-yellow-500/30">

      {/* HEADER */}
      <div className="sticky top-0 z-40 bg-black/95 backdrop-blur border-b border-yellow-500/30">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <button onClick={() => history.back()}>
            <ArrowLeft className="text-yellow-400" />
          </button>
          <div className="flex-1">
            <h1 className="font-bold">Nexus News</h1>
            <p className="text-gray-400 text-sm">Actualidad informativa</p>
          </div>
          <button onClick={() => navigator.share?.({ title: news.title, url })}>
            <Share2 className="text-yellow-400" />
          </button>
          <button onClick={() => setBookmarked(!bookmarked)}>
            <Bookmark className={bookmarked ? "fill-yellow-400 text-yellow-400" : ""} />
          </button>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 py-10">
        <article className="bg-black border border-yellow-500/30 rounded-3xl overflow-hidden p-8">

          {/* CATEGORÍA */}
          <span className="inline-block bg-yellow-500 text-black px-4 py-2 rounded-full font-bold uppercase text-sm mb-6">
            {news.category}
          </span>

          {/* TITULO */}
          <h1 className="text-4xl md:text-5xl font-black leading-tight mb-6">
            {news.title}
          </h1>

          {/* META */}
          <div className="text-gray-400 mb-8">
            Por <strong className="text-white">{news.author}</strong> · {formatRelativeTime(news.published_at)}
            {news.country && ` · ${news.country}`}
          </div>

          {/* RESUMEN */}
          {news.summary && (
            <p className="text-xl text-gray-300 leading-relaxed mb-8 font-medium">
              {news.summary}
            </p>
          )}

          {/* IMAGEN */}
          <img
            src={news.image_url}
            alt={news.title}
            className="w-full h-[450px] object-cover rounded-2xl mb-10"
            loading="lazy"
          />

          {/* CONTENIDO */}
          <section className="space-y-6 text-lg text-gray-300 leading-relaxed text-justify">
            {paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </section>

          {/* BLOQUE SEO: CLAVES */}
          <section className="mt-14 border-t border-gray-800 pt-8">
            <h2 className="text-2xl font-black mb-6">🔍 Claves de la noticia</h2>
            <ul className="space-y-4 text-gray-300 text-lg">
              <li><strong className="text-white">Qué ocurrió:</strong> {news.summary}</li>
              <li><strong className="text-white">Por qué es importante:</strong> El hecho tiene impacto directo en el contexto actual y genera repercusiones inmediatas.</li>
              <li><strong className="text-white">Qué se espera ahora:</strong> En los próximos días se esperan nuevas decisiones y reacciones oficiales.</li>
            </ul>
          </section>

          {/* ANTECEDENTES */}
          <section className="mt-12 bg-gray-900/40 border border-gray-800 rounded-2xl p-6">
            <h2 className="text-2xl font-black mb-4">📚 Antecedentes</h2>
            <p className="text-gray-300 text-lg leading-relaxed">
              Este acontecimiento se suma a otros hechos recientes que han marcado la actualidad.
              Situaciones similares ya se han presentado anteriormente, generando análisis y debate.
            </p>
          </section>

          {/* IMPACTO */}
          <section className="mt-12">
            <h2 className="text-2xl font-black mb-4">💬 Impacto y reacciones</h2>
            <p className="text-gray-300 text-lg leading-relaxed">
              La noticia ha generado reacciones inmediatas en redes sociales y entre analistas,
              quienes consideran que este hecho podría marcar un punto de inflexión.
            </p>
          </section>

          {/* PUBLICIDAD */}
          <AdSpace slotId="8962635274" className="my-16" />

          {/* TAGS */}
          {news.tags && news.tags.length > 0 && (
            <div className="flex flex-wrap gap-3 border-t border-gray-800 pt-6">
              {news.tags.map(tag => (
                <span key={tag} className="px-4 py-2 bg-gray-800 text-yellow-400 rounded-full text-sm font-semibold">
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* COMENTARIOS */}
          <div className="mt-12">
            <button
              onClick={() => setShowComments(!showComments)}
              className="flex items-center gap-3 px-8 py-4 bg-gray-800 rounded-xl font-bold"
            >
              <MessageCircle /> Comentarios
            </button>

            <AnimatePresence>
              {showComments && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-8 space-y-6"
                >
                  <div className="flex gap-3">
                    <div className="w-10 h-10 bg-yellow-500 rounded-full flex items-center justify-center text-black">
                      <User />
                    </div>
                    <input
                      value={newComment}
                      onChange={e => setNewComment(e.target.value)}
                      placeholder="Escribe tu comentario..."
                      className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3"
                      onKeyDown={e => e.key === 'Enter' && addComment()}
                    />
                    <button
                      onClick={addComment}
                      className="px-6 py-3 bg-yellow-500 text-black rounded-xl font-bold"
                    >
                      <Send />
                    </button>
                  </div>

                  {comments.map(c => (
                    <div key={c.id} className="bg-gray-800 rounded-2xl p-4">
                      <div className="font-bold">{c.author}</div>
                      <p className="text-gray-300">{c.content}</p>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

        </article>
      </main>
    </div>
  );
}
