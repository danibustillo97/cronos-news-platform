// Datos del home resueltos en el SERVIDOR (SEO: el HTML inicial ya trae
// la portada, el feed y sus enlaces; sin depender de JS). Solo lectura
// pública: misma consulta que el navegador (news publicadas por recencia)
// con la clave publicable, y el layout de Portada desde el backend.

import { createClient } from '@supabase/supabase-js'
import { apiUrl } from '@/studio/lab/api-client'
import { normalizeLayout } from '@/lib/portalLayout'
import { estimateReadMinutes } from '@/lib/readTime'
import { filterCurrentNews, newsQueryFloor } from '@/lib/newsFreshness'
import type { PortalLayout } from '@/types/portal'
import type { NewsView } from '@/types/news'

export const HOME_PAGE_SIZE = 24
/** El cuerpo completo no viaja al HTML inicial: basta el inicio para resúmenes y citas. */
const CONTENT_PREVIEW_CHARS = 3_000

export async function getHomeNews(): Promise<NewsView[] | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY
    || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
  if (!url || !key) return null
  try {
    const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data, error } = await client
      .from('news')
      .select('id,title,subtitle,slug,excerpt,summary,content,image_url,category,tags,author,published_at,views,source,source_url')
      .eq('status', 'published')
      .gte('published_at', newsQueryFloor())
      .order('published_at', { ascending: false })
      .range(0, 99)
    if (error || !data) return null
    return filterCurrentNews(data as NewsView[]).slice(0, HOME_PAGE_SIZE).map((n) => ({
      ...n,
      read_minutes: estimateReadMinutes(n.content, n.excerpt),
      content: n.content ? n.content.slice(0, CONTENT_PREVIEW_CHARS) : n.content,
      content_truncated: Boolean(n.content && n.content.length > CONTENT_PREVIEW_CHARS),
    }))
  } catch {
    return null
  }
}

/** null = no se pudo leer (el portal usa DEFAULT_LAYOUT y vuelve a intentar en el navegador). */
export async function getPortalLayoutServer(): Promise<PortalLayout | null> {
  try {
    const res = await fetch(apiUrl('/api/portal/layout'), { signal: AbortSignal.timeout(2_000), next: { revalidate: 15 } })
    if (!res.ok) return null
    return normalizeLayout(await res.json())
  } catch {
    return null
  }
}
