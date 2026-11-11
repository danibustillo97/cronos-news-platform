'use client'

// Respeta la composición real de la fotografía en vez de forzar siempre
// el mismo aspect ratio -- mide las dimensiones naturales de la imagen ya
// proxied (same-origin, sin problemas de CORS) y usa ESE ratio, acotado a
// un rango razonable para no romper el grid editorial (una foto extrema
// -- panorámica o casi cuadrada -- igual encaja). Mientras no se conoce
// el ratio real se usa un fallback neutro, nunca se recorta a la fuerza.

import { useEffect, useState } from 'react'
import Image from 'next/image'

// Rango de clamp por rol editorial -- siempre a partir del ratio NATURAL
// medido, nunca un valor fijo inventado. "auto" (listas/columnas) tolera
// el rango más amplio; "square"/"portrait" acotan para composiciones
// donde el layout no puede volverse arbitrariamente alto/ancho.
const VARIANT_BOUNDS: Record<string, [number, number]> = {
  auto: [4 / 5, 21 / 9],
  landscape: [3 / 2, 21 / 9],
  portrait: [3 / 5, 4 / 5],
  square: [4 / 5, 5 / 4],
  wide: [16 / 9, 21 / 9],
}

const FALLBACK_RATIO = 16 / 10

export default function EditorialImage({
  src, alt, sizes, priority = false, className = '', variant = 'auto',
}: {
  src: string | null
  alt: string
  sizes: string
  priority?: boolean
  className?: string
  variant?: 'auto' | 'landscape' | 'portrait' | 'square' | 'wide'
}) {
  const [ratio, setRatio] = useState<number | null>(null)

  useEffect(() => {
    setRatio(null)
    if (!src) return
    let cancelled = false
    const img = new window.Image()
    img.onload = () => {
      if (cancelled || !img.naturalWidth || !img.naturalHeight) return
      const natural = img.naturalWidth / img.naturalHeight
      const [min, max] = VARIANT_BOUNDS[variant]
      setRatio(Math.min(max, Math.max(min, natural)))
    }
    img.src = src
    return () => { cancelled = true }
  }, [src, variant])

  return (
    <div
      className={`relative w-full overflow-hidden bg-neutral-900 ${className}`}
      style={{ aspectRatio: ratio ?? FALLBACK_RATIO }}
    >
      {src ? (
        <Image src={src} alt={alt} fill priority={priority} sizes={sizes} className="object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-neutral-800 to-neutral-950">
          <span className="text-[#E30613] font-black text-xl">NEXUS</span>
        </div>
      )}
    </div>
  )
}
