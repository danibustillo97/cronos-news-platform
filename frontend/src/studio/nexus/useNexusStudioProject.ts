'use client'

// Estado real de un StudioProject + undo/redo + autosave -- NO toca
// studio/orchestration/useStudio.ts (el editor viejo, con su propio
// modelo ScriptSegment[] incompatible). Undo/redo es un historial real de
// snapshots de `scenes` en memoria (nunca falso -- cada entrada es un
// estado real que existió); el autosave hace PATCH con debounce, mismo
// espíritu que el autosave de Revisión (UpdateArtifact).

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  duplicateStudioProject, getStudioProject, updateStudioProject, type UpdateStudioProjectPatch,
} from '@/studio/nexus/api'
import type { CompositionFormat, StudioProject, StudioScene } from '@/types/studio'

const AUTOSAVE_DEBOUNCE_MS = 800
const MAX_HISTORY = 50

export function useNexusStudioProject(projectId: string | null) {
  const [project, setProject] = useState<StudioProject | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const history = useRef<StudioScene[][]>([])
  const future = useRef<StudioScene[][]>([])
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingPatch = useRef<UpdateStudioProjectPatch | null>(null)

  useEffect(() => {
    if (!projectId) { setLoading(false); return }
    let cancelled = false
    setLoading(true)
    setError(null)
    getStudioProject(projectId)
      .then((p) => { if (!cancelled) { setProject(p); history.current = []; future.current = [] } })
      .catch((e) => { if (!cancelled) setError(String(e)) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [projectId])

  const flushSave = useCallback((id: string) => {
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null }
    const patch = pendingPatch.current
    if (!patch) return
    pendingPatch.current = null
    setSaving(true)
    updateStudioProject(id, patch)
      .then((p) => setProject(p))
      .catch((e) => setError(String(e)))
      .finally(() => setSaving(false))
  }, [])

  const persist = useCallback((patch: UpdateStudioProjectPatch) => {
    if (!projectId) return
    pendingPatch.current = { ...pendingPatch.current, ...patch }
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => flushSave(projectId), AUTOSAVE_DEBOUNCE_MS)
  }, [projectId, flushSave])

  const replaceScenes = useCallback((scenes: StudioScene[], recordHistory = true) => {
    setProject((prev) => {
      if (!prev) return prev
      if (recordHistory) {
        history.current = [...history.current, prev.scenes].slice(-MAX_HISTORY)
        future.current = []
      }
      return { ...prev, scenes }
    })
    persist({ scenes })
  }, [persist])

  const undo = useCallback(() => {
    setProject((prev) => {
      if (!prev || history.current.length === 0) return prev
      const previousScenes = history.current[history.current.length - 1]
      history.current = history.current.slice(0, -1)
      future.current = [prev.scenes, ...future.current].slice(0, MAX_HISTORY)
      persist({ scenes: previousScenes })
      return { ...prev, scenes: previousScenes }
    })
  }, [persist])

  const redo = useCallback(() => {
    setProject((prev) => {
      if (!prev || future.current.length === 0) return prev
      const [nextScenes, ...rest] = future.current
      future.current = rest
      history.current = [...history.current, prev.scenes].slice(-MAX_HISTORY)
      persist({ scenes: nextScenes })
      return { ...prev, scenes: nextScenes }
    })
  }, [persist])

  const setTitle = useCallback((title: string) => {
    setProject((prev) => (prev ? { ...prev, title } : prev))
    persist({ title })
  }, [persist])

  const setTemplateId = useCallback((templateId: string) => {
    setProject((prev) => (prev ? { ...prev, templateId } : prev))
    persist({ templateId })
  }, [persist])

  const setFormat = useCallback((format: CompositionFormat) => {
    setProject((prev) => (prev ? { ...prev, format } : prev))
    persist({ format })
  }, [persist])

  const saveNow = useCallback(() => {
    if (projectId) flushSave(projectId)
  }, [projectId, flushSave])

  const createVersion = useCallback(async () => {
    if (!projectId) return null
    saveNow()
    const versioned = await duplicateStudioProject(projectId)
    return versioned
  }, [projectId, saveNow])

  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current) }, [])

  return {
    project, loading, saving, error,
    canUndo: history.current.length > 0,
    canRedo: future.current.length > 0,
    replaceScenes, undo, redo, setTitle, setTemplateId, setFormat, saveNow, createVersion,
  }
}
