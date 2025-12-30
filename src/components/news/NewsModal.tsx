'use client'

import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Calendar, User, Clock, Share2, Facebook, Twitter, Linkedin } from 'lucide-react'
import { formatArticleContent } from '@/lib/textUtils'
import RelatedNews from './RelatedNews'
import DOMPurify from 'isomorphic-dompurify';
import parse from 'html-react-parser';
import type { NewsView } from '@/types/news';

interface NewsModalProps {
  news: NewsView | null
  onClose: () => void
  onNewsClick?: (news: NewsView) => void
}

const formatDate = (dateString: string) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  return new Intl.DateTimeFormat('es-CO', { 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric',
    hour: '2-digit', 
    minute: '2-digit' 
  }).format(date)
}

export default function NewsModal({ news, onClose, onNewsClick }: NewsModalProps) {
  // Local state to handle news switching within modal
  const [currentNews, setCurrentNews] = useState<NewsView | null>(news);

  useEffect(() => {
    setCurrentNews(news);
  }, [news]);

  const handleRelatedClick = (newNews: NewsView) => {
    setCurrentNews(newNews);
    // Also scroll to top
    const container = document.querySelector('.custom-scroll');
    if (container) container.scrollTop = 0;
    
    if (onNewsClick) onNewsClick(newNews);
  };

  if (!currentNews) return null

  return (
    <AnimatePresence>
      {currentNews && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-center items-end md:items-center p-0 md:p-4"
          >
            {/* Modal Content */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
              className="bg-white w-full max-w-5xl max-h-[95vh] md:max-h-[90vh] md:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden flex flex-col relative mx-auto"
            >
              {/* Close Button */}
              <button
                onClick={onClose}
                className="absolute top-4 right-4 z-20 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full backdrop-blur-md transition-colors"
              >
                <X size={24} />
              </button>

              {/* Scrollable Content */}
              <div className="overflow-y-auto custom-scroll flex-1">
                {/* Hero Image */}
                <div className="relative aspect-video w-full max-h-[35vh] md:max-h-[40vh]">
                  <img
                    src={currentNews.image_url || 'https://via.placeholder.com/1200x800'}
                    alt={currentNews.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent" />
                  
                  <div className="absolute bottom-0 left-0 p-6 md:p-10 w-full max-w-6xl mx-auto">
                    <div className="flex items-center gap-3 mb-3">
                        <span className="bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-sm uppercase tracking-wider shadow-lg">
                        {currentNews.category || 'Noticia'}
                        </span>
                        <span className="text-neutral-300 text-xs flex items-center gap-1">
                             <Clock size={12} /> {formatDate(currentNews.published_at)}
                        </span>
                    </div>
                    <h1 className="text-2xl md:text-3xl lg:text-4xl font-black text-white leading-tight mb-2 drop-shadow-lg">
                      {currentNews.title}
                    </h1>
                  </div>
                </div>

                {/* Article Body */}
                <div className="p-6 md:p-10 max-w-4xl mx-auto">
                  {/* Meta Data */}
                  <div className="flex flex-wrap items-center gap-6 text-sm text-neutral-500 mb-10 border-b border-neutral-100 pb-8">
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 bg-neutral-100 rounded-full flex items-center justify-center text-neutral-400">
                        <User size={20} />
                      </div>
                      <div className="flex flex-col">
                         <span className="text-xs font-bold text-neutral-400 uppercase">Por</span>
                         <span className="font-bold text-neutral-900 text-base">{currentNews.author || 'Redacción Nexus'}</span>
                      </div>
                    </div>
                    <div className="h-8 w-[1px] bg-neutral-200 hidden sm:block"></div>
                    <div className="flex items-center gap-2">
                      <Calendar size={18} className="text-neutral-400" />
                      <span className="font-medium">{formatDate(currentNews.published_at)}</span>
                    </div>
                    <div className="ml-auto flex gap-2">
                        {/* Social Buttons */}
                        <button className="p-2.5 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors shadow-sm hover:shadow-md">
                            <Facebook size={18} />
                        </button>
                        <button className="p-2.5 bg-sky-500 text-white rounded-full hover:bg-sky-600 transition-colors shadow-sm hover:shadow-md">
                            <Twitter size={18} />
                        </button>
                        <button className="p-2.5 bg-green-500 text-white rounded-full hover:bg-green-600 transition-colors shadow-sm hover:shadow-md">
                            <Share2 size={18} />
                        </button>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="prose prose-xl max-w-3xl mx-auto text-neutral-800 leading-loose px-6 md:px-0
                    prose-headings:font-black prose-headings:text-neutral-900 
                    prose-p:mb-8 prose-p:text-xl prose-p:leading-[2] prose-p:font-serif
                    prose-a:text-red-600 prose-a:font-bold prose-a:no-underline hover:prose-a:underline
                    prose-img:rounded-2xl prose-img:shadow-xl prose-img:w-full prose-img:my-8
                    prose-strong:text-neutral-900 prose-strong:font-black
                    prose-blockquote:border-l-4 prose-blockquote:border-red-600 prose-blockquote:pl-6 prose-blockquote:italic prose-blockquote:text-neutral-600 prose-blockquote:bg-neutral-50 prose-blockquote:py-2 prose-blockquote:rounded-r-lg
                    [&>p:first-of-type]:first-letter:text-7xl [&>p:first-of-type]:first-letter:font-black [&>p:first-of-type]:first-letter:text-red-600 [&>p:first-of-type]:first-letter:mr-4 [&>p:first-of-type]:first-letter:float-left [&>p:first-of-type]:first-letter:leading-[0.8]
                  ">
                    {parse(DOMPurify.sanitize(formatArticleContent(currentNews.content || '')))}
                  </div>

                  {/* Related News Section */}
                  <RelatedNews 
                    currentNewsId={currentNews.id} 
                    category={currentNews.category} 
                    onNewsClick={handleRelatedClick}
                  />

                </div>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
