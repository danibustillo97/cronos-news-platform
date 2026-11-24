// Encuestas y debates -- lógica pura (validación del payload, porcentajes,
// estado de voto local). El fetch vive en lib/usePolls.ts.
//
// Contrato (backend):
//   GET  /api/polls?placement=home -> { polls: Poll[] }
//   GET  /api/polls/{id}            -> Poll
//   POST /api/polls/{id}/vote {optionId, voterId} -> Poll | 409 {detail, poll}

export interface PollOption {
  id: string
  label: string
  argument: string | null
  votes: number
}

export interface Poll {
  id: string
  kind: 'poll' | 'debate'
  question: string
  context: string | null
  options: PollOption[]
  totalVotes: number
  status: 'open' | 'closed'
  closesAt: string | null
  newsId: string | null
  featured: boolean
  createdAt: string
  /** Dónde se muestra. Vacío = sin restricción (compatibilidad). */
  placement: PollPlacement[]
}

export type PollPlacement = 'home' | 'pulse' | 'article'
const PLACEMENTS: readonly PollPlacement[] = ['home', 'pulse', 'article']

export const VOTER_KEY = 'nexus.voter'
export const VOTED_KEY = 'nexus.voted'

type KV = Pick<Storage, 'getItem' | 'setItem'>

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function str(v: unknown, max = 600): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t ? t.slice(0, max) : null
}

function count(v: unknown): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
}

export function normalizePoll(raw: unknown): Poll | null {
  if (!isRecord(raw) || raw.status === 'draft') return null
  const id = str(raw.id, 128)
  const question = str(raw.question, 400)
  if (!id || !question || !Array.isArray(raw.options)) return null
  const seen = new Set<string>()
  const options: PollOption[] = []
  for (const o of raw.options) {
    if (!isRecord(o)) continue
    const oid = str(o.id, 128)
    const label = str(o.label, 200)
    if (!oid || !label || seen.has(oid)) continue
    seen.add(oid)
    options.push({ id: oid, label, argument: str(o.argument, 600), votes: count(o.votes) })
  }
  if (options.length < 2) return null
  const summed = options.reduce((s, o) => s + o.votes, 0)
  const kind = raw.kind === 'debate' && options.length === 2 ? 'debate' : 'poll'
  return {
    id,
    kind,
    question,
    context: str(raw.context),
    options,
    totalVotes: Math.max(count(raw.totalVotes), summed),
    status: raw.status === 'closed' ? 'closed' : 'open',
    closesAt: str(raw.closesAt, 64),
    newsId: str(raw.newsId, 128),
    featured: raw.featured === true,
    createdAt: str(raw.createdAt, 64) ?? '',
    placement: Array.isArray(raw.placement)
      ? [...new Set(raw.placement.filter((p): p is PollPlacement => PLACEMENTS.includes(p as PollPlacement)))]
      : [],
  }
}

/** Acepta `{ polls: [...] }` o un array directo; descarta lo malformado. */
export function normalizePolls(raw: unknown): Poll[] {
  const list = isRecord(raw) && Array.isArray(raw.polls) ? raw.polls : Array.isArray(raw) ? raw : []
  return list.map(normalizePoll).filter((p): p is Poll => p !== null)
}

/** Porcentajes enteros que suman exactamente 100 (método del mayor resto). */
export function percentages(options: Pick<PollOption, 'votes'>[]): number[] {
  const total = options.reduce((s, o) => s + o.votes, 0)
  if (total === 0) return options.map(() => 0)
  const raw = options.map((o) => (o.votes / total) * 100)
  const floors = raw.map(Math.floor)
  let rest = 100 - floors.reduce((s, v) => s + v, 0)
  const order = raw.map((v, i) => ({ i, frac: v - floors[i] })).sort((a, b) => b.frac - a.frac || a.i - b.i)
  for (const { i } of order) {
    if (rest <= 0) break
    floors[i] += 1
    rest -= 1
  }
  return floors
}

/** Id de la opción ganadora, o null si hay empate en el primer lugar o no hay votos. */
export function leaderId(poll: Pick<Poll, 'options'>): string | null {
  const sorted = [...poll.options].sort((a, b) => b.votes - a.votes)
  if (!sorted[0] || sorted[0].votes === 0) return null
  if (sorted[1] && sorted[1].votes === sorted[0].votes) return null
  return sorted[0].id
}

export function isClosed(poll: Pick<Poll, 'status' | 'closesAt'>, now: Date): boolean {
  if (poll.status === 'closed') return true
  if (!poll.closesAt) return false
  const t = Date.parse(poll.closesAt)
  return Number.isFinite(t) && t <= now.getTime()
}

export function closesLabel(poll: Pick<Poll, 'status' | 'closesAt'>, now: Date): string {
  if (isClosed(poll, now)) return 'Votación cerrada'
  if (!poll.closesAt) return 'Votación abierta'
  const t = Date.parse(poll.closesAt)
  if (!Number.isFinite(t)) return 'Votación abierta'
  const min = Math.round((t - now.getTime()) / 60_000)
  if (min < 60) return `Cierra en ${Math.max(1, min)} min`
  const h = Math.round(min / 60)
  if (h < 48) return `Cierra en ${h} h`
  return `Cierra en ${Math.round(h / 24)} días`
}

export function formatVotes(n: number): string {
  return `${new Intl.NumberFormat('es-CO').format(n)} ${n === 1 ? 'voto' : 'votos'}`
}

/** Voto optimista: suma 1 a la opción elegida (el servidor confirma después). */
export function applyLocalVote(poll: Poll, optionId: string): Poll {
  if (!poll.options.some((o) => o.id === optionId)) return poll
  return {
    ...poll,
    totalVotes: poll.totalVotes + 1,
    options: poll.options.map((o) => (o.id === optionId ? { ...o, votes: o.votes + 1 } : o)),
  }
}

// ----------------------------------------------------------- almacenamiento

export function readVoted(storage: KV | null): Record<string, string> {
  if (!storage) return {}
  try {
    const parsed: unknown = JSON.parse(storage.getItem(VOTED_KEY) ?? '{}')
    if (!isRecord(parsed)) return {}
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(parsed)) if (typeof v === 'string') out[k] = v
    return out
  } catch {
    return {}
  }
}

export function markVoted(storage: KV | null, pollId: string, optionId: string): Record<string, string> {
  const next = { ...readVoted(storage), [pollId]: optionId }
  try { storage?.setItem(VOTED_KEY, JSON.stringify(next)) } catch { /* almacenamiento bloqueado */ }
  return next
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function getVoterId(storage: KV | null, generate: () => string): string {
  try {
    const existing = storage?.getItem(VOTER_KEY)
    if (existing && UUID.test(existing)) return existing
  } catch { /* sin acceso */ }
  const id = generate()
  try { storage?.setItem(VOTER_KEY, id) } catch { /* sin acceso */ }
  return id
}

export function randomUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

/** ¿Se puede mostrar en ese lugar? Sin `placement` explícito, se permite. */
export function inPlacement(poll: Pick<Poll, 'placement'>, where: PollPlacement): boolean {
  return poll.placement.length === 0 || poll.placement.includes(where)
}

/** Destacada primero (abierta), luego abiertas por fecha, cerradas al final. */
export function sortPolls(polls: Poll[], now: Date): Poll[] {
  return [...polls].sort((a, b) => {
    const ca = isClosed(a, now) ? 1 : 0
    const cb = isClosed(b, now) ? 1 : 0
    if (ca !== cb) return ca - cb
    if (a.featured !== b.featured) return a.featured ? -1 : 1
    return (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0)
  })
}
