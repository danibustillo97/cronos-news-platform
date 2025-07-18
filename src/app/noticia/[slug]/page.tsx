'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Head from 'next/head'
import { formatDistanceToNow, format } from 'date-fns'
import { es } from 'date-fns/locale'
import { createClient } from '@supabase/supabase-js'

interface NewsItem {
  title: string
  summary: string
  content: string
  image_url: string
  author: string
  category: string
  published_at: string
  tags?: string[]
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function NoticiaPage({ params }: { params: { slug: string } }) {
  const router = useRouter()
  const { slug } = params
  const [data, setData] = useState<NewsItem | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchNoticia() {
      const { data: news, error } = await supabase
        .from('news')
        .select('title, summary, content, image_url, author, category, published_at, tags')
        .eq('slug', slug)
        .maybeSingle()
      if (error || !news) {
        router.replace('/noticia/no-encontrada')
        return
      }
      setData(news)
      setLoading(false)
    }
    fetchNoticia()
  }, [slug, router])

  useEffect(() => {
    if (!data) return
    document.title = data.title
    let meta = document.querySelector("meta[name='description']")
    if (!meta) {
      meta = document.createElement('meta')
      meta.setAttribute('name', 'description')
      document.head.appendChild(meta)
    }
    meta.setAttribute('content', data.summary || '')
  }, [data])

  if (loading) return <div className="text-center text-gray-300 mt-32">Cargando noticia…</div>
  if (!data) {
    router.replace('/noticia/no-encontrada')
    return null
  }

  const publishedAt = new Date(data.published_at)
  const relativeTime = formatDistanceToNow(publishedAt, { addSuffix: true, locale: es })
  const cleanContent = data.content.replace(/https?:\/\/[^\s]+/g, '').trim()

  return (
    <>
      <Head>
        <meta property="og:title" content={data.title} />
        <meta property="og:image" content={data.image_url} />
      </Head>

      <main
        className="relative min-h-screen bg-gray-50 overflow-hidden py-16 px-4"
        style={{
          backgroundImage: 'url(/canvas-texture.png)',
          backgroundSize: 'cover',
          backgroundBlendMode: 'overlay',
        }}
      >
        <div className="canvas-bg" />

        <div className="relative max-w-3xl mx-auto">
          <article className="relative bg-black/90 rounded-[32px] shadow-2xl overflow-hidden">
            {/* Título */}
            <header className="p-8">
              <h1 className="text-4xl md:text-5xl font-extrabold text-yellow-400 leading-tight">
                {data.title}
              </h1>
              <p className="mt-2 text-sm text-gray-400 italic">
                por {data.author} • {relativeTime}
              </p>
            </header>

            {/* Imagen */}
            {data.image_url && (
              <div className="overflow-hidden">
                <img
                  src={data.image_url}
                  alt={data.title}
                  className="w-full h-auto object-cover"
                />
              </div>
            )}

            {/* Badge categoría */}
            <div className="absolute top-8 right-8 flex space-x-2">
              <span className="bg-yellow-400 text-black text-xs font-semibold px-3 py-1 rounded-full">
                {data.category}
              </span>
            </div>

            {/* Contenido */}
            <div
              className="prose prose-lg prose-invert max-w-none p-8 bg-black/80 text-gray-100 leading-relaxed space-y-8 text-justify"
              dangerouslySetInnerHTML={{ __html: cleanContent }}
            />

            {/* Tags */}
            {data.tags && (
              <div className="px-8 pb-8 flex flex-wrap gap-2">
                {data.tags.map((tag) => (
                  <span
                    key={tag}
                    className="bg-gray-700 text-gray-200 text-xs px-3 py-1 rounded-full"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </article>
        </div>
      </main>

      <style jsx>{`
        .canvas-bg {
          position: absolute;
          inset: 0;
          background: 
            repeating-linear-gradient(
              45deg,
              rgba(0, 0, 0, 0.03),
              rgba(0, 0, 0, 0.03) 1px,
              transparent 1px,
              transparent 10px
            ),
            radial-gradient(circle at top left, rgba(255, 200, 100, 0.05), transparent 70%),
            radial-gradient(circle at bottom right, rgba(100, 150, 255, 0.04), transparent 70%);
          pointer-events: none;
        }
        /* Legibilidad mejorada */
        .prose-lg {
          font-size: 1.125rem;       /* 18px */
          line-height: 1.75rem;      /* 28px */
        }
        .prose p {
          margin-bottom: 2rem;       /* separación mayor */
        }
        .prose ul {
          padding-left: 1.5rem;
          margin-bottom: 2rem;
        }
        .prose li {
          margin-bottom: 1rem;
        }
        .prose blockquote {
          border-left: 4px solid #444;
          padding-left: 1rem;
          color: #bbb;
          margin: 2rem 0;
        }
        .prose code {
          background: rgba(255, 255, 255, 0.1);
          padding: 0.2rem 0.4rem;
          border-radius: 4px;
          font-size: 0.9rem;
        }
      `}</style>
    </>
  )
}
