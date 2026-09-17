'use client'

// The ONE real article reading experience -- shared between NewsModal
// (opened over the feed while browsing) and the standalone /noticia/[slug]
// page (direct link, share, reload, or when JS/crawlers can't run the
// modal). Both must look identical -- a reader should never be able to
// tell which path they're on. `content` is real structured HTML by now
// (see backend PublishArtifact._resolve_content_html) -- body images are
// already resolved <img>+<figcaption>, never plain text, never a
// dangling <figure> marker.

import Image from 'next/image'
import { Calendar, User, Clock, Share2, Facebook, Twitter } from 'lucide-react'
import { proxiedImage } from '@/lib/media'
import RelatedNews from './RelatedNews'
import DOMPurify from 'isomorphic-dompurify'
import parse from 'html-react-parser'
import type { NewsView } from '@/types/news'

const SITE_URL = 'https://www.nexusnews.info'

function shareUrl(platform: 'facebook' | 'twitter', url: string, title: string): string {
  if (platform === 'facebook') return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`
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

export default function ArticleContent({
  news, onRelatedClick,
}: {
  news: NewsView
  onRelatedClick: (news: NewsView) => void
}) {
  const canonicalUrl = `${SITE_URL}/noticia/${news.slug}`
  const heroImage = proxiedImage(news.image_url)
  const safeArticleContent = news.content
    ? DOMPurify.sanitize(news.content, { USE_PROFILES: { html: true, svg: true, svgFilters: true } })
    : ''

  return (
    <>
      {/* Hero Image -- a gentler 3:2 ratio (close to the real 1536x1024
          images the pipeline generates) instead of a square/16:9 crop
          that chopped subjects out of the frame. */}
      <div className="relative aspect-[3/2] sm:aspect-[16/9] w-full max-h-[60vh] bg-neutral-900">
        {heroImage ? (
          <Image
            src={heroImage}
            alt={news.title}
            fill
            sizes="(max-width: 768px) 100vw, 1024px"
            className="object-cover"
            priority
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-neutral-800 to-neutral-950">
            <span className="text-red-500 font-black text-2xl tracking-tight">Nexus News</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-transparent" />

        <div className="absolute bottom-0 left-0 p-4 md:p-10 w-full max-w-6xl mx-auto">
          <div className="flex items-center gap-3 mb-2 md:mb-3 flex-wrap">
            <span className="bg-red-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-[0.18em] shadow-lg">
              {news.category || 'Noticia'}
            </span>
            <span className="text-neutral-200 text-[10px] md:text-xs flex items-center gap-1.5 bg-black/20 backdrop-blur-sm px-2.5 py-1 rounded-full border border-white/10">
              <Clock size={12} /> {formatArticleDate(news.published_at)}
            </span>
          </div>
          <h1 className="text-xl md:text-3xl lg:text-4xl font-black text-white leading-[1.05] mb-2 drop-shadow-[0_10px_25px_rgba(0,0,0,0.6)] line-clamp-3 md:line-clamp-none">
            {news.title}
          </h1>
        </div>
      </div>

      {/* Article Body */}
      <div className="p-6 md:p-10 max-w-4xl mx-auto">
        <div className="flex flex-wrap items-center gap-6 text-sm text-neutral-500 mb-10 border-b border-neutral-200 pb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-neutral-100 rounded-full flex items-center justify-center text-neutral-500 ring-1 ring-neutral-200">
              <User size={18} />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-[0.2em]">Por</span>
              <span className="font-bold text-neutral-900 text-base">{news.author || 'Redacción Nexus'}</span>
            </div>
          </div>
          <div className="h-8 w-[1px] bg-neutral-200 hidden sm:block"></div>
          <div className="flex items-center gap-2 text-neutral-600">
            <Calendar size={17} className="text-neutral-500" />
            <span className="font-medium">{formatArticleDate(news.published_at)}</span>
          </div>
          <div className="ml-auto flex gap-2">
            <a
              href={shareUrl('facebook', canonicalUrl, news.title)}
              target="_blank" rel="noopener noreferrer"
              className="p-2.5 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors shadow-sm hover:shadow-md"
              aria-label="Compartir en Facebook"
            >
              <Facebook size={18} />
            </a>
            <a
              href={shareUrl('twitter', canonicalUrl, news.title)}
              target="_blank" rel="noopener noreferrer"
              className="p-2.5 bg-sky-500 text-white rounded-full hover:bg-sky-600 transition-colors shadow-sm hover:shadow-md"
              aria-label="Compartir en X"
            >
              <Twitter size={18} />
            </a>
            <button
              onClick={() => {
                if (navigator.share) navigator.share({ title: news.title, url: canonicalUrl })
                else navigator.clipboard?.writeText(canonicalUrl)
              }}
              className="p-2.5 bg-emerald-500 text-white rounded-full hover:bg-emerald-600 transition-colors shadow-sm hover:shadow-md"
              aria-label="Compartir"
            >
              <Share2 size={18} />
            </button>
          </div>
        </div>

        <div className="article-content max-w-3xl mx-auto px-6 md:px-0
          [&>p:first-of-type]:first-letter:text-7xl [&>p:first-of-type]:first-letter:font-black [&>p:first-of-type]:first-letter:text-red-600 [&>p:first-of-type]:first-letter:mr-4 [&>p:first-of-type]:first-letter:float-left [&>p:first-of-type]:first-letter:leading-[0.8]
        ">
          {parse(safeArticleContent || `<p>${news.excerpt || 'Sin contenido disponible.'}</p>`)}
        </div>

        <RelatedNews currentNewsId={news.id} category={news.category} onNewsClick={onRelatedClick} />
      </div>
    </>
  )
}
