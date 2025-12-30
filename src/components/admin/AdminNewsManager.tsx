"use client";
import { useEffect, useState } from "react";
import { Edit, Plus, FileText, User, LayoutGrid, List as ListIcon, Bot, RefreshCw, Filter, Trash2, Globe, Eye } from "lucide-react";
import NewsCard from "@/components/news/NewsCard";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";

interface News {
  id: string;
  title: string;
  subtitle?: string;
  content?: string;
  excerpt?: string;
  seo_description?: string;
  image_url: string;
  published_at: string;
  category?: string;
  subcategory?: string;
  author?: string;
  league?: string;
  country?: string;
  team?: string;
  tags?: string[];
  slug: string;
  status?: string;
}

import { getCachedNews, setCachedNews, removeCachedItem, updateCachedItem } from "@/lib/newsCache";
import { useEditorWorkspace } from "@/context/EditorWorkspaceContext";

export default function AdminNewsManager() {
  const { openEditor, updateDraft } = useEditorWorkspace();
  const [newsList, setNewsList] = useState<News[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [filterStatus, setFilterStatus] = useState<'all' | 'published' | 'draft'>('all');
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState<string | null>(null);

  const fetchNews = async () => {
    // 1. Instant Cache Load
    const cached = getCachedNews();
    if (cached && cached.length > 0 && filterStatus === 'all') {
       setNewsList(cached);
       setLoading(false);
    }

    try {
      let query = supabase
        .from('news')
        .select('id, title, subtitle, image_url, published_at, category, subcategory, author, status, slug, tags, excerpt, seo_description')
        .order('published_at', { ascending: false });
      
      if (filterStatus !== 'all') {
        query = query.eq('status', filterStatus);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      setNewsList(data || []);
      // Update Cache if we are viewing all
      if (filterStatus === 'all') {
         setCachedNews(data || []);
      }
    } catch (error) {
      console.error("Error fetching news:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNews();
  }, [filterStatus]);

  const handleEdit = async (news: News) => {
    // 1. Open immediately with current data
    openEditor({
        ...news,
        content: news.content || "" // Will be empty initially if not fetched
    });

    // 2. Always try to fetch fresh content from Supabase (bypassing cache for editing)
    const { data, error } = await supabase
        .from('news')
        .select('content, excerpt, seo_title, seo_description, subtitle')
        .eq('id', news.id)
        .single();
    
    if (!error && data) {
        // Update the editor with fresh data
        openEditor({
            ...news,
            content: data.content,
            subtitle: data.subtitle,
            description: data.excerpt || data.seo_description
        });
    }
  };

  const handlePublish = async (id: string) => {
    setIsPublishing(id);
    const toastId = toast.loading("Publishing...");
    // Optimistic Update
    setNewsList(prev => prev.map(n => n.id === id ? { ...n, status: 'published' } : n));
    
    try {
        const { error } = await supabase.from('news').update({ status: 'published' }).eq('id', id);
        if (error) throw error;
        
        // Update Cache
        updateCachedItem({ id, status: 'published' });
        toast.success("Published successfully", { id: toastId });
    } catch (error) {
        console.error("Error publishing:", error);
        toast.error("Failed to publish", { id: toastId });
        // Revert
        fetchNews();
    } finally {
        setIsPublishing(null);
    }
  };

  const handleDelete = async (id: string) => {
    // Ideally replace confirm with a custom modal, but toast is priority for status
    if (!confirm("Are you sure you want to delete this story? This action cannot be undone.")) return;
    
    setIsDeleting(id);
    const toastId = toast.loading("Deleting...");
    
    // Optimistic UI Update
    const previousList = [...newsList];
    setNewsList(prev => prev.filter(n => n.id !== id));
    
    try {
      const { error } = await supabase.from('news').delete().eq('id', id);
      if (error) throw error;
      
      // Update Cache
      removeCachedItem(id);
      toast.success("Deleted successfully", { id: toastId });
    } catch (error) {
      console.error("Error deleting news:", error);
      toast.error("Failed to delete news item", { id: toastId });
      // Revert UI
      setNewsList(previousList);
    } finally {
      setIsDeleting(null);
    }
  };

  return (
    <div className="space-y-8">
       {/* Controls Toolbar */}
       <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-6 border-b border-white/10">
        
        {/* Filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 xl:pb-0">
          <button 
            onClick={() => setFilterStatus('all')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${filterStatus === 'all' ? 'bg-white text-black' : 'bg-white/5 text-neutral-400 hover:bg-white/10'}`}
          >
            All Stories
          </button>
          <button 
            onClick={() => setFilterStatus('published')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap flex items-center gap-2 ${filterStatus === 'published' ? 'bg-green-500/20 text-green-400 border border-green-500/50' : 'bg-white/5 text-neutral-400 hover:bg-white/10'}`}
          >
            <Globe size={14} /> Published
          </button>
          <button 
            onClick={() => setFilterStatus('draft')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap flex items-center gap-2 ${filterStatus === 'draft' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50' : 'bg-white/5 text-neutral-400 hover:bg-white/10'}`}
          >
            <FileText size={14} /> Drafts
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
           {/* View Toggle */}
           <div className="flex bg-black/50 p-1 rounded-lg border border-white/10">
              <button 
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white/10 text-white' : 'text-neutral-500 hover:text-neutral-300'}`}
              >
                <LayoutGrid size={18} />
              </button>
              <button 
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-md transition-all ${viewMode === 'list' ? 'bg-white/10 text-white' : 'text-neutral-500 hover:text-neutral-300'}`}
              >
                <ListIcon size={18} />
              </button>
           </div>

           <div className="h-8 w-[1px] bg-white/10 mx-2 hidden md:block"></div>

           <button className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold px-4 py-2.5 rounded-lg shadow-lg shadow-purple-900/20 hover:shadow-purple-900/40 transition-all text-sm group">
              <Bot size={18} className="group-hover:animate-bounce" />
              <span>AI Generate</span>
           </button>

           <button 
            onClick={() => openEditor({
                id: 'new',
                title: '',
                content: '',
                image_url: '',
                published_at: new Date().toISOString(),
                slug: '',
                status: 'draft'
            })}
            className="flex items-center gap-2 bg-white text-black font-bold px-4 py-2.5 rounded-lg hover:bg-neutral-200 transition-all text-sm"
           >
              <Plus size={18} />
              New Story
            </button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-32 text-neutral-500">
            <RefreshCw className="animate-spin mb-4 text-red-500" size={32} />
            <p className="font-mono text-sm">Syncing with database...</p>
        </div>
      ) : newsList.length === 0 ? (
        <div className="bg-white/5 rounded-2xl p-16 text-center border border-white/10 border-dashed">
          <div className="w-20 h-20 bg-white/5 text-neutral-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <FileText size={32} />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">No stories found</h3>
          <p className="text-neutral-400 mb-8 max-w-md mx-auto">Try changing your filters or create a new story.</p>
          <button 
            onClick={() => openEditor({
                id: 'new',
                title: '',
                content: '',
                image_url: '',
                published_at: new Date().toISOString(),
                slug: '',
                status: 'draft'
            })}
            className="text-red-500 font-bold hover:text-red-400 transition-colors"
          >
            Create First Story &rarr;
          </button>
        </div>
      ) : (
        <>
          {viewMode === 'grid' ? (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {newsList.map((news) => (
                  <div key={news.id} className="relative group">
                    <NewsCard news={news} showStatus={true} darkMode={true} onClick={() => {}} />
                    
                    {/* Hover Overlay Actions */}
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center gap-3 rounded-xl z-10 p-4">
                        <a onClick={() => handleEdit(news)} className="w-full max-w-[140px] cursor-pointer">
                            <button className="w-full bg-white text-black px-4 py-2 rounded-lg font-bold text-sm hover:scale-105 transition-transform flex items-center justify-center gap-2">
                               <Edit size={14} /> Edit
                            </button>
                          </a>
                        
                        {news.status !== 'published' && (
                           <button 
                             onClick={() => handlePublish(news.id)}
                             disabled={isPublishing === news.id}
                             className="w-full max-w-[140px] bg-green-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:scale-105 transition-transform flex items-center justify-center gap-2"
                           >
                              {isPublishing === news.id ? <RefreshCw className="animate-spin" size={14} /> : <Globe size={14} />}
                              Go Live
                           </button>
                        )}

                        <button 
                          onClick={() => handleDelete(news.id)}
                          disabled={isDeleting === news.id}
                          className="w-full max-w-[140px] bg-red-600/20 border border-red-600/50 text-red-500 px-4 py-2 rounded-lg font-bold text-sm hover:bg-red-600 hover:text-white transition-all flex items-center justify-center gap-2"
                        >
                           {isDeleting === news.id ? <RefreshCw className="animate-spin" size={14} /> : <Trash2 size={14} />}
                           Delete
                        </button>
                    </div>
                  </div>
                ))}
             </div>
          ) : (
            <div className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
               <table className="w-full text-left border-collapse">
                 <thead className="bg-black/20 text-neutral-400 text-xs uppercase tracking-wider font-mono">
                   <tr>
                     <th className="p-4">Status</th>
                     <th className="p-4">Title</th>
                     <th className="p-4">Category</th>
                     <th className="p-4">Author</th>
                     <th className="p-4">Date</th>
                     <th className="p-4 text-right">Actions</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-white/5 text-neutral-300 text-sm">
                   {newsList.map((n) => (
                     <tr key={n.id} className="hover:bg-white/5 transition-colors">
                        <td className="p-4">
                           <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-bold ${n.status === 'published' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${n.status === 'published' ? 'bg-green-400' : 'bg-yellow-400'}`}></span>
                              {n.status === 'published' ? 'Published' : 'Draft'}
                           </span>
                        </td>
                        <td className="p-4 font-medium text-white">
                          <div className="flex items-center gap-3">
                            {n.image_url && (
                              <img src={n.image_url} alt="" className="w-8 h-8 rounded object-cover bg-neutral-800" />
                            )}
                            <span className="line-clamp-1">{n.title}</span>
                          </div>
                        </td>
                        <td className="p-4">
                           <span className="bg-white/10 px-2 py-1 rounded text-xs">{n.category || "General"}</span>
                        </td>
                        <td className="p-4 text-neutral-500">{n.author || "System"}</td>
                        <td className="p-4 text-neutral-500 text-xs font-mono">
                          {new Date(n.published_at).toLocaleDateString()}
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {n.status !== 'published' && (
                              <button 
                                onClick={() => handlePublish(n.id)}
                                disabled={isPublishing === n.id}
                                className="p-2 hover:bg-green-500/20 rounded text-neutral-400 hover:text-green-400 transition-colors"
                                title="Publish Now"
                              >
                                {isPublishing === n.id ? <RefreshCw className="animate-spin" size={16} /> : <Globe size={16} />}
                              </button>
                            )}
                            <button 
                                onClick={() => handleEdit(n)} 
                                className="p-2 hover:bg-white/10 rounded text-neutral-400 hover:text-white transition-colors"
                            >
                                <Edit size={16} />
                            </button>
                            <button 
                              onClick={() => handleDelete(n.id)}
                              disabled={isDeleting === n.id}
                              className="p-2 hover:bg-red-500/20 rounded text-neutral-400 hover:text-red-500 transition-colors"
                            >
                               {isDeleting === n.id ? <RefreshCw className="animate-spin" size={16} /> : <Trash2 size={16} />}
                            </button>
                          </div>
                        </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
