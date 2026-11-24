// Reacciones y comentarios -- lógica pura. Contrato (backend):
//   GET  /api/social/{type}/{id}?voterId=V -> SocialSummary
//   POST /api/social/{type}/{id}/react {voterId, reaction|null}
//   POST /api/social/{type}/{id}/comments {voterId, author, body}
//        -> 201 {id, author, body, createdAt, status, message} | 429 {detail}

export type SocialType = 'news' | 'capsule' | 'poll' | 'picks'
export type Reaction = 'fire' | 'goal' | 'wow' | 'clap' | 'laugh' | 'sad'

export const REACTIONS: { id: Reaction; emoji: string; label: string }[] = [
  { id: 'fire', emoji: '🔥', label: 'Fuego' },
  { id: 'goal', emoji: '⚽', label: 'Golazo' },
  { id: 'wow', emoji: '😮', label: 'Asombro' },
  { id: 'clap', emoji: '👏', label: 'Aplausos' },
  { id: 'laugh', emoji: '😂', label: 'Risa' },
  { id: 'sad', emoji: '😢', label: 'Tristeza' },
]

const IDS = REACTIONS.map((r) => r.id)

export interface SocialComment { id: string; author: string; body: string; createdAt: string }

export interface SocialSummary {
  counts: Record<Reaction, number>
  total: number
  mine: Reaction | null
  comments: SocialComment[]
  commentCount: number
}

export const COMMENT_MAX = 500
export const AUTHOR_MAX = 40
export const AUTHOR_KEY = 'nexus.author'

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}
const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0)
const s = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

export function emptySummary(): SocialSummary {
  return { counts: { fire: 0, goal: 0, wow: 0, clap: 0, laugh: 0, sad: 0 }, total: 0, mine: null, comments: [], commentCount: 0 }
}

export function normalizeSummary(raw: unknown): SocialSummary | null {
  if (!isRecord(raw)) return null
  const out = emptySummary()
  const counts = isRecord(raw.counts) ? raw.counts : {}
  for (const id of IDS) out.counts[id] = n(counts[id])
  const summed = IDS.reduce((acc, id) => acc + out.counts[id], 0)
  out.total = Math.max(n(raw.total), summed)
  out.mine = IDS.includes(raw.mine as Reaction) ? (raw.mine as Reaction) : null
  out.comments = Array.isArray(raw.comments)
    ? raw.comments.filter(isRecord).map((c) => ({ id: s(c.id, 64), author: s(c.author, AUTHOR_MAX) || 'Anónimo', body: s(c.body, COMMENT_MAX), createdAt: s(c.createdAt, 64) }))
      .filter((c) => c.id && c.body)
    : []
  out.commentCount = Math.max(n(raw.commentCount), out.comments.length)
  return out
}

/** Reacción optimista: una por persona; tocar la misma la quita; cambiar mueve el conteo. */
export function applyReaction(prev: SocialSummary, next: Reaction | null): SocialSummary {
  const counts = { ...prev.counts }
  let total = prev.total
  if (prev.mine) { counts[prev.mine] = Math.max(0, counts[prev.mine] - 1); total = Math.max(0, total - 1) }
  const target = next === prev.mine ? null : next
  if (target) { counts[target] += 1; total += 1 }
  return { ...prev, counts, total, mine: target }
}

/** Las reacciones más usadas, para mostrar junto al conteo. */
export function topReactions(summary: SocialSummary, max = 3): string[] {
  return REACTIONS.filter((r) => summary.counts[r.id] > 0)
    .sort((a, b) => summary.counts[b.id] - summary.counts[a.id])
    .slice(0, max)
    .map((r) => r.emoji)
}

export type CommentCheck = { ok: true; author: string; body: string } | { ok: false; error: string }

export function validateComment(author: string, body: string): CommentCheck {
  const a = author.replace(/\s+/g, ' ').trim()
  const b = body.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
  if (a.length < 2) return { ok: false, error: 'Escribe tu nombre (mínimo 2 letras).' }
  if (a.length > AUTHOR_MAX) return { ok: false, error: `El nombre admite hasta ${AUTHOR_MAX} caracteres.` }
  if (b.length < 2) return { ok: false, error: 'Escribe tu comentario.' }
  if (b.length > COMMENT_MAX) return { ok: false, error: `El comentario admite hasta ${COMMENT_MAX} caracteres.` }
  return { ok: true, author: a, body: b }
}

/** "1,2 mil" para conteos grandes. */
export function compactCount(v: number): string {
  if (v < 1000) return String(v)
  const fmt = (x: number) => (Math.round(x * 10) / 10).toString().replace('.', ',')
  return v < 1_000_000 ? `${fmt(v / 1000)} mil` : `${fmt(v / 1_000_000)} M`
}

/** Respuestas rápidas (se publican con un toque). */
export const QUICK_REPLIES: { emoji: string; text: string }[] = [
  { emoji: '⚽', text: 'Golazo' },
  { emoji: '🔥', text: 'Qué partido' },
  { emoji: '👏', text: 'Crack' },
]

/** Nombre por defecto para no pedir datos de entrada: "Hincha 482". */
export function defaultAuthor(random: () => number = Math.random): string {
  return `Hincha ${100 + Math.floor(random() * 900)}`
}

/** Texto final de una respuesta rápida. */
export function quickReplyText(r: { emoji: string; text: string }): string {
  return `${r.emoji} ${r.text}`
}
