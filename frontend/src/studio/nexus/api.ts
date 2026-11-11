// Todas las llamadas reales a /api/studio/* y /api/artifacts (lectura) --
// mismo apiUrl() same-origin que el resto del sitio, nunca un endpoint
// inventado.

import { apiUrl } from '@/studio/lab/api-client'
import type { CompositionFormat, SafeArea, StudioMode, StudioProject, StudioSourceArtifact, Template } from '@/types/studio'

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`${res.status} ${res.statusText}: ${body}`)
  }
  return res.json()
}

export async function listPublishedArtifacts(limit = 200): Promise<StudioSourceArtifact[]> {
  const res = await fetch(apiUrl(`/api/artifacts?status=PUBLISHED&limit=${limit}`))
  const data = await json<{ artifacts: StudioSourceArtifact[] }>(res)
  return data.artifacts
}

export async function getArtifact(artifactId: string): Promise<StudioSourceArtifact> {
  const res = await fetch(apiUrl(`/api/artifacts/${artifactId}`))
  return json<StudioSourceArtifact>(res)
}

export async function createStudioProject(
  sourceArtifactId: string, mode: StudioMode, templateId?: string, format: CompositionFormat = 'REEL_9X16',
): Promise<StudioProject> {
  const res = await fetch(apiUrl('/api/studio/projects'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sourceArtifactId, mode, templateId, format }),
  })
  return json<StudioProject>(res)
}

export async function getStudioProject(projectId: string): Promise<StudioProject> {
  const res = await fetch(apiUrl(`/api/studio/projects/${projectId}`))
  return json<StudioProject>(res)
}

export interface UpdateStudioProjectPatch {
  title?: string
  templateId?: string
  format?: CompositionFormat
  status?: StudioProject['status']
  scenes?: StudioProject['scenes']
}

export async function updateStudioProject(projectId: string, patch: UpdateStudioProjectPatch): Promise<StudioProject> {
  const res = await fetch(apiUrl(`/api/studio/projects/${projectId}`), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
  return json<StudioProject>(res)
}

export async function duplicateStudioProject(projectId: string): Promise<StudioProject> {
  const res = await fetch(apiUrl(`/api/studio/projects/${projectId}/versions`), { method: 'POST' })
  return json<StudioProject>(res)
}

export async function listStudioProjectVersions(sourceArtifactId: string): Promise<StudioProject[]> {
  const res = await fetch(apiUrl(`/api/studio/projects/by-source/${sourceArtifactId}`))
  const data = await json<{ versions: StudioProject[] }>(res)
  return data.versions
}

export async function listStudioTemplates(): Promise<Template[]> {
  const res = await fetch(apiUrl('/api/studio/templates'))
  const data = await json<{ templates: Template[] }>(res)
  return data.templates
}

export async function getSafeArea(format: CompositionFormat): Promise<SafeArea> {
  const res = await fetch(apiUrl(`/api/studio/safe-areas?format=${format}`))
  return json<SafeArea>(res)
}
