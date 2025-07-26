import { notFound } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import Head from 'next/head'

interface NewsItem {
  id: string
  title: string
  summary: string
  content: string
  image_url: string
  author: string
  published_at: string
  slug: string
  category: string
  tags?: string[]
  league?: string
  country?: string
  team?: string
  seo_score?: number
  relevance_score?: number
}

export const dynamic = 'force-dynamic'

async function fetchNewsBySlug(slug: string): Promise<NewsItem | null> {
  const res = await fetch(
    `https://backendcronosnews-production.up.railway.app/api/news/slug/${slug}`,
    { cache: 'no-store' }
  )
  if (!res.ok) return null
  const { news } = await res.json()
  return news || null
}

export default async function NoticiaPage({ params }: { params: { slug: string } }) {
  const slug = params.slug
  const data = await fetchNewsBySlug(slug)

  if (!data) return notFound()

  const publishedAt = new Date(data.published_at)
  const relativeTime = formatDistanceToNow(publishedAt, { addSuffix: true, locale: es })
  const cleanContent = data.content.replace(/https?:\/\/[^\s]+/g, '').trim()

  return (
    <>
      <Head>
        <title>{data.title} | CronosNews</title>
        <meta name="description" content={data.summary || data.title} />
        <meta property="og:title" content={data.title} />
        <meta property="og:image" content={data.image_url} />
        <meta property="og:description" content={data.summary || data.title} />
      </Head>
      <main className="min-h-screen py-12 px-2 md:px-0 bg-gradient-to-br from-black to-neutral-950">
        <section className="max-w-2xl mx-auto">
          <article className="bg-black/80 border border-yellow-400 rounded-3xl shadow-2xl overflow-hidden">
            <header className="px-8 pt-8 flex flex-col gap-3">
              <span className={`inline-block w-max mb-2 px-4 py-1 rounded-full font-bold text-xs uppercase
                ${data.category === 'banderazo rojo'
                  ? 'bg-red-600 text-white border border-red-200'
                  : 'bg-yellow-400 text-black'}
              `}>
                {data.category}
              </span>
              <h1 className="text-3xl md:text-5xl font-extrabold leading-tight tracking-tight text-white mb-2">
                {data.title}
              </h1>
              <div className="flex flex-wrap gap-4 items-center text-xs text-gray-400 font-medium">
                <span>por {data.author || 'Noirs Virals'}</span>
                <span>• {relativeTime}</span>
                {data.country && <span className="italic">| {data.country}</span>}
                {data.league && data.league !== 'General' && <span className="italic">| {data.league}</span>}
                {data.team && <span className="italic">| {data.team}</span>}
              </div>
            </header>
            {data.image_url && (
              <div className="mt-6 mb-2">
                <img
                  src={data.image_url}
                  alt={data.title}
                  className="w-full h-[240px] md:h-[320px] object-cover object-center rounded-b-xl"
                  loading="lazy"
                />
              </div>
            )}
            <div className="px-8 pt-4 pb-8 text-gray-100 leading-relaxed space-y-6 text-justify">
              {cleanContent.split('\n').map((p, idx) =>
                <p key={idx} className="mb-3">{p.trim()}</p>
              )}
              {data.tags && data.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-6">
                  {data.tags.map((tag: string) => (
                    <span
                      key={tag}
                      className="bg-neutral-200 text-neutral-800 px-3 py-1 rounded-full text-xs font-semibold"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </article>
        </section>
      </main>
    </>
  )
}
