// "Pulso" -- composición pura del feed social del home. No es una lista de
// noticias en secuencia: teje historias (de tamaños distintos) con
// bloques derivados de datos REALES -- resumen "en 30 segundos" (del
// summary/excerpt), declaraciones (citas textuales que ya están en el
// cuerpo), partidos, tabla, cifras del día y temas en tendencia (tags).
// Si un dato no existe, su bloque simplemente no se genera: nunca se
// fabrica contenido.

import type { Match } from '@/types/sports'
import { detectVideoSource } from '@/lib/streamSource'

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

export type StorySize = 'lead' | 'wide' | 'standard'

export type FeedBlock<S extends FeedStory = FeedStory> =
  | { type: 'story'; key: string; story: S; size: StorySize }
  | { type: 'brief'; key: string; story: S; points: string[] }
  | { type: 'quote'; key: string; story: S; quote: string }
  | { type: 'match'; key: string; match: Match }
  | { type: 'stat'; key: string; stats: { label: string; value: number }[] }
  | { type: 'standings'; key: string; league: string }
  | { type: 'trending'; key: string; topics: { tag: string; count: number }[] }
  | { type: 'video'; key: string; story: S; embedUrl: string }
  | { type: 'poll'; key: string; pollId: string }
  | { type: 'players'; key: string }
  | { type: 'ad'; key: string }

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

const QUOTE_PATTERNS = [/“([^”]{40,280})”/, /«([^»]{40,280})»/, /"([^"]{40,280})"/]

/** Primera cita textual real del cuerpo (entre comillas), o null. */
export function extractQuote(html: string | null | undefined): string | null {
  for (const paragraph of htmlParagraphs(html)) {
    for (const pattern of QUOTE_PATTERNS) {
      const m = paragraph.match(pattern)
      if (m) {
        const quote = m[1].trim().replace(/[,;:]$/, '')
        if (quote.split(' ').length >= 7) return quote
      }
    }
  }
  return null
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

/** Primer video de YouTube embebido en el cuerpo de la nota. */
export function extractVideoEmbed(html: string | null | undefined): string | null {
  if (!html) return null
  const re = /(?:src|href|data-src)=["']([^"']*(?:youtube\.com|youtu\.be|youtube-nocookie\.com)[^"']*)["']/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) {
    const raw = decodeEntities(m[1]).replace(/^\/\//, 'https://')
    const src = detectVideoSource(raw)
    if (src?.kind === 'youtube') return src.embedUrl.replace('autoplay=1&mute=1&', '')
  }
  return null
}

export function trendingTopics(stories: FeedStory[], max = 6): { tag: string; count: number }[] {
  const counts = new Map<string, { tag: string; count: number; first: number }>()
  stories.forEach((story, index) => {
    const seenInStory = new Set<string>()
    for (const raw of story.tags ?? []) {
      const tag = typeof raw === 'string' ? raw.trim() : ''
      const key = tag.toLowerCase()
      if (!tag || seenInStory.has(key)) continue
      seenInStory.add(key)
      const entry = counts.get(key)
      if (entry) entry.count += 1
      else counts.set(key, { tag, count: 1, first: index })
    }
  })
  return [...counts.values()]
    .sort((a, b) => b.count - a.count || a.first - b.first)
    .slice(0, max)
    .map(({ tag, count }) => ({ tag, count }))
}

// --------------------------------------------------------------- partidos

function sameLocalDay(iso: string | null, now: Date): boolean {
  if (!iso) return false
  const d = new Date(iso)
  return !Number.isNaN(d.getTime()) && d.toDateString() === now.toDateString()
}

export function matchDayStats(matches: Match[], now: Date): { label: string; value: number }[] {
  const today = matches.filter((m) => sameLocalDay(m.date, now) || m.status === 'live')
  const live = today.filter((m) => m.status === 'live').length
  const goals = today
    .filter((m) => m.status !== 'scheduled')
    .reduce((sum, m) => sum + (Number(m.homeScore) || 0) + (Number(m.awayScore) || 0), 0)
  if (today.length === 0) return []
  return [
    { label: 'Partidos hoy', value: today.length },
    { label: 'En vivo', value: live },
    { label: 'Goles del día', value: goals },
  ]
}

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

// ------------------------------------------------------------ composición

export interface ComposeInput<S extends FeedStory> {
  /** Historias para tarjetas (ya sin las del Escenario), en orden. */
  stories: S[]
  /** Todas las historias del home en orden -- fuente de resúmenes/citas/temas. */
  sources: S[]
  matches: Match[]
  now: Date
  standingsLeague?: string | null
  /** Segunda tabla para rellenar cuando hay pocas historias. */
  secondaryLeague?: string | null
  /** Encuestas/debates abiertos (ya ordenados) que van dentro del feed. */
  polls?: { id: string }[]
  /** Tarjeta de herramienta "Compara jugadores". */
  playersTool?: boolean
  adEvery?: number
}

export function storySize(index: number): StorySize {
  if (index === 0) return 'lead'
  if (index % 7 === 4) return 'wide'
  if (index % 7 === 0) return 'lead'
  return 'standard'
}

export function composeFeed<S extends FeedStory>(input: ComposeInput<S>): FeedBlock<S>[] {
  const { stories, sources, matches, now } = input
  const adEvery = Math.max(4, input.adEvery ?? 10)

  const aux: FeedBlock<S>[] = []
  const picked = featuredMatches(matches, now, 3)
  // Con pocas historias se suman más partidos reales del día (próximos) para que el Pulso no quede vacío.
  const thin = stories.length < 6
  const extraMatches = thin
    ? matches
      .filter((m) => m.status === 'scheduled' && !picked.some((p) => p.id === m.id) && m.date && Date.parse(m.date) >= now.getTime())
      .sort((a, b) => Date.parse(a.date as string) - Date.parse(b.date as string))
      .slice(0, 3)
    : []
  const polls = input.polls ?? []
  const briefs = sources
    .map((story) => ({ story, points: briefPoints(story) }))
    .filter((b) => b.points.length >= 2)
  const quotes = sources
    .map((story) => ({ story, quote: extractQuote(story.content) }))
    .filter((q): q is { story: S; quote: string } => Boolean(q.quote))
  const video = sources
    .map((story) => ({ story, embedUrl: extractVideoEmbed(story.content) }))
    .find((v): v is { story: S; embedUrl: string } => Boolean(v.embedUrl))
  const stats = matchDayStats(matches, now)
  const topics = trendingTopics(sources)

  if (picked[0]) aux.push({ type: 'match', key: `match-${picked[0].id}`, match: picked[0] })
  if (briefs[0]) aux.push({ type: 'brief', key: `brief-${briefs[0].story.id}`, ...briefs[0] })
  if (input.standingsLeague) aux.push({ type: 'standings', key: `standings-${input.standingsLeague}`, league: input.standingsLeague })
  if (polls[0]) aux.push({ type: 'poll', key: `poll-${polls[0].id}`, pollId: polls[0].id })
  if (quotes[0]) aux.push({ type: 'quote', key: `quote-${quotes[0].story.id}`, ...quotes[0] })
  if (stats.length > 0) aux.push({ type: 'stat', key: 'stat-day', stats })
  if (picked[1]) aux.push({ type: 'match', key: `match-${picked[1].id}`, match: picked[1] })
  if (input.playersTool) aux.push({ type: 'players', key: 'players-tool' })
  if (topics.length >= 3) aux.push({ type: 'trending', key: 'trending', topics })
  if (thin && input.secondaryLeague && input.secondaryLeague !== input.standingsLeague) {
    aux.push({ type: 'standings', key: `standings-${input.secondaryLeague}`, league: input.secondaryLeague })
  }
  for (const m of extraMatches.slice(0, 2)) aux.push({ type: 'match', key: `match-${m.id}`, match: m })
  if (polls[1]) aux.push({ type: 'poll', key: `poll-${polls[1].id}`, pollId: polls[1].id })
  if (video) aux.push({ type: 'video', key: `video-${video.story.id}`, ...video })
  if (briefs[1]) aux.push({ type: 'brief', key: `brief-${briefs[1].story.id}`, ...briefs[1] })
  if (quotes[1]) aux.push({ type: 'quote', key: `quote-${quotes[1].story.id}`, ...quotes[1] })
  if (picked[2]) aux.push({ type: 'match', key: `match-${picked[2].id}`, match: picked[2] })
  for (const m of extraMatches.slice(2)) aux.push({ type: 'match', key: `match-${m.id}`, match: m })
  for (const p of polls.slice(2, 4)) aux.push({ type: 'poll', key: `poll-${p.id}`, pollId: p.id })

  const woven: FeedBlock<S>[] = []
  stories.forEach((story, index) => {
    woven.push({ type: 'story', key: `story-${story.id}`, story, size: storySize(index) })
    // Ritmo: un bloque de datos cada historia al principio, luego cada dos.
    if (aux.length > 0 && (index < 4 || index % 2 === 1)) woven.push(aux.shift()!)
  })
  woven.push(...aux)

  // Publicidad nativa: después del 5.º bloque y luego cada `adEvery`.
  const out: FeedBlock<S>[] = []
  let adCount = 0
  woven.forEach((block, index) => {
    out.push(block)
    const position = index + 1
    if (position === 5 || (position > 5 && (position - 5) % adEvery === 0)) {
      out.push({ type: 'ad', key: `ad-${adCount++}` })
    }
  })
  if (adCount === 0 && woven.length >= 3) out.push({ type: 'ad', key: 'ad-0' })
  return out
}

// ----------------------------------------------------------------- "Ahora"

export type NowItem<S extends FeedStory = FeedStory> =
  | { kind: 'story'; key: string; at: number; story: S }
  | { kind: 'live' | 'final' | 'kickoff'; key: string; at: number; match: Match }

/**
 * Riel "Ahora": en vivo arriba, luego lo último que pasó (publicaciones +
 * finales) por recencia, y al cierre los partidos que arrancan en las
 * próximas `aheadHours` horas, ordenados por hora de inicio.
 */
export function buildNowItems<S extends FeedStory>(stories: S[], matches: Match[], now: Date, max = 12, aheadHours = 12): NowItem<S>[] {
  const nowMs = now.getTime()
  const live: NowItem<S>[] = matches
    .filter((m) => m.status === 'live')
    .map((match) => ({ kind: 'live', key: `live-${match.id}`, at: nowMs, match }))
  const past: NowItem<S>[] = []
  for (const story of stories) {
    const at = Date.parse(story.published_at)
    if (Number.isFinite(at)) past.push({ kind: 'story', key: `s-${story.id}`, at, story })
  }
  for (const match of matches) {
    const at = match.date ? Date.parse(match.date) : NaN
    if (match.status === 'finished' && Number.isFinite(at) && nowMs - at < 36 * 3600_000) {
      past.push({ kind: 'final', key: `f-${match.id}`, at, match })
    }
  }
  past.sort((a, b) => b.at - a.at)
  const ahead: NowItem<S>[] = matches
    .filter((m) => m.status === 'scheduled' && m.date)
    .map((match) => ({ kind: 'kickoff' as const, key: `k-${match.id}`, at: Date.parse(match.date as string), match }))
    .filter((i) => Number.isFinite(i.at) && i.at >= nowMs && i.at - nowMs <= aheadHours * 3600_000)
    .sort((a, b) => a.at - b.at)

  const upcomingSlots = Math.min(ahead.length, 3)
  const head = [...live, ...past].slice(0, Math.max(0, max - upcomingSlots))
  return [...head, ...ahead.slice(0, max - head.length)]
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
