"use client";
import { useState, useEffect, useRef } from 'react';
import { X, Minus, Maximize2, Save, MoreVertical, Globe, RefreshCw, Trash2, Minimize2, Image as ImageIcon, Tag, Layout, FileText, AlertCircle, CheckCircle, BarChart3, Settings, PanelRightClose, PanelRightOpen, ChevronRight, ChevronDown } from 'lucide-react';
import { NewsDraft, useEditorWorkspace } from '@/context/EditorWorkspaceContext';
import TiptapEditor from '@/components/news/TiptapEditor';
import { supabase } from '@/lib/supabaseClient';
import { GLOBAL_CATEGORIES, getSubcategories } from '@/lib/globalCategories';
import { generateSmartTags } from '@/lib/smartTags';
import { Sparkles } from 'lucide-react';
import { toast } from 'sonner';

// Custom Select Component
const CustomSelect = ({ 
    label, 
    value, 
    options, 
    onChange, 
    placeholder = "Select..." 
}: { 
    label?: React.ReactNode, 
    value: string, 
    options: string[], 
    onChange: (val: string) => void,
    placeholder?: string 
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="space-y-2 relative" ref={containerRef}>
            {label && (
                <label className="flex items-center gap-2 text-xs font-bold text-neutral-400 uppercase tracking-wider">
                    {label}
                </label>
            )}
            <div 
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full bg-[#111] border ${isOpen ? 'border-blue-500 ring-1 ring-blue-500/20' : 'border-white/10 hover:border-white/20'} rounded-lg p-3 text-sm text-white transition-all cursor-pointer flex items-center justify-between group`}
            >
                <span className={!value ? 'text-neutral-500' : ''}>{value || placeholder}</span>
                <ChevronDown size={14} className={`text-neutral-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </div>

            {/* Dropdown Menu */}
            <div className={`absolute top-full left-0 right-0 mt-2 bg-[#161616] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden transition-all duration-200 origin-top ${isOpen ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 -translate-y-2 pointer-events-none'}`}>
                <div className="max-h-60 overflow-y-auto custom-scrollbar p-1">
                    {options.map(opt => (
                        <div 
                            key={opt}
                            onClick={() => {
                                onChange(opt);
                                setIsOpen(false);
                            }}
                            className={`px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors flex items-center justify-between ${value === opt ? 'bg-blue-600/20 text-blue-400 font-medium' : 'text-neutral-300 hover:bg-white/5 hover:text-white'}`}
                        >
                            {opt}
                            {value === opt && <CheckCircle size={12} />}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default function FloatingEditorWindow({ draft }: { draft: NewsDraft }) {
  const { closeEditor, minimizeEditor, updateDraft } = useEditorWorkspace();
  const [isSaving, setIsSaving] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  // Cover Image State
    const [isEditingCover, setIsEditingCover] = useState(false);
    const coverInputRef = useRef<HTMLInputElement>(null);

    // Focus cover input when editing starts
    useEffect(() => {
        if (isEditingCover && coverInputRef.current) {
            coverInputRef.current.focus();
        }
    }, [isEditingCover]);
  const [title, setTitle] = useState(draft.title || "");
  const [subtitle, setSubtitle] = useState(draft.subtitle || "");
  const [content, setContent] = useState(draft.content || "");
  const [coverImage, setCoverImage] = useState(draft.image_url || "");
  
  // Metadata State
  const [category, setCategory] = useState(draft.category || "Football");
  const [subcategory, setSubcategory] = useState(draft.subcategory || "");
  const [tags, setTags] = useState<string[]>(draft.tags || []);
  const [slug, setSlug] = useState(draft.slug || "");
  const [excerpt, setExcerpt] = useState(draft.description || "");
  const [tagInput, setTagInput] = useState("");
  const [activeTab, setActiveTab] = useState<'settings' | 'seo'>('settings');

  // Sync state with draft props (important for when content is fetched asynchronously)
  useEffect(() => {
    if (draft.content && draft.content !== content) {
       // If local content is empty, take the fetched content
       if (!content || content.trim() === '') {
          setContent(draft.content);
       }
    }
  }, [draft.content]);

  // Handle Escape key to minimize
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        minimizeEditor(draft.id);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [draft.id, minimizeEditor]);

  // Auto-generate slug from title if empty
  useEffect(() => {
    if (!slug && title) {
        setSlug(title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, ''));
    }
  }, [title, slug]);

  // Debounced auto-save to context (local)
  useEffect(() => {
    const timer = setTimeout(() => {
        updateDraft(draft.id, { 
            title, 
            subtitle,
            content, 
            image_url: coverImage,
            category,
            subcategory,
            tags,
            slug,
            description: excerpt
        });
    }, 1000);
    return () => clearTimeout(timer);
  }, [title, subtitle, content, coverImage, category, subcategory, tags, slug, excerpt]);

  // Smart Generation Logic (Auto-Excerpt, Auto-Subtitle, SEO)
  useEffect(() => {
      const timer = setTimeout(() => {
          // Auto-Generate Excerpt if empty and content exists
          if (!excerpt && content && content.length > 50) {
              const stripped = content.replace(/<[^>]+>/g, ''); // Simple strip HTML
              const generatedExcerpt = stripped.substring(0, 160).trim() + "...";
              setExcerpt(generatedExcerpt);
          }

          // Auto-Generate Subtitle if empty
          if (!subtitle && content && content.length > 100) {
             const stripped = content.replace(/<[^>]+>/g, '');
             // Try to take the first sentence or a chunk
             const firstSentenceMatch = stripped.match(/[^.?!]+[.?!]/);
             if (firstSentenceMatch) {
                 const potentialSubtitle = firstSentenceMatch[0].trim();
                 if (potentialSubtitle.length < 150) {
                     setSubtitle(potentialSubtitle);
                 } else {
                     setSubtitle(potentialSubtitle.substring(0, 140) + "...");
                 }
             }
          }
          
          // Smart Slug Update (only if slug is empty or auto-generated looks outdated)
          if (!slug && title) {
              setSlug(title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, ''));
          }
      }, 2000);
      return () => clearTimeout(timer);
  }, [content, title]);

  const handleSaveCloud = async () => {
    setIsSaving(true);
    const toastId = toast.loading('Saving draft...');
    try {
        const finalSlug = slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
        if (draft.id === 'new') {
            const { data, error } = await supabase
                .from('news')
                .insert({
                    title,
                    subtitle,
                    content,
                    image_url: coverImage,
                    category,
                    subcategory,
                    tags,
                    slug: finalSlug,
                    excerpt,
                    seo_description: excerpt,
                    status: 'draft',
                    published_at: new Date().toISOString(),
                })
                .select('id')
                .single();
            if (error) throw error;
            const newId = data?.id as string;
            if (!newId) throw new Error('Insert succeeded but no id returned');
            updateDraft(draft.id, { id: newId, slug: finalSlug, localChanges: false }, false);
        } else {
            const { error } = await supabase
                .from('news')
                .update({
                    title,
                    subtitle,
                    content,
                    image_url: coverImage,
                    category,
                    subcategory,
                    tags,
                    slug: finalSlug,
                    excerpt,
                    seo_description: excerpt,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', draft.id);
            if (error) throw error;
            updateDraft(draft.id, { slug: finalSlug, localChanges: false }, false);
        }
        
        toast.success('Draft saved successfully', {
            id: toastId,
            description: 'Your changes are now in the cloud.'
        });
        
    } catch (e) {
        console.error("Save failed", e);
        toast.error(`Failed to sync to cloud`, {
            id: toastId,
            description: (e as any).message
        });
    } finally {
        setIsSaving(false);
    }
  };

  const addTag = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && tagInput.trim()) {
          e.preventDefault();
          if (!tags.includes(tagInput.trim())) {
              setTags([...tags, tagInput.trim()]);
          }
          setTagInput("");
      }
  };

  const removeTag = (tagToRemove: string) => {
      setTags(tags.filter(t => t !== tagToRemove));
  };

  // Auto-generate tags when title changes significantly (optional, but good for "smart" feel)
  useEffect(() => {
      const timer = setTimeout(() => {
          // Only auto-gen if tags are empty to avoid overriding user deletions
          if (tags.length === 0 && (title.length > 10 || content.length > 50)) {
              const newTags = generateSmartTags(title, content, []);
              if (newTags.length > 0) {
                  setTags(newTags);
              }
          }
      }, 2000); // 2 second pause
      return () => clearTimeout(timer);
  }, [title, content, tags.length]);

  const handleAutoGenerateTags = () => {
      const newTags = generateSmartTags(title, content, tags);
      if (newTags.length > 0) {
          setTags([...new Set([...tags, ...newTags])]);
      }
  };

  // SEO Score Calculation
  const calculateSeoScore = () => {
      let score = 0;
      if (title.length > 20 && title.length < 70) score += 20;
      if (content.length > 300) score += 20;
      if (coverImage) score += 20;
      if (tags.length >= 3) score += 10;
      if (slug) score += 10;
      if (excerpt) score += 20;
      return score;
  };

  const seoScore = calculateSeoScore();
  const getScoreColor = (score: number) => {
      if (score >= 80) return 'text-green-500';
      if (score >= 50) return 'text-yellow-500';
      return 'text-red-500';
  };

  return (
    <div className="fixed top-20 right-0 bottom-0 left-0 md:left-64 z-[40] pointer-events-auto bg-black/95 backdrop-blur-xl animate-in fade-in zoom-in duration-200 flex flex-col shadow-[0_-10px_40px_rgba(0,0,0,0.5)] border-t border-white/10">
      <div className="w-full h-full flex flex-col bg-[#050505]">
        
        {/* Header / Window Bar */}
        <div className="h-14 bg-[#0a0a0a] border-b border-white/5 flex items-center justify-between px-4 select-none shrink-0 z-50">
            <div className="flex items-center gap-4">
                <div className="flex gap-2 group">
                    <button onClick={() => {
                        if (draft.localChanges) {
                             if (window.confirm("Close this draft? Unsaved changes will be lost.")) {
                                 closeEditor(draft.id);
                             }
                        } else {
                            closeEditor(draft.id);
                        }
                    }} className="w-3 h-3 rounded-full bg-red-500 hover:bg-red-400 transition-colors" />
                    <button onClick={() => minimizeEditor(draft.id)} className="w-3 h-3 rounded-full bg-yellow-500 hover:bg-yellow-400 transition-colors" />
                    <button className="w-3 h-3 rounded-full bg-green-500 hover:bg-green-400 transition-colors" />
                </div>
                <span className="text-sm font-mono text-neutral-400 ml-4 truncate max-w-[300px]">
                    {draft.id === 'new' ? 'Untitled Draft' : draft.title}
                </span>
                {draft.localChanges && (
                    <span className="text-[10px] text-yellow-500 bg-yellow-500/10 px-2 py-0.5 rounded-full">
                        Unsaved Changes
                    </span>
                )}
            </div>

            <div className="flex items-center gap-2">
                <button 
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    className={`p-2 rounded hover:bg-white/10 transition-colors ${isSidebarOpen ? 'text-blue-400' : 'text-neutral-400'}`}
                    title="Toggle Sidebar"
                >
                    {isSidebarOpen ? <PanelRightOpen size={18} /> : <PanelRightClose size={18} />}
                </button>
                <div className="w-[1px] h-6 bg-white/10 mx-1"></div>
                <button 
                    onClick={handleSaveCloud}
                    disabled={isSaving}
                    className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-bold transition-all"
                >
                    {isSaving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                    Save Cloud
                </button>
            </div>
        </div>

        {/* Main Layout: Editor + Sidebar */}
        <div className="flex-1 flex overflow-hidden relative">
            
            {/* LEFT: Editor Content */}
            <div className="flex-1 overflow-y-auto bg-[#050505] p-0 flex flex-col items-center custom-scrollbar min-w-0">
                <div className="w-full max-w-5xl flex flex-col h-full p-8 md:p-12 relative">
                    
                    {/* Cover Image Selector (Aspect Video 16:9) */}
                    <div className="group relative w-full aspect-video bg-neutral-900/50 rounded-2xl mb-8 overflow-hidden border border-white/5 flex items-center justify-center transition-all hover:border-white/20 shadow-2xl shrink-0">
                        {coverImage ? (
                            <>
                                <img src={coverImage} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                                    <button 
                                        onClick={() => setIsEditingCover(true)}
                                        className="bg-white text-black px-6 py-3 rounded-full text-sm font-bold flex items-center gap-2 shadow-xl transform scale-90 group-hover:scale-100 transition-transform hover:bg-neutral-200"
                                    >
                                        <ImageIcon size={18} /> Change Cover
                                    </button>
                                </div>
                            </>
                        ) : (
                            <div 
                                onClick={() => setIsEditingCover(true)}
                                className="flex flex-col items-center text-neutral-500 gap-3 group-hover:text-neutral-300 transition-colors p-4 text-center cursor-pointer"
                            >
                                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-2 group-hover:bg-white/10 transition-colors">
                                    <ImageIcon size={32} />
                                </div>
                                <span className="text-lg font-medium">Add Cover Image</span>
                                <span className="text-xs text-neutral-600">Recommended: 1920x1080 (16:9)</span>
                            </div>
                        )}

                        {/* Inline URL Editor Overlay */}
                        {isEditingCover && (
                            <div className="absolute inset-0 bg-black/80 backdrop-blur-md z-10 flex flex-col items-center justify-center p-8 animate-in fade-in zoom-in duration-200">
                                <div className="w-full max-w-lg space-y-4">
                                    <h3 className="text-white font-bold text-lg text-center">Cover Image URL</h3>
                                    <div className="flex gap-2">
                                        <input 
                                            ref={coverInputRef}
                                            type="text" 
                                            value={coverImage}
                                            onChange={(e) => setCoverImage(e.target.value)}
                                            placeholder="https://..."
                                            className="flex-1 bg-[#222] border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') setIsEditingCover(false);
                                                if (e.key === 'Escape') setIsEditingCover(false);
                                            }}
                                        />
                                        <button 
                                            onClick={() => setIsEditingCover(false)}
                                            className="bg-blue-600 hover:bg-blue-500 text-white px-6 rounded-xl font-bold transition-colors"
                                        >
                                            Done
                                        </button>
                                    </div>
                                    <button 
                                        onClick={() => setIsEditingCover(false)}
                                        className="text-neutral-500 text-sm hover:text-white transition-colors w-full text-center"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Title Input (TextArea for wrapping) */}
                    <textarea 
                        value={title}
                        onChange={(e) => {
                            setTitle(e.target.value);
                            e.target.style.height = 'auto';
                            e.target.style.height = e.target.scrollHeight + 'px';
                        }}
                        placeholder="Story Headline..."
                        rows={1}
                        className="w-full bg-transparent text-3xl md:text-5xl font-black text-white placeholder-neutral-800 border-none outline-none mb-4 shrink-0 leading-tight tracking-tight resize-none overflow-hidden"
                        style={{ height: 'auto' }}
                    />

                    {/* Subtitle Input (New) */}
                    <textarea 
                        value={subtitle}
                        onChange={(e) => {
                            setSubtitle(e.target.value);
                            e.target.style.height = 'auto';
                            e.target.style.height = e.target.scrollHeight + 'px';
                        }}
                        placeholder="Add a compelling subtitle..."
                        rows={1}
                        className="w-full bg-transparent text-xl md:text-2xl font-medium text-neutral-400 placeholder-neutral-800 border-none outline-none mb-8 shrink-0 leading-snug tracking-tight resize-none overflow-hidden"
                        style={{ height: 'auto' }}
                    />
                    
                    {/* Rich Text Editor */}
                    <div className="flex-1 min-h-[500px]">
                        <TiptapEditor value={content} onChange={setContent} className="h-full" />
                    </div>
                </div>
            </div>

            {/* RIGHT: Inspector Sidebar */}
            <div className={`border-l border-white/5 bg-[#0a0a0a] flex flex-col shrink-0 transition-all duration-300 ${isSidebarOpen ? 'w-80 translate-x-0' : 'w-0 translate-x-full border-none opacity-0 pointer-events-none'}`}>
                {/* Tabs */}
                <div className="flex border-b border-white/5">
                    <button 
                        onClick={() => setActiveTab('settings')}
                        className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${activeTab === 'settings' ? 'text-white border-b-2 border-blue-500 bg-white/5' : 'text-neutral-500 hover:text-neutral-300'}`}
                    >
                        Settings
                    </button>
                    <button 
                        onClick={() => setActiveTab('seo')}
                        className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${activeTab === 'seo' ? 'text-white border-b-2 border-green-500 bg-white/5' : 'text-neutral-500 hover:text-neutral-300'}`}
                    >
                        SEO & Score
                    </button>
                </div>

                {/* Sidebar Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar w-80">
                    
                    {activeTab === 'settings' ? (
                        <>
                            {/* Category Section */}
                            <div className="space-y-3">
                                <CustomSelect 
                                    label={<><Layout size={14} /> Category</>}
                                    value={category}
                                    options={Object.keys(GLOBAL_CATEGORIES)}
                                    onChange={(val) => {
                                        setCategory(val);
                                        setSubcategory("");
                                    }}
                                />

                                {/* Subcategory (Conditional) */}
                                {GLOBAL_CATEGORIES[category] && GLOBAL_CATEGORIES[category].length > 0 && (
                                    <div className="animate-in slide-in-from-left-2 duration-200 pl-2 border-l-2 border-white/5 ml-1">
                                        <CustomSelect 
                                            label={<><ChevronRight size={12} /> Subcategory</>}
                                            value={subcategory}
                                            options={GLOBAL_CATEGORIES[category]}
                                            onChange={setSubcategory}
                                            placeholder="Select Specific Topic..."
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Tags Section */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <label className="flex items-center gap-2 text-xs font-bold text-neutral-400 uppercase tracking-wider">
                                        <Tag size={14} /> Tags
                                    </label>
                                    <button 
                                        onClick={handleAutoGenerateTags}
                                        className="text-[10px] font-bold text-purple-400 flex items-center gap-1 hover:text-purple-300 transition-colors"
                                        title="AI Generate based on content"
                                    >
                                        <Sparkles size={12} /> Auto-Gen
                                    </button>
                                </div>
                                <div className="bg-[#111] border border-white/10 rounded-xl p-3 flex flex-wrap gap-2 min-h-[50px] focus-within:ring-1 focus-within:ring-blue-500/50 focus-within:border-blue-500/50 transition-all">
                                    {tags.map(tag => (
                                        <span key={tag} className="bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs px-2.5 py-1 rounded-lg flex items-center gap-1.5 animate-in zoom-in duration-200">
                                            {tag}
                                            <button onClick={() => removeTag(tag)} className="hover:text-white transition-colors"><X size={10} /></button>
                                        </span>
                                    ))}
                                    <input 
                                        type="text" 
                                        value={tagInput}
                                        onChange={(e) => setTagInput(e.target.value)}
                                        onKeyDown={addTag}
                                        placeholder={tags.length === 0 ? "Type tag & hit Enter..." : "Add more..."}
                                        className="bg-transparent text-sm text-white focus:outline-none min-w-[100px] flex-1 placeholder:text-neutral-600"
                                    />
                                </div>
                            </div>

                            {/* Slug Section */}
                            <div className="space-y-3">
                                <label className="flex items-center gap-2 text-xs font-bold text-neutral-400 uppercase tracking-wider">
                                    <Globe size={14} /> URL Slug
                                </label>
                                <div className="flex items-center bg-[#111] border border-white/10 rounded-xl overflow-hidden focus-within:border-blue-500/50 transition-colors group">
                                    <div className="bg-white/5 px-3 py-3 border-r border-white/5 text-xs text-neutral-500 font-mono select-none group-focus-within:text-neutral-400 transition-colors">
                                        /news/
                                    </div>
                                    <input 
                                        type="text" 
                                        value={slug}
                                        onChange={(e) => setSlug(e.target.value)}
                                        className="w-full bg-transparent px-3 py-3 text-xs font-mono text-neutral-300 focus:outline-none placeholder:text-neutral-700"
                                        placeholder="url-friendly-slug"
                                    />
                                </div>
                            </div>

                            {/* Excerpt Section */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <label className="flex items-center gap-2 text-xs font-bold text-neutral-400 uppercase tracking-wider">
                                        <FileText size={14} /> Excerpt
                                    </label>
                                    <span className={`text-[10px] font-mono ${excerpt.length > 160 ? 'text-red-400' : 'text-neutral-500'}`}>
                                        {excerpt.length}/160
                                    </span>
                                </div>
                                <div className="relative">
                                    <textarea 
                                        value={excerpt}
                                        onChange={(e) => setExcerpt(e.target.value)}
                                        rows={4}
                                        className="w-full bg-[#111] border border-white/10 rounded-xl p-4 text-sm text-neutral-300 focus:border-blue-500/50 focus:outline-none transition-all resize-none placeholder:text-neutral-700 leading-relaxed"
                                        placeholder="Write a compelling summary for search engines and social previews..."
                                    />
                                    <div className="absolute bottom-3 right-3 pointer-events-none">
                                        <div className="w-2 h-2 rounded-full bg-white/5"></div>
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            {/* SEO Score Card */}
                            <div className="bg-[#111] rounded-2xl p-6 flex flex-col items-center justify-center border border-white/10 relative overflow-hidden">
                                <div className={`text-5xl font-black ${getScoreColor(seoScore)} mb-2`}>
                                    {seoScore}
                                </div>
                                <span className="text-xs text-neutral-500 uppercase tracking-widest font-bold">SEO Score</span>
                                
                                {/* Progress Circle Background (Fake) */}
                                <svg className="absolute inset-0 w-full h-full opacity-10 pointer-events-none" viewBox="0 0 100 100">
                                    <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="10" />
                                </svg>
                            </div>

                            {/* Checklist */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                    <BarChart3 size={16} className="text-blue-500" /> Analysis
                                </h3>
                                
                                <div className="space-y-2">
                                    <CheckItem label="Title Length (20-70 chars)" met={title.length >= 20 && title.length <= 70} />
                                    <CheckItem label="Content Length (>300 chars)" met={content.length > 300} />
                                    <CheckItem label="Cover Image" met={!!coverImage} />
                                    <CheckItem label="At least 3 Tags" met={tags.length >= 3} />
                                    <CheckItem label="Meta Description" met={!!excerpt} />
                                    <CheckItem label="URL Slug" met={!!slug} />
                                    <CheckItem label="Subcategory Selected" met={!!subcategory} />
                                </div>
                            </div>

                            {/* Tips */}
                            <div className="bg-blue-900/10 border border-blue-500/20 p-4 rounded-xl">
                                <h4 className="text-blue-400 text-xs font-bold mb-2 flex items-center gap-2">
                                    <AlertCircle size={14} /> Pro Tip
                                </h4>
                                <p className="text-neutral-400 text-xs leading-relaxed">
                                    Use high-quality images and ensure your focus keyword appears in the first paragraph.
                                </p>
                            </div>
                        </>
                    )}

                </div>
            </div>
        </div>
      </div>
    </div>
  );
}

function CheckItem({ label, met }: { label: string, met: boolean }) {
    return (
        <div className={`flex items-center gap-3 p-3 rounded-lg border ${met ? 'bg-green-500/10 border-green-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
            {met ? <CheckCircle size={16} className="text-green-500 shrink-0" /> : <AlertCircle size={16} className="text-red-500 shrink-0" />}
            <span className={`text-xs font-medium ${met ? 'text-green-200' : 'text-red-200'}`}>{label}</span>
        </div>
    );
}
