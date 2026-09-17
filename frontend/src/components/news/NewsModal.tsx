'use client'

import React, { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import ArticleContent from './ArticleContent'
import type { NewsView } from '@/types/news'

interface NewsModalProps {
  news: NewsView | null
  onClose: () => void
  onNewsClick?: (news: NewsView) => void
}

export default function NewsModal({ news, onClose, onNewsClick }: NewsModalProps) {
  const currentNews = news;

  // ESC cierra en desktop, y el body no debe poder scrollear por detrás
  // del modal mientras está abierto (sección 7 del pedido).
  useEffect(() => {
    if (!currentNews) return;
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [currentNews, onClose]);

  const handleRelatedClick = (newNews: NewsView) => {
    const container = document.querySelector('.custom-scroll');
    if (container) container.scrollTop = 0;
    onNewsClick?.(newNews);
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
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex justify-center items-end md:items-center p-0 md:p-4"
          >
            {/* Modal Content */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
              className="bg-white text-neutral-900 w-full max-w-5xl max-h-[95vh] md:max-h-[90vh] md:rounded-[28px] rounded-t-[28px] shadow-[0_35px_100px_rgba(15,23,42,0.35)] overflow-hidden flex flex-col relative mx-auto border border-neutral-200"
            >
              {/* Close Button */}
              <button
                onClick={onClose}
                className="absolute top-4 right-4 z-20 bg-neutral-900/80 hover:bg-neutral-950 text-white p-2.5 rounded-full backdrop-blur-md transition-all duration-200 shadow-lg"
              >
                <X size={22} />
              </button>

              {/* Scrollable Content -- same real ArticleContent the
                  standalone page renders, so the "floating window" design
                  is the ONE reading experience everywhere. */}
              <div className="overflow-y-auto custom-scroll flex-1">
                <ArticleContent news={currentNews} onRelatedClick={handleRelatedClick} />
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
