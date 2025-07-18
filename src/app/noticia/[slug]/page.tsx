// src/app/noticia/[slug]/page.tsx

import { notFound } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import Head from 'next/head'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export const dynamic = 'force-dynamic'

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

// ✅ ESTA ES LA FIRMA CORRECTA
export default async function NoticiaPage({ params }: { params: { slug: string } }) {
  const slug = params.slug // 👈 ya es sincrónico

  const { data, error } = await supabase
    .from('news')
    .select('*')
    .eq('slug', slug)
    .maybeSingle()

  if (error || !data) return notFound()

  const publishedAt = new Date(data.published_at)
  const relativeTime = formatDistanceToNow(publishedAt, { addSuffix: true, locale: es })
  const cleanContent = data.content.replace(/https?:\/\/[^\s]+/g, '').trim()

  return (
    <>
      <Head>
        <title>{data.title}</title>
        <meta name="description" content={data.summary || ''} />
        <meta property="og:title" content={data.title} />
        <meta property="og:image" content={data.image_url} />
      </Head>

      <main className="min-h-screen py-16 px-4">
        <div className="max-w-3xl mx-auto">
          <article className="bg-black rounded-3xl shadow-2xl overflow-hidden border border-yellow-400">
            <header className="px-8 pt-8">
              <h1 className="text-4xl md:text-5xl font-extrabold text-yellow-400 leading-tight">
                {data.title}
              </h1>
              <p className="mt-2 text-sm text-gray-400 italic">
                por {data.author} • {relativeTime}
              </p>
            </header>

            {data.image_url && (
              <div className="mt-4">
                <img
                  src={data.image_url}
                  alt={data.title}
                  className="w-full h-auto object-cover"
                />
              </div>
            )}

            <div className="px-8 pt-4">
              <span className="bg-yellow-400 text-black text-xs font-bold px-3 py-1 rounded-full">
                {data.category}
              </span>
            </div>

            <div
              className="px-8 py-6 text-gray-100 leading-relaxed space-y-6 text-justify"
              dangerouslySetInnerHTML={{ __html: cleanContent }}
            />

            {data.tags && (
              <div className="px-8 pb-8 flex flex-wrap gap-2">
                {data.tags.map((tag: string) => (
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
    </>
  )
}
