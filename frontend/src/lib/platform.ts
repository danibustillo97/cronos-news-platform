// Capa de modelo para la nueva composición editorial del Home --
// Creador / Publicación / Cobertura. NEXUS hoy no tiene ninguna de estas
// entidades en el backend (no hay tabla de creadores, no hay video_url/
// audio_url en `news` -- confirmado leyendo domain/ y los schemas SQL).
// Por eso este archivo no inventa datos: son TIPOS preparados para
// recibir contenido real (API/WebSocket/streaming/CMS, como pidió el
// brief), más ADAPTADORES que construyen instancias reales a partir de
// lo que sí existe hoy (news.author, news.category, tags, sports
// scoreboard). Ningún Creator tiene seguidores falsos -- solo cuenta
// publicaciones reales. Ningún Post tiene formato video/audio/live salvo
// que el dato de origen realmente lo sea (hoy: nunca, hasta que exista
// esa columna).

import type { NewsView } from '@/types/news'
import type { Match } from '@/types/sports'

export type PostFormat = 'article' | 'photo' | 'video' | 'audio' | 'live' | 'gallery' | 'data' | 'mixed'

export interface Creator {
  id: string
  name: string
  initial: string
  specialty: string | null
  postCount: number
}

// Ningún NewsView tiene estos campos hoy (no existe video_url/audio_url
// en `news` -- ver comentario de arriba). `media` queda opcional a
// propósito: en cuanto el backend agregue esas columnas, un Post real
// puede traer video/audio sin cambiar este tipo ni PostCard.tsx.
export interface PostMedia {
  videoUrl?: string
  audioUrl?: string
  durationLabel?: string
}

export interface Post {
  id: string
  format: PostFormat
  creator: Creator
  title: string
  excerpt: string | null
  category: string | null
  imageUrl: string | null
  publishedAt: string
  slug: string
  readMinutes: number
  media?: PostMedia
  source: NewsView
}

export interface Coverage {
  id: string
  title: string
  match: Match
  posts: Post[]
}

function creatorFromName(name: string, allNews: NewsView[]): Creator {
  const authored = allNews.filter((n) => (n.author || 'Nexus News') === name)
  const categories = new Map<string, number>()
  for (const n of authored) {
    if (!n.category) continue
    categories.set(n.category, (categories.get(n.category) ?? 0) + 1)
  }
  const specialty = Array.from(categories.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
  return {
    id: name,
    name,
    initial: name.slice(0, 1).toUpperCase(),
    specialty,
    postCount: authored.length,
  }
}

export function newsToPost(item: NewsView, allNews: NewsView[]): Post {
  return {
    id: item.id,
    format: 'article',
    creator: creatorFromName(item.author || 'Nexus News', allNews),
    title: item.title,
    excerpt: item.excerpt ?? null,
    category: item.category ?? null,
    imageUrl: item.image_url ?? null,
    publishedAt: item.published_at,
    slug: item.slug,
    readMinutes: estimateReadMinutesLocal(item.content, item.excerpt),
    source: item,
  }
}

// Espejo mínimo de lib/readTime.ts -- evita un ciclo de import (readTime
// no depende de platform, pero mantener la lógica en un solo lugar real
// es mejor; se re-exporta desde acá para quien construya Posts).
function estimateReadMinutesLocal(...texts: (string | null | undefined)[]): number {
  const combined = texts.filter(Boolean).join(' ').replace(/<[^>]*>/g, ' ')
  const words = combined.trim().split(/\s+/).filter(Boolean).length
  if (words === 0) return 0
  return Math.max(1, Math.round(words / 200))
}

// Top creadores reales por volumen de publicación -- nunca por
// "seguidores" (no existe ese dato). `min` filtra ruido de un autor con
// una sola nota ocasional.
export function topCreators(allNews: NewsView[], limit = 6, min = 1): Creator[] {
  const names = new Set(allNews.map((n) => n.author || 'Nexus News'))
  return Array.from(names)
    .map((name) => creatorFromName(name, allNews))
    .filter((c) => c.postCount >= min)
    .sort((a, b) => b.postCount - a.postCount)
    .slice(0, limit)
}

// Cobertura real: busca coincidencia textual entre los equipos de un
// partido y el título de noticias ya publicadas -- nunca inventa una
// relación. Si ningún partido tiene al menos 1 nota real relacionada,
// devuelve null y el módulo que lo consuma simplemente no se muestra.
export function buildCoverage(matches: Match[], sportsNews: NewsView[]): Coverage | null {
  const candidates = [...matches.filter((m) => m.status === 'live'), ...matches.filter((m) => m.status !== 'live')]
  for (const match of candidates) {
    const needles = [match.homeTeam, match.awayTeam].map((t) => t.toLowerCase())
    const related = sportsNews.filter((n) => needles.some((needle) => n.title.toLowerCase().includes(needle)))
    if (related.length > 0) {
      return {
        id: match.id,
        title: `${match.homeTeam} vs. ${match.awayTeam}`,
        match,
        posts: related.slice(0, 4).map((n) => newsToPost(n, sportsNews)),
      }
    }
  }
  return null
}
