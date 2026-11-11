"use client";

// Real, persisted sponsor banners -- one creative per <AdSlot position="...">
// slot on the public site (frontend/src/components/ads/AdSlot.tsx), stored
// in `ad_banners` via the backend (never written from the browser directly --
// see backend/app/presentation/api/ads.py). Each position has a fixed pixel
// size (backend/app/domain/ads/entities.py POSITION_SIZES) -- this form
// checks an upload against it BEFORE sending, so a mismatched image never
// even reaches the network call.
//
// The picker is the real site itself (AdminAdsSimulator), not a row of
// abstract tabs -- clicking a slot marker on the live embedded portal is
// how a position gets selected below.

import { useEffect, useState } from "react";
import { Megaphone, Upload, Trash2, ExternalLink, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { apiUrl } from "@/studio/lab/api-client";
import { supabase } from "@/lib/supabaseClient";
import AdminAdsSimulator from "./AdminAdsSimulator";

type AdPosition = "HOME_TOP" | "HOME_FEED" | "ARTICLE_TOP" | "ARTICLE_END" | "SIDEBAR_DESKTOP";

const POSITION_LABELS: Record<AdPosition, string> = {
  HOME_TOP: "Inicio — Superior",
  HOME_FEED: "Inicio — Feed",
  ARTICLE_TOP: "Artículo — Superior",
  ARTICLE_END: "Artículo — Final",
  SIDEBAR_DESKTOP: "Sidebar (Desktop)",
};

interface AdBanner {
  id: string;
  position: AdPosition;
  imageUrl: string;
  linkUrl: string;
  altText: string;
  width: number;
  height: number;
  active: boolean;
  createdAt: string;
}

export default function AdminAds() {
  const [positions, setPositions] = useState<Record<string, { width: number; height: number }>>({});
  const [banners, setBanners] = useState<AdBanner[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AdPosition>("SIDEBAR_DESKTOP");
  const [articleSrc, setArticleSrc] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const [file, setFile] = useState<File | null>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [altText, setAltText] = useState("");
  const [uploading, setUploading] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [posRes, bannersRes] = await Promise.all([
        fetch(apiUrl("/api/ads/positions")),
        fetch(apiUrl("/api/ads/all")),
      ]);
      if (posRes.ok) setPositions(await posRes.json());
      if (bannersRes.ok) setBanners(await bannersRes.json());
      if (!posRes.ok || !bannersRes.ok) {
        toast.error("No se pudo cargar la publicidad -- ¿corriste ad_banners_schema.sql en Supabase?");
      }
    } catch {
      toast.error("No se pudo conectar con el backend");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    // A real, recent published article to embed in the "Artículo" preview
    // tab -- the simulation is only honest if it's a page a visitor could
    // actually land on, not a placeholder.
    supabase
      .from("news")
      .select("slug")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(1)
      .then(({ data }) => {
        if (data && data[0]?.slug) setArticleSrc(`/noticia/${data[0].slug}`);
      });
  }, []);

  const spec = positions[selected];
  const positionBanners = banners.filter((b) => b.position === selected);
  const activeCountByPosition = (pos: string) => banners.filter((b) => b.position === pos && b.active).length;

  const handleFileChange = (f: File | null) => {
    if (!f || !spec) { setFile(f); return; }
    const img = new Image();
    const objectUrl = URL.createObjectURL(f);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      if (img.naturalWidth !== spec.width || img.naturalHeight !== spec.height) {
        toast.error(
          `${POSITION_LABELS[selected]} requiere exactamente ${spec.width}×${spec.height}px -- esta imagen es ${img.naturalWidth}×${img.naturalHeight}px`
        );
        setFile(null);
        return;
      }
      setFile(f);
    };
    img.src = objectUrl;
  };

  const handleUpload = async () => {
    if (!file || !linkUrl.trim()) {
      toast.error("Falta la imagen o el enlace de destino");
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append("position", selected);
      form.append("link_url", linkUrl.trim());
      form.append("alt_text", altText.trim());
      form.append("file", file);
      const res = await fetch(apiUrl("/api/ads"), { method: "POST", body: form });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail || `HTTP ${res.status}`);
      }
      const created: AdBanner = await res.json();
      setBanners((prev) => [created, ...prev]);
      setFile(null);
      setLinkUrl("");
      setAltText("");
      toast.success("Banner publicado");
      setReloadToken((t) => t + 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo subir el banner");
    } finally {
      setUploading(false);
    }
  };

  const toggleActive = async (banner: AdBanner) => {
    const next = !banner.active;
    setBanners((prev) => prev.map((b) => (b.id === banner.id ? { ...b, active: next } : b)));
    try {
      const res = await fetch(apiUrl(`/api/ads/${banner.id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: next }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setReloadToken((t) => t + 1);
    } catch {
      setBanners((prev) => prev.map((b) => (b.id === banner.id ? { ...b, active: banner.active } : b)));
      toast.error("No se pudo actualizar el banner");
    }
  };

  const deleteBanner = async (banner: AdBanner) => {
    const prev = banners;
    setBanners((p) => p.filter((b) => b.id !== banner.id));
    try {
      const res = await fetch(apiUrl(`/api/ads/${banner.id}`), { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success("Banner eliminado");
      setReloadToken((t) => t + 1);
    } catch {
      setBanners(prev);
      toast.error("No se pudo eliminar el banner");
    }
  };

  return (
    <div className="space-y-8">
      <div className="bg-white/5 p-8 rounded-3xl border border-white/10 backdrop-blur-md">
        <div className="flex items-center gap-4 mb-6">
          <div className="p-3 bg-amber-500/10 text-amber-500 rounded-xl border border-amber-500/20">
            <Megaphone size={24} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Publicidad</h3>
            <p className="text-sm text-neutral-400">
              Banners propios (patrocinadores directos) por posición -- cada slot tiene una medida fija y exacta.
              Si un slot no tiene banner activo, el sitio cae de vuelta a AdSense ahí.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-3 text-neutral-400 py-8 justify-center">
            <RefreshCw className="animate-spin" size={20} />
            Cargando...
          </div>
        ) : (
          <>
            <AdminAdsSimulator
              selected={selected}
              onSelect={(pos) => setSelected(pos as AdPosition)}
              labelFor={(pos) => POSITION_LABELS[pos as AdPosition] ?? pos}
              badgeFor={(pos) => {
                const count = activeCountByPosition(pos);
                return count > 0 ? { text: `${count} activo${count > 1 ? "s" : ""}`, ok: true } : { text: "Sin banner", ok: false };
              }}
              articleSrc={articleSrc}
              reloadToken={reloadToken}
              onRefresh={() => setReloadToken((t) => t + 1)}
            />

            <div className="flex items-center gap-2 mb-4">
              <span className="px-3 py-1 rounded-full bg-red-600 text-white text-xs font-bold">
                {POSITION_LABELS[selected]}
              </span>
              {spec && <span className="text-xs text-neutral-500">{spec.width}×{spec.height}px exacto</span>}
            </div>

            {/* Upload form for the selected position */}
            <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-4 items-end mb-8 p-5 rounded-2xl bg-black/30 border border-white/5">
              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Imagen</label>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
                  className="w-full text-sm text-neutral-300 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-white/10 file:text-white file:text-xs file:font-bold hover:file:bg-white/20"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Enlace de destino</label>
                <input
                  type="url"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://elpatrocinador.com"
                  className="w-full px-4 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all"
                />
              </div>
              <button
                onClick={handleUpload}
                disabled={uploading || !file || !linkUrl.trim()}
                className="flex items-center gap-2 bg-white text-black px-6 py-2.5 rounded-xl font-bold hover:bg-neutral-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {uploading ? <RefreshCw className="animate-spin" size={16} /> : <Upload size={16} />}
                Publicar
              </button>
              <div className="md:col-span-3 space-y-2">
                <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Texto alternativo (opcional)</label>
                <input
                  type="text"
                  value={altText}
                  onChange={(e) => setAltText(e.target.value)}
                  placeholder="Ej: Vuelos y hoteles con Avianca"
                  className="w-full px-4 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all"
                />
              </div>
            </div>

            {/* Existing banners for this position */}
            {positionBanners.length === 0 ? (
              <p className="text-sm text-neutral-500 text-center py-6">
                Sin banners para {POSITION_LABELS[selected]} -- se muestra AdSense en este slot.
              </p>
            ) : (
              <div className="space-y-3">
                {positionBanners.map((banner) => (
                  <div
                    key={banner.id}
                    className="flex items-center gap-4 p-4 rounded-2xl bg-black/30 border border-white/5"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={banner.imageUrl}
                      alt={banner.altText}
                      className="h-16 w-auto rounded-lg border border-white/10 bg-white/5 object-contain flex-shrink-0"
                      style={{ maxWidth: 140 }}
                    />
                    <div className="min-w-0 flex-1">
                      <a
                        href={banner.linkUrl}
                        target="_blank" rel="noopener noreferrer"
                        className="text-sm font-medium text-white hover:text-red-400 transition-colors flex items-center gap-1.5 truncate"
                      >
                        {banner.linkUrl} <ExternalLink size={12} className="flex-shrink-0" />
                      </a>
                      <p className="text-xs text-neutral-500 truncate">{banner.altText || "Sin texto alternativo"}</p>
                    </div>
                    <button
                      onClick={() => toggleActive(banner)}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors flex-shrink-0 ${
                        banner.active
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                          : "bg-white/5 text-neutral-500 border-white/10"
                      }`}
                    >
                      {banner.active ? "Activo" : "Pausado"}
                    </button>
                    <button
                      onClick={() => deleteBanner(banner)}
                      aria-label="Eliminar banner"
                      className="p-2 rounded-lg text-neutral-500 hover:text-red-400 hover:bg-red-500/10 transition-colors flex-shrink-0"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
