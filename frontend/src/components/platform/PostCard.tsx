'use client'

// Base editorial común para CUALQUIER publicación, sin importar su
// formato -- un artículo, un video o un audio usan el mismo componente,
// nunca uno distinto por tipo (esa era la regla explícita del brief:
// "no diseñes componentes completamente independientes para cada
// formato"). Lo único que cambia es el bloque de medio: imagen por
// defecto, VideoBlock si el Post trae media.videoUrl, AudioBlock si trae
// media.audioUrl -- nunca los tres a la fuerza.
//
// Solo 2 variantes (`feature`/`compact`) A PROPÓSITO -- toda la
// personalidad de cada sección (asimetría, rail horizontal, grid) la
// resuelve el layout que envuelve a PostCard, nunca una prop nueva acá.
// Reaccionar/Comentar quedan deshabilitados en todas partes (sin backend
// de comentarios todavía) -- Compartir es real en todas partes.

import { useState } from 'react'
import { Clock, MessageCircle, Heart, Share2, Check } from 'lucide-react'
import EditorialImage from '@/components/news/EditorialImage'
import CreatorBadge from '@/components/platform/CreatorBadge'
import FormatBadge from '@/components/platform/FormatBadge'
import VideoBlock from '@/components/platform/VideoBlock'
import AudioBlock from '@/components/platform/AudioBlock'
import { proxiedImage } from '@/lib/media'
import type { Post } from '@/lib/platform'

const formatRelative = (dateString: string) => {
  const diffMs = Date.now() - new Date(dateString).getTime()
  const hours = Math.floor(diffMs / 3_600_000)
  if (hours < 1) return 'Hace unos minutos'
  if (hours < 24) return `Hace ${hours} h`
  const days = Math.floor(hours / 24)
  return `Hace ${days} d`
}

function ShareIcon({ slug, isDark, size = 13 }: { slug: string; isDark: boolean; size?: number }) {
  const [copied, setCopied] = useState(false)

  const share = async (e: React.MouseEvent) => {
    e.stopPropagation()
    const url = `${window.location.origin}/noticia/${slug}`
    if (navigator.share) {
      try { await navigator.share({ url }) } catch { /* usuario canceló */ }
      return
    }
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* clipboard no disponible */ }
  }

  return (
    <button onClick={share} title={copied ? 'Copiado' : 'Compartir'} className={`transition-colors ${isDark ? 'text-neutral-500 hover:text-white' : 'text-[#999] hover:text-[#161616]'}`}>
      {copied ? <Check size={size} /> : <Share2 size={size} />}
    </button>
  )
}

function ActionIcons({ post, isDark, size = 13 }: { post: Post; isDark: boolean; size?: number }) {
  return (
    <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
      <span title="Próximamente" className="text-neutral-600 cursor-not-allowed"><Heart size={size} /></span>
      <span title="Próximamente" className="text-neutral-600 cursor-not-allowed"><MessageCircle size={size} /></span>
      <ShareIcon slug={post.slug} isDark={isDark} size={size} />
    </div>
  )
}

function MediaBlock({ post }: { post: Post }) {
  if (post.media?.videoUrl) {
    return <VideoBlock videoUrl={post.media.videoUrl} posterUrl={proxiedImage(post.imageUrl)} title={post.title} />
  }
  if (post.imageUrl) {
    return <EditorialImage src={proxiedImage(post.imageUrl)} alt={post.title} sizes="(max-width: 768px) 100vw, 500px" variant="landscape" className="rounded-sm" />
  }
  return null
}

export default function PostCard({
  post, isDark, onOpen, variant = 'compact',
}: {
  post: Post
  isDark: boolean
  onOpen: (post: Post) => void
  variant?: 'feature' | 'compact'
}) {
  const isFeature = variant === 'feature'

  return (
    <article>
      <div className="flex items-center justify-between mb-2.5">
        <CreatorBadge creator={post.creator} isDark={isDark} size={isFeature ? 24 : 18} />
        <FormatBadge format={post.format} />
      </div>

      {/* `feature` se cap a max-w-2xl SIEMPRE -- nunca a todo el ancho del
          contenedor padre. En una columna angosta (FrontPage) ese máximo
          nunca se activa (la columna ya es más angosta); en un contenedor
          ancho (NowStream, a todo el ancho de la página) evita exactamente
          el problema real de la iteración anterior: una imagen casi a
          pantalla completa que se leía como "una tarjeta gigante". */}
      <button onClick={() => onOpen(post)} className={`group block text-left w-full ${isFeature ? 'max-w-2xl' : ''}`}>
        {(post.imageUrl || post.media?.videoUrl) && <div className="mb-2.5"><MediaBlock post={post} /></div>}
        <span className="text-[#E30613] text-[10px] font-bold uppercase tracking-[0.14em]">{post.category || 'Noticia'}</span>
        <h3 className={`font-serif font-bold leading-snug group-hover:opacity-70 transition-opacity ${isFeature ? 'text-xl mt-1.5' : 'text-sm mt-1 line-clamp-2'} ${isDark ? 'text-white' : 'text-[#161616]'}`}>
          {post.title}
        </h3>
        {isFeature && post.excerpt && (
          <p className={`text-sm mt-1.5 leading-relaxed line-clamp-2 ${isDark ? 'text-neutral-400' : 'text-[#666]'}`}>{post.excerpt}</p>
        )}
      </button>

      {post.media?.audioUrl && (
        <div className="mt-2.5">
          <AudioBlock trackId={post.id} audioUrl={post.media.audioUrl} title={post.title} creatorName={post.creator.name} isDark={isDark} />
        </div>
      )}

      <div className={`flex items-center justify-between mt-2 text-[11px] ${isDark ? 'text-neutral-500' : 'text-[#999]'}`}>
        <span className="flex items-center gap-3">
          <span>{formatRelative(post.publishedAt)}</span>
          {post.readMinutes > 0 && (
            <span className="flex items-center gap-1"><Clock size={11} /> {post.readMinutes} min</span>
          )}
        </span>
        <ActionIcons post={post} isDark={isDark} size={isFeature ? 14 : 12} />
      </div>
    </article>
  )
}
