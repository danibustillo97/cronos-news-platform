import React, { useState } from 'react';
import { Play, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import TikTokEmbed from '@/components/social/TikTokEmbed';

// Mock data - In production this would come from Supabase 'news' table where type='video'
const MOCK_STORIES = [
  {
    id: '1',
    title: 'Resumen de la Jornada',
    thumbnail: 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=500&q=80',
    tiktokId: '7455844784462613766', // Example ID
    author: 'Nexus Sports'
  },
  {
    id: '2',
    title: 'Golazo de Messi',
    thumbnail: 'https://images.unsplash.com/photo-1614632537423-1e6c2e7e0aab?w=500&q=80',
    tiktokId: '7455844784462613766',
    author: 'Nexus Sports'
  },
  {
    id: '3',
    title: 'Fichajes Bomba',
    thumbnail: 'https://images.unsplash.com/photo-1522778119026-d647f0565c6a?w=500&q=80',
    tiktokId: '7455844784462613766',
    author: 'Nexus Sports'
  },
  {
    id: '4',
    title: 'NBA Highlights',
    thumbnail: 'https://images.unsplash.com/photo-1546519638-68e109498ee2?w=500&q=80',
    tiktokId: '7455844784462613766',
    author: 'Nexus Sports'
  }
];

export default function VideoStories() {
  const [selectedStory, setSelectedStory] = useState<string | null>(null);

  const activeStory = MOCK_STORIES.find(s => s.id === selectedStory);

  return (
    <div className="w-full mb-8">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-2 h-8 bg-red-600 rounded-full" />
        <h2 className="text-xl font-bold text-neutral-800">Nexus Stories</h2>
        <span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-1 rounded-full animate-pulse">
          LIVE
        </span>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
        {MOCK_STORIES.map((story) => (
          <motion.div
            key={story.id}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setSelectedStory(story.id)}
            className="flex-shrink-0 relative w-32 h-48 md:w-40 md:h-64 rounded-xl overflow-hidden cursor-pointer group shadow-md"
          >
            <img
              src={story.thumbnail}
              alt={story.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex flex-col justify-end p-3">
              <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center mb-2 group-hover:bg-red-600 transition-colors">
                <Play size={12} className="text-white fill-current" />
              </div>
              <p className="text-white text-xs font-bold leading-tight line-clamp-2">
                {story.title}
              </p>
            </div>
            <div className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border border-white animate-pulse" />
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {selectedStory && activeStory && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
            onClick={() => setSelectedStory(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-sm bg-black rounded-2xl overflow-hidden shadow-2xl border border-white/10"
            >
              <button
                onClick={() => setSelectedStory(null)}
                className="absolute top-4 right-4 z-10 p-2 bg-black/50 rounded-full text-white hover:bg-white/20 transition-colors"
              >
                <X size={20} />
              </button>
              
              <div className="aspect-[9/16] bg-neutral-900 flex items-center justify-center">
                 <TikTokEmbed videoId={activeStory.tiktokId} className="w-full h-full" />
              </div>
              
              <div className="p-4 bg-neutral-900">
                <h3 className="text-white font-bold">{activeStory.title}</h3>
                <p className="text-neutral-400 text-sm">@{activeStory.author}</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
