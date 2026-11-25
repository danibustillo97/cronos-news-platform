'use client'

// /parleys (visita directa y SEO). El feed abre el mismo tablero en una
// ventana flotante (ParleysBoard inSheet).

import PortalPage, { pageShell } from '@/components/portal/PortalPage'
import ParleysBoard from '@/components/portal/ParleysBoard'

export default function ParleysClient() {
  return (
    <PortalPage>
      <div className={`${pageShell} max-w-[1200px] pb-28 pt-8 sm:pt-12 lg:pb-20`}>
        <ParleysBoard />
      </div>
    </PortalPage>
  )
}
