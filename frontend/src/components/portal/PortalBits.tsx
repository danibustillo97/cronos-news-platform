'use client'

import { motion, useReducedMotion } from 'framer-motion'
import type { ReactNode } from 'react'

export function LiveBadge({ label = 'En vivo', size = 'md' }: { label?: string; size?: 'sm' | 'md' | 'lg' }) {
  const cls = size === 'lg'
    ? 'px-3 py-1.5 text-xs gap-2'
    : size === 'sm' ? 'px-2 py-0.5 text-[10px] gap-1.5' : 'px-2.5 py-1 text-[11px] gap-1.5'
  return (
    <span className={`inline-flex items-center rounded-full bg-[var(--nx-live)] font-black uppercase tracking-[0.14em] text-white ${cls}`}>
      <span className="nx-live-dot text-white" style={{ width: size === 'lg' ? 8 : 6, height: size === 'lg' ? 8 : 6 }} aria-hidden="true" />
      {label}
    </span>
  )
}

export function Kicker({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span className={`text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--nx-accent-text)] ${className}`}>
      {children}
    </span>
  )
}

export function SectionHeading({ id, kicker, title, action }: { id?: string; kicker: string; title: string; action?: ReactNode }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div className="min-w-0">
        <Kicker>{kicker}</Kicker>
        <h2 id={id} className="mt-1 text-xl font-extrabold leading-tight tracking-[-0.01em] text-[var(--nx-ink)] sm:text-2xl">{title}</h2>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

/** Entrada sutil al hacer scroll (sin ocultar contenido) -- desactivada con menos movimiento. */
export function Reveal({ children, className = '', delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const reduce = useReducedMotion()
  if (reduce) return <div className={className}>{children}</div>
  return (
    <motion.div
      className={className}
      // Solo desplazamiento: el contenido nunca queda invisible (capturas, SEO, scroll rápido).
      initial={{ y: 14 }}
      whileInView={{ y: 0 }}
      viewport={{ once: true, margin: '0px 0px -60px 0px' }}
      transition={{ duration: 0.45, ease: [0.2, 0.7, 0.2, 1], delay }}
    >
      {children}
    </motion.div>
  )
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`nx-skeleton rounded-xl ${className}`} />
}
