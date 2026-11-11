'use client'

// Hero editorial -- estilo de referencia: panel de texto anclado a la
// izquierda, centrado verticalmente, sobre un degradado que sale desde
// el borde izquierdo (nunca una franja inferior pareja). La foto sigue
// siendo protagonista -- el contenedor usa aspect-ratio (no una altura
// en píxeles fija y desconectada del ancho real de la columna, que en
// lg terminaba casi cuadrada: 714x640 ≈ 1.1, se leía como una tarjeta
// chata en vez de un hero panorámico). aspect-ratio escala con el ancho
// real, así siempre queda panorámico en desktop/tablet y más alto en
// mobile, sin importar cuántas columnas ocupe el grid padre.
//
// Deliberadamente NO incluye paginación numerada (1 2 3 4) ni una tira
// "siguiente" -- eso, en la referencia visual, es paginación real de un
// artículo multi-página que NEXUS no tiene. Se prefirió omitirlo a
// simularlo con datos falsos.

import Image from 'next/image'
import { Clock, User } from 'lucide-react'
import { estimateReadMinutes } from '@/lib/readTime'
import type { NewsView } from '@/types/news'

export default function HeroEditorial({ item, src, onOpen }: { item: NewsView; src: string | null; onOpen: (item: NewsView) => void }) {
  const readMinutes = estimateReadMinutes(item.content, item.excerpt)

  return (
    <button
      onClick={() => onOpen(item)}
      className="relative w-full overflow-hidden bg-neutral-900 rounded-md block text-left group aspect-[4/5] sm:aspect-[16/11] lg:aspect-[16/10]"
    >
      {src ? (
        <Image
          src={src}
          alt={item.title}
          fill
          priority
          sizes="(max-width: 1024px) 100vw, 760px"
          className="object-cover object-[62%_center] transition-transform duration-700 group-hover:scale-[1.02]"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-neutral-800 to-neutral-950">
          <span className="text-[#E30613] font-black text-2xl">NEXUS</span>
        </div>
      )}

      {/* Degradado desde el borde izquierdo -- el panel de texto vive acá, nunca abajo. Se corta a la mitad de la foto, nunca la tapa entera. */}
      <div className="absolute inset-y-0 left-0 w-[65%] sm:w-[55%] bg-gradient-to-r from-black/95 via-black/55 to-transparent pointer-events-none" />

      <div className="absolute inset-y-0 left-0 w-[85%] sm:w-[52%] flex flex-col justify-center p-6 sm:p-10">
        <span className="inline-block text-[#E30613] text-[11px] font-bold uppercase tracking-[0.18em] mb-3 w-fit">
          {item.category || 'Destacada'}
        </span>
        <h1 className="font-serif font-bold leading-[1.08] text-white text-2xl sm:text-4xl lg:text-[3.25rem] mb-4 max-w-xl line-clamp-4">
          {item.title}
        </h1>
        {item.excerpt && (
          <p className="text-white/75 text-sm leading-relaxed mb-5 max-w-md line-clamp-2 hidden sm:block">
            {item.excerpt}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-5 text-xs text-white/70">
          {readMinutes > 0 && (
            <span className="flex items-center gap-1.5"><Clock size={12} /> {readMinutes} min de lectura</span>
          )}
          {item.author && (
            <span className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-white/15 flex items-center justify-center text-[9px] font-bold text-white">
                {item.author.slice(0, 1).toUpperCase()}
              </span>
              {item.author}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}
