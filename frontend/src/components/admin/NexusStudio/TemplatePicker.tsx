'use client'

// Cambiar de plantilla sin perder contenido (sección 5) -- solo cambia
// `templateId`, nunca toca scenes/clips. Las 9 plantillas reales vienen
// de GET /api/studio/templates (datos, no componentes hardcodeados).

import { useEffect, useState } from 'react'
import { listStudioTemplates } from '@/studio/nexus/api'
import type { StudioMode, Template } from '@/types/studio'

export default function TemplatePicker({
  activeTemplateId, mode, onSelect,
}: {
  activeTemplateId: string
  mode: StudioMode
  onSelect: (templateId: string) => void
}) {
  const [templates, setTemplates] = useState<Template[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    listStudioTemplates()
      .then((t) => { if (!cancelled) setTemplates(t) })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Error desconocido')
      })
    return () => { cancelled = true }
  }, [])

  return (
    <div>
      <h3 className="text-[11px] font-bold uppercase tracking-[0.1em] text-white/50 mb-2">Plantillas</h3>
      {error && <p role="alert" className="mb-2 text-[10px] text-red-400">No se pudieron cargar las plantillas: {error}</p>}
      <div className="grid grid-cols-2 gap-1.5">
        {templates
          .filter((t) => mode === 'IMAGE' || !t.id.startsWith('nexus_editorial_premium_'))
          .map((t) => (
          <button
            key={t.id}
            onClick={() => onSelect(t.id)}
            title={t.description}
            className={`text-left px-2 py-2 rounded-sm text-[11px] font-bold border transition-colors ${
              t.id === activeTemplateId
                ? 'border-red-600 bg-red-600/15 text-white'
                : 'border-white/10 text-white/60 hover:text-white hover:border-white/25'
            }`}
          >
            <span className="flex items-center gap-1.5">
              {t.id.startsWith('nexus_editorial_premium_') && (
                <span aria-hidden="true" className="h-2 w-2 flex-shrink-0 rounded-full" style={{ backgroundColor: t.accentColor }} />
              )}
              {t.name.replace('NEXUS ', '')}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
