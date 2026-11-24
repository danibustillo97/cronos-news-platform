'use client'

// Reaccionar y comentar (fila de acciones de cada tarjeta y del artículo).
// - Reacción: tocar = 🔥 (otra vez la quita); mantener presionado o pasar
//   el cursor abre 🔥 ⚽ 😮 👏 😂 😢. Optimista, con reversión si falla.
// - Comentarios: hoja inferior en teléfono / panel lateral en desktop,
//   con lista y caja para escribir (nombre recordado, 500 caracteres).
// Sin migración en el backend (503): botones deshabilitados con aviso.

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronUp, Loader2, MessageCircle, Send, X } from 'lucide-react'
import { COMMENT_MAX, REACTIONS, compactCount, type Reaction, type SocialType } from '@/lib/social'
import { timeAgo } from '@/lib/feedComposer'
import { useSocial, readAuthor, type CommentResult } from '@/lib/useSocial'
import { usePortalTheme } from '@/context/ThemeContext'

const UNAVAILABLE = 'Las reacciones y comentarios estarán disponibles muy pronto'
const emojiOf = (r: Reaction | null) => REACTIONS.find((x) => x.id === r)?.emoji ?? '🔥'

const actionBtn = 'inline-flex h-11 items-center gap-1.5 rounded-full px-2.5 text-[13px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 sm:px-3'

function useIsDesktop() {
  const [d, setD] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const on = () => setD(mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return d
}

function CommentsPanel({
  title, open, onClose, social, forceTheme,
}: {
  title: string
  open: boolean
  onClose: () => void
  social: ReturnType<typeof useSocial>
  forceTheme?: 'light' | 'dark'
}) {
  const { theme } = usePortalTheme()
  const desktop = useIsDesktop()
  const [author, setAuthor] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<CommentResult | null>(null)
  const [drag, setDrag] = useState(0)
  const startY = useRef<number | null>(null)
  const textRef = useRef<HTMLTextAreaElement>(null)
  const { summary, status } = social

  useEffect(() => { if (open) { setAuthor((a) => a || readAuthor()); void social.load() } }, [open]) // eslint-disable-line react-hooks/exhaustive-deps -- recargar al abrir
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    const t = window.setTimeout(() => textRef.current?.focus(), 60)
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); window.clearTimeout(t) }
  }, [open, onClose])

  if (!open) return null
  const disabled = status === 'unavailable'
  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    if (sending || disabled) return
    setSending(true)
    const r = await social.comment(author, body)
    setResult(r)
    if (r.ok) setBody('')
    setSending(false)
  }

  const panel = (
    <div className="nx-portal fixed inset-0 z-[90]" data-theme={forceTheme ?? theme} style={{ background: 'transparent' }} role="dialog" aria-modal="true" aria-label={`Comentarios: ${title}`}>
      <button type="button" aria-label="Cerrar comentarios" className="absolute inset-0 bg-black/55" onClick={onClose} />
      <div
        className={desktop
          ? 'absolute inset-y-0 right-0 flex w-[420px] max-w-full flex-col border-l border-[var(--nx-line)] bg-[var(--nx-bg)] shadow-2xl'
          : 'absolute inset-x-0 bottom-0 flex max-h-[85svh] flex-col rounded-t-[22px] border-t border-[var(--nx-line)] bg-[var(--nx-bg)] shadow-2xl'}
        style={!desktop && drag > 0 ? { transform: `translateY(${drag}px)` } : undefined}
      >
        {!desktop && (
          <div
            className="flex h-6 shrink-0 cursor-grab touch-none items-center justify-center"
            onPointerDown={(e) => { startY.current = e.clientY; (e.target as HTMLElement).setPointerCapture(e.pointerId) }}
            onPointerMove={(e) => { if (startY.current !== null) setDrag(Math.max(0, e.clientY - startY.current)) }}
            onPointerUp={() => { if (drag > 90) onClose(); setDrag(0); startY.current = null }}
            aria-hidden="true"
          >
            <span className="h-1.5 w-10 rounded-full bg-[var(--nx-line-strong)]" />
          </div>
        )}
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--nx-line)] px-4 py-2.5">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-[var(--nx-ink)]">Comentarios{summary ? ` · ${compactCount(summary.commentCount)}` : ''}</h2>
            <p className="truncate text-xs text-[var(--nx-muted)]">{title}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--nx-muted)] hover:bg-[var(--nx-surface-2)]"><X size={18} /></button>
        </header>

        <div className="min-h-[140px] flex-1 overflow-y-auto px-4 py-3" aria-live="polite">
          {status === 'loading' && !summary ? (
            <p className="flex items-center gap-2 py-6 text-sm text-[var(--nx-muted)]"><Loader2 size={15} className="animate-spin" aria-hidden="true" /> Cargando comentarios…</p>
          ) : disabled ? (
            <p className="py-6 text-center text-sm text-[var(--nx-muted)]">{UNAVAILABLE}.</p>
          ) : summary && summary.comments.length > 0 ? (
            <ul className="flex flex-col gap-4">
              {summary.comments.map((c) => (
                <li key={c.id} className="flex gap-3">
                  <span aria-hidden className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--nx-surface-2)] text-xs font-bold text-[var(--nx-ink-2)]">{c.author.slice(0, 1).toUpperCase()}</span>
                  <div className="min-w-0">
                    <p className="text-[13px]"><span className="font-semibold text-[var(--nx-ink)]">{c.author}</span>{c.createdAt && <time dateTime={c.createdAt} className="ml-2 text-xs text-[var(--nx-muted)]">{timeAgo(c.createdAt)}</time>}</p>
                    <p className="mt-0.5 whitespace-pre-line break-words text-[14px] leading-relaxed text-[var(--nx-ink-2)]">{c.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-6 text-center text-sm text-[var(--nx-muted)]">Todavía no hay comentarios. ¡Escribe el primero!</p>
          )}
        </div>

        <form onSubmit={send} className="shrink-0 border-t border-[var(--nx-line)] px-4 pb-[calc(env(safe-area-inset-bottom,0px)+12px)] pt-3">
          {result && (
            <p role="status" className={`mb-2 text-xs font-semibold ${result.ok ? 'text-[var(--nx-accent-text)]' : 'text-[#DC2626]'}`}>
              {result.ok ? result.message : result.error}
            </p>
          )}
          <label className="sr-only" htmlFor="nx-comment-author">Tu nombre</label>
          <input
            id="nx-comment-author"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="Tu nombre"
            maxLength={40}
            autoComplete="nickname"
            disabled={disabled}
            className="mb-2 h-10 w-full rounded-xl border border-[var(--nx-line-strong)] bg-[var(--nx-surface)] px-3 text-sm text-[var(--nx-ink)] placeholder:text-[var(--nx-muted)] focus:border-[#FACC15] focus:outline-none disabled:opacity-50"
          />
          <div className="flex items-end gap-2">
            <label className="sr-only" htmlFor="nx-comment-body">Comentario</label>
            <textarea
              id="nx-comment-body"
              ref={textRef}
              value={body}
              onChange={(e) => setBody(e.target.value.slice(0, COMMENT_MAX))}
              placeholder={disabled ? UNAVAILABLE : 'Escribe un comentario respetuoso…'}
              rows={2}
              disabled={disabled}
              className="min-h-[44px] flex-1 resize-none rounded-xl border border-[var(--nx-line-strong)] bg-[var(--nx-surface)] px-3 py-2.5 text-sm text-[var(--nx-ink)] placeholder:text-[var(--nx-muted)] focus:border-[#FACC15] focus:outline-none disabled:opacity-50"
            />
            <button type="submit" disabled={disabled || sending || body.trim().length < 2} aria-label="Publicar comentario" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#FACC15] text-black disabled:opacity-40">
              {sending ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
            </button>
          </div>
          <p className="mt-1 text-right text-[11px] tabular-nums text-[var(--nx-muted)]">{body.length}/{COMMENT_MAX}</p>
        </form>
      </div>
    </div>
  )
  return createPortal(panel, document.body)
}

export default function SocialActions({ type, id, title, forceTheme }: { type: SocialType; id: string; title: string; forceTheme?: 'light' | 'dark' }) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const social = useSocial(type, id, visible)
  const { summary, status, react } = social
  const [picker, setPicker] = useState(false)
  const [panel, setPanel] = useState(false)
  const pressTimer = useRef<number | null>(null)
  const hoverTimer = useRef<number | null>(null)
  const longPressed = useRef(false)

  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); io.disconnect() } }, { rootMargin: '300px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    if (!picker) return
    const onDown = (e: PointerEvent) => { if (!rootRef.current?.contains(e.target as Node)) setPicker(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPicker(false) }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey) }
  }, [picker])

  const ready = status === 'ready' && summary !== null
  const disabled = status === 'unavailable'
  const closePanel = useCallback(() => setPanel(false), [])
  const clear = (t: React.MutableRefObject<number | null>) => { if (t.current) window.clearTimeout(t.current); t.current = null }

  const choose = (r: Reaction) => { setPicker(false); void react(r) }
  const mine = summary?.mine ?? null

  return (
    <div ref={rootRef} className="relative flex items-center">
      <div
        className="relative"
        onMouseEnter={() => { if (!ready) return; clear(hoverTimer); hoverTimer.current = window.setTimeout(() => setPicker(true), 450) }}
        onMouseLeave={() => { clear(hoverTimer) }}
      >
        <button
          type="button"
          disabled={!ready}
          title={disabled ? UNAVAILABLE : 'Toca para 🔥 · mantén presionado para más reacciones'}
          aria-label={mine ? `Tu reacción: ${REACTIONS.find((r) => r.id === mine)?.label}. Tocar para quitarla` : 'Reaccionar con fuego'}
          aria-pressed={Boolean(mine)}
          onPointerDown={(e) => {
            if (!ready || e.pointerType === 'mouse') return
            longPressed.current = false
            clear(pressTimer)
            pressTimer.current = window.setTimeout(() => { longPressed.current = true; setPicker(true) }, 420)
          }}
          onPointerUp={() => clear(pressTimer)}
          onPointerLeave={() => clear(pressTimer)}
          onContextMenu={(e) => e.preventDefault()}
          onClick={() => {
            if (longPressed.current) { longPressed.current = false; return }
            void react(mine ? null : 'fire')
          }}
          className={`${actionBtn} select-none ${mine ? 'text-[var(--nx-accent-text)]' : 'text-[var(--nx-muted)] hover:bg-[var(--nx-surface-2)] hover:text-[var(--nx-ink)]'}`}
        >
          <span className={`text-[17px] leading-none ${mine ? '' : 'opacity-70 grayscale'}`} aria-hidden="true">{emojiOf(mine)}</span>
          {ready && summary.total > 0 && <span className="tabular-nums">{compactCount(summary.total)}</span>}
        </button>
        {ready && (
          <button type="button" onClick={() => setPicker((p) => !p)} aria-label="Más reacciones" aria-expanded={picker} aria-haspopup="true" className="sr-only focus:not-sr-only focus:absolute focus:-top-2 focus:left-full focus:inline-flex focus:h-6 focus:w-6 focus:items-center focus:justify-center focus:rounded-full focus:bg-[var(--nx-surface-2)]">
            <ChevronUp size={12} aria-hidden="true" />
          </button>
        )}
        {picker && ready && (
          <div role="menu" aria-label="Elige una reacción" className="absolute bottom-full left-0 z-30 mb-2 flex gap-0.5 rounded-full border border-[var(--nx-line)] bg-[var(--nx-surface)] p-1 shadow-2xl" onMouseLeave={() => setPicker(false)}>
            {REACTIONS.map((r) => (
              <button
                key={r.id}
                type="button"
                role="menuitemradio"
                aria-checked={mine === r.id}
                aria-label={r.label}
                title={r.label}
                onClick={() => choose(r.id)}
                className={`inline-flex h-11 w-11 items-center justify-center rounded-full text-[22px] transition-transform hover:scale-125 ${mine === r.id ? 'bg-[var(--nx-surface-2)]' : ''}`}
              >
                <span aria-hidden="true">{r.emoji}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <button
        type="button"
        disabled={disabled}
        title={disabled ? UNAVAILABLE : 'Ver y escribir comentarios'}
        onClick={() => setPanel(true)}
        aria-label={`Comentarios${ready ? ` (${summary.commentCount})` : ''}: ${title}`}
        className={`${actionBtn} text-[var(--nx-muted)] hover:bg-[var(--nx-surface-2)] hover:text-[var(--nx-ink)]`}
      >
        <MessageCircle size={16} aria-hidden="true" />
        {ready && summary.commentCount > 0 ? <span className="tabular-nums">{compactCount(summary.commentCount)}</span> : <span className="hidden sm:inline">Comentar</span>}
      </button>
      <CommentsPanel title={title} open={panel} onClose={closePanel} social={social} forceTheme={forceTheme} />
    </div>
  )
}
