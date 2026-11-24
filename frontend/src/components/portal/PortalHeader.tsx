'use client'

// Cabecera fija del portal: navbar + marcador (ScoreTicker) en un único
// wrapper sticky. En pantallas < lg se esconde al bajar y vuelve al subir
// (anima `top`, no transform, para no romper el menú móvil `fixed` de
// ModernNavbar), así no se come la pantalla del teléfono.

import { useEffect, useRef, useState } from 'react'
import ModernNavbar from '@/components/portal/PortalNavbar'
import ScoreTicker from '@/components/news/ScoreTicker'
import type { Match } from '@/types/sports'

export default function PortalHeader({ matches, onHeight }: { matches: Match[]; onHeight: (h: number) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const [hidden, setHidden] = useState(false)
  const [height, setHeight] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => { setHeight(el.offsetHeight); onHeight(el.offsetHeight) }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [onHeight])

  useEffect(() => {
    let last = window.scrollY
    let frame = 0
    const onScroll = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const y = window.scrollY
        if (window.innerWidth >= 1024 || y < 140) setHidden(false)
        else if (y > last + 8) setHidden(true)
        else if (y < last - 8) setHidden(false)
        last = y
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => { window.removeEventListener('scroll', onScroll); cancelAnimationFrame(frame) }
  }, [])

  return (
    <div
      ref={ref}
      className="sticky z-50 transition-[top] duration-300 ease-out"
      style={{ top: hidden ? -height : 0 }}
      onFocusCapture={() => setHidden(false)}
    >
      <ModernNavbar />
      <ScoreTicker matches={matches} />
    </div>
  )
}
