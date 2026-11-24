'use client'

// Preview real -- dibuja la escena activa en el playhead usando el
// mismo toolkit Canvas2D real que ya usa el editor viejo
// (SocialMedia/services/canvas/{primitives,logo}.ts), nunca una segunda
// implementación de dibujo. El playhead es CONTROLADO desde StudioShell
// (mismo estado que usa Timeline para su línea) -- antes este componente
// tenía su propio estado interno y quedaba desincronizado del timeline,
// que es exactamente el bug reportado ("la línea no camina"). Las
// imágenes se cargan a través de /api/proxy-image (mismo proxy
// same-origin que ya usa todo el resto del sitio para evitar canvas
// "tainted" por CORS) -- cargarlas directo desde el backend en otro
// puerto, como hacía la versión anterior, es lo que dejaba las escenas
// de imágenes del cuerpo en negro.

import { useEffect, useRef, useState } from 'react'
import { Download, FileArchive, Pause, Play, Maximize2, SkipBack, SkipForward } from 'lucide-react'
import { wrapText } from '@/components/admin/SocialMedia/services/canvas/text'
import { drawLogo } from '@/components/admin/SocialMedia/services/canvas/logo'
import { renderPremiumEditorial } from '@/components/admin/NexusStudio/premiumEditorialTemplate'
import { proxiedImage } from '@/lib/media'
import { estimateReadMinutes } from '@/lib/readTime'
import { createCarouselZip } from '@/components/admin/NexusStudio/carouselZip'
import type { SafeArea, StudioProject, StudioScene, StudioSourceArtifact, Template, TemplateElement } from '@/types/studio'

const COLOR_ROLE_FALLBACK: Record<string, string> = { ink: '#161616', white: '#FFFFFF', muted: '#999999' }
const FONT_ROLE: Record<string, string> = {
  display: '900 56px Arial', body: '600 30px Arial', caption: '800 22px Arial', metadata: '500 22px Arial',
}

function resolveColor(role: string | null, accentColor: string): string {
  if (role === 'accent') return accentColor
  return COLOR_ROLE_FALLBACK[role ?? 'white'] ?? '#FFFFFF'
}

function drawImageCoverFocal(
  ctx: CanvasRenderingContext2D, img: HTMLImageElement,
  x: number, y: number, w: number, h: number, focalX: number, focalY: number,
) {
  const ratio = Math.max(w / img.naturalWidth, h / img.naturalHeight)
  const drawW = img.naturalWidth * ratio
  const drawH = img.naturalHeight * ratio
  // Center the crop on the real focal point instead of always the
  // geometric center -- section 12's "mantener focal point de imágenes".
  const cx = x - (drawW - w) * focalX
  const cy = y - (drawH - h) * focalY
  ctx.save()
  ctx.beginPath()
  ctx.rect(x, y, w, h)
  ctx.clip()
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, cx, cy, drawW, drawH)
  ctx.restore()
}

function activeScene(project: StudioProject, playheadMs: number): StudioScene | null {
  let elapsed = 0
  for (const scene of [...project.scenes].sort((a, b) => a.order - b.order)) {
    if (playheadMs < elapsed + scene.durationMs + 0.0001) return scene
    elapsed += scene.durationMs
  }
  return project.scenes[project.scenes.length - 1] ?? null
}

type ImageStatus = { state: 'loading' | 'loaded' | 'error'; img: HTMLImageElement }
const imageCache = new Map<string, ImageStatus>()

// Devuelve la imagen si ya está lista; si no, la empieza a cargar (una
// sola vez por URL) y llama a onReady cuando termine (ok o error) para
// que el caller repinte. Nunca deja un estado "loading" colgado para
// siempre -- onerror también resuelve.
function loadImage(proxiedUrl: string, onReady: () => void): HTMLImageElement | null {
  const cached = imageCache.get(proxiedUrl)
  if (cached?.state === 'loaded') return cached.img
  if (cached) return null
  const img = new window.Image()
  const entry: ImageStatus = { state: 'loading', img }
  imageCache.set(proxiedUrl, entry)
  img.onload = () => { entry.state = 'loaded'; onReady() }
  img.onerror = () => { entry.state = 'error'; onReady() }
  img.src = proxiedUrl
  return null
}

function preloadImage(proxiedUrl: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(proxiedUrl)
  if (cached?.state === 'loaded') return Promise.resolve(cached.img)
  if (cached?.state === 'error') return Promise.reject(new Error('No se pudo cargar una imagen del carrusel.'))

  return new Promise((resolve, reject) => {
    const finish = () => {
      const entry = imageCache.get(proxiedUrl)
      if (entry?.state === 'loaded' && entry.img.naturalWidth > 0) resolve(entry.img)
      else reject(new Error('No se pudo cargar una imagen del carrusel.'))
    }

    if (cached) {
      if (cached.img.complete) {
        finish()
        return
      }
      cached.img.addEventListener('load', finish, { once: true })
      cached.img.addEventListener('error', finish, { once: true })
      return
    }

    const img = new window.Image()
    const entry: ImageStatus = { state: 'loading', img }
    imageCache.set(proxiedUrl, entry)
    img.onload = () => { entry.state = 'loaded'; resolve(img) }
    img.onerror = () => {
      entry.state = 'error'
      reject(new Error('No se pudo cargar una imagen del carrusel.'))
    }
    img.src = proxiedUrl
  })
}

function sceneImageUrls(
  scene: StudioScene,
  source: StudioSourceArtifact | null,
  isPremiumEditorial: boolean,
): string[] {
  if (isPremiumEditorial) {
    const feature = source?.mediaRequirements.find((media) => media.kind === 'FEATURE_IMAGE')
    const featureClip = feature && scene.clips.find(
      (clip) => clip.track === 'IMAGE' && clip.sourcePlaceholderId === feature.placeholderId,
    )
    const featureUrl = featureClip
      ? featureClip.hidden ? null : featureClip.assetUrl ?? feature?.assetUrl
      : feature?.assetUrl
    const image = proxiedImage(featureUrl)
    return image ? [image] : []
  }

  const imageClip = scene.clips.find((clip) => clip.track === 'IMAGE' && !clip.hidden)
  const image = imageClip?.assetUrl ? proxiedImage(imageClip.assetUrl) : null
  return image ? [image] : []
}

function waitForPaint(): Promise<void> {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()))
  })
}

function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('No se pudo generar el PNG de una diapositiva.'))
    }, 'image/png')
  })
}

function safeFilename(value: string): string {
  return value.normalize('NFD')
    .replace(/[\\u0300-\\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase() || 'publicacion'
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1500)
}

export default function Preview({
  project, source, template, format, categoryLabel, safeArea, showSafeArea,
  playheadMs, playing, onSeek, onTogglePlay,
}: {
  project: StudioProject
  source: StudioSourceArtifact | null
  template: Template | null
  format: { canvasWidth: number; canvasHeight: number }
  categoryLabel: string | null
  safeArea: SafeArea | null
  showSafeArea: boolean
  playheadMs: number
  playing: boolean
  onSeek: (ms: number) => void
  onTogglePlay: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [exportError, setExportError] = useState<string | null>(null)
  const [exportingCarousel, setExportingCarousel] = useState(false)
  const [exportProgress, setExportProgress] = useState(0)
  const [featuredImageStatus, setFeaturedImageStatus] = useState<'ready' | 'loading' | 'error'>('ready')
  const totalMs = project.totalDurationMs || 1
  const isPremiumEditorial = project.mode === 'IMAGE' && project.templateId.startsWith('nexus_editorial_premium_')

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = format.canvasWidth
    canvas.height = format.canvasHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    render(ctx, canvas.width, canvas.height)

    function render(ctx: CanvasRenderingContext2D, w: number, h: number) {
      ctx.fillStyle = '#0A0A0A'
      ctx.fillRect(0, 0, w, h)

      const scene = activeScene(project, playheadMs)
      if (!scene || !template) return
      const accentColor = template.accentColor

      if (isPremiumEditorial) {
        if (!source) {
          setFeaturedImageStatus('loading')
          return
        }
        const feature = source.mediaRequirements.find((media) => media.kind === 'FEATURE_IMAGE')
        const featureClip = feature && scene.clips.find(
          (clip) => clip.track === 'IMAGE' && clip.sourcePlaceholderId === feature.placeholderId,
        )
        const featureUrl = featureClip
          ? featureClip.hidden ? null : featureClip.assetUrl ?? feature?.assetUrl
          : feature?.assetUrl
        const imageSrc = proxiedImage(featureUrl)
        const featuredImage = imageSrc
          ? loadImage(imageSrc, () => {
            const status = imageCache.get(imageSrc)?.state
            setFeaturedImageStatus(status === 'loaded' ? 'ready' : 'error')
            const currentCanvas = canvasRef.current
            const currentContext = currentCanvas?.getContext('2d')
            if (currentCanvas && currentContext) render(currentContext, currentCanvas.width, currentCanvas.height)
          })
          : null
        const imageState = imageSrc ? imageCache.get(imageSrc)?.state : 'error'
        setFeaturedImageStatus(imageState === 'loaded' ? 'ready' : imageState === 'error' ? 'error' : 'loading')
        const logoSrc = proxiedImage(process.env.NEXT_PUBLIC_BRAND_LOGO_URL)
        const brandLogo = logoSrc
          ? loadImage(logoSrc, () => {
            const currentCanvas = canvasRef.current
            const currentContext = currentCanvas?.getContext('2d')
            if (currentCanvas && currentContext) render(currentContext, currentCanvas.width, currentCanvas.height)
          })
          : null

        renderPremiumEditorial(ctx, {
          title: source.title,
          category: categoryLabel,
          status: source.status,
          summary: source.subtitle || source.excerpt || source.summary || null,
          publishedAt: source.publishedAt || source.createdAt,
          readMinutes: estimateReadMinutes(source.summary, source.excerpt),
          location: source.location || null,
        }, accentColor, featuredImage, brandLogo)
        return
      }

      const elements = template.latestVersion.elements
      for (const el of [...elements].sort((a, b) => a.zIndex - b.zIndex)) {
        drawElement(ctx, el, scene, w, h, accentColor)
      }
    }

    function drawElement(
      ctx: CanvasRenderingContext2D, el: TemplateElement, scene: StudioScene, w: number, h: number, accentColor: string,
    ) {
      const rectX = el.x * w, rectY = el.y * h, rectW = el.width * w, rectH = el.height * h

      if (el.kind === 'BACKGROUND' || el.kind === 'IMAGE') {
        const clip = scene.clips.find((c) => c.track === 'IMAGE' && !c.hidden)
        const src = clip?.assetUrl ? proxiedImage(clip.assetUrl) : null
        if (src) {
          const img = loadImage(src, () => render(ctx, canvasRef.current!.width, canvasRef.current!.height))
          if (img) drawImageCoverFocal(ctx, img, rectX, rectY, rectW, rectH, clip!.transform.focalX, clip!.transform.focalY)
        }
        return
      }
      if (el.kind === 'ACCENT_BAR') {
        ctx.fillStyle = resolveColor(el.colorRole, accentColor)
        ctx.fillRect(rectX, rectY, rectW, rectH)
        return
      }
      if (el.kind === 'CATEGORY_PILL') {
        if (!categoryLabel) return
        ctx.font = FONT_ROLE[el.fontRole ?? 'caption']
        ctx.fillStyle = resolveColor(el.colorRole, accentColor)
        ctx.textBaseline = 'top'
        ctx.fillText(categoryLabel.toUpperCase(), rectX, rectY)
        return
      }
      if (el.kind === 'HEADLINE' || el.kind === 'SUBTITLE') {
        const clip = scene.clips.find((c) => c.track === 'TEXT' && !c.hidden)
        if (!clip?.text) return
        ctx.font = FONT_ROLE[el.fontRole ?? 'display']
        ctx.fillStyle = resolveColor(el.colorRole, accentColor)
        ctx.textBaseline = 'top'
        const fontSizeMatch = /(\d+)px/.exec(ctx.font)
        const lineHeight = (fontSizeMatch ? parseInt(fontSizeMatch[1], 10) : 40) * 1.15
        wrapText(ctx, clip.text, rectX, rectY, rectW, lineHeight)
        return
      }
      if (el.kind === 'METADATA') {
        ctx.font = FONT_ROLE[el.fontRole ?? 'metadata']
        ctx.fillStyle = resolveColor(el.colorRole, accentColor)
        ctx.textBaseline = 'top'
        ctx.fillText(project.title, rectX, rectY)
        return
      }
      if (el.kind === 'LOGO' || el.kind === 'FOOTER_BRANDING') {
        const scale = rectW / 260
        drawLogo(ctx, rectX, rectY, scale > 0 ? scale : 0.5, false)
        return
      }
    }
  }, [project, source, template, format, playheadMs, categoryLabel, isPremiumEditorial])

  const frameMs = 1000 / 30

  const downloadImage = async () => {
    const scene = activeScene(project, playheadMs)
    const canvas = canvasRef.current
    if (!scene || !canvas) {
      setExportError('No hay una diapositiva lista para exportar.')
      return
    }

    if (isPremiumEditorial && featuredImageStatus !== 'ready') {
      setExportError(featuredImageStatus === 'loading'
        ? 'Espera a que termine de cargar la imagen destacada.'
        : 'No se pudo cargar la imagen destacada; no se exportó la publicación.')
      return
    }

    try {
      const urls = sceneImageUrls(scene, source, isPremiumEditorial)
      if (isPremiumEditorial && urls.length === 0) {
        throw new Error('La diapositiva no tiene una imagen destacada disponible.')
      }
      await Promise.all(urls.map(preloadImage))
      await waitForPaint()
      const blob = await canvasToPng(canvas)
      downloadBlob(blob, `${safeFilename(project.title)}-slide-${scene.order + 1}.png`)
      setExportError(null)
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'No se pudo exportar la diapositiva.')
    }
  }

  const downloadCarousel = async () => {
    if (exportingCarousel) return
    const scenes = [...project.scenes].sort((a, b) => a.order - b.order)
    if (project.mode !== 'IMAGE' || scenes.length < 2) {
      setExportError('Un carrusel necesita al menos dos diapositivas en un proyecto de imagen.')
      return
    }
    if (!template) {
      setExportError('No hay una plantilla lista para exportar el carrusel.')
      return
    }
    if (isPremiumEditorial && !source) {
      setExportError('No se pudo cargar el contenido original de la publicación.')
      return
    }

    const originalPlayhead = playheadMs
    const resumePlayback = playing
    const files: { name: string; data: Uint8Array }[] = []
    const baseName = safeFilename(project.title)
    let sceneOffset = 0

    setExportingCarousel(true)
    setExportProgress(0)
    setExportError(null)
    if (resumePlayback) onTogglePlay()

    try {
      for (let index = 0; index < scenes.length; index += 1) {
        const scene = scenes[index]
        const urls = sceneImageUrls(scene, source, isPremiumEditorial)
        if (isPremiumEditorial && urls.length === 0) {
          throw new Error(`La diapositiva ${index + 1} no tiene una imagen destacada disponible.`)
        }

        // Load the real assets before seeking; later scenes must never be
        // exported as blank frames just because they were not previewed yet.
        await Promise.all(urls.map(preloadImage))
        onSeek(sceneOffset)
        await waitForPaint()

        const canvas = canvasRef.current
        if (!canvas) throw new Error('No se encontró el lienzo de exportación.')
        const blob = await canvasToPng(canvas)
        files.push({
          name: `${baseName}-slide-${String(index + 1).padStart(2, '0')}.png`,
          data: new Uint8Array(await blob.arrayBuffer()),
        })
        setExportProgress(index + 1)
        sceneOffset += scene.durationMs
      }

      const archive = createCarouselZip(files)
      downloadBlob(archive, `${baseName}-carrusel.zip`)
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'No se pudo exportar el carrusel completo.')
    } finally {
      onSeek(originalPlayhead)
      if (resumePlayback) onTogglePlay()
      setExportingCarousel(false)
    }
  }
  return (
    <div ref={containerRef} className="flex flex-col items-center gap-3 h-full justify-center">
      <div
        className="relative bg-black rounded-sm overflow-hidden shadow-2xl"
        style={{ aspectRatio: `${format.canvasWidth} / ${format.canvasHeight}`, maxHeight: '70vh', maxWidth: '100%' }}
      >
        <canvas ref={canvasRef} className="w-full h-full block" />
        {showSafeArea && safeArea && (
          <div
            aria-hidden="true"
            className="absolute pointer-events-none border-2 border-dashed border-red-500"
            style={{
              top: `${(safeArea.insets.top / safeArea.canvasHeight) * 100}%`,
              right: `${(safeArea.insets.right / safeArea.canvasWidth) * 100}%`,
              bottom: `${(safeArea.insets.bottom / safeArea.canvasHeight) * 100}%`,
              left: `${(safeArea.insets.left / safeArea.canvasWidth) * 100}%`,
            }}
          />
        )}
      </div>

      <div className="flex items-center gap-3 text-white/80">
        <button onClick={() => onSeek(Math.max(0, playheadMs - frameMs))} aria-label="Frame anterior" className="hover:text-white">
          <SkipBack size={16} />
        </button>
        <button
          onClick={onTogglePlay}
          aria-label={playing ? 'Pausar' : 'Reproducir'}
          className="bg-red-600 hover:bg-red-700 text-white rounded-full p-2 transition-colors"
        >
          {playing ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <button onClick={() => onSeek(Math.min(totalMs, playheadMs + frameMs))} aria-label="Frame siguiente" className="hover:text-white">
          <SkipForward size={16} />
        </button>
        <input
          type="range" min={0} max={totalMs} value={playheadMs}
          onChange={(e) => onSeek(Number(e.target.value))}
          className="w-64 accent-red-600"
          aria-label="Buscar en la línea de tiempo"
        />
        <span className="text-xs tabular-nums text-white/50">
          {(playheadMs / 1000).toFixed(1)}s / {(totalMs / 1000).toFixed(1)}s
        </span>
        <button
          onClick={() => containerRef.current?.requestFullscreen?.()}
          aria-label="Pantalla completa"
          className="hover:text-white"
        >
          <Maximize2 size={16} />
        </button>
        {project.mode === 'IMAGE' && (
          <>
            <button
              onClick={() => void downloadImage()}
              disabled={exportingCarousel || (isPremiumEditorial && featuredImageStatus !== 'ready')}
              aria-label="Exportar diapositiva PNG"
              title="Descargar la diapositiva actual como PNG"
              className="hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Download size={16} />
            </button>
            {project.scenes.length > 1 && (
              <button
                onClick={() => void downloadCarousel()}
                disabled={exportingCarousel || (isPremiumEditorial && featuredImageStatus !== 'ready')}
                aria-label="Exportar carrusel ZIP"
                title={exportingCarousel
                  ? `Exportando diapositiva ${exportProgress} de ${project.scenes.length}`
                  : `Descargar las ${project.scenes.length} diapositivas en un ZIP`}
                className="inline-flex items-center gap-1.5 rounded-sm px-2 py-1 text-[10px] font-semibold text-white/80 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <FileArchive size={15} />
                {exportingCarousel ? `${exportProgress}/${project.scenes.length}` : 'Carrusel ZIP'}
              </button>
            )}
          </>
        )}
      </div>
      {isPremiumEditorial && featuredImageStatus === 'error' && (
        <p role="alert" className="text-xs text-red-400">Falta o no se pudo cargar la imagen destacada; la exportación está deshabilitada.</p>
      )}
      {exportError && <p role="alert" className="text-xs text-red-400">{exportError}</p>}
    </div>
  )
}
