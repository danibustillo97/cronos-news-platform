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
    <button type="button" onClick={share} aria-label={`Compartir: ${title}`} className="inline-flex h-11 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold text-[var(--nx-muted)] transition-colors hover:bg-[var(--nx-surface-2)] hover:text-[var(--nx-ink)]">
      {copied ? <Check size={16} aria-hidden="true" /> : <Share2 size={16} aria-hidden="true" />}
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
    <button type="button" onClick={toggle} aria-pressed={saved} aria-label={`${saved ? 'Quitar de guardados' : 'Guardar'}: ${title}`} className={`inline-flex h-11 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold transition-colors hover:bg-[var(--nx-surface-2)] ${saved ? 'text-[var(--nx-accent-text)]' : 'text-[var(--nx-muted)] hover:text-[var(--nx-ink)]'}`}>
      {saved ? <BookmarkCheck size={16} aria-hidden="true" /> : <Bookmark size={16} aria-hidden="true" />}
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
  meta?: ReactNode
  share?: { url: string; title: string }
  saveId?: string
  more?: { href: string; label: string; onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void }
  labelledBy?: string
  /** Reacciones y comentarios (noticias, cápsulas, encuestas, parley). */
  social?: { type: SocialType; id: string }
}

export default function ReelFrame({ icon, kind, tone = 'default', time, media, body, title, meta, share, saveId, more, labelledBy, social }: ReelFrameProps) {
  const chip = tone === 'live'
    ? 'bg-[var(--nx-live)] text-white'
    : tone === 'accent' ? 'bg-[#FACC15] text-black' : 'bg-[var(--nx-surface-2)] text-[var(--nx-ink-2)]'
  return (
    <article aria-labelledby={labelledBy} className="relative box-border w-full min-w-0 max-w-full overflow-hidden rounded-[20px] border border-[var(--nx-line)] bg-[var(--nx-surface)]">
      <header className="flex h-12 items-center justify-between gap-3 px-4">
        <span className={`inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-bold uppercase tracking-[0.1em] ${chip}`}>
          {icon}{kind}
        </span>
        {time && <TimeAgo iso={time} className="text-xs font-medium text-[var(--nx-muted)]" />}
      </header>
      {media}
      {(title || body || meta) && (
        <div className="flex min-w-0 flex-col gap-2 px-3 pb-1 pt-3.5 sm:px-4">
          {title}
          {body}
          {meta && <div className="text-xs text-[var(--nx-muted)]">{meta}</div>}
        </div>
      )}
      {(share || saveId || more || social) && (
        <footer className="mt-1 flex items-center gap-0.5 border-t border-[var(--nx-line)] px-2 py-1">
          {social && <SocialActions type={social.type} id={social.id} title={share?.title ?? kind} />}
          {share && <ShareAction url={share.url} title={share.title} compact={Boolean(social)} />}
          {saveId && share && <SaveAction id={saveId} title={share.title} compact={Boolean(social)} />}
          {more && (
            <Link href={more.href} onClick={more.onClick} className="ml-auto inline-flex h-11 items-center gap-1 rounded-full px-3 text-[13px] font-semibold text-[var(--nx-ink)] transition-colors hover:bg-[var(--nx-surface-2)]">
              {more.label} <ArrowUpRight size={15} aria-hidden="true" />
            </Link>
          )}
        </footer>
      )}
    </article>
  )
}

export const reelTitle = 'text-[19px] font-bold leading-[1.25] tracking-[-0.01em] text-[var(--nx-ink)] sm:text-xl'
