'use client'

// "En Contexto" -- análisis/explicadores/perspectiva, no notas rápidas.
// Ruptura editorial deliberada: SIEMPRE oscuro, independiente del theme
// claro/oscuro del resto del sitio (mismo criterio que NEXUS Pulse) --
// una pausa después de varias secciones informativas, no otro módulo más
// que se ve igual que los anteriores.
//
// Filtra por `content_format` (columna nueva y real, ver
// infrastructure/database/supabase_setup/add_content_format.sql) -- nunca
// infiere el formato de una nota a partir de su longitud o categoría.
// Vacío hoy hasta que algo etiquete contenido real con ese campo; el
// componente se oculta en ese caso (SectionBand solo se monta en la rama
// con contenido), nunca deja un bloque oscuro vacío.

import EditorialImage from '@/components/news/EditorialImage'
import SectionBand from '@/components/news/SectionBand'
import { proxiedImage } from '@/lib/media'
import type { NewsView } from '@/types/news'

const FORMAT_LABEL: Record<string, string> = {
  analysis: 'Análisis',
  explainer: 'Explicador',
  perspective: 'Perspectiva',
}

export default function InContext({ news, onOpen }: { news: NewsView[]; onOpen: (item: NewsView) => void }) {
  const items = news.filter((item) => !!item.content_format).slice(0, 3)
  if (items.length === 0) return null

  return (
    <SectionBand bg="#111111" borderColor="rgba(255,255,255,0.1)">
      <section>
        <h2 className="text-xl font-serif font-bold mb-4 text-white">En Contexto</h2>
        <div className="grid grid-cols-4 md:grid-cols-8 lg:grid-cols-12 gap-6">
          {items.map((item) => (
            <button key={item.id} onClick={() => onOpen(item)} className="col-span-4 group block text-left">
              <EditorialImage src={proxiedImage(item.image_url)} alt={item.title} sizes="(max-width: 768px) 100vw, 33vw" className="rounded-sm mb-2.5" />
              <span className="text-[#E30613] text-[10px] font-bold uppercase tracking-[0.14em]">
                {FORMAT_LABEL[item.content_format as string] || item.content_format}
              </span>
              <h3 className="font-serif font-bold text-lg leading-snug mt-1.5 text-white group-hover:opacity-70 transition-opacity">
                {item.title}
              </h3>
            </button>
          ))}
        </div>
      </section>
    </SectionBand>
  )
}
