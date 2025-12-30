"use client";
import { useState } from "react";
import { Globe, Search, Save, Plus, Hash, Wand2 } from "lucide-react";

export default function AdminSeoTags() {
  const [tags, setTags] = useState([
    "Fútbol", "Champions League", "Premier League", "La Liga", "Messi", "Cristiano Ronaldo", 
    "NBA", "LeBron James", "Fórmula 1", "Verstappen", "Tenis", "Nadal", "Alcaraz"
  ]);
  const [newTag, setNewTag] = useState("");

  const handleAddTag = () => {
    if (newTag && !tags.includes(newTag)) {
      setTags([...tags, newTag]);
      setNewTag("");
    }
  };

  return (
    <div className="space-y-8">
      {/* SEO Settings */}
      <div className="bg-white/5 p-8 rounded-3xl border border-white/10 backdrop-blur-md">
        <div className="flex items-center gap-4 mb-8">
          <div className="p-3 bg-blue-500/10 text-blue-500 rounded-xl border border-blue-500/20">
            <Globe size={24} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Global SEO Config</h3>
          </div>
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Site Title</label>
              <input 
                type="text" 
                defaultValue="Nexus News | Noticias Deportivas al Instante"
                className="w-full px-5 py-3 rounded-xl bg-black/40 border border-white/10 text-white focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Meta Description</label>
              <input 
                type="text" 
                defaultValue="El mejor portal de noticias deportivas con análisis IA en tiempo real."
                className="w-full px-5 py-3 rounded-xl bg-black/40 border border-white/10 text-white focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Keywords</label>
            <textarea 
              rows={3}
              defaultValue="deportes, noticias, futbol, nba, f1, tenis, resultados en vivo, analisis deportivo"
              className="w-full px-5 py-3 rounded-xl bg-black/40 border border-white/10 text-white focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all"
            />
          </div>
          <div className="flex justify-end pt-4">
            <button className="flex items-center gap-2 bg-white text-black px-8 py-3 rounded-xl font-bold hover:bg-neutral-200 transition-colors shadow-lg shadow-white/10">
              <Save size={18} />
              Save Changes
            </button>
          </div>
        </div>
      </div>

      {/* Tag Management */}
      <div className="bg-white/5 p-8 rounded-3xl border border-white/10 backdrop-blur-md">
        <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-500/10 text-purple-500 rounded-xl border border-purple-500/20">
                    <Hash size={24} />
                </div>
                <div>
                    <h3 className="text-xl font-bold text-white">Tag Database</h3>
                    <p className="text-sm text-neutral-400">Organize content taxonomy.</p>
                </div>
            </div>
            <button className="flex items-center gap-2 text-purple-400 text-sm font-bold hover:text-purple-300 transition-colors">
                <Wand2 size={16} />
                AI Auto-Organize
            </button>
        </div>
        
        <div className="flex gap-4 mb-8">
          <div className="flex-1 relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl blur opacity-20 group-hover:opacity-50 transition duration-500"></div>
            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500" size={20} />
                <input 
                type="text"
                placeholder="Search or create new tag..."
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                className="w-full pl-12 pr-4 py-3 rounded-xl bg-black/60 border border-white/10 text-white focus:border-white/30 outline-none transition-all"
                onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                />
            </div>
          </div>
          <button 
            onClick={handleAddTag}
            className="bg-white/10 border border-white/10 text-white px-6 py-3 rounded-xl font-bold hover:bg-white hover:text-black transition-all flex items-center gap-2"
          >
            <Plus size={18} />
            Add Tag
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span key={tag} className="bg-black/40 text-neutral-300 px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/30 cursor-pointer transition-all border border-white/5">
              #{tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
