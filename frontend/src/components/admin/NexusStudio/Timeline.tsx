'use client'

// Timeline multi-track real -- cada StudioClip vive en una escena y lleva
// su propio `track` (sección 8: VIDEO/IMAGES/TEXT/VOICE/MUSIC/SFX/
// OVERLAYS/CAPTIONS/BRANDING), nunca una entidad Track separada (ver
// StudioProject.entities -- decisión ya aprobada). Reordenar escenas usa
// botones ←/→ en vez de drag-and-drop de bloques -- drag real y
// determinístico para TRIM/MOVE dentro de una escena, reorder explícito
// y siempre-correcto para el orden de escenas (compromiso de alcance
// consciente, no una feature faltante).

import { useCallback, useMemo, useRef, useState } from 'react'
import {
  ChevronLeft, ChevronRight, Copy, Eye, EyeOff, Lock, Scissors, Trash2, Unlock, Volume2, VolumeX, ZoomIn, ZoomOut,
} from 'lucide-react'
import type { StudioClip, StudioScene, TrackType } from '@/types/studio'

const TRACK_ORDER: TrackType[] = [
  'VIDEO', 'IMAGE', 'TEXT', 'VOICE', 'MUSIC', 'SFX', 'OVERLAY', 'CAPTION', 'BRANDING',
]
const TRACK_LABEL: Record<TrackType, string> = {
  VIDEO: 'Video', IMAGE: 'Imágenes', TEXT: 'Texto', VOICE: 'Voz', MUSIC: 'Música', SFX: 'SFX',
  OVERLAY: 'Overlays', CAPTION: 'Captions', BRANDING: 'Marca',
}
const MIN_SCENE_MS = 500
const MAX_SCENE_MS = 15000
const MIN_PX_PER_SEC = 20
const MAX_PX_PER_SEC = 200

function sceneOffsets(scenes: StudioScene[]): Map<string, number> {
  const ordered = [...scenes].sort((a, b) => a.order - b.order)
  const offsets = new Map<string, number>()
  let acc = 0
  for (const s of ordered) { offsets.set(s.id, acc); acc += s.durationMs }
  return offsets
}

function newId(): string {
  return `clip-${Math.random().toString(36).slice(2, 10)}`
}

export default function Timeline({
  scenes, onChangeScenes, playheadMs, onSeek, selectedClipId, onSelectClip,
}: {
  scenes: StudioScene[]
  onChangeScenes: (scenes: StudioScene[]) => void
  playheadMs: number
  onSeek: (ms: number) => void
  selectedClipId: string | null
  onSelectClip: (id: string | null) => void
}) {
  const [pxPerSec, setPxPerSec] = useState(60)
  const trackAreaRef = useRef<HTMLDivElement>(null)
  const dragState = useRef<{
    kind: 'move' | 'trim-left' | 'trim-right'
    sceneId: string
    clipId: string
    startX: number
    originalStartMs: number
    originalDurationMs: number
  } | null>(null)

  const ordered = useMemo(() => [...scenes].sort((a, b) => a.order - b.order), [scenes])
  const offsets = useMemo(() => sceneOffsets(scenes), [scenes])
  const totalMs = Math.max(1, ordered.reduce((sum, s) => sum + s.durationMs, 0))
  const msToPx = (ms: number) => (ms / 1000) * pxPerSec

  const updateScene = useCallback((sceneId: string, updater: (scene: StudioScene) => StudioScene) => {
    onChangeScenes(scenes.map((s) => (s.id === sceneId ? updater(s) : s)))
  }, [scenes, onChangeScenes])

  const moveScene = (sceneId: string, direction: -1 | 1) => {
    const idx = ordered.findIndex((s) => s.id === sceneId)
    const swapIdx = idx + direction
    if (idx < 0 || swapIdx < 0 || swapIdx >= ordered.length) return
    const a = ordered[idx], b = ordered[swapIdx]
    onChangeScenes(scenes.map((s) => {
      if (s.id === a.id) return { ...s, order: b.order }
      if (s.id === b.id) return { ...s, order: a.order }
      return s
    }))
  }

  const deleteScene = (sceneId: string) => {
    onChangeScenes(scenes.filter((s) => s.id !== sceneId).map((s, i) => ({ ...s, order: i })))
  }

  const duplicateScene = (sceneId: string) => {
    const scene = scenes.find((s) => s.id === sceneId)
    if (!scene) return
    const clone: StudioScene = {
      ...scene, id: newId(), order: scene.order + 0.5,
      clips: scene.clips.map((c) => ({ ...c, id: newId() })),
    }
    const renumbered = [...scenes, clone]
      .sort((a, b) => a.order - b.order)
      .map((s, i) => ({ ...s, order: i }))
    onChangeScenes(renumbered)
  }

  const resizeScene = (sceneId: string, newDurationMs: number) => {
    const clamped = Math.min(MAX_SCENE_MS, Math.max(MIN_SCENE_MS, newDurationMs))
    updateScene(sceneId, (scene) => ({
      ...scene, durationMs: clamped,
      clips: scene.clips.map((c) => (
        c.durationMs === scene.durationMs ? { ...c, durationMs: clamped } : c
      )),
    }))
  }

  const updateClip = (sceneId: string, clipId: string, patch: Partial<StudioClip>) => {
    updateScene(sceneId, (scene) => ({
      ...scene, clips: scene.clips.map((c) => (c.id === clipId ? { ...c, ...patch } : c)),
    }))
  }

  const deleteClip = (sceneId: string, clipId: string) => {
    updateScene(sceneId, (scene) => ({ ...scene, clips: scene.clips.filter((c) => c.id !== clipId) }))
  }

  const duplicateClip = (sceneId: string, clip: StudioClip) => {
    updateScene(sceneId, (scene) => ({ ...scene, clips: [...scene.clips, { ...clip, id: newId() }] }))
  }

  const splitClipAtPlayhead = (sceneId: string, clip: StudioClip) => {
    const sceneOffset = offsets.get(sceneId) ?? 0
    const clipAbsStart = sceneOffset + clip.startMs
    const splitAt = playheadMs - clipAbsStart
    if (splitAt <= 0 || splitAt >= clip.durationMs) return
    const first: StudioClip = { ...clip, durationMs: splitAt }
    const second: StudioClip = { ...clip, id: newId(), startMs: clip.startMs + splitAt, durationMs: clip.durationMs - splitAt }
    updateScene(sceneId, (scene) => ({
      ...scene, clips: scene.clips.flatMap((c) => (c.id === clip.id ? [first, second] : [c])),
    }))
  }

  const onClipPointerDown = (
    e: React.PointerEvent, kind: 'move' | 'trim-left' | 'trim-right', sceneId: string, clip: StudioClip,
  ) => {
    e.stopPropagation()
    onSelectClip(clip.id)
    dragState.current = {
      kind, sceneId, clipId: clip.id, startX: e.clientX,
      originalStartMs: clip.startMs, originalDurationMs: clip.durationMs,
    }
    const onMove = (ev: PointerEvent) => {
      const drag = dragState.current
      if (!drag) return
      const deltaMs = ((ev.clientX - drag.startX) / pxPerSec) * 1000
      const scene = scenes.find((s) => s.id === drag.sceneId)
      if (!scene) return
      if (drag.kind === 'move') {
        const newStart = Math.min(
          Math.max(0, drag.originalStartMs + deltaMs), scene.durationMs - drag.originalDurationMs,
        )
        updateClip(drag.sceneId, drag.clipId, { startMs: Math.round(newStart) })
      } else if (drag.kind === 'trim-left') {
        const newStart = Math.min(Math.max(0, drag.originalStartMs + deltaMs), drag.originalStartMs + drag.originalDurationMs - 100)
        const newDuration = drag.originalStartMs + drag.originalDurationMs - newStart
        updateClip(drag.sceneId, drag.clipId, { startMs: Math.round(newStart), durationMs: Math.round(newDuration) })
      } else {
        const newDuration = Math.min(
          Math.max(100, drag.originalDurationMs + deltaMs), scene.durationMs - drag.originalStartMs,
        )
        updateClip(drag.sceneId, drag.clipId, { durationMs: Math.round(newDuration) })
      }
    }
    const onUp = () => {
      dragState.current = null
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const seekFromClientX = (clientX: number) => {
    const rect = trackAreaRef.current?.getBoundingClientRect()
    if (!rect) return
    const ms = ((clientX - rect.left) / pxPerSec) * 1000
    onSeek(Math.min(totalMs, Math.max(0, ms)))
  }

  return (
    <div className="flex flex-col h-full bg-[#0A0A0A] text-white select-none">
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-white/10 flex-shrink-0">
        <button onClick={() => setPxPerSec((p) => Math.max(MIN_PX_PER_SEC, p - 20))} aria-label="Alejar" className="text-white/60 hover:text-white">
          <ZoomOut size={14} />
        </button>
        <button onClick={() => setPxPerSec((p) => Math.min(MAX_PX_PER_SEC, p + 20))} aria-label="Acercar" className="text-white/60 hover:text-white">
          <ZoomIn size={14} />
        </button>
        <span className="text-[10px] text-white/40 ml-2">{(totalMs / 1000).toFixed(1)}s total</span>
      </div>

      <div className="flex-1 overflow-auto">
        <div style={{ width: msToPx(totalMs) + 200 }}>
          {/* Ruler + escenas */}
          <div
            className="relative h-9 border-b border-white/10 flex-shrink-0 ml-[140px] cursor-pointer"
            onClick={(e) => seekFromClientX(e.clientX)}
          >
            {ordered.map((scene) => {
              const offset = offsets.get(scene.id) ?? 0
              return (
                <div
                  key={scene.id}
                  className="absolute top-0 h-full border-r border-white/20 bg-white/[0.04] flex items-center justify-between px-1.5 group"
                  style={{ left: msToPx(offset), width: msToPx(scene.durationMs) }}
                >
                  <div className="flex items-center gap-0.5">
                    <button onClick={(e) => { e.stopPropagation(); moveScene(scene.id, -1) }} className="text-white/40 hover:text-white" aria-label="Mover escena a la izquierda">
                      <ChevronLeft size={12} />
                    </button>
                    <span className="text-[10px] font-bold text-white/70">#{scene.order + 1}</span>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={(e) => { e.stopPropagation(); duplicateScene(scene.id) }} aria-label="Duplicar escena" className="text-white/50 hover:text-white"><Copy size={11} /></button>
                    <button onClick={(e) => { e.stopPropagation(); deleteScene(scene.id) }} aria-label="Eliminar escena" className="text-white/50 hover:text-red-400"><Trash2 size={11} /></button>
                    <button onClick={(e) => { e.stopPropagation(); moveScene(scene.id, 1) }} className="text-white/40 hover:text-white" aria-label="Mover escena a la derecha">
                      <ChevronRight size={12} />
                    </button>
                  </div>
                  <div
                    className="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize"
                    onPointerDown={(e) => {
                      e.stopPropagation()
                      const startX = e.clientX
                      const original = scene.durationMs
                      const onMove = (ev: PointerEvent) => resizeScene(scene.id, original + ((ev.clientX - startX) / pxPerSec) * 1000)
                      const onUp = () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp) }
                      window.addEventListener('pointermove', onMove)
                      window.addEventListener('pointerup', onUp)
                    }}
                  />
                </div>
              )
            })}
          </div>

          {/* Tracks */}
          <div ref={trackAreaRef} className="relative">
            {TRACK_ORDER.map((track) => (
              <div key={track} className="flex border-b border-white/5" style={{ height: 44 }}>
                <div className="w-[140px] flex-shrink-0 flex items-center px-2 text-[11px] font-bold text-white/50 border-r border-white/10 sticky left-0 bg-[#0A0A0A] z-10">
                  {TRACK_LABEL[track]}
                </div>
                <div className="relative flex-1">
                  {ordered.map((scene) => {
                    const sceneOffset = offsets.get(scene.id) ?? 0
                    return scene.clips.filter((c) => c.track === track).map((clip) => {
                      const absStart = sceneOffset + clip.startMs
                      const selected = clip.id === selectedClipId
                      return (
                        <div
                          key={clip.id}
                          onPointerDown={(e) => onClipPointerDown(e, 'move', scene.id, clip)}
                          className={`absolute top-1 bottom-1 rounded-sm border flex items-center px-1.5 gap-1 cursor-grab overflow-hidden ${
                            selected ? 'border-red-500 bg-red-600/30' : 'border-white/15 bg-white/10 hover:bg-white/15'
                          } ${clip.hidden ? 'opacity-40' : ''}`}
                          style={{ left: msToPx(absStart), width: Math.max(24, msToPx(clip.durationMs)) }}
                        >
                          <div
                            className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize"
                            onPointerDown={(e) => onClipPointerDown(e, 'trim-left', scene.id, clip)}
                          />
                          <span className="text-[10px] truncate flex-1 pointer-events-none">
                            {clip.text || clip.sourcePlaceholderId || track}
                          </span>
                          {selected && (
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button onClick={(e) => { e.stopPropagation(); splitClipAtPlayhead(scene.id, clip) }} aria-label="Dividir" className="text-white/60 hover:text-white"><Scissors size={10} /></button>
                              <button onClick={(e) => { e.stopPropagation(); duplicateClip(scene.id, clip) }} aria-label="Duplicar clip" className="text-white/60 hover:text-white"><Copy size={10} /></button>
                              <button onClick={(e) => { e.stopPropagation(); updateClip(scene.id, clip.id, { locked: !clip.locked }) }} aria-label="Bloquear" className="text-white/60 hover:text-white">
                                {clip.locked ? <Lock size={10} /> : <Unlock size={10} />}
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); updateClip(scene.id, clip.id, { muted: !clip.muted }) }} aria-label="Silenciar" className="text-white/60 hover:text-white">
                                {clip.muted ? <VolumeX size={10} /> : <Volume2 size={10} />}
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); updateClip(scene.id, clip.id, { hidden: !clip.hidden }) }} aria-label="Ocultar" className="text-white/60 hover:text-white">
                                {clip.hidden ? <EyeOff size={10} /> : <Eye size={10} />}
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); deleteClip(scene.id, clip.id) }} aria-label="Eliminar clip" className="text-white/60 hover:text-red-400"><Trash2 size={10} /></button>
                            </div>
                          )}
                          <div
                            className="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize"
                            onPointerDown={(e) => onClipPointerDown(e, 'trim-right', scene.id, clip)}
                          />
                        </div>
                      )
                    })
                  })}
                </div>
              </div>
            ))}

            {/* Playhead */}
            <div
              className="absolute top-0 bottom-0 w-px bg-red-500 pointer-events-none z-20"
              style={{ left: 140 + msToPx(playheadMs) }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
