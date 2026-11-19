'use client'

// Sección 3: seleccionar una noticia REAL (Artifact PUBLISHED) abre
// Studio. Lista completa vía GET /api/artifacts?status=PUBLISHED (ya
// real, sin cambios de backend) + búsqueda/filtro client-side -- mismo
// patrón ya usado en la homepage (news.engine.ts/NearYou.tsx).

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { Clapperboard, Image as ImageIcon, Radio, Search } from 'lucide-react'
import { proxiedImage } from '@/lib/media'
import { createStudioProject, listPublishedArtifacts } from '@/studio/nexus/api'
import { useCategoryNames } from '@/studio/nexus/useCategoryNames'
import type { CompositionFormat, StudioMode, StudioSourceArtifact } from '@/types/studio'

const formatDate = (iso: string | null) => {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso))
}

export default function ContentSelector({ onProjectCreated }: { onProjectCreated: (projectId: string) => void }) {
  const [artifacts, setArtifacts] = useState<StudioSourceArtifact[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [pickingFor, setPickingFor] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const categoryNames = useCategoryNames()

  useEffect(() => {
    let cancelled = false
    listPublishedArtifacts()
      .then((items) => { if (!cancelled) setArtifacts(items) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const categories = useMemo(() => {
    const ids = new Set(artifacts.map((a) => a.categoryId).filter((id): id is string => !!id))
    return Array.from(ids).map((id) => ({ id, name: categoryNames.get(id) ?? id }))
  }, [artifacts, categoryNames])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return artifacts.filter((a) => {
      if (categoryFilter && a.categoryId !== categoryFilter) return false
      if (!q) return true
      return (
        a.title.toLowerCase().includes(q)
        || a.tags.some((t) => t.toLowerCase().includes(q))
        || (categoryNames.get(a.categoryId ?? '') ?? '').toLowerCase().includes(q)
      )
    })
  }, [artifacts, query, categoryFilter, categoryNames])

  const handleCreate = async (artifactId: string, mode: StudioMode) => {
    setCreating(true)
    setCreateError(null)
    try {
      const format: CompositionFormat = mode === 'IMAGE' ? 'FEED_4X5' : 'REEL_9X16'
      const project = await createStudioProject(artifactId, mode, undefined, format)
      onProjectCreated(project.id)
    } catch (e) {
      setCreating(false)
      setCreateError(String(e))
    }
  }

  return (
    <div className="h-full flex flex-col bg-[#0A0A0A] text-white">
      <div className="p-4 border-b border-white/10 flex-shrink-0">
        <h1 className="text-lg font-serif font-bold mb-3">NEXUS Studio</h1>
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center gap-2 bg-white/5 border border-white/10 rounded-sm px-3 py-2">
            <Search size={14} className="text-white/40" />
            <input
              value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por título, tag o categoría…"
              className="bg-transparent outline-none text-sm flex-1 placeholder:text-white/30"
            />
          </div>
        </div>
        {categories.length > 0 && (
          <div className="flex items-center gap-1.5 mt-2 overflow-x-auto scrollbar-hide">
            <button
              onClick={() => setCategoryFilter(null)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap ${!categoryFilter ? 'bg-red-600 text-white' : 'bg-white/5 text-white/50'}`}
            >
              Todas
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setCategoryFilter(c.id)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap ${categoryFilter === c.id ? 'bg-red-600 text-white' : 'bg-white/5 text-white/50'}`}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <p className="text-sm text-white/40">Cargando artículos publicados…</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-white/40">No hay artículos publicados que coincidan.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((a) => {
              const featured = a.mediaRequirements.find((m) => m.kind === 'FEATURE_IMAGE')
              const img = featured?.assetUrl ? proxiedImage(featured.assetUrl) : null
              const isPicking = pickingFor === a.id
              return (
                <div key={a.id} className="border border-white/10 rounded-sm overflow-hidden bg-white/[0.02]">
                  <div className="relative aspect-video bg-neutral-900">
                    {img ? (
                      <Image src={img} alt={a.title} fill sizes="360px" className="object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white/20 text-xs">Sin imagen destacada</div>
                    )}
                  </div>
                  <div className="p-3">
                    <span className="text-red-500 text-[10px] font-bold uppercase tracking-[0.14em]">
                      {categoryNames.get(a.categoryId ?? '') ?? 'Sin categoría'}
                    </span>
                    <h3 className="text-sm font-bold leading-snug mt-1 line-clamp-2">{a.title}</h3>
                    <p className="text-[11px] text-white/40 mt-1">{formatDate(a.publishedAt)} · Publicado</p>

                    {isPicking ? (
                      <>
                        <div className="flex items-center gap-1.5 mt-3">
                          <button
                            disabled={creating}
                            onClick={() => handleCreate(a.id, 'IMAGE')}
                            className="flex-1 flex items-center justify-center gap-1 bg-white/10 hover:bg-white/20 rounded-sm py-1.5 text-[11px] font-bold disabled:opacity-40"
                          >
                            <ImageIcon size={12} /> Imagen
                          </button>
                          <button
                            disabled={creating}
                            onClick={() => handleCreate(a.id, 'REEL')}
                            className="flex-1 flex items-center justify-center gap-1 bg-red-600 hover:bg-red-700 rounded-sm py-1.5 text-[11px] font-bold disabled:opacity-40"
                          >
                            <Clapperboard size={12} /> Reel
                          </button>
                          <button
                            disabled
                            title="LIVE llega en una fase siguiente"
                            className="flex-1 flex items-center justify-center gap-1 bg-white/5 rounded-sm py-1.5 text-[11px] font-bold text-white/30 cursor-not-allowed"
                          >
                            <Radio size={12} /> Live
                          </button>
                        </div>
                        {createError && <p className="text-[10px] text-red-400 mt-1.5">{createError}</p>}
                      </>
                    ) : (
                      <button
                        onClick={() => { setPickingFor(a.id); setCreateError(null) }}
                        className="mt-3 w-full bg-white/5 hover:bg-white/10 rounded-sm py-1.5 text-[11px] font-bold"
                      >
                        Abrir en Studio →
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
