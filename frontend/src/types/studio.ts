// Espejo real de backend/app/presentation/schemas.py's Studio* models --
// nunca un campo inventado que el backend no devuelve.

export type StudioMode = 'IMAGE' | 'REEL' | 'LIVE'
export type CompositionFormat = 'REEL_9X16' | 'FEED_4X5' | 'SQUARE_1X1' | 'LANDSCAPE_16X9'
export type StudioProjectStatus = 'DRAFT' | 'READY'
export type TrackType = 'VIDEO' | 'IMAGE' | 'TEXT' | 'VOICE' | 'MUSIC' | 'SFX' | 'OVERLAY' | 'CAPTION' | 'BRANDING'
export type TemplateElementKind =
  | 'HEADLINE' | 'SUBTITLE' | 'CATEGORY_PILL' | 'IMAGE' | 'LOGO' | 'METADATA' | 'ACCENT_BAR' | 'BACKGROUND'
  | 'FOOTER_BRANDING'

export interface ClipTransform {
  x: number
  y: number
  scale: number
  rotation: number
  opacity: number
  focalX: number
  focalY: number
}

export interface StudioClip {
  id: string
  track: TrackType
  startMs: number
  durationMs: number
  sourcePlaceholderId: string | null
  assetId: string | null
  assetUrl: string | null
  text: string | null
  transform: ClipTransform
  locked: boolean
  muted: boolean
  hidden: boolean
}

export interface StudioScene {
  id: string
  order: number
  durationMs: number
  clips: StudioClip[]
}

export interface StudioProject {
  id: string
  sourceArtifactId: string
  mode: StudioMode
  templateId: string
  format: CompositionFormat
  status: StudioProjectStatus
  version: number
  parentProjectId: string | null
  title: string
  scenes: StudioScene[]
  totalDurationMs: number
  createdAt: string
  updatedAt: string
}

export interface TemplateElement {
  id: string
  kind: TemplateElementKind
  track: TrackType
  x: number
  y: number
  width: number
  height: number
  fontRole: string | null
  colorRole: string | null
  zIndex: number
}

export interface TemplateSafeArea {
  top: number
  right: number
  bottom: number
  left: number
}

export interface Template {
  id: string
  name: string
  description: string
  accentColor: string
  latestVersion: {
    version: number
    elements: TemplateElement[]
    safeArea: TemplateSafeArea
  }
}

export interface SafeArea {
  format: CompositionFormat
  canvasWidth: number
  canvasHeight: number
  insets: { top: number; right: number; bottom: number; left: number }
  source: string
}

// Lo que el content selector necesita de un Artifact real
// (GET /api/artifacts?status=PUBLISHED) -- subconjunto de ArtifactOut.
export interface StudioSourceArtifact {
  id: string
  title: string
  subtitle: string | null
  excerpt: string
  summary: string
  status: string
  categoryId: string | null
  tags: string[]
  createdAt: string
  publishedAt: string | null
  location?: string | null
  mediaRequirements: {
    placeholderId: string
    kind: 'FEATURE_IMAGE' | 'BODY_IMAGE' | 'VIDEO'
    assetId: string | null
    assetUrl: string | null
    caption: string | null
    altText: string | null
    assetProvenance: string | null
  }[]
}
