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
import Image from 'next/image'
import { Clock, MessageCircle, Heart, Share2, Check, Play, Zap } from 'lucide-react'
import CreatorBadge from '@/components/platform/CreatorBadge'
import FormatBadge from '@/components/platform/FormatBadge'
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

function CardImage({ src, alt, sizes }: { src: string | null; alt: string; sizes: string }) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#2a2410] via-[#16140a] to-[#0B0B0B]">
        <Zap size={28} className="fill-yellow-300 text-yellow-300 opacity-80" strokeWidth={0} />
      </div>
    )
  }
  return <Image src={src} alt={alt} fill sizes={sizes} onError={() => setFailed(true)} className="object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
}

export default function PostCard({
  post, isDark, onOpen, variant = 'compact',
}: {
  post: Post
  isDark: boolean
  onOpen: (post: Post) => void
  variant?: 'feature' | 'compact' | 'card'
}) {
  const isFeature = variant === 'feature'
  const isCard = variant === 'card'
  const image = proxiedImage(post.imageUrl)
  const hasVideo = Boolean(post.media?.videoUrl)
  const shell = isDark
    ? 'border-white/[0.08] bg-[#121211] hover:border-yellow-300/40'
    : 'border-[#E5E5E5] bg-white hover:border-yellow-400'

  // Layout horizontal (imagen a un lado) para las tarjetas compactas y la destacada ancha.
  if (!isCard) {
    return (
      <article className={`group overflow-hidden rounded-xl border transition-colors ${shell} ${isFeature ? 'sm:grid sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]' : 'flex'}`}>
        <button onClick={() => onOpen(post)} aria-label={post.title} className={`relative block flex-none overflow-hidden bg-neutral-900 ${isFeature ? 'aspect-[16/10] sm:aspect-auto sm:min-h-[240px]' : 'order-last h-[88px] w-[112px]'}`}>
          <CardImage src={image} alt={post.title} sizes={isFeature ? '(max-width: 768px) 100vw, 520px' : '120px'} />
          {isFeature && <span className="absolute left-3 top-3 rounded-full bg-yellow-300 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-black">{post.category || 'Noticia'}</span>}
          {hasVideo && <span className="absolute inset-0 flex items-center justify-center bg-black/30"><Play size={isFeature ? 30 : 20} className="fill-white text-white" /></span>}
        </button>
        <div className={`flex min-w-0 flex-1 flex-col justify-between gap-3 ${isFeature ? 'p-5' : 'p-3'}`}>
          <button onClick={() => onOpen(post)} className="block text-left">
            {!isFeature && <span className="text-[10px] font-black uppercase tracking-[0.14em] text-yellow-300">{post.category || 'Noticia'}</span>}
            <h3 className={`font-serif font-bold leading-snug transition-colors group-hover:text-yellow-300 ${isFeature ? 'text-2xl line-clamp-3' : 'mt-0.5 text-sm line-clamp-2'} ${isDark ? 'text-white' : 'text-[#161616]'}`}>{post.title}</h3>
            {isFeature && post.excerpt && <p className={`mt-2 text-sm leading-relaxed line-clamp-3 ${isDark ? 'text-neutral-400' : 'text-[#666]'}`}>{post.excerpt}</p>}
          </button>
          {post.media?.audioUrl && <AudioBlock trackId={post.id} audioUrl={post.media.audioUrl} title={post.title} creatorName={post.creator.name} isDark={isDark} />}
          <div className={`flex items-center justify-between text-[11px] ${isDark ? 'text-neutral-500' : 'text-[#999]'}`}>
            <span className="flex min-w-0 items-center gap-2">
              {isFeature && <CreatorBadge creator={post.creator} isDark={isDark} size={20} />}
              <span className="truncate">{formatRelative(post.publishedAt)}</span>
              {post.readMinutes > 0 && <span className="flex items-center gap-1"><Clock size={11} /> {post.readMinutes} min</span>}
            </span>
            {isFeature && <ActionIcons post={post} isDark={isDark} size={13} />}
          </div>
        </div>
      </article>
    )
  }

  return (
    <article className={`group flex flex-col overflow-hidden rounded-xl border transition-all hover:-translate-y-0.5 ${shell}`}>
      <button onClick={() => onOpen(post)} aria-label={post.title} className="relative block aspect-[16/10] w-full overflow-hidden bg-neutral-900">
        <CardImage src={image} alt={post.title} sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 300px" />
        <span className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/60 to-transparent" />
        <span className="absolute left-3 top-3 rounded-full bg-yellow-300 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-black">{post.category || 'Noticia'}</span>
        {hasVideo && <span className="absolute inset-0 flex items-center justify-center"><Play size={26} className="fill-white text-white drop-shadow" /></span>}
      </button>
      <div className="flex flex-1 flex-col justify-between gap-3 p-4">
        <button onClick={() => onOpen(post)} className="block text-left">
          <h3 className={`font-serif text-[15px] font-bold leading-snug line-clamp-3 transition-colors group-hover:text-yellow-300 ${isDark ? 'text-white' : 'text-[#161616]'}`}>{post.title}</h3>
        </button>
        {post.media?.audioUrl && <AudioBlock trackId={post.id} audioUrl={post.media.audioUrl} title={post.title} creatorName={post.creator.name} isDark={isDark} />}
        <div className={`flex items-center justify-between text-[11px] ${isDark ? 'text-neutral-500' : 'text-[#999]'}`}>
          <span className="flex items-center gap-2">
            <span>{formatRelative(post.publishedAt)}</span>
            {post.readMinutes > 0 && <span className="flex items-center gap-1"><Clock size={11} /> {post.readMinutes} min</span>}
          </span>
          <ShareIcon slug={post.slug} isDark={isDark} size={13} />
        </div>
      </div>
    </article>
  )
}
