'use client'

// Entrada real de NEXUS Studio -- sin proyecto activo, el selector de
// contenido (Artifacts PUBLISHED reales); con uno, el editor completo.
// NEXUS Studio is the supported content editing workspace.

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
