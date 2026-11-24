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
import { COMMENT_MAX, QUICK_REPLIES, REACTIONS, compactCount, quickReplyText, type Reaction, type SocialType } from '@/lib/social'
import { timeAgo } from '@/lib/feedComposer'
import { useSocial, ensureAuthor, saveAuthor, type CommentResult } from '@/lib/useSocial'
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
  const [editingName, setEditingName] = useState(false)
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<CommentResult | null>(null)
  const [full, setFull] = useState(false)
  const [drag, setDrag] = useState(0)
  const startY = useRef<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const { summary, status } = social

  useEffect(() => {
    if (!open) return
    setAuthor(ensureAuthor())
    setFull(false)
    setResult(null)
    void social.load()
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps -- recargar al abrir
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey) }
  }, [open, onClose])

  if (!open) return null
  const disabled = status === 'unavailable'

  const post = async (text: string) => {
    if (sending || disabled) return
    setSending(true)
    const r = await social.comment(author || ensureAuthor(), text)
    setResult(r)
    if (r.ok) setBody('')
    setSending(false)
  }
  const onDragEnd = () => {
    if (drag < -60) setFull(true)
    else if (drag > 90) { if (full) setFull(false); else onClose() }
    setDrag(0)
    startY.current = null
  }

  const panel = (
    <div className="nx-portal fixed inset-0 z-[90]" data-theme={forceTheme ?? theme} style={{ background: 'transparent' }} role="dialog" aria-modal="true" aria-label={`Comentarios: ${title}`}>
      <button type="button" aria-label="Cerrar comentarios" className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        className={desktop
          ? 'absolute inset-y-0 right-0 flex w-[400px] max-w-full flex-col border-l border-[var(--nx-line)] bg-[var(--nx-bg)] shadow-2xl'
          : `absolute inset-x-0 bottom-0 flex flex-col rounded-t-[22px] bg-[var(--nx-bg)] shadow-2xl transition-[height] duration-200 ${full ? 'h-[92svh]' : 'h-[55svh]'}`}
        style={!desktop && drag !== 0 ? { transform: drag > 0 ? `translateY(${drag}px)` : undefined, height: drag < 0 ? `calc(${full ? '92svh' : '55svh'} + ${-drag}px)` : undefined, transition: 'none' } : undefined}
      >
        {!desktop && (
          <div
            className="flex h-7 shrink-0 cursor-grab touch-none items-center justify-center"
            onPointerDown={(e) => { startY.current = e.clientY; (e.target as HTMLElement).setPointerCapture(e.pointerId) }}
            onPointerMove={(e) => { if (startY.current !== null) setDrag(Math.max(-320, e.clientY - startY.current)) }}
            onPointerUp={onDragEnd}
            onPointerCancel={onDragEnd}
            onDoubleClick={() => setFull((f) => !f)}
            aria-hidden="true"
          >
            <span className="h-1.5 w-10 rounded-full bg-[var(--nx-line-strong)]" />
          </div>
        )}
        <header className="flex shrink-0 items-center justify-between gap-2 px-4 pb-2">
          <h2 className="text-[15px] font-bold text-[var(--nx-ink)]">{summary && summary.commentCount > 0 ? `${compactCount(summary.commentCount)} comentarios` : 'Comentarios'}</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[var(--nx-muted)] hover:bg-[var(--nx-surface-2)]"><X size={18} /></button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-2" aria-live="polite">
          {status === 'loading' && !summary ? (
            <div className="space-y-2 px-1">{[0, 1, 2].map((i) => <div key={i} className="nx-skeleton h-12 rounded-2xl" />)}</div>
          ) : disabled ? (
            <p className="py-8 text-center text-sm text-[var(--nx-muted)]">{UNAVAILABLE}.</p>
          ) : summary && summary.comments.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {summary.comments.map((c) => (
                <li key={c.id} className="flex items-start gap-2">
                  <span aria-hidden className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--nx-surface-3)] text-[11px] font-bold text-[var(--nx-ink-2)]">{c.author.slice(0, 1).toUpperCase()}</span>
                  <div className="min-w-0">
                    <p className="inline-block max-w-full break-words rounded-2xl rounded-tl-md bg-[var(--nx-surface-2)] px-3 py-1.5 text-[14px] leading-snug text-[var(--nx-ink)]">
                      <span className="mr-1.5 font-bold">{c.author}</span>{c.body}
                    </p>
                    {c.createdAt && <time dateTime={c.createdAt} className="ml-3 block text-[11px] text-[var(--nx-muted)]">{timeAgo(c.createdAt)}</time>}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-8 text-center text-sm text-[var(--nx-muted)]">Sé el primero en comentar.</p>
          )}
        </div>

        <div className="shrink-0 border-t border-[var(--nx-line)] px-3 pb-[calc(env(safe-area-inset-bottom,0px)+10px)] pt-2">
          {result && (
            <p role="status" className={`mb-1.5 px-1 text-xs font-semibold ${result.ok ? 'text-[var(--nx-accent-text)]' : 'text-[#DC2626]'}`}>{result.ok ? result.message : result.error}</p>
          )}
          <div className="nx-snap-x mb-2 flex gap-1.5 overflow-x-auto">
            {QUICK_REPLIES.map((q) => (
              <button key={q.text} type="button" disabled={disabled || sending} onClick={() => post(quickReplyText(q))} className="inline-flex h-9 shrink-0 items-center gap-1 rounded-full border border-[var(--nx-line)] px-3 text-[13px] font-semibold text-[var(--nx-ink)] transition-transform active:scale-95 disabled:opacity-40">
                <span aria-hidden="true">{q.emoji}</span>{q.text}
              </button>
            ))}
          </div>
          {editingName ? (
            <form className="mb-2 flex items-center gap-2 px-1" onSubmit={(e) => { e.preventDefault(); const n = author.trim(); if (n.length >= 2) { saveAuthor(n); setEditingName(false) } }}>
              <label htmlFor="nx-author" className="text-[12px] text-[var(--nx-muted)]">Tu nombre</label>
              <input id="nx-author" value={author} onChange={(e) => setAuthor(e.target.value.slice(0, 40))} autoFocus className="h-8 min-w-0 flex-1 rounded-lg border border-[var(--nx-line-strong)] bg-[var(--nx-surface)] px-2 text-[13px] text-[var(--nx-ink)] focus:outline-none" />
              <button type="submit" className="h-8 rounded-lg bg-[var(--nx-ink)] px-3 text-[12px] font-bold text-[var(--nx-bg)]">Listo</button>
            </form>
          ) : (
            <p className="mb-1.5 px-1 text-[11px] text-[var(--nx-muted)]">
              Comentas como <span className="font-semibold text-[var(--nx-ink-2)]">{author}</span> · <button type="button" onClick={() => setEditingName(true)} className="font-semibold text-[var(--nx-accent-text)] hover:underline">cambiar</button>
            </p>
          )}
          <form onSubmit={(e) => { e.preventDefault(); void post(body) }} className="flex items-center gap-2">
            <button type="button" onClick={() => setEditingName(true)} aria-label={`Tu nombre: ${author}. Cambiar`} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FACC15] text-[13px] font-bold text-black">{(author || 'H').slice(0, 1).toUpperCase()}</button>
            <label htmlFor="nx-comment" className="sr-only">Escribe un comentario</label>
            <input
              id="nx-comment"
              ref={inputRef}
              value={body}
              onChange={(e) => setBody(e.target.value.slice(0, COMMENT_MAX))}
              placeholder={disabled ? UNAVAILABLE : 'Comenta…'}
              disabled={disabled}
              enterKeyHint="send"
              autoComplete="off"
              className="h-10 min-w-0 flex-1 rounded-full border border-[var(--nx-line-strong)] bg-[var(--nx-surface)] px-4 text-[14px] text-[var(--nx-ink)] placeholder:text-[var(--nx-muted)] focus:border-[#FACC15] focus:outline-none disabled:opacity-50"
            />
            <button type="submit" disabled={disabled || sending || body.trim().length < 2} aria-label="Publicar comentario" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FACC15] text-black transition-transform active:scale-90 disabled:opacity-35">
              {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </form>
          {body.length > COMMENT_MAX - 60 && <p className="mt-1 text-right text-[11px] tabular-nums text-[var(--nx-muted)]">{body.length}/{COMMENT_MAX}</p>}
        </div>
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

  const [burst, setBurst] = useState<{ key: number; emoji: string } | null>(null)
  const juicy = (r: Reaction | null) => {
    if (r) {
      setBurst({ key: Date.now(), emoji: emojiOf(r) })
      try { navigator.vibrate?.(10) } catch { /* sin vibración */ }
    }
    void react(r)
  }
  const choose = (r: Reaction) => { setPicker(false); juicy(r) }
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
            juicy(mine ? null : 'fire')
          }}
          className={`${actionBtn} select-none ${mine ? 'text-[var(--nx-accent-text)]' : 'text-[var(--nx-muted)] hover:bg-[var(--nx-surface-2)] hover:text-[var(--nx-ink)]'}`}
        >
          <span key={mine ?? 'none'} className={`text-[17px] leading-none ${mine ? 'nx-pop' : 'opacity-70 grayscale'}`} aria-hidden="true">{emojiOf(mine)}</span>
          {ready && summary.total > 0 && <span className="tabular-nums">{compactCount(summary.total)}</span>}
        </button>
        {burst && (
          <span key={burst.key} aria-hidden="true" className="pointer-events-none absolute bottom-full left-3 z-40" onAnimationEnd={() => setBurst(null)}>
            {[0, 1, 2, 3, 4].map((i) => (
              <span key={i} className="nx-burst absolute text-lg" style={{ ['--dx' as string]: `${(i - 2) * 14}px`, animationDelay: `${i * 30}ms` }}>{burst.emoji}</span>
            ))}
          </span>
        )}
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
