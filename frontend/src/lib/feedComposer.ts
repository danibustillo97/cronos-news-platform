// "Pulso" -- composición pura del feed social del home. No es una lista de
// noticias en secuencia: teje historias (de tamaños distintos) con
// bloques derivados de datos REALES -- resumen "en 30 segundos" (del
// summary/excerpt), declaraciones (citas textuales que ya están en el
// cuerpo), partidos, tabla, cifras del día y temas en tendencia (tags).
// Si un dato no existe, su bloque simplemente no se genera: nunca se
// fabrica contenido.

import type { Match } from '@/types/sports'

export interface FeedStory {
  id: string
  title: string
  slug: string
  published_at: string
  summary?: string | null
  excerpt?: string | null
  content?: string | null
  tags?: string[] | null
}

// ---------------------------------------------------------------- texto

const ENTITIES: Record<string, string> = {
  amp: '&', quot: '"', apos: "'", nbsp: ' ', lt: '<', gt: '>',
  ldquo: '“', rdquo: '”', laquo: '«', raquo: '»', lsquo: '‘', rsquo: '’', hellip: '…',
}

export function decodeEntities(input: string): string {
  return input.replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (whole, code: string) => {
    if (code[0] === '#') {
      const n = code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10)
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : whole
    }
    return ENTITIES[code.toLowerCase()] ?? whole
  })
}

/** Párrafos de texto plano a partir del HTML del artículo (sin figcaptions). */
export function htmlParagraphs(html: string | null | undefined): string[] {
  if (!html) return []
  const cleaned = html
    .replace(/<(script|style|figcaption|figure|iframe)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|h[1-6]|li|blockquote|div)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
  return decodeEntities(cleaned)
    .split(/\n+/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

/** Hasta `max` frases del resumen real -- base de "En 30 segundos". */
export function summaryPoints(text: string | null | undefined, max = 3): string[] {
  if (!text) return []
  const flat = decodeEntities(text).replace(/\s+/g, ' ').trim()
  const sentences = flat.match(/[^.!?…]+[.!?…]+["”»)]?/g) ?? []
  return sentences
    .map((s) => s.trim())
    .filter((s) => s.length >= 30 && s.length <= 260)
    .slice(0, max)
}

/**
 * "En 30 segundos": bajada (excerpt) + primeros párrafos del cuerpo +
 * summary, sin repetir frases. Todo texto real de la nota.
 */
export function briefPoints(story: Pick<FeedStory, 'excerpt' | 'content' | 'summary'>, max = 3): string[] {
  const candidates = [
    ...summaryPoints(story.excerpt, max),
    ...summaryPoints(htmlParagraphs(story.content).slice(0, 3).join(' '), max),
    ...summaryPoints(story.summary, max),
  ]
  const seen = new Set<string>()
  const out: string[] = []
  for (const sentence of candidates) {
    const key = sentence.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(sentence)
    if (out.length >= max) break
  }
  return out
}

// --------------------------------------------------------------- partidos

/** En vivo primero, luego el próximo en arrancar, luego el último final. */
export function featuredMatches(matches: Match[], now: Date, max = 3): Match[] {
  const live = matches.filter((m) => m.status === 'live')
  const t = (m: Match) => (m.date ? Date.parse(m.date) : NaN)
  const upcoming = matches
    .filter((m) => m.status === 'scheduled' && t(m) >= now.getTime())
    .sort((a, b) => t(a) - t(b))
  const finished = matches
    .filter((m) => m.status === 'finished' && Number.isFinite(t(m)))
    .sort((a, b) => t(b) - t(a))
  return [...live, ...upcoming.slice(0, 1), ...finished.slice(0, 1)].slice(0, max)
}

// ------------------------------------------------------------------ tiempo

export function timeAgo(iso: string | number | null | undefined, now: Date = new Date()): string {
  if (iso === null || iso === undefined) return ''
  const t = typeof iso === 'number' ? iso : Date.parse(iso)
  if (!Number.isFinite(t)) return ''
  const diff = Math.round((now.getTime() - t) / 60_000)
  if (diff < 1) return 'ahora'
  if (diff < 60) return `hace ${diff} min`
  const hours = Math.floor(diff / 60)
  if (hours < 24) return `hace ${hours} h`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'ayer'
  if (days < 7) return `hace ${days} días`
  return new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short' }).format(new Date(t))
}

export function kickoffLabel(iso: string | null, now: Date = new Date()): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const time = new Intl.DateTimeFormat('es-CO', { hour: 'numeric', minute: '2-digit' }).format(date)
  const tomorrow = new Date(now)
  tomorrow.setDate(now.getDate() + 1)
  if (date.toDateString() === now.toDateString()) return `Hoy ${time}`
  if (date.toDateString() === tomorrow.toDateString()) return `Mañana ${time}`
  return `${new Intl.DateTimeFormat('es-CO', { weekday: 'short', day: 'numeric' }).format(date)} · ${time}`
}
