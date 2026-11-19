'use client'

import React, { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import ModernNavbar from '@/components/ui/ModernNavbar'
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
        // Full-screen window, not a centered card -- the reading measure
        // (max-w-5xl) lives inside ArticleContent itself now, so it stays
        // comfortable to read without capping how much of the screen the
        // window itself uses.
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          className="fixed inset-0 z-50 bg-white text-neutral-900 flex flex-col"
        >
          {/* The real site navbar -- the window is a full page now, not a
              card floating over a backdrop, so it gets the same chrome
              every other page has. */}
          <ModernNavbar />

          {/* Close Button -- there's no "back" affordance in the navbar
              itself (it's built for real pages, not this modal-over-feed
              UX), so a floating close stays, just moved below the bar. */}
          <button
            onClick={onClose}
            className="fixed top-20 right-4 z-[60] bg-neutral-900/80 hover:bg-neutral-950 text-white p-2.5 rounded-full backdrop-blur-md transition-all duration-200 shadow-lg"
            aria-label="Cerrar"
          >
            <X size={22} />
          </button>

          {/* Scrollable Content -- same real ArticleContent the
              standalone page renders, so the "floating window" design
              is the ONE reading experience everywhere. */}
          <div className="overflow-y-auto custom-scroll flex-1 pt-16">
            <ArticleContent news={currentNews} onRelatedClick={handleRelatedClick} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
