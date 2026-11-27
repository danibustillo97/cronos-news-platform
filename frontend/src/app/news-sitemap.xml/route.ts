import { supabase } from '@/lib/supabaseClient'

export const revalidate = 1800

function xmlEscape(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export async function GET() {
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabase
    .from('news')
    .select('title, slug, published_at, category, tags')
    .eq('status', 'published')
    .gte('published_at', cutoff)
    .order('published_at', { ascending: false })
    .limit(1000)

  if (error) {
    return new Response('News sitemap temporarily unavailable', {
      status: 503,
      headers: { 'Cache-Control': 'no-store', 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }

  const urls = (data ?? [])
    .filter((item) => item.slug && item.title && item.published_at)
    .map((item) => {
      const keywords = [item.category, ...(Array.isArray(item.tags) ? item.tags : [])]
        .filter(Boolean)
        .join(', ')
      return `<url>
  <loc>https://www.nexusnews.info/noticia/${encodeURIComponent(item.slug)}</loc>
  <news:news>
    <news:publication>
      <news:name>NEXUS News</news:name>
      <news:language>es</news:language>
    </news:publication>
    <news:publication_date>${xmlEscape(new Date(item.published_at).toISOString())}</news:publication_date>
    <news:title>${xmlEscape(item.title)}</news:title>
    ${keywords ? `<news:keywords>${xmlEscape(keywords)}</news:keywords>` : ''}
  </news:news>
</url>`
    })
    .join('\n')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${urls}
</urlset>`

  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600',
    },
  })
}
