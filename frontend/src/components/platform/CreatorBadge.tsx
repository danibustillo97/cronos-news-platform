// Identidad de creador reutilizable -- avatar con inicial (no hay fotos
// de perfil reales todavía), nombre, especialidad derivada de su
// categoría más frecuente. Usado por PostCard, FeaturedCreators y
// CoverageRail -- una sola forma de mostrar "quién publicó esto" en toda
// la plataforma.

import Link from 'next/link'
import type { Creator } from '@/lib/platform'

export function slugifyName(name: string): string {
  return name.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

export function creatorHref(creator: Creator): string {
  return `/creador/${slugifyName(creator.name)}`
}

// `asLink` por defecto true -- CreatorBadge es su propio link al perfil
// (uso normal, ej. dentro de PostCard). Pasar `asLink={false}` cuando el
// elemento contenedor YA es un link/botón al mismo destino o a otro
// destino (ej. la tarjeta completa de FeaturedCreators) -- anidar un
// <Link> dentro de otro es HTML inválido, nunca se hace.
export default function CreatorBadge({
  creator, isDark, size = 20, showSpecialty = false, asLink = true,
}: {
  creator: Creator
  isDark: boolean
  size?: number
  showSpecialty?: boolean
  asLink?: boolean
}) {
  const content = (
    <>
      <span
        className="flex-shrink-0 rounded-full bg-[#E30613]/15 flex items-center justify-center font-bold text-[#E30613]"
        style={{ width: size, height: size, fontSize: size * 0.42 }}
      >
        {creator.initial}
      </span>
      <span className="min-w-0 truncate">
        <span className={`text-sm font-bold ${asLink ? 'group-hover/creator:opacity-70 transition-opacity' : ''} ${isDark ? 'text-white' : 'text-[#161616]'}`}>
          {creator.name}
        </span>
        {showSpecialty && creator.specialty && (
          <span className={`text-xs ml-1.5 ${isDark ? 'text-neutral-500' : 'text-[#999]'}`}>· {creator.specialty}</span>
        )}
      </span>
    </>
  )

  if (!asLink) {
    return <span className="inline-flex items-center gap-2 min-w-0">{content}</span>
  }

  return (
    <Link
      href={creatorHref(creator)}
      onClick={(e) => e.stopPropagation()}
      className="inline-flex items-center gap-2 group/creator min-w-0"
    >
      {content}
    </Link>
  )
}
