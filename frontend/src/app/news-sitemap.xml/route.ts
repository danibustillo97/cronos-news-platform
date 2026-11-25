import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'

export const runtime = 'nodejs'

export async function GET() {
  const supabase = createSupabaseServerClient()
  const { data, error } = await supabase
    .from('news')
    .select('slug,title,image_url,published_at')
    .eq('status', 'published')
    .gte('published_at', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
    .lte('published_at', new Date().toISOString())
    .order('published_at', { ascending: false })
    .limit(1000)

  if (error) {
    return new NextResponse('Unable to build news sitemap', { status: 503 })
  }

  const items = (data || [])
    .filter(item => item.slug && item.published_at && Number.isFinite(new Date(item.published_at).getTime()))
    .map(item => {
      const published = item.published_at
        ? new Date(item.published_at).toISOString()
        : null
      return [
        '  <url>',
        `    <loc>https://www.nexusnews.info/noticia/${encodeURIComponent(item.slug)}</loc>`,
        published ? `    <news:news><news:publication><news:name>Nexus News</news:name><news:language>es</news:language></news:publication><news:publication_date>${published}</news:publication_date><news:title>${escapeXml(item.title)}</news:title></news:news>` : '',
        item.image_url ? `    <image:image><image:loc>${escapeXml(item.image_url)}</image:loc></image:image>` : '',
        '  </url>',
      ].filter(Boolean).join('\n')
    })
    .join('\n')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${items}
</urlset>`

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=300',
    },
  })
}

function escapeXml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
