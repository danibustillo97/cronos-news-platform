'use client'

// Anatomía ÚNICA de toda tarjeta del feed Reels: cabecera (tipo + hora),
// visual, título, una línea de meta y fila de acciones (compartir,
// guardar, ver más). Mismo radio, padding y tipografía para todos los
// tipos -- de ahí la uniformidad.

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { ArrowUpRight, Bookmark, BookmarkCheck, Check, Share2 } from 'lucide-react'
import { safeStorage } from '@/lib/players'
import { timeAgo } from '@/lib/feedComposer'
import type { SocialType } from '@/lib/social'
import SocialActions from './SocialActions'

export type ReelTone = 'default' | 'accent' | 'live'

const SAVED_KEY = 'nexus.saved'

function readSaved(): string[] {
  try {
    const v: unknown = JSON.parse(safeStorage()?.getItem(SAVED_KEY) ?? '[]')
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

/** "hace 5 min" con <time datetime>; el texto relativo puede diferir entre servidor y navegador. */
export function TimeAgo({ iso, className = '' }: { iso: string | null | undefined; className?: string }) {
  const [label, setLabel] = useState(() => timeAgo(iso))
  useEffect(() => {
    setLabel(timeAgo(iso))
    const id = window.setInterval(() => setLabel(timeAgo(iso)), 60_000)
    return () => window.clearInterval(id)
  }, [iso])
  if (!iso) return null
  return <time dateTime={iso} className={className} suppressHydrationWarning>{label}</time>
}

/** Botón de la fila de acciones: 44 px de alto, ícono de 18 px, mismo espaciado en todas las tarjetas. */
export const actionBtn = 'inline-flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-full px-2.5 text-[13px] font-semibold text-[var(--nx-muted)] transition-colors hover:bg-[var(--nx-surface-2)] hover:text-[var(--nx-ink)]'

/** Chip de tipo: el mismo en todo el portal (11 px, 700, tracking .12em, píldora, texto de acento sobre fondo sutil). */
export function chipClass(tone: ReelTone = 'default'): string {
  const base = 'inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-bold uppercase tracking-[0.12em]'
  return tone === 'live' ? `${base} bg-[var(--nx-live)]/[0.14] text-[var(--nx-live)]` : `${base} bg-[var(--nx-accent)]/[0.14] text-[var(--nx-accent-text)]`
}

function ShareAction({ url, title, compact = false }: { url: string; title: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false)
  const share = async () => {
    const abs = url.startsWith('http') ? url : `${window.location.origin}${url}`
    try {
      if (navigator.share) { await navigator.share({ title, url: abs }); return }
      await navigator.clipboard.writeText(abs)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch { /* cancelado */ }
  }
  return (
    <button type="button" onClick={share} aria-label={`Compartir: ${title}`} className={actionBtn}>
      {copied ? <Check size={18} aria-hidden="true" /> : <Share2 size={18} aria-hidden="true" />}
      <span className={compact ? 'hidden sm:inline' : ''}>{copied ? 'Copiado' : 'Compartir'}</span>
    </button>
  )
}

function SaveAction({ id, title, compact = false }: { id: string; title: string; compact?: boolean }) {
  const [saved, setSaved] = useState(false)
  useEffect(() => { setSaved(readSaved().includes(id)) }, [id])
  const toggle = () => {
    const list = readSaved()
    const next = list.includes(id) ? list.filter((x) => x !== id) : [id, ...list].slice(0, 200)
    try { safeStorage()?.setItem(SAVED_KEY, JSON.stringify(next)) } catch { /* bloqueado */ }
    setSaved(next.includes(id))
  }
  return (
    <button type="button" onClick={toggle} aria-pressed={saved} aria-label={`${saved ? 'Quitar de guardados' : 'Guardar'}: ${title}`} className={`${actionBtn} ${saved ? '!text-[var(--nx-accent-text)]' : ''}`}>
      {saved ? <BookmarkCheck size={18} aria-hidden="true" /> : <Bookmark size={18} aria-hidden="true" />}
      <span className={compact ? 'hidden sm:inline' : ''}>{saved ? 'Guardado' : 'Guardar'}</span>
    </button>
  )
}

export interface ReelFrameProps {
  icon: ReactNode
  kind: string
  tone?: ReelTone
  time?: string | null
  /** Visual a sangre (imagen, diapositivas). */
  media?: ReactNode
  /** Contenido con padding (tablas, partidos, encuestas, datos). */
  body?: ReactNode
  title?: ReactNode
  /** Partes de la línea de meta (fuente, lectura…): se unen con " · " y la hora va después de la primera. */
  meta?: ReactNode | ReactNode[]
  share?: { url: string; title: string }
  saveId?: string
  more?: { href: string; label: string; onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void }
  labelledBy?: string
  /** Reacciones y comentarios (noticias, cápsulas, encuestas, parley). */
  social?: { type: SocialType; id: string }
}

export default function ReelFrame({ icon, kind, tone = 'default', time, media, body, title, meta, share, saveId, more, labelledBy, social }: ReelFrameProps) {
  // Línea de meta: fuente · hora · lectura (un solo separador).
  const parts = (Array.isArray(meta) ? meta : meta ? [meta] : []).filter((p) => p !== null && p !== undefined && p !== false && p !== '')
  if (time) parts.splice(Math.min(1, parts.length), 0, <TimeAgo key="time" iso={time} />)
  return (
    <article aria-labelledby={labelledBy} className="relative box-border w-full min-w-0 max-w-full overflow-hidden rounded-2xl border border-[var(--nx-line)] bg-[var(--nx-surface)]">
      <header className="flex h-12 items-center justify-between gap-3 px-4 sm:px-5">
        <span className={chipClass(tone)}>{icon}{kind}</span>
      </header>
      {media}
      {(title || body || parts.length > 0) && (
        <div className="flex min-w-0 flex-col gap-2 px-4 pb-1 pt-4 sm:px-5">
          {title}
          {body}
          {parts.length > 0 && (
            <p className="text-[12.5px] leading-snug text-[var(--nx-muted)]">
              {parts.map((p, i) => <span key={i}>{i > 0 && <span aria-hidden="true" className="mx-1.5">·</span>}{p}</span>)}
            </p>
          )}
        </div>
      )}
      {(share || saveId || more || social) && (
        <footer className="mt-2 flex h-14 items-center gap-1 border-t border-[var(--nx-line)] px-2 sm:px-3">
          {social && <SocialActions type={social.type} id={social.id} title={share?.title ?? kind} />}
          {share && <ShareAction url={share.url} title={share.title} compact={Boolean(social)} />}
          {saveId && share && <SaveAction id={saveId} title={share.title} compact={Boolean(social)} />}
          {more && (
            <Link href={more.href} onClick={more.onClick} className="ml-auto inline-flex h-11 items-center gap-1 rounded-full px-3 text-[13px] font-semibold text-[var(--nx-ink)] transition-colors hover:bg-[var(--nx-surface-2)]">
              {more.label} <ArrowUpRight size={18} aria-hidden="true" />
            </Link>
          )}
        </footer>
      )}
    </article>
  )
}

export const reelTitle = 'text-[18px] font-bold leading-[1.2] tracking-[-0.01em] text-[var(--nx-ink)] line-clamp-3 sm:text-[20px]'
