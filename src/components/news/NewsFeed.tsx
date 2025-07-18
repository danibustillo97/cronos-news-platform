'use client'

import React, { useEffect, useState, useRef } from 'react'
import { ThumbsUp, MessageCircle, Share2, Copy, Facebook, Twitter, Linkedin } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'

interface NewsItem {
  id: string
  title: string
  content: string
  image_url: string
  author: string
  published_at: string
  slug: string
}

const SkeletonCard = () => (
  <div className="bg-neutral-900 rounded-xl shadow p-4 space-y-3 animate-pulse max-w-2xl mx-auto">
    <div className="w-full aspect-video bg-neutral-700 rounded-lg" />
    <div className="h-3 w-1/3 bg-neutral-700 rounded" />
    <div className="h-5 w-2/3 bg-neutral-600 rounded" />
    <div className="h-3 w-full bg-neutral-700 rounded" />
    <div className="h-3 w-5/6 bg-neutral-700 rounded" />
    <div className="flex gap-3 mt-2">
      <div className="h-3 w-14 bg-neutral-700 rounded" />
      <div className="h-3 w-16 bg-neutral-700 rounded" />
      <div className="h-3 w-20 bg-neutral-700 rounded" />
    </div>
  </div>
)

const AdBanner = () => (
  <div className="max-w-2xl mx-auto">
    <div className="my-6">
      <ins
        className="adsbygoogle block w-full h-32 bg-yellow-400 rounded-lg shadow flex items-center justify-center text-black font-semibold text-sm"
        style={{ display: 'block' }}
        data-ad-client="ca-pub-xxxxxxxxxxxxxxx"
        data-ad-slot="xxxxxxxxxx"
        data-ad-format="auto"
        data-full-width-responsive="true"
      >
        Banner Publicitario
      </ins>
    </div>
  </div>
)

const timeAgo = (dateStr: string) => {
  const diff = Date.now() - new Date(dateStr).getTime()
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `hace ${days} día${days > 1 ? 's' : ''}`
  if (hours > 0) return `hace ${hours} hora${hours > 1 ? 's' : ''}`
  if (minutes > 0) return `hace ${minutes} minuto${minutes > 1 ? 's' : ''}`
  return 'hace unos segundos'
}

const ShareButton = ({ slug }: { slug: string }) => {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/noticia/${slug}`

  const handleCopy = () => {
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 hover:text-yellow-400 transition"
      >
        <Share2 size={16} />
        Compartir
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.2 }}
            className="absolute right-0 mt-2 w-64 bg-neutral-950 border border-neutral-800 rounded-xl shadow-xl p-4 z-50 space-y-3"
          >
            <p className="text-xs text-neutral-400 font-medium">Compartir noticia</p>

            <div className="flex justify-between gap-4 text-yellow-400">
              <a
                href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:scale-110 transition"
              >
                <Facebook size={20} />
              </a>
              <a
                href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:scale-110 transition"
              >
                <Twitter size={20} />
              </a>
              <a
                href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:scale-110 transition"
              >
                <Linkedin size={20} />
              </a>
            </div>

            <div className="flex items-center justify-between text-xs bg-neutral-800 rounded-md px-3 py-2">
              <span className="truncate text-neutral-400">{url}</span>
              <button onClick={handleCopy} className="text-yellow-400 hover:text-yellow-300 transition">
                {copied ? '✅' : <Copy size={14} />}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

const NewsFeed = () => {
  const [news, setNews] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  useEffect(() => {
    async function fetchNews() {
      try {
        const res = await fetch('https://backendcronosnews-production.up.railway.app/api/news/published')
        const data = await res.json()
        if (data.success) {
          const sorted = data.news.sort(
            (a: NewsItem, b: NewsItem) =>
              new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
          )
          setNews(sorted)
        }
      } catch (error) {
        console.error('Error fetching news:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchNews()
  }, [])

  const toggleExpand = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <div className="space-y-6 px-4 max-w-2xl mx-auto">
      {loading
        ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
        : news.map((item, index) => (
            <React.Fragment key={item.id}>
              {index > 0 && index % 4 === 0 && <AdBanner />}

              <article className="bg-neutral-900 rounded-xl shadow-md p-4 space-y-3">
                <Link href={`/noticia/${item.slug}`}>
                  <div className="relative cursor-pointer">
                    <img
                      src={item.image_url}
                      alt={item.title}
                      className="w-full rounded-lg aspect-video object-cover"
                    />
                    <span className="absolute top-2 left-2 bg-yellow-400 text-black text-[10px] font-semibold px-1.5 py-0.5 rounded shadow">
                      {item.author || 'Fuente'}
                    </span>
                  </div>
                </Link>

                <div className="text-xs text-neutral-400">{timeAgo(item.published_at)}</div>

                <Link href={`/noticia/${item.slug}`}>
                  <h2 className="text-lg font-semibold leading-snug text-white hover:underline">
                    {item.title}
                  </h2>
                </Link>

                <p
                  className={`text-sm text-neutral-300 leading-relaxed ${
                    expanded[item.id] ? '' : 'line-clamp-5'
                  }`}
                >
                  {item.content}
                </p>

                {item.content.length > 300 && (
                  <button
                    className="text-xs text-yellow-400 hover:underline"
                    onClick={() => toggleExpand(item.id)}
                  >
                    {expanded[item.id] ? 'Ver menos' : 'Ver más'}
                  </button>
                )}

                <div className="flex items-center justify-between pt-3 border-t border-neutral-800 text-xs text-neutral-400">
                  <button className="flex items-center gap-1 hover:text-yellow-400 transition">
                    <ThumbsUp size={16} />
                    Me gusta
                  </button>

                  <button className="flex items-center gap-1 hover:text-yellow-400 transition">
                    <MessageCircle size={16} />
                    Comentarios
                    <span className="ml-1 bg-yellow-400 text-black px-1.5 py-0.5 rounded-full text-[10px] font-bold shadow">
                      3
                    </span>
                  </button>

                  <ShareButton slug={item.slug} />
                </div>
              </article>
            </React.Fragment>
          ))}
    </div>
  )
}

export default NewsFeed
