"use client";
import { useEffect, useState } from "react";
import { Globe, Hash, RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";
import { apiUrl } from "@/studio/lab/api-client";

interface SeoSettings {
  siteTitle: string;
  metaDescription: string;
  keywords: string[];
}

interface Topic {
  id: string;
  name: string;
  slug: string;
}

interface Category {
  id: string;
  name: string;
  slug: string;
  topics: Topic[];
}

interface CategoryGroup {
  id: string;
  name: string;
  slug: string;
  categories: Category[];
}

export default function AdminSeoTags() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [siteTitle, setSiteTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [keywordsText, setKeywordsText] = useState("");

  const [groups, setGroups] = useState<CategoryGroup[]>([]);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(apiUrl("/api/settings/seo"));
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.message || `HTTP ${res.status}`);
        }
        const data: SeoSettings = await res.json();
        setSiteTitle(data.siteTitle);
        setMetaDescription(data.metaDescription);
        setKeywordsText(data.keywords.join(", "));
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo cargar la configuración SEO");
      } finally {
        setLoading(false);
      }
    })();

    (async () => {
      try {
        const res = await fetch(apiUrl("/api/categories"));
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setGroups(data.groups ?? []);
      } catch (err) {
        setCategoriesError(err instanceof Error ? err.message : "No se pudo cargar la taxonomía");
      }
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const keywords = keywordsText.split(",").map((k) => k.trim()).filter(Boolean);
      const res = await fetch(apiUrl("/api/settings/seo"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteTitle, metaDescription, keywords }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message || `HTTP ${res.status}`);
      }
      const data: SeoSettings = await res.json();
      setSiteTitle(data.siteTitle);
      setMetaDescription(data.metaDescription);
      setKeywordsText(data.keywords.join(", "));
      toast.success("Configuración SEO guardada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar la configuración SEO");
    } finally {
      setSaving(false);
    }
  };

  const allTopics = groups.flatMap((g) => g.categories.flatMap((c) => c.topics));

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
            <p className="text-sm text-neutral-400">Controla el título, descripción y keywords que ve Google en cada página del sitio.</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-3 text-neutral-400 py-8 justify-center">
            <RefreshCw className="animate-spin" size={20} />
            Cargando configuración...
          </div>
        ) : error ? (
          <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl p-4">
            {error}
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Site Title</label>
                <input
                  type="text"
                  value={siteTitle}
                  onChange={(e) => setSiteTitle(e.target.value)}
                  className="w-full px-5 py-3 rounded-xl bg-black/40 border border-white/10 text-white focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Meta Description</label>
                <input
                  type="text"
                  value={metaDescription}
                  onChange={(e) => setMetaDescription(e.target.value)}
                  className="w-full px-5 py-3 rounded-xl bg-black/40 border border-white/10 text-white focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Keywords (separadas por coma)</label>
              <textarea
                rows={3}
                value={keywordsText}
                onChange={(e) => setKeywordsText(e.target.value)}
                className="w-full px-5 py-3 rounded-xl bg-black/40 border border-white/10 text-white focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all"
              />
            </div>
            <div className="flex justify-end pt-4">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 bg-white text-black px-8 py-3 rounded-xl font-bold hover:bg-neutral-200 transition-colors shadow-lg shadow-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? <RefreshCw className="animate-spin" size={18} /> : <Save size={18} />}
                {saving ? "Guardando..." : "Save Changes"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Tag Database — la taxonomía real de categorías/topics, no una lista suelta */}
      <div className="bg-white/5 p-8 rounded-3xl border border-white/10 backdrop-blur-md">
        <div className="flex items-center gap-4 mb-8">
          <div className="p-3 bg-purple-500/10 text-purple-500 rounded-xl border border-purple-500/20">
            <Hash size={24} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Tag Database</h3>
            <p className="text-sm text-neutral-400">Topics reales de la taxonomía de categorías (solo lectura por ahora — se editan en Supabase).</p>
          </div>
        </div>

        {categoriesError ? (
          <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl p-4">
            {categoriesError}
          </div>
        ) : groups.length === 0 ? (
          <div className="flex items-center gap-3 text-neutral-400 py-8 justify-center">
            <RefreshCw className="animate-spin" size={20} />
            Cargando taxonomía...
          </div>
        ) : (
          <div className="space-y-6">
            {groups.map((group) => (
              <div key={group.id}>
                <p className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-3">{group.name}</p>
                <div className="flex flex-wrap gap-2">
                  {group.categories.map((category) => (
                    <span
                      key={category.id}
                      className="bg-black/40 text-neutral-300 px-4 py-2 rounded-lg text-sm font-medium border border-white/5"
                    >
                      #{category.name}
                    </span>
                  ))}
                </div>
              </div>
            ))}
            <div>
              <p className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-3">Topics ({allTopics.length})</p>
              <div className="flex flex-wrap gap-2">
                {allTopics.map((topic) => (
                  <span
                    key={topic.id}
                    className="bg-black/40 text-neutral-300 px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/30 cursor-default transition-all border border-white/5"
                  >
                    #{topic.name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
