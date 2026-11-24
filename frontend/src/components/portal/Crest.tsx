'use client'

// Escudos de equipos y logos de competiciones. Si ESPN no entrega la
// imagen (null) o falla al cargar, se pinta un monograma elegante con un
// tono estable derivado del nombre -- nunca un logo inventado.

import { useState } from 'react'
import Image from 'next/image'
import { leagueLogoUrl, monogram, monogramHue } from '@/lib/leagueLogos'

function Monogram({ name, size, rounded }: { name: string; size: number; rounded: string }) {
  const hue = monogramHue(name)
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center font-black tracking-tight text-white ${rounded}`}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(9, Math.round(size * 0.38)),
        background: `linear-gradient(135deg, hsl(${hue} 45% 34%), hsl(${(hue + 40) % 360} 50% 20%))`,
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.15)',
      }}
    >
      {monogram(name)}
    </span>
  )
}

export function TeamCrest({ src, name, size = 28, className = '' }: { src: string | null | undefined; name: string; size?: number; className?: string }) {
  const [failed, setFailed] = useState<string | null>(null)
  if (!src || failed === src) return <span className={className}><Monogram name={name} size={size} rounded="rounded-full" /></span>
  return (
    <Image
      src={src}
      alt=""
      width={size}
      height={size}
      sizes={`${size * 2}px`}
      onError={() => setFailed(src)}
      className={`shrink-0 object-contain ${className}`}
      style={{ width: size, height: size }}
    />
  )
}

export function LeagueBadge({ league, name, size = 20, dark = true, className = '' }: { league: string; name: string; size?: number; dark?: boolean; className?: string }) {
  const src = leagueLogoUrl(league, dark)
  const [failed, setFailed] = useState<string | null>(null)
  if (!src || failed === src) return <span className={className}><Monogram name={name} size={size} rounded="rounded-md" /></span>
  return (
    <Image
      src={src}
      alt=""
      width={size}
      height={size}
      sizes={`${size * 2}px`}
      onError={() => setFailed(src)}
      className={`shrink-0 object-contain ${className}`}
      style={{ width: size, height: size }}
    />
  )
}
