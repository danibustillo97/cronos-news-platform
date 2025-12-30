"use client";
import React from 'react';
import { Clock, ChevronRight } from 'lucide-react';
import { stripHtml, truncateText } from '@/lib/textUtils';

interface News {
  id: string;
  title: string;
  subtitle?: string;
  content?: string;
  excerpt?: string;
  description?: string;
  category?: string;
  image_url?: string;
  published_at: string;
  author?: string;
  slug: string;
  // Admin specific fields
  status?: string;
}

interface NewsCardProps {
  news: News;
  onClick?: () => void;
  showStatus?: boolean; // For admin view
  darkMode?: boolean;
}

const formatDate = (dateString: string) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('es-CO', { 
    day: 'numeric', 
    month: 'long', 
    hour: '2-digit', 
    minute: '2-digit' 
  }).format(date);
}

export default function NewsCard({ news, onClick, showStatus = false, darkMode = false }: NewsCardProps) {
  return (
    <article 
        className={`${darkMode ? 'bg-white/5 border border-white/10 hover:border-white/20' : 'bg-white shadow-lg hover:shadow-xl'} rounded-2xl overflow-hidden transition-all duration-300 group cursor-pointer h-full flex flex-col transform hover:-translate-y-1`}
        onClick={onClick}
    >
      <div className="relative aspect-video w-full overflow-hidden bg-neutral-900">
        <img 
          src={news.image_url || 'https://via.placeholder.com/600x400'} 
          alt={news.title}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-t from-black/60 to-transparent opacity-60" />
        <div className="absolute top-3 left-3 flex gap-2">
            <span className="bg-white/95 backdrop-blur-md px-2 py-1 rounded text-xs font-bold text-neutral-900 shadow-sm uppercase tracking-wide">
                {news.category || 'General'}
            </span>
            {showStatus && (
                <span className={`px-2 py-1 rounded text-xs font-bold text-white shadow-sm uppercase tracking-wide ${
                    news.status === 'published' ? 'bg-green-600' : 'bg-yellow-500'
                }`}>
                    {news.status === 'published' ? 'Publicado' : 'Borrador'}
                </span>
            )}
        </div>
      </div>
      <div className={`p-5 flex flex-col flex-1 relative`}>
        {/* Subtle decorative gradient at bottom */}
        <div className={`absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-red-600 to-red-800 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left`} />
        
        <div className="mb-3">
            <h3 className={`text-xl font-bold leading-tight group-hover:text-red-600 transition-colors line-clamp-2 ${darkMode ? 'text-white' : 'text-neutral-900'}`}>
            {news.title}
            </h3>
            {news.subtitle && (
                <h4 className={`text-sm font-medium mt-1 line-clamp-2 ${darkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>
                    {news.subtitle}
                </h4>
            )}
        </div>
        <p className={`text-sm line-clamp-3 mb-4 flex-1 ${darkMode ? 'text-neutral-400' : 'text-neutral-600'}`}>
          {news.excerpt || news.description || truncateText(stripHtml(news.content || ""), 120)}
        </p>
        <div className={`flex items-center justify-between pt-4 mt-auto ${darkMode ? 'border-t border-white/10' : 'border-t border-neutral-100'}`}>
          <span className={`text-xs font-medium flex items-center gap-1 ${darkMode ? 'text-neutral-500' : 'text-neutral-500'}`}>
             <Clock size={12} />
             {formatDate(news.published_at)}
          </span>
          <button className="text-red-600 hover:text-red-700 text-xs font-bold flex items-center gap-1 uppercase tracking-wide">
            Leer más <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </article>
  );
}
