import React, { useState, useEffect } from 'react';
import { Play, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import TikTokEmbed from '@/components/social/TikTokEmbed';
import { supabase } from '@/lib/supabaseClient';

interface Story {
  id: string;
  title: string;
  thumbnail_url: string;
  tiktok_id: string;
  author: string;
}

export default function VideoStories() {
  const [stories, setStories] = useState<Story[]>([]);
  const [selectedStory, setSelectedStory] = useState<string | null>(null);

  useEffect(() => {
    const fetchStories = async () => {
      const { data } = await supabase
        .from('stories')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (data) {
        setStories(data);
      }
    };
    fetchStories();

    // Subscribe to new stories
    const channel = supabase
      .channel('public:stories')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'stories' }, (payload) => {
        setStories((current) => [payload.new as Story, ...current]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const activeStory = stories.find(s => s.id === selectedStory);

  if (stories.length === 0) return null;

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
        {stories.map((story) => (
          <motion.div
            key={story.id}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setSelectedStory(story.id)}
            className="flex-shrink-0 relative w-32 h-48 md:w-40 md:h-64 rounded-xl overflow-hidden cursor-pointer group shadow-md"
          >
            <img
              src={story.thumbnail_url}
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
                 <TikTokEmbed videoId={activeStory.tiktok_id} className="w-full h-full" />
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
