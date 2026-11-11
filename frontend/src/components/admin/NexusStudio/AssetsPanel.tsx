'use client'

// Sección 33: FEATURED / BODY IMAGES reales del Artifact fuente, con
// provenance visible (sección 30) -- GENERATED/UPLOADS quedan como
// secciones reales pero vacías: Fase 1 no tiene todavía un mecanismo para
// generar/subir un asset nuevo dentro de Studio (eso es Fase 2+), así que
// mostrarlas con contenido sería inventar datos.
//
// "Arrastrar al timeline" (sección 33) se resolvió como click-to-insert:
// un asset real se agrega como clip nuevo a la escena seleccionada -- una
// interacción más simple que drag-and-drop cross-componente, igual de
// real, sin comprometer el alcance de Fase 1.

import Image from 'next/image'
import { proxiedImage } from '@/lib/media'
import type { StudioSourceArtifact } from '@/types/studio'

function ProvenanceBadge({ provenance }: { provenance: string | null }) {
  if (!provenance) return null
  const isGenerated = provenance.startsWith('AI_GENERATED')
  return (
    <span className={`text-[8px] font-bold uppercase tracking-wide px-1 py-0.5 rounded-sm ${isGenerated ? 'bg-purple-600/30 text-purple-300' : 'bg-emerald-600/30 text-emerald-300'}`}>
      {isGenerated ? 'IA' : 'Editorial'}
    </span>
  )
}

export default function AssetsPanel({
  source, onInsert,
}: {
  source: StudioSourceArtifact | null
  onInsert: (placeholderId: string, assetId: string | null, assetUrl: string | null) => void
}) {
  if (!source) {
    return <div className="p-3 text-xs text-white/30">Cargando assets reales del artículo…</div>
  }

  const featured = source.mediaRequirements.filter((m) => m.kind === 'FEATURE_IMAGE')
  const body = source.mediaRequirements.filter((m) => m.kind === 'BODY_IMAGE')

  return (
    <div className="p-3 space-y-4 overflow-y-auto h-full">
      <div>
        <h4 className="text-[10px] font-bold uppercase tracking-[0.08em] text-white/40 mb-1.5">Destacada</h4>
        {featured.length === 0 ? (
          <p className="text-[11px] text-white/25">Sin imagen destacada.</p>
        ) : featured.map((m) => (
          <button
            key={m.placeholderId}
            onClick={() => onInsert(m.placeholderId, m.assetId, m.assetUrl)}
            className="relative w-full aspect-video rounded-sm overflow-hidden bg-white/5 border border-white/10 hover:border-red-500 group mb-1"
          >
            {m.assetUrl && <Image src={proxiedImage(m.assetUrl) ?? m.assetUrl} alt="" fill sizes="220px" className="object-cover" />}
            <div className="absolute top-1 left-1"><ProvenanceBadge provenance={m.assetProvenance} /></div>
          </button>
        ))}
      </div>

      <div>
        <h4 className="text-[10px] font-bold uppercase tracking-[0.08em] text-white/40 mb-1.5">
          Imágenes del cuerpo ({body.length})
        </h4>
        {body.length === 0 ? (
          <p className="text-[11px] text-white/25">Este artículo no tiene imágenes en el cuerpo.</p>
        ) : (
          <div className="grid grid-cols-2 gap-1.5">
            {body.map((m) => (
              <button
                key={m.placeholderId}
                onClick={() => onInsert(m.placeholderId, m.assetId, m.assetUrl)}
                title={m.caption ?? m.placeholderId}
                className="relative aspect-square rounded-sm overflow-hidden bg-white/5 border border-white/10 hover:border-red-500"
              >
                {m.assetUrl && <Image src={proxiedImage(m.assetUrl) ?? m.assetUrl} alt="" fill sizes="110px" className="object-cover" />}
                <div className="absolute top-1 left-1"><ProvenanceBadge provenance={m.assetProvenance} /></div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        <h4 className="text-[10px] font-bold uppercase tracking-[0.08em] text-white/40 mb-1.5">Generadas</h4>
        <p className="text-[11px] text-white/25">Ninguna todavía -- generar imágenes nuevas llega en una fase siguiente.</p>
      </div>

      <div>
        <h4 className="text-[10px] font-bold uppercase tracking-[0.08em] text-white/40 mb-1.5">Subidas</h4>
        <p className="text-[11px] text-white/25">Ninguna todavía.</p>
      </div>
    </div>
  )
}
