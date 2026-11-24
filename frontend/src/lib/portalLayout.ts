// Lógica pura del contrato de Portada (types/portal.ts): normaliza lo que
// llega del backend o del admin (postMessage), ordena las historias según
// pinned/hidden y resuelve qué muestra realmente el Escenario. Nada de
// esto toca el DOM -- ver lib/usePortalLayout.ts para el fetch/polling.

import {
  DEFAULT_LAYOUT,
  PORTAL_MSG_LAYOUT,
  PORTAL_MSG_SCROLL,
  type PortalLayout,
  type PortalScrollTarget,
  type StageMode,
} from '@/types/portal'
import { detectAudioSource, detectVideoSource, parseHttpUrl, type AudioSource, type VideoSource } from '@/lib/streamSource'

const MODES: readonly StageMode[] = ['news', 'video', 'radio']
const SCROLL_TARGETS: readonly PortalScrollTarget[] = ['stage', 'feed', 'sports']
const MAX_IDS = 500

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function text(value: unknown, max = 300): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed.slice(0, max) : null
}

function httpUrl(value: unknown): string | null {
  return parseHttpUrl(value)?.toString() ?? null
}

function idList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  for (const item of value) {
    const id = typeof item === 'number' ? String(item) : text(item, 128)
    if (id && !seen.has(id)) seen.add(id)
    if (seen.size >= MAX_IDS) break
  }
  return [...seen]
}

export function defaultLayout(): PortalLayout {
  return { stage: { mode: DEFAULT_LAYOUT.stage.mode }, pinned: [], hidden: [] }
}

/**
 * Acepta el layout directo o envuelto en `{ layout: ... }`. Cada pieza
 * malformada cae a su valor de DEFAULT_LAYOUT, nunca rompe el portal.
 */
export function normalizeLayout(raw: unknown): PortalLayout {
  const src = isRecord(raw) && isRecord(raw.layout) ? raw.layout : raw
  if (!isRecord(src)) return defaultLayout()

  const stageRaw = isRecord(src.stage) ? src.stage : {}
  const mode = MODES.includes(stageRaw.mode as StageMode) ? (stageRaw.mode as StageMode) : 'news'
  const stage: PortalLayout['stage'] = { mode }

  if (isRecord(stageRaw.video)) {
    const url = httpUrl(stageRaw.video.url)
    if (url) stage.video = { url, title: text(stageRaw.video.title) ?? 'Transmisión en vivo', poster: httpUrl(stageRaw.video.poster) }
  }
  if (isRecord(stageRaw.radio)) {
    const url = httpUrl(stageRaw.radio.url)
    if (url) stage.radio = { url, title: text(stageRaw.radio.title) ?? 'Radio en vivo', logo: httpUrl(stageRaw.radio.logo) }
  }

  return {
    stage,
    pinned: idList(src.pinned),
    hidden: idList(src.hidden),
    updatedAt: text(src.updatedAt, 64),
  }
}

interface Orderable {
  id: string
  published_at?: string | null
}

function timeOf(item: Orderable): number {
  const t = item.published_at ? Date.parse(item.published_at) : NaN
  return Number.isFinite(t) ? t : 0
}

/**
 * Orden real del home: fijadas primero (en su orden), ocultas nunca, el
 * resto por recencia. Una oculta gana sobre una fijada. Deduplica por id.
 */
export function applyLayout<T extends Orderable>(items: T[], layout: Pick<PortalLayout, 'pinned' | 'hidden'>): T[] {
  const hidden = new Set(layout.hidden)
  const byId = new Map<string, T>()
  for (const item of items) {
    if (!item || hidden.has(item.id) || byId.has(item.id)) continue
    byId.set(item.id, item)
  }
  const pinned: T[] = []
  for (const id of layout.pinned) {
    const item = byId.get(id)
    if (item) { pinned.push(item); byId.delete(id) }
  }
  const rest = [...byId.values()].sort((a, b) => timeOf(b) - timeOf(a))
  return [...pinned, ...rest]
}

/** Ids fijados que todavía no están cargados (hay que pedirlos aparte). */
export function missingPinned(items: Orderable[], layout: Pick<PortalLayout, 'pinned' | 'hidden'>): string[] {
  const have = new Set(items.map((i) => i.id))
  const hidden = new Set(layout.hidden)
  return layout.pinned.filter((id) => !have.has(id) && !hidden.has(id))
}

export type ResolvedStage =
  | { mode: 'news' }
  | { mode: 'video'; title: string; poster: string | null; source: VideoSource; url: string }
  | { mode: 'radio'; title: string; logo: string | null; source: AudioSource }

/** Lo que el Escenario puede mostrar de verdad: una URL no reproducible vuelve a noticias. */
export function resolveStage(layout: PortalLayout): ResolvedStage {
  const { stage } = layout
  if (stage.mode === 'video' && stage.video) {
    const source = detectVideoSource(stage.video.url)
    if (source) return { mode: 'video', title: stage.video.title, poster: stage.video.poster ?? null, source, url: stage.video.url }
  }
  if (stage.mode === 'radio' && stage.radio) {
    const source = detectAudioSource(stage.radio.url)
    if (source) return { mode: 'radio', title: stage.radio.title, logo: stage.radio.logo ?? null, source }
  }
  return { mode: 'news' }
}

export type PortalMessage =
  | { type: 'layout'; layout: PortalLayout }
  | { type: 'scroll'; target: PortalScrollTarget }

/** Valida un mensaje del admin (solo mismo origen). Cualquier otra cosa: null. */
export function parsePortalMessage(origin: string, selfOrigin: string, data: unknown): PortalMessage | null {
  if (!origin || origin !== selfOrigin || !isRecord(data)) return null
  if (data.type === PORTAL_MSG_LAYOUT) return { type: 'layout', layout: normalizeLayout(data.layout) }
  if (data.type === PORTAL_MSG_SCROLL && SCROLL_TARGETS.includes(data.target as PortalScrollTarget)) {
    return { type: 'scroll', target: data.target as PortalScrollTarget }
  }
  return null
}

/** Firma estable para no re-renderizar cuando el polling trae lo mismo. */
export function layoutSignature(layout: PortalLayout): string {
  return JSON.stringify([layout.stage, layout.pinned, layout.hidden])
}
