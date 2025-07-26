'use client'

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ThumbsUp, MessageCircle, Share2 } from "lucide-react";

// Categoría-colores (negro y amarillo, algunos detalles)
type CategoryKey =
  | "deporte"
  | "economía"
  | "política"
  | "salud"
  | "tecnología"
  | "internacional"
  | "cultura"
  | "entretenimiento"
  | "judicial"
  | "colombia"
  | "banderazo rojo"
  | "actualidad";

const categoryColors: Record<CategoryKey, string> = {
  deporte: "bg-yellow-400 text-black",
  economía: "bg-yellow-400 text-black",
  política: "bg-yellow-400 text-black",
  salud: "bg-yellow-400 text-black",
  tecnología: "bg-yellow-400 text-black",
  internacional: "bg-yellow-400 text-black",
  cultura: "bg-yellow-400 text-black",
  entretenimiento: "bg-yellow-400 text-black",
  judicial: "bg-yellow-400 text-black",
  colombia: "bg-yellow-400 text-black",
  "banderazo rojo": "bg-gradient-to-r from-red-700 to-yellow-400 text-white border-2 border-yellow-300 shadow-lg",
  actualidad: "bg-yellow-400 text-black",
};

function capitalize(text?: string) {
  if (!text) return "";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function formatDate(date: string | number | Date) {
  if (!date) return "";
  const d = new Date(date);
  return d.toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });
}

// Limpieza y párrafos elegantes (saltos automáticos)
function formatParagraphs(text?: string) {
  if (!text) return [];
  const cleaned = text
    .replace(/https?:\/\/[\w./\-_%#?=&]+/gi, "")
    .replace(/([.?!])(\s*)(?=[A-ZÁÉÍÓÚÑ])/g, "$1\n\n") // salto doble tras puntos y mayúscula
    .replace(/\s{2,}/g, " ")
    .trim();
  return cleaned.split("\n\n").map(p => p.trim()).filter((p) => p.length > 20);
}

interface News {
  id: string | number;
  title: string;
  content: string;
  image_url: string;
  published_at: string;
  category?: string;
  author?: string;
  league?: string;
  country?: string;
  team?: string;
  tags?: string[];
  slug: string;
}

const NewsFeed = () => {
  const [news, setNews] = useState<News[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | number | null>(null);

  useEffect(() => {
    async function fetchNews() {
      try {
        const res = await fetch("https://backendcronosnews-production.up.railway.app/api/news/published");
        const data = await res.json();
        if (data.success) {
          const sorted = data.news.sort(
            (a: News, b: News) =>
              new Date(b.published_at).getTime() -
              new Date(a.published_at).getTime()
          );
          setNews(sorted);
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("Error fetching news:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchNews();
  }, []);

  const handleExpand = (id: string | number) => {
    setExpandedId(prev => (prev === id ? null : id));
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 bg-black min-h-screen space-y-10">
      {loading ? (
        <div className="text-center text-lg text-yellow-400 py-10 animate-pulse">
          Cargando noticias...
        </div>
      ) : news.length === 0 ? (
        <div className="text-center text-lg text-yellow-400 py-10">
          No hay noticias recientes.
        </div>
      ) : (
        news.map((item) => {
          const paragraphs = formatParagraphs(item.content);
          const cat = (item.category?.toLowerCase() as CategoryKey) || "actualidad";
          const catColor = categoryColors[cat] || "bg-yellow-400 text-black";
          const expanded = expandedId === item.id;

          return (
            <article
              key={item.id}
              className={`relative rounded-2xl overflow-hidden shadow-2xl border border-yellow-900 bg-black/90 hover:shadow-yellow-700/30 transition-shadow duration-300 group`}
            >
              {/* Imagen + etiqueta categoría */}
              <div className="relative">
                <img
                  src={item.image_url}
                  alt={item.title}
                  title={item.title}
                  loading="lazy"
                  className="w-full h-48 md:h-56 object-cover object-center"
                />
                <span
                  className={`absolute top-4 left-4 px-4 py-1 rounded-full text-xs font-extrabold uppercase tracking-widest shadow border ${catColor} drop-shadow-lg`}
                >
                  {capitalize(item.category)}
                </span>
                {cat === "banderazo rojo" && (
                  <span className="absolute top-4 right-4 bg-yellow-400 text-red-900 px-3 py-1 rounded-full text-xs font-black shadow border-2 border-red-900 animate-pulse z-10">
                    Junior Power
                  </span>
                )}
              </div>
              <div className="p-6 pt-5">
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <span className="text-xs font-medium text-yellow-200">{formatDate(item.published_at)}</span>
                  {item.author && (
                    <span className="text-xs text-neutral-400 ml-2 font-medium">
                      {item.author}
                    </span>
                  )}
                  {item.league && (
                    <span className="ml-2 text-xs bg-yellow-800 text-yellow-100 px-2 py-0.5 rounded font-medium border border-yellow-400">{item.league}</span>
                  )}
                  {item.team && (
                    <span className="ml-2 text-xs bg-red-900 text-yellow-200 px-2 py-0.5 rounded font-medium border border-yellow-700">{item.team}</span>
                  )}
                </div>
                <Link href={`/noticia/${item.slug}`}>
                  <h2 className="text-2xl font-extrabold capitalize leading-tight mb-2 text-yellow-400 hover:underline transition tracking-tight">
                    {capitalize(item.title)}
                  </h2>
                </Link>
                <div className="text-base text-yellow-50 leading-relaxed font-light space-y-6 mb-3">
                  {(expanded ? paragraphs : paragraphs.slice(0, 2)).map((p, i) => (
                    <p key={i} className="transition-all duration-300">{p}</p>
                  ))}
                </div>
                {paragraphs.length > 2 && (
                  <div className="flex justify-center mt-2">
                    <button
                      className="fixed md:static z-30 left-1/2 bottom-16 md:bottom-auto -translate-x-1/2 md:translate-x-0 px-8 py-3 rounded-full font-black text-lg shadow-2xl bg-yellow-400 text-black hover:bg-yellow-300 focus:outline-none transition-all"
                      style={{
                        position: expanded ? "fixed" : "static",
                      }}
                      onClick={() => handleExpand(item.id)}
                    >
                      {expanded ? "Ver menos" : "Leer más"}
                    </button>
                  </div>
                )}
                {/* Tags */}
                {item.tags && item.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-4 mb-2">
                    {item.tags.map((t) => (
                      <span key={t} className="bg-black border border-yellow-800 text-yellow-300 px-3 py-0.5 rounded-full text-xs font-semibold">
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
                {/* Acciones sociales */}
                <div className="flex gap-6 items-center pt-3 border-t border-yellow-900 text-yellow-500 mt-4">
                  <button className="flex items-center gap-2 hover:text-yellow-300 transition">
                    <ThumbsUp size={17} /> Me gusta
                  </button>
                  <button className="flex items-center gap-2 hover:text-yellow-300 transition">
                    <MessageCircle size={17} /> Comentar
                  </button>
                  <a
                    href={`https://twitter.com/intent/tweet?url=https://noticias-cronos-366i.vercel.app/noticia/${item.slug}`}
                    target="_blank"
                    rel="noopener"
                    className="flex items-center gap-2 hover:text-blue-400 transition"
                  >
                    <Share2 size={17} /> Compartir
                  </a>
                </div>
              </div>
            </article>
          );
        })
      )}
    </div>
  );
};

export default NewsFeed;
