"use client";
import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import TiptapEditor from "@/components/news/TiptapEditor";
import { Save, ArrowLeft, Image as ImageIcon, Tag, User, Type, LayoutTemplate, AlertCircle } from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import FloatingEditorDock from "@/components/admin/FloatingEditorDock";
import { updateCachedItem } from "@/lib/newsCache";

interface News {
  id: string;
  title: string;
  content: string;
  image_url: string;
  published_at: string;
  category?: string;
  author?: string;
  slug: string;
  status?: string;
}

export default function EditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const isNew = id === "new";
  
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  
  // Form State
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("General");
  const [imageUrl, setImageUrl] = useState("");
  const [author, setAuthor] = useState("Admin");
  const [status, setStatus] = useState("draft");

  useEffect(() => {
    if (isNew) return;

    // Try to load from localStorage context first
    const savedContext = localStorage.getItem("draft_news_edit");
    if (savedContext) {
      const news: News = JSON.parse(savedContext);
      // Ensure we have content. If not (e.g. came from optimized list), we must fetch from DB.
      if (news.id === id && news.content !== undefined) {
        setTitle(news.title);
        setContent(news.content);
        setCategory(news.category || "General");
        setImageUrl(news.image_url || "");
        setAuthor(news.author || "Admin");
        setStatus(news.status || "draft");
        setLoading(false);
        return;
      }
    }

    // Fallback: Fetch from Supabase directly if LS is missing
    const fetchNews = async () => {
      try {
        const { data, error } = await supabase.from('news').select('*').eq('id', id).single();
        if (error) throw error;
        if (data) {
          setTitle(data.title);
          setContent(data.content);
          setCategory(data.category || "General");
          setImageUrl(data.image_url || "");
          setAuthor(data.author || "Admin");
          setStatus(data.status || "draft");
        }
      } catch (error) {
        console.error("Error loading news:", error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchNews();
  }, [id, isNew]);

  const handleSave = async () => {
    setSaving(true);
    
    const newsData = {
      id: isNew ? crypto.randomUUID() : id,
      title,
      content,
      image_url: imageUrl,
      category,
      author,
      published_at: new Date().toISOString(),
      slug: title.toLowerCase().replace(/ /g, "-").replace(/[^\w-]+/g, ""),
      status
    };

    try {
      // 1. Try API First (Best for business logic)
      let saved = false;
      try {
        const response = await fetch('http://localhost:8000/api/news', {
          method: isNew ? 'POST' : 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newsData)
        });
        
        if (response.ok) {
          saved = true;
        } else {
          console.warn("Backend save failed, attempting direct DB save...");
        }
      } catch (err) {
        console.warn("Backend unavailable, attempting direct DB save...", err);
      }

      // 2. Fallback: Direct Supabase Save
      if (!saved) {
        const { error } = await supabase.from('news').upsert(newsData);
        if (error) throw error;
      }

      console.log("Saved news:", newsData);
      
      // Update the 'edit context' just in case
      localStorage.setItem("draft_news_edit", JSON.stringify(newsData));
      
      router.push("/admin"); // Return to dashboard
    } catch (error) {
      console.error("Error saving:", error);
      alert("Error saving content. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleAIFormat = () => {
     // Simple placeholder logic for "Intelligent" formatting
     // In future, this would call an AI endpoint
     const cleaned = content
        .replace(/<div/g, '<p')
        .replace(/<\/div>/g, '</p>')
        .replace(/&nbsp;/g, ' ');
     setContent(cleaned);
     alert("Simple formatting applied! (AI endpoint to be connected)");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-32">
      {/* Floating Dock for "Brutal" Control */}
      <FloatingEditorDock 
         status={status}
         setStatus={setStatus}
         onSave={handleSave}
         saving={saving}
         onAIFormat={handleAIFormat}
      />

      {/* Header */}
      <div className="flex items-center justify-between pb-6 border-b border-white/10">
        <div className="flex items-center gap-4">
          <Link href="/admin">
            <button className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white transition-colors">
              <ArrowLeft size={20} />
            </button>
          </Link>
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">
              {isNew ? "Create Story" : "Edit Story"}
            </h1>
            <p className="text-neutral-500 text-sm">
              {isNew ? "Drafting a new piece" : `Editing ID: ${id.slice(0, 8)}...`}
            </p>
          </div>
        </div>
        
        {/* Removed top buttons in favor of Floating Dock */}
        <div className="text-neutral-500 text-xs font-mono">
           {status === 'published' ? '🟢 Live' : '🟡 Draft Mode'}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Editor Area */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Title Input */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider flex items-center gap-2">
              <Type size={14} /> Headline
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter an engaging headline..."
              className="w-full text-3xl font-bold bg-transparent border-b border-white/10 py-4 text-white placeholder-neutral-700 focus:outline-none focus:border-red-500 transition-colors"
            />
          </div>

          {/* Editor */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider flex items-center gap-2">
              <LayoutTemplate size={14} /> Content Body
            </label>
            <TiptapEditor value={content} onChange={setContent} />
          </div>

        </div>

        {/* Sidebar Settings */}
        <div className="space-y-6">
           {/* Cover Image */}
           <div className="bg-white/5 p-6 rounded-2xl border border-white/10 space-y-4">
              <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-2">
                 <ImageIcon size={14} /> Cover Image
              </label>
              
              <div className="aspect-video bg-black/40 rounded-xl overflow-hidden border border-white/5 relative group">
                 {imageUrl ? (
                   <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
                 ) : (
                   <div className="w-full h-full flex flex-col items-center justify-center text-neutral-600">
                      <ImageIcon size={32} className="mb-2" />
                      <span className="text-xs">No image set</span>
                   </div>
                 )}
              </div>

              <input
                type="text"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-4 py-2 bg-black/40 border border-white/10 rounded-lg text-sm text-white focus:border-white/30 outline-none transition-all"
              />
           </div>

           {/* Metadata */}
           <div className="bg-white/5 p-6 rounded-2xl border border-white/10 space-y-6">
              <div className="space-y-2">
                 <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-2">
                    <Tag size={14} /> Category
                 </label>
                 <select 
                   value={category}
                   onChange={(e) => setCategory(e.target.value)}
                   className="w-full px-4 py-2 bg-black/40 border border-white/10 rounded-lg text-sm text-white focus:border-white/30 outline-none transition-all appearance-none"
                 >
                   <option value="General">General</option>
                   <option value="Fútbol">Fútbol</option>
                   <option value="Baloncesto">Baloncesto</option>
                   <option value="Tenis">Tenis</option>
                   <option value="F1">Fórmula 1</option>
                 </select>
              </div>

              <div className="space-y-2">
                 <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-2">
                    <User size={14} /> Author
                 </label>
                 <input
                   type="text"
                   value={author}
                   onChange={(e) => setAuthor(e.target.value)}
                   className="w-full px-4 py-2 bg-black/40 border border-white/10 rounded-lg text-sm text-white focus:border-white/30 outline-none transition-all"
                 />
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
