'use client'

// Entrada real de NEXUS Studio -- sin proyecto activo, el selector de
// contenido (Artifacts PUBLISHED reales); con uno, el editor completo.
// No reemplaza "Studio (legacy)" (social/SocialMedia) -- vive aparte
// hasta que este cubra sus capacidades reales (regla 36).

import { useState } from 'react'
import ContentSelector from '@/components/admin/NexusStudio/ContentSelector'
import StudioShell from '@/components/admin/NexusStudio/StudioShell'

export default function NexusStudioView() {
  const [projectId, setProjectId] = useState<string | null>(null)

  if (projectId) {
    return <StudioShell projectId={projectId} onBack={() => setProjectId(null)} />
  }
  return <ContentSelector onProjectCreated={setProjectId} />
}
