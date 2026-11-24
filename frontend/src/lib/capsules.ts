// Cápsulas (efemérides, "¿Sabías que…?", leyendas, momentos históricos):
//   GET /api/capsules/feed?limit=12 -> { capsules: Capsule[] }

export type CapsuleKind = 'efemeride' | 'sabias_que' | 'leyenda' | 'momento'
export interface CapsuleSlide { text: string; image: string | null }
export interface Capsule {
  id: string
  kind: CapsuleKind
  title: string
  subject: string | null
  year: number | null
  date: string | null // "MM-DD"
  slides: CapsuleSlide[]
  tags: string[]
  createdAt: string
}

const KINDS: readonly CapsuleKind[] = ['efemeride', 'sabias_que', 'leyenda', 'momento']

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}
function str(v: unknown, max = 600): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t ? t.slice(0, max) : null
}
function httpUrl(v: unknown): string | null {
  const s = str(v, 1000)
  if (!s) return null
  try {
    const u = new URL(s)
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null
  } catch {
    return null
  }
}

export function normalizeCapsule(raw: unknown): Capsule | null {
  if (!isRecord(raw)) return null
  const id = str(raw.id, 128)
  const title = str(raw.title, 300)
  const kind = KINDS.includes(raw.kind as CapsuleKind) ? (raw.kind as CapsuleKind) : null
  if (!id || !title || !kind || !Array.isArray(raw.slides)) return null
  const slides = raw.slides.filter(isRecord).map((s) => ({ text: str(s.text, 600) ?? '', image: httpUrl(s.image) })).filter((s) => s.text).slice(0, 8)
  if (slides.length === 0) return null
  const year = typeof raw.year === 'number' && Number.isInteger(raw.year) && raw.year > 1800 && raw.year < 2200 ? raw.year : null
  const date = typeof raw.date === 'string' && /^\d{2}-\d{2}$/.test(raw.date) ? raw.date : null
  return {
    id, kind, title, slides, year, date,
    subject: str(raw.subject, 200),
    tags: Array.isArray(raw.tags) ? raw.tags.map((t) => str(t, 60)).filter((t): t is string => Boolean(t)).slice(0, 10) : [],
    createdAt: str(raw.createdAt, 64) ?? '',
  }
}

export function normalizeCapsules(raw: unknown): Capsule[] {
  const list = isRecord(raw) && Array.isArray(raw.capsules) ? raw.capsules : Array.isArray(raw) ? raw : []
  const seen = new Set<string>()
  const out: Capsule[] = []
  for (const c of list) {
    const cap = normalizeCapsule(c)
    if (cap && !seen.has(cap.id)) { seen.add(cap.id); out.push(cap) }
  }
  return out
}

/** Efemérides de HOY primero. */
export function sortCapsules(caps: Capsule[], now: Date): Capsule[] {
  const today = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  return caps.map((c, i) => ({ c, i, rank: c.kind === 'efemeride' && c.date === today ? 0 : 1 }))
    .sort((a, b) => a.rank - b.rank || a.i - b.i).map(({ c }) => c)
}

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

export function capsuleDateLabel(c: Pick<Capsule, 'date' | 'year'>, now: Date): string | null {
  if (!c.date && !c.year) return null
  if (c.date) {
    const [mm, dd] = c.date.split('-').map(Number)
    if (mm === now.getMonth() + 1 && dd === now.getDate()) return c.year ? `Un día como hoy · ${c.year}` : 'Un día como hoy'
    const base = `${dd} de ${MONTHS[mm - 1] ?? ''}`.trim()
    return c.year ? `${base} de ${c.year}` : base
  }
  return String(c.year)
}

export const CAPSULE_LABEL: Record<CapsuleKind, string> = {
  efemeride: 'Efeméride',
  sabias_que: '¿Sabías que…?',
  leyenda: 'Leyendas',
  momento: 'Momento histórico',
}

/** Colores de cada tipo (mismo criterio que /og/capsule). */
export const CAPSULE_ACCENT: Record<CapsuleKind, string> = {
  efemeride: '#FACC15',
  sabias_que: '#38BDF8',
  leyenda: '#D4AF37',
  momento: '#F97316',
}

/** URL de la imagen 9:16 que genera el backend para una diapositiva. */
export function capsuleOgUrl(c: Capsule, slide: number): string {
  const q = new URLSearchParams({ kind: c.kind, title: c.title, i: String(slide), n: String(c.slides.length) })
  if (c.subject) q.set('subject', c.subject)
  if (c.year) q.set('year', String(c.year))
  if (c.date) q.set('day', c.date)
  const s = c.slides[slide - 1]
  if (s?.text) q.set('text', s.text)
  if (s?.image) q.set('image', s.image)
  return `/og/capsule?${q.toString()}`
}
