'use client'

// Estado social de UN elemento (noticia, cápsula, encuesta, parley).
// Carga perezosa (cuando la tarjeta se ve), reacción optimista con
// reversión, y envío de comentarios con los estados del backend
// (pendiente de revisión, 429 por enfriamiento, 503 sin migración).

import { useCallback, useEffect, useRef, useState } from 'react'
import { applyReaction, AUTHOR_KEY, defaultAuthor, normalizeSummary, validateComment, type Reaction, type SocialComment, type SocialSummary, type SocialType } from '@/lib/social'
import { getVoterId, randomUuid } from '@/lib/polls'
import { safeStorage } from '@/lib/players'

export type SocialStatus = 'idle' | 'loading' | 'ready' | 'unavailable'
export type CommentResult = { ok: true; pending: boolean; message: string; comment: SocialComment | null } | { ok: false; error: string }

const base = (type: SocialType, id: string) => `/api/social/${type}/${encodeURIComponent(id)}`

export function readAuthor(): string {
  try { return safeStorage()?.getItem(AUTHOR_KEY) ?? '' } catch { return '' }
}

/** Nombre guardado o uno por defecto ("Hincha 482"), que queda guardado. */
export function ensureAuthor(): string {
  const saved = readAuthor()
  if (saved) return saved
  const name = defaultAuthor()
  try { safeStorage()?.setItem(AUTHOR_KEY, name) } catch { /* bloqueado */ }
  return name
}

export function saveAuthor(name: string): void {
  try { safeStorage()?.setItem(AUTHOR_KEY, name.trim().slice(0, 40)) } catch { /* bloqueado */ }
}

export function useSocial(type: SocialType, id: string, enabled: boolean) {
  const [summary, setSummary] = useState<SocialSummary | null>(null)
  const [status, setStatus] = useState<SocialStatus>('idle')
  const busy = useRef(false)

  const load = useCallback(async () => {
    setStatus((s) => (s === 'ready' ? s : 'loading'))
    try {
      const voterId = getVoterId(safeStorage(), randomUuid)
      const res = await fetch(`${base(type, id)}?voterId=${encodeURIComponent(voterId)}`, { cache: 'no-store' })
      if (!res.ok) { setStatus('unavailable'); return }
      const s = normalizeSummary(await res.json())
      if (!s) { setStatus('unavailable'); return }
      setSummary(s)
      setStatus('ready')
    } catch {
      setStatus('unavailable')
    }
  }, [type, id])

  useEffect(() => { if (enabled && status === 'idle') void load() }, [enabled, status, load])

  const react = useCallback(async (reaction: Reaction | null) => {
    if (!summary || status !== 'ready' || busy.current) return
    busy.current = true
    const prev = summary
    const optimistic = applyReaction(prev, reaction)
    setSummary(optimistic)
    try {
      const res = await fetch(`${base(type, id)}/react`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voterId: getVoterId(safeStorage(), randomUuid), reaction: optimistic.mine }),
      })
      if (!res.ok) throw new Error(String(res.status))
      const server = normalizeSummary(await res.json().catch(() => null))
      if (server) setSummary((cur) => ({ ...server, comments: server.comments.length ? server.comments : cur?.comments ?? [] }))
    } catch {
      setSummary(prev)
    } finally {
      busy.current = false
    }
  }, [summary, status, type, id])

  const comment = useCallback(async (author: string, body: string): Promise<CommentResult> => {
    const check = validateComment(author, body)
    if (!check.ok) return check
    try { safeStorage()?.setItem(AUTHOR_KEY, check.author) } catch { /* bloqueado */ }
    try {
      const res = await fetch(`${base(type, id)}/comments`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voterId: getVoterId(safeStorage(), randomUuid), author: check.author, body: check.body }),
      })
      const data = await res.json().catch(() => null) as Record<string, unknown> | null
      if (res.status === 429) return { ok: false, error: typeof data?.detail === 'string' ? data.detail : 'Espera unos segundos antes de volver a comentar.' }
      if (res.status === 503) return { ok: false, error: 'Los comentarios todavía no están disponibles.' }
      if (!res.ok || !data) return { ok: false, error: typeof data?.detail === 'string' ? data.detail : 'No pudimos publicar tu comentario. Intenta de nuevo.' }
      const pending = data.status === 'pending'
      const message = typeof data.message === 'string' && data.message ? data.message : pending ? 'Tu comentario quedó en revisión y aparecerá cuando sea aprobado.' : 'Comentario publicado.'
      const created: SocialComment | null = !pending && typeof data.id === 'string'
        ? { id: data.id, author: String(data.author ?? check.author), body: String(data.body ?? check.body), createdAt: String(data.createdAt ?? new Date().toISOString()) }
        : null
      if (created) setSummary((s) => (s ? { ...s, comments: [created, ...s.comments], commentCount: s.commentCount + 1 } : s))
      return { ok: true, pending, message, comment: created }
    } catch {
      return { ok: false, error: 'Sin conexión. Intenta de nuevo.' }
    }
  }, [type, id])

  return { summary, status, load, react, comment }
}
