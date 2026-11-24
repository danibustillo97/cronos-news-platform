'use client'

// /leyendas: cuadrícula de cápsulas "leyenda"; cada una abre su tarjeta de
// diapositivas en una ventana. Sin backend (503) -> estado vacío diseñado.

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Crown, Play, X } from 'lucide-react'
import PortalPage, { pageShell } from '@/components/portal/PortalPage'
import { Skeleton } from '@/components/portal/PortalBits'
import { CapsuleCard } from '@/components/portal/FeedExtras'
import { useCapsules } from '@/lib/useCapsules'
import { monogram } from '@/lib/leagueLogos'
import { proxiedImage } from '@/lib/media'
import type { Capsule } from '@/lib/capsules'

const GOLD = '#D4AF37'

export default function LegendsClient() {
  const { capsules, loaded } = useCapsules('limit=60&kind=leyenda')
  const legends = capsules.filter((c) => c.kind === 'leyenda')
  const [open, setOpen] = useState<Capsule | null>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <PortalPage>
      <div className={`${pageShell} max-w-[1200px] pb-20 pt-8 sm:pt-12`}>
        <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: GOLD }}><Crown size={14} aria-hidden="true" /> Salón de la fama</p>
        <h1 className="mt-2 text-[clamp(1.75rem,1.4rem+1.5vw,2.5rem)] font-bold leading-[1.1] tracking-[-0.015em] text-[var(--nx-ink)]">Leyendas</h1>
        <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-[var(--nx-ink-2)]">Las figuras que hicieron historia, contadas en un minuto.</p>

        {!loaded ? (
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="aspect-[3/4]" />)}</div>
        ) : legends.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-[var(--nx-line-strong)] px-6 py-14 text-center">
            <p className="text-base font-bold text-[var(--nx-ink)]">Muy pronto: el salón de las leyendas.</p>
            <p className="mt-1 text-sm text-[var(--nx-muted)]">Mientras tanto, sigue el Pulso del día en la portada.</p>
            <Link href="/" className="mt-5 inline-flex min-h-[44px] items-center rounded-full bg-[var(--nx-ink)] px-5 text-sm font-bold text-[var(--nx-bg)]">Ir a la portada</Link>
          </div>
        ) : (
          <ul className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {legends.map((c) => {
              const img = proxiedImage(c.slides.find((s) => s.image)?.image ?? null)
              const name = c.subject ?? c.title
              return (
                <li key={c.id}>
                  <button type="button" onClick={() => setOpen(c)} className="group relative block aspect-[3/4] w-full overflow-hidden rounded-2xl bg-[#111] text-left text-white ring-1 ring-[var(--nx-line)]">
                    {img ? <Image src={img} alt={name} fill sizes="(max-width: 640px) 50vw, 300px" className="object-cover opacity-80 transition-transform duration-700 group-hover:scale-[1.04]" /> : (
                      <span className="absolute inset-0 flex items-center justify-center"><span className="inline-flex h-20 w-20 items-center justify-center rounded-full text-2xl font-bold text-black" style={{ background: `linear-gradient(135deg, ${GOLD}, #8a6d1a)` }}>{monogram(name)}</span></span>
                    )}
                    <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                    <span aria-hidden className="absolute inset-0 rounded-2xl shadow-[inset_0_0_0_1px_rgba(212,175,55,0.35)]" />
                    <span className="absolute inset-x-0 bottom-0 p-3.5">
                      <span className="text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: GOLD }}>{c.year ?? 'Leyenda'}</span>
                      <span className="mt-0.5 block text-base font-bold leading-tight">{name}</span>
                      <span className="mt-1.5 inline-flex items-center gap-1 text-xs text-white/75"><Play size={12} aria-hidden="true" /> Ver historia</span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {open && (
        <div className="fixed inset-0 z-[85] flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={open.subject ?? open.title}>
          <button type="button" aria-label="Cerrar" className="absolute inset-0 bg-black/70" onClick={() => setOpen(null)} />
          <div className="relative max-h-[92svh] w-full max-w-[560px] overflow-y-auto">
            <button type="button" onClick={() => setOpen(null)} aria-label="Cerrar" className="absolute right-3 top-14 z-40 inline-flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-white"><X size={18} /></button>
            <CapsuleCard capsule={open} />
          </div>
        </div>
      )}
    </PortalPage>
  )
}
