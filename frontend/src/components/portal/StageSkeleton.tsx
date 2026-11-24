import type { CSSProperties } from 'react'
import { Skeleton } from './PortalBits'

/** Mismas alturas que el Escenario real (StageNews) -- sin saltos de layout al cargar. */
export default function StageSkeleton() {
  return (
    <div
      className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_300px]"
      style={{ '--nx-stage-img': 'clamp(300px, calc(62vh - 88px), 432px)' } as CSSProperties}
      aria-busy="true"
      aria-label="Cargando portada"
    >
      <div className="overflow-hidden rounded-2xl bg-[var(--nx-surface)] ring-1 ring-[var(--nx-line)]">
        <Skeleton className="aspect-video w-full !rounded-none sm:aspect-auto sm:h-[352px] lg:h-[var(--nx-stage-img)]" />
        <div className="space-y-2 px-4 py-4 sm:hidden">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-6 w-11/12" />
          <Skeleton className="h-6 w-3/4" />
        </div>
        <div className="flex gap-2 border-t border-[var(--nx-line)] p-3 sm:h-[88px]">
          <Skeleton className="h-16 w-[76%] shrink-0 sm:w-[44%] lg:w-1/4" />
          <Skeleton className="h-16 w-[40%] shrink-0 lg:w-1/4" />
        </div>
      </div>
      <Skeleton className="hidden h-[calc(var(--nx-stage-img)_+_88px)] xl:block" />
    </div>
  )
}
