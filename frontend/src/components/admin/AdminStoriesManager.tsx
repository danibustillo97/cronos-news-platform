import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Plus, Trash2, Play, Image as ImageIcon, Smartphone, Database, Copy } from 'lucide-react';
import { toast } from 'sonner';

interface Story {
  id: string;
  title: string;
  thumbnail_url: string;
  tiktok_id: string;
  author: string;
  created_at: string;
}

export default function AdminStoriesManager() {
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [setupRequired, setSetupRequired] = useState(false);
  
  // Form State
  const [newStory, setNewStory] = useState({
    title: '',
    thumbnail_url: '',
    tiktok_id: '',
    author: 'Nexus Sports'
  });

  useEffect(() => {
    fetchStories();
  }, []);

  const fetchStories = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('stories')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching stories:', error);
      // Check if table missing (generic error or 404)
      setSetupRequired(true);
    } else {
      setStories(data || []);
      setSetupRequired(false);
    }
    setLoading(false);
  };

  const handleCopySQL = () => {
    const sql = `
-- 1. Create Stories Table for TikTok Integration
create table if not exists public.stories (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  thumbnail_url text,
  tiktok_id text not null,
  author text default 'Nexus Sports',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  views bigint default 0
);

-- 2. Add Views Column to News Table (if not exists)
alter table public.news add column if not exists views bigint default 0;

-- 3. Enable Row Level Security (RLS)
alter table public.stories enable row level security;

-- 4. Create Policies for Stories
create policy "Public stories are viewable by everyone" 
  on public.stories for select 
  using (true);

create policy "Admins can insert stories" 
  on public.stories for insert 
  with check (auth.role() = 'authenticated');

create policy "Admins can update stories" 
  on public.stories for update 
  using (auth.role() = 'authenticated');

create policy "Admins can delete stories" 
  on public.stories for delete 
  using (auth.role() = 'authenticated');
    `;
    navigator.clipboard.writeText(sql);
    toast.success("SQL copied to clipboard!");
  };

  if (setupRequired) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center space-y-6">
        <div className="w-20 h-20 bg-red-900/20 rounded-full flex items-center justify-center mb-4 animate-pulse">
           <Database className="text-red-500" size={40} />
        </div>
        <h2 className="text-2xl font-bold text-white">Setup Required</h2>
        <p className="text-neutral-400 max-w-lg">
          The <code>stories</code> table was not found in your Supabase database. 
          Please run the migration script to enable TikTok Stories features.
        </p>
        
        <div className="flex gap-4">
          <button 
            onClick={handleCopySQL}
            className="flex items-center gap-2 bg-neutral-800 hover:bg-neutral-700 text-white px-6 py-3 rounded-xl font-bold transition-all border border-white/10"
          >
            <Copy size={18} />
            Copy SQL Script
          </button>
          <a 
            href="https://supabase.com/dashboard/project/_/sql" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg shadow-red-900/20"
          >
            Open Supabase SQL Editor
          </a>
        </div>
      </div>
    );
  }

  const handleCreate = async () => {
    if (!newStory.title || !newStory.tiktok_id) {
      toast.error("Title and TikTok ID are required");
      return;
    }

    const toastId = toast.loading("Creating story...");
    
    // Default thumbnail if none provided
    const storyData = {
      ...newStory,
      thumbnail_url: newStory.thumbnail_url || 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=500&q=80'
    };

    const { data, error } = await supabase
      .from('stories')
      .insert([storyData])
      .select()
      .single();

    if (error) {
      console.error(error);
      toast.error("Failed to create story", { id: toastId });
    } else {
      setStories([data, ...stories]);
      setIsCreating(false);
      setNewStory({ title: '', thumbnail_url: '', tiktok_id: '', author: 'Nexus Sports' });
      toast.success("Story created successfully", { id: toastId });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this story?")) return;
    
    const { error } = await supabase.from('stories').delete().eq('id', id);
    
    if (error) {
      toast.error("Failed to delete");
    } else {
      setStories(stories.filter(s => s.id !== id));
      toast.success("Deleted successfully");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-white/10 pb-6">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Smartphone className="text-red-500" />
            TikTok Stories Manager
          </h2>
          <p className="text-sm text-neutral-400">Manage viral vertical video content.</p>
        </div>
        <button 
          onClick={() => setIsCreating(true)}
          className="bg-white text-black px-4 py-2 rounded-lg font-bold hover:bg-neutral-200 transition-colors flex items-center gap-2"
        >
          <Plus size={18} /> New Story
        </button>
      </div>

      {isCreating && (
        <div className="bg-neutral-900/50 border border-white/10 rounded-xl p-6 mb-8 animate-in slide-in-from-top-4">
          <h3 className="text-lg font-bold text-white mb-4">New Story</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-500">Title</label>
              <input 
                value={newStory.title}
                onChange={e => setNewStory({...newStory, title: e.target.value})}
                className="w-full bg-black border border-white/10 rounded-lg p-3 text-sm text-white focus:border-red-500 outline-none"
                placeholder="Ex: Golazo de Messi..."
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-500">TikTok Video ID</label>
              <input 
                value={newStory.tiktok_id}
                onChange={e => setNewStory({...newStory, tiktok_id: e.target.value})}
                className="w-full bg-black border border-white/10 rounded-lg p-3 text-sm text-white focus:border-red-500 outline-none"
                placeholder="Ex: 7455844784462613766"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-500">Thumbnail URL</label>
              <input 
                value={newStory.thumbnail_url}
                onChange={e => setNewStory({...newStory, thumbnail_url: e.target.value})}
                className="w-full bg-black border border-white/10 rounded-lg p-3 text-sm text-white focus:border-red-500 outline-none"
                placeholder="https://..."
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-500">Author</label>
              <input 
                value={newStory.author}
                onChange={e => setNewStory({...newStory, author: e.target.value})}
                className="w-full bg-black border border-white/10 rounded-lg p-3 text-sm text-white focus:border-red-500 outline-none"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <button 
              onClick={() => setIsCreating(false)}
              className="px-4 py-2 text-neutral-400 hover:text-white"
            >
              Cancel
            </button>
            <button 
              onClick={handleCreate}
              className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg transition-colors"
            >
              Create Story
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-neutral-500">Loading stories...</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {stories.map(story => (
            <div key={story.id} className="group relative aspect-[9/16] bg-neutral-900 rounded-xl overflow-hidden border border-white/10 hover:border-red-500/50 transition-all">
              <img 
                src={story.thumbnail_url} 
                alt={story.title}
                className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity"
              />
              <div className="absolute inset-0 flex flex-col justify-end p-4 bg-gradient-to-t from-black/90 to-transparent">
                <h4 className="text-white font-bold text-sm leading-tight mb-1 line-clamp-2">{story.title}</h4>
                <p className="text-neutral-400 text-xs">ID: {story.tiktok_id}</p>
              </div>
              
              <button 
                onClick={() => handleDelete(story.id)}
                className="absolute top-2 right-2 p-2 bg-black/50 hover:bg-red-600 rounded-full text-white opacity-0 group-hover:opacity-100 transition-all"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {stories.length === 0 && (
            <div className="col-span-full py-12 text-center text-neutral-500 border border-dashed border-neutral-800 rounded-xl">
              No stories found. Create one to get started!
            </div>
          )}
        </div>
      )}
    </div>
  );
}
