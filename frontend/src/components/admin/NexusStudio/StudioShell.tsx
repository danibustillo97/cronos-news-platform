'use client'

// Layout "postproduction room" (sección 31): izquierda proyecto/assets/
// plantillas, centro preview, abajo timeline, derecha inspector. Top:
// nombre del proyecto, undo/redo, save, preview, export/live (Fase 2+,
// deshabilitados acá con motivo real, nunca fingiendo que funcionan).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Copy, Redo2, Undo2 } from 'lucide-react'
import { useNexusStudioProject } from '@/studio/nexus/useNexusStudioProject'
import { getArtifact, getSafeArea, listStudioTemplates } from '@/studio/nexus/api'
import { useCategoryNames } from '@/studio/nexus/useCategoryNames'
import Preview from '@/components/admin/NexusStudio/Preview'
import Timeline from '@/components/admin/NexusStudio/Timeline'
import Inspector from '@/components/admin/NexusStudio/Inspector'
import TemplatePicker from '@/components/admin/NexusStudio/TemplatePicker'
import FormatSwitcher from '@/components/admin/NexusStudio/FormatSwitcher'
import AssetsPanel from '@/components/admin/NexusStudio/AssetsPanel'
import type { ClipTransform, CompositionFormat, SafeArea, StudioClip, StudioScene, StudioSourceArtifact, Template } from '@/types/studio'

function newClipId(): string {
  return `clip-${Math.random().toString(36).slice(2, 10)}`
}

export default function StudioShell({ projectId, onBack }: { projectId: string; onBack: () => void }) {
  const {
    project, loading, saving, error, canUndo, canRedo,
    replaceScenes, undo, redo, setTitle, setTemplateId, setFormat, saveNow, createVersion,
  } = useNexusStudioProject(projectId)

  const [templates, setTemplates] = useState<Template[]>([])
  const [source, setSource] = useState<StudioSourceArtifact | null>(null)
  const [safeArea, setSafeArea] = useState<SafeArea | null>(null)
  const [showSafeArea, setShowSafeArea] = useState(false)
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null)
  const [playheadMs, setPlayheadMs] = useState(0)
  const [playing, setPlaying] = useState(false)
  const categoryNames = useCategoryNames()
  const sourceArtifactId = project?.sourceArtifactId
  const projectFormat = project?.format

  // Único reloj real de reproducción -- Preview y Timeline leen el MISMO
  // playheadMs (antes Preview tenía su propio estado interno y su
  // playhead nunca movía la línea del timeline; ese era el bug).
  const rafRef = useRef<number | null>(null)
  const lastTickRef = useRef(0)
  const totalMs = project?.totalDurationMs || 1
  useEffect(() => {
    if (!playing) return
    lastTickRef.current = performance.now()
    const tick = (now: number) => {
      const dt = now - lastTickRef.current
      lastTickRef.current = now
      setPlayheadMs((prev) => {
        const next = prev + dt
        return next >= totalMs ? 0 : next
      })
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [playing, totalMs])

  useEffect(() => {
    listStudioTemplates().then(setTemplates).catch(() => {})
  }, [])

  useEffect(() => {
    if (!sourceArtifactId) return
    getArtifact(sourceArtifactId).then(setSource).catch(() => {})
  }, [sourceArtifactId])

  useEffect(() => {
    if (!projectFormat) return
    getSafeArea(projectFormat).then(setSafeArea).catch(() => setSafeArea(null))
  }, [projectFormat])

  const template = useMemo(() => templates.find((t) => t.id === project?.templateId) ?? null, [templates, project])
  const categoryLabel = source?.categoryId ? categoryNames.get(source.categoryId) ?? null : null
  const isPremiumEditorial = project?.mode === 'IMAGE'
    && project.templateId.startsWith('nexus_editorial_premium_')

  useEffect(() => {
    if (isPremiumEditorial && project?.format !== 'FEED_4X5') setFormat('FEED_4X5')
  }, [isPremiumEditorial, project?.format, setFormat])

  const selectTemplate = (templateId: string) => {
    setTemplateId(templateId)
    if (templateId.startsWith('nexus_editorial_premium_')) setFormat('FEED_4X5')
  }

  const findClip = useCallback((clipId: string): { scene: StudioScene; clip: StudioClip } | null => {
    if (!project) return null
    for (const scene of project.scenes) {
      const clip = scene.clips.find((c) => c.id === clipId)
      if (clip) return { scene, clip }
    }
    return null
  }, [project])

  const selected = selectedClipId ? findClip(selectedClipId) : null

  const patchClip = (clipId: string, patch: Partial<StudioClip>) => {
    if (!project) return
    const scenes = project.scenes.map((scene) => ({
      ...scene, clips: scene.clips.map((c) => (c.id === clipId ? { ...c, ...patch } : c)),
    }))
    replaceScenes(scenes)
  }

  const patchTransform = (clipId: string, patch: Partial<ClipTransform>) => {
    const found = findClip(clipId)
    if (!found) return
    patchClip(clipId, { transform: { ...found.clip.transform, ...patch } })
  }

  const activeSceneForInsert = useCallback((): StudioScene | null => {
    if (!project || project.scenes.length === 0) return null
    let elapsed = 0
    for (const scene of [...project.scenes].sort((a, b) => a.order - b.order)) {
      if (playheadMs < elapsed + scene.durationMs) return scene
      elapsed += scene.durationMs
    }
    return project.scenes[project.scenes.length - 1]
  }, [project, playheadMs])

  const insertAsset = (placeholderId: string, assetId: string | null, assetUrl: string | null) => {
    if (!project) return
    const scene = activeSceneForInsert()
    if (!scene) return
    const clip: StudioClip = {
      id: newClipId(), track: 'IMAGE', startMs: 0, durationMs: scene.durationMs,
      sourcePlaceholderId: placeholderId, assetId, assetUrl, text: null,
      transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1, focalX: 0.5, focalY: 0.5 },
      locked: false, muted: false, hidden: false,
    }
    replaceScenes(project.scenes.map((s) => (s.id === scene.id ? { ...s, clips: [...s.clips, clip] } : s)))
  }

  if (loading) {
    return <div className="h-full flex items-center justify-center text-white/40 text-sm">Cargando proyecto…</div>
  }
  if (error || !project) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 text-white/60 text-sm">
        <p>No se pudo cargar el proyecto{error ? `: ${error}` : ''}.</p>
        <button onClick={onBack} className="text-red-500 font-bold">← Volver al selector</button>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-[#0A0A0A] text-white">
      {/* Top bar */}
      <div className="h-12 flex items-center justify-between px-3 border-b border-white/10 flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={onBack} aria-label="Volver" className="text-white/50 hover:text-white flex-shrink-0"><ArrowLeft size={16} /></button>
          <input
            value={project.title}
            onChange={(e) => setTitle(e.target.value)}
            className="bg-transparent text-sm font-bold outline-none min-w-0 flex-1 focus:bg-white/5 rounded-sm px-1"
          />
          <span className="text-[10px] text-white/30 flex-shrink-0">v{project.version}</span>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <button onClick={undo} disabled={!canUndo} aria-label="Deshacer" className="text-white/50 hover:text-white disabled:opacity-20"><Undo2 size={15} /></button>
          <button onClick={redo} disabled={!canRedo} aria-label="Rehacer" className="text-white/50 hover:text-white disabled:opacity-20"><Redo2 size={15} /></button>
          <span className="text-[10px] text-white/30 w-16">{saving ? 'Guardando…' : 'Guardado'}</span>
          <button onClick={saveNow} className="text-[11px] font-bold bg-white/10 hover:bg-white/20 px-2.5 py-1 rounded-sm">Guardar</button>
          <button onClick={createVersion} className="text-[11px] font-bold bg-white/10 hover:bg-white/20 px-2.5 py-1 rounded-sm flex items-center gap-1">
            <Copy size={11} /> Nueva versión
          </button>
          <button disabled title="Exportar MP4 llega en la Fase 2 (voz/render real)" className="text-[11px] font-bold bg-white/5 text-white/30 px-2.5 py-1 rounded-sm cursor-not-allowed">
            Exportar
          </button>
          <button disabled title="LIVE llega en la Fase 4" className="text-[11px] font-bold bg-white/5 text-white/30 px-2.5 py-1 rounded-sm cursor-not-allowed">
            Live
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex">
        {/* Left: templates + assets */}
        <div className="w-64 flex-shrink-0 border-r border-white/10 flex flex-col">
          <div className="p-3 border-b border-white/10">
            <TemplatePicker activeTemplateId={project.templateId} mode={project.mode} onSelect={selectTemplate} />
          </div>
          <div className="flex-1 min-h-0">
            <AssetsPanel source={source} onInsert={insertAsset} />
          </div>
        </div>

        {/* Center: preview + format */}
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
            <FormatSwitcher
              format={isPremiumEditorial ? 'FEED_4X5' : project.format}
              locked={isPremiumEditorial}
              onChange={(f: CompositionFormat) => setFormat(f)}
            />
            <label className="flex items-center gap-1.5 text-[11px] text-white/50 cursor-pointer">
              <input type="checkbox" checked={showSafeArea} onChange={(e) => setShowSafeArea(e.target.checked)} className="accent-red-600" />
              Zona segura
            </label>
          </div>
          <div className="flex-1 min-h-0 p-4">
            <Preview
              project={project} source={source} template={template} categoryLabel={categoryLabel}
              format={isPremiumEditorial
                ? { canvasWidth: 1080, canvasHeight: 1350 }
                : { canvasWidth: safeArea?.canvasWidth ?? 1080, canvasHeight: safeArea?.canvasHeight ?? 1920 }}
              safeArea={safeArea} showSafeArea={showSafeArea}
              playheadMs={playheadMs} playing={playing}
              onSeek={setPlayheadMs} onTogglePlay={() => setPlaying((p) => !p)}
            />
          </div>
        </div>

        {/* Right: inspector */}
        <div className="w-64 flex-shrink-0 border-l border-white/10">
          <Inspector
            clip={selected?.clip ?? null}
            onUpdateClip={(patch) => selected && patchClip(selected.clip.id, patch)}
            onUpdateTransform={(patch) => selected && patchTransform(selected.clip.id, patch)}
          />
        </div>
      </div>

      {/* Bottom: timeline */}
      <div className="h-64 flex-shrink-0 border-t border-white/10">
        <Timeline
          scenes={project.scenes} onChangeScenes={replaceScenes}
          playheadMs={playheadMs} onSeek={setPlayheadMs}
          selectedClipId={selectedClipId} onSelectClip={setSelectedClipId}
        />
      </div>
    </div>
  )
}
