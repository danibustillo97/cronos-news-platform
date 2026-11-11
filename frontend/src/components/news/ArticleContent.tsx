'use client'

// The ONE real article reading experience -- shared between NewsModal
// (opened over the feed while browsing) and the standalone /noticia/[slug]
// page (direct link, share, reload, or when JS/crawlers can't run the
// modal). Both must look identical -- a reader should never be able to
// tell which path they're on. `content` is real structured HTML by now
// (see backend PublishArtifact._resolve_content_html) -- body images are
// already resolved <img>+<figcaption>, never plain text, never a
// dangling <figure> marker.

import { useEffect, useState } from 'react'
import Image from 'next/image'
import {
  Calendar, Facebook, Twitter, MessageCircle, Bookmark, BookmarkCheck,
  Link2, Maximize2, X,
} from 'lucide-react'
import { proxiedImage } from '@/lib/media'
import RelatedNews from './RelatedNews'
import AdSlot from '@/components/ads/AdSlot'
import DOMPurify from 'isomorphic-dompurify'
import parse from 'html-react-parser'
import type { NewsView } from '@/types/news'

const SITE_URL = 'https://www.nexusnews.info'
const BOOKMARKS_KEY = 'nexus-bookmarks'

function sanitizeArticleHtml(html: string): string {
  const sanitized = DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true, svg: true, svgFilters: true },
    ADD_TAGS: ['iframe'],
    ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'loading', 'referrerpolicy', 'title', 'width', 'height'],
  })

  return sanitized.replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, (iframe) => {
    const source = iframe.match(/\bsrc=["']([^"']+)["']/i)?.[1]
    if (!source) return ''

    try {
      const url = new URL(source)
      return url.protocol === 'https:' && ['www.youtube-nocookie.com', 'www.youtube.com'].includes(url.hostname)
        ? iframe
        : ''
    } catch {
      return ''
    }
  })
}

function shareUrl(platform: 'facebook' | 'twitter' | 'whatsapp', url: string, title: string): string {
  if (platform === 'facebook') return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`
  if (platform === 'whatsapp') return `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`
  return `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`
}

export function formatArticleDate(dateString: string) {
  if (!dateString) return ''
  const date = new Date(dateString)
  return new Intl.DateTimeFormat('es-CO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

// ~200 wpm, stripped of tags -- a plain estimate, not a real parse of the
// rendered word count (close enough for a "X min de lectura" label).
function estimateReadingMinutes(html?: string): number {
  if (!html) return 1
  const text = html.replace(/<[^>]*>/g, ' ')
  const words = text.split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(words / 200))
}

function useBookmark(slug: string) {
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(BOOKMARKS_KEY)
      const list: string[] = raw ? JSON.parse(raw) : []
      setSaved(list.includes(slug))
    } catch {
      // private mode / blocked storage -- silently keep the default
    }
  }, [slug])

  const toggle = () => {
    setSaved((prev) => {
      const next = !prev
      try {
        const raw = window.localStorage.getItem(BOOKMARKS_KEY)
        const list: string[] = raw ? JSON.parse(raw) : []
        const updated = next ? Array.from(new Set([...list, slug])) : list.filter((s) => s !== slug)
        window.localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(updated))
      } catch {}
      return next
    })
  }

  return { saved, toggle }
}

export default function ArticleContent({
  news, onRelatedClick,
}: {
  news: NewsView
  onRelatedClick: (news: NewsView) => void
}) {
  const canonicalUrl = `${SITE_URL}/noticia/${news.slug}`
  const heroImage = proxiedImage(news.image_url)
  const safeArticleContent = news.content
    ? sanitizeArticleHtml(news.content)
    : ''
  const readingMinutes = estimateReadingMinutes(news.content)
  const { saved, toggle: toggleSaved } = useBookmark(news.slug)
  const [lightboxOpen, setLightboxOpen] = useState(false)

  const copyLink = () => {
    navigator.clipboard?.writeText(canonicalUrl)
  }

  const shareButtons = (
    <>
      <button
        onClick={toggleSaved}
        aria-label={saved ? 'Quitar de guardados' : 'Guardar'}
        aria-pressed={saved}
        className="flex items-center justify-center gap-2 p-2.5 rounded-full border border-neutral-200 text-neutral-600 hover:border-neutral-300 hover:text-neutral-900 transition-colors"
      >
        {saved ? <BookmarkCheck size={18} className="text-red-600" /> : <Bookmark size={18} />}
      </button>
      <a
        href={shareUrl('whatsapp', canonicalUrl, news.title)}
        target="_blank" rel="noopener noreferrer"
        className="p-2.5 rounded-full bg-emerald-500 text-white hover:bg-emerald-600 transition-colors"
        aria-label="Compartir en WhatsApp"
      >
        <MessageCircle size={18} />
      </a>
      <a
        href={shareUrl('facebook', canonicalUrl, news.title)}
        target="_blank" rel="noopener noreferrer"
        className="p-2.5 rounded-full bg-blue-600 text-white hover:bg-blue-700 transition-colors"
        aria-label="Compartir en Facebook"
      >
        <Facebook size={18} />
      </a>
      <a
        href={shareUrl('twitter', canonicalUrl, news.title)}
        target="_blank" rel="noopener noreferrer"
        className="p-2.5 rounded-full bg-neutral-900 text-white hover:bg-neutral-800 transition-colors"
        aria-label="Compartir en X"
      >
        <Twitter size={18} />
      </a>
      <button
        onClick={copyLink}
        aria-label="Copiar enlace"
        className="p-2.5 rounded-full border border-neutral-200 text-neutral-600 hover:border-neutral-300 hover:text-neutral-900 transition-colors"
      >
        <Link2 size={18} />
      </button>
    </>
  )

  return (
    <div className="w-full max-w-7xl mx-auto px-4 md:px-6 pt-6 md:pt-10 pb-16">
      {/* Header block -- full page width, text left / hero right on
          desktop (stacked in the same order on mobile). The share rail
          and sidebar only start below this, alongside the body text --
          matching a real newsroom layout instead of squeezing the
          headline into the narrower reading column. */}
      <div className="lg:grid lg:grid-cols-2 lg:gap-12 lg:items-start mb-8">
        <div>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-red-600 font-bold text-xs uppercase tracking-[0.2em]">
              {news.category || 'Noticia'}
            </span>
            <span className="h-px w-8 bg-red-600" />
          </div>

          <h1 className="text-3xl md:text-4xl lg:text-[2.75rem] font-black text-neutral-900 leading-[1.08] mb-4">
            {news.title}
          </h1>

          {news.excerpt && (
            <p className="text-lg text-neutral-600 leading-relaxed mb-6">{news.excerpt}</p>
          )}

          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-red-600 text-white font-black flex items-center justify-center flex-shrink-0">
              {(news.author || 'Nexus News').trim().charAt(0).toUpperCase()}
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-neutral-900 text-sm">{news.author || 'Nexus News'}</span>
              <span className="text-neutral-500 text-xs flex items-center gap-1.5">
                <Calendar size={12} /> {formatArticleDate(news.published_at)} · {readingMinutes} min de lectura
              </span>
            </div>
          </div>

          {news.tags && news.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {news.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-3 py-1 rounded-full border border-neutral-200 text-neutral-600 text-xs font-medium"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Hero Image -- real pipeline images are 1536x1024 (3:2), so the
            container matches that ratio exactly and object-contain
            guarantees the full photo is always visible, never cropped. */}
        <div className="relative aspect-[3/2] w-full bg-neutral-950 rounded-2xl overflow-hidden mt-6 lg:mt-0 group">
          {heroImage ? (
            <Image
              src={heroImage}
              alt={news.title}
              fill
              sizes="(max-width: 1024px) 100vw, 600px"
              className="object-contain"
              priority
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-neutral-800 to-neutral-950">
              <span className="text-red-500 font-black text-2xl tracking-tight">Nexus News</span>
            </div>
          )}
          {heroImage && (
            <button
              onClick={() => setLightboxOpen(true)}
              aria-label="Ver imagen completa"
              className="absolute bottom-3 right-3 p-2 rounded-full bg-black/50 text-white backdrop-blur-md opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
            >
              <Maximize2 size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Mobile/tablet share row -- the sticky rail below is desktop-only */}
      <div className="flex lg:hidden items-center gap-2 mb-8 flex-wrap">
        {shareButtons}
      </div>

      <AdSlot position="ARTICLE_TOP" className="mb-10" />

      {/* Body row -- share rail, article body + related, sidebar */}
      <div className="lg:grid lg:grid-cols-[56px_minmax(0,1fr)_300px] lg:gap-8">
        <aside className="hidden lg:flex flex-col items-center gap-3 sticky top-24 h-fit">
          {shareButtons}
        </aside>

        <div className="min-w-0">
          <div className="article-content max-w-none
            [&>p:first-of-type]:first-letter:text-7xl [&>p:first-of-type]:first-letter:font-black [&>p:first-of-type]:first-letter:text-red-600 [&>p:first-of-type]:first-letter:mr-4 [&>p:first-of-type]:first-letter:float-left [&>p:first-of-type]:first-letter:leading-[0.8]
          ">
            {parse(safeArticleContent || `<p>${news.excerpt || 'Sin contenido disponible.'}</p>`)}
          </div>

          <AdSlot position="ARTICLE_END" className="my-10" />

          <RelatedNews currentNewsId={news.id} category={news.category} onNewsClick={onRelatedClick} />
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-6">
            <AdSlot position="SIDEBAR_DESKTOP" />
            <div className="rounded-2xl border border-neutral-200 p-6 bg-neutral-50">
              <h3 className="font-bold text-neutral-900 mb-2">Recibe las noticias que importan</h3>
              <p className="text-sm text-neutral-500 mb-4">Un resumen diario con lo más relevante de Colombia y el mundo.</p>
              <form className="flex flex-col gap-2" onSubmit={(e) => e.preventDefault()}>
                <input
                  type="email" placeholder="Tu correo electrónico"
                  className="rounded-lg px-3 py-2.5 text-sm border border-neutral-200 bg-white text-neutral-900 placeholder:text-neutral-400 outline-none focus:border-red-500/60"
                />
                <button type="submit" className="bg-red-600 hover:bg-red-700 transition-colors text-white px-4 py-2.5 rounded-lg font-bold text-sm">
                  Suscribirme
                </button>
              </form>
            </div>
          </div>
        </aside>
      </div>

      {lightboxOpen && heroImage && (
        <div
          className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center p-4"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            onClick={() => setLightboxOpen(false)}
            aria-label="Cerrar"
            className="absolute top-4 right-4 p-2.5 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
          >
            <X size={22} />
          </button>
          <img
            src={heroImage}
            alt={news.title}
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  )
}
