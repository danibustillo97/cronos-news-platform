// Espacios publicitarios con nombre (admin "Anuncios"):
//   GET /api/ads/slots -> { slots: AdSlotDef[] }
// Cada ubicación tiene medidas exactas por dispositivo y, si hay campaña,
// una imagen por dispositivo.

export type AdPlacement = 'home-top' | 'feed-1' | 'feed-2' | 'feed-3' | 'sidebar' | 'article-inline' | 'article-bottom' | 'match-modal'
export type Device = 'mobile' | 'tablet' | 'desktop'
export type Size = [number, number]

export interface AdCreative { campaignId: string | null; imageMobile: string | null; imageTablet: string | null; imageDesktop: string | null; href: string | null; alt: string; advertiser: string | null }
/** `sizes[device]` null = esa ubicación no existe en ese dispositivo (p. ej. la lateral solo en escritorio). */
export interface AdSlotDef { id: string; name: string; placement: AdPlacement; sizes: Record<Device, Size | null>; enabled: boolean; creative: AdCreative | null }

/** Dónde caen las ubicaciones del feed: después de la 4.ª, 10.ª y 16.ª pieza. */
export const FEED_AD_AFTER: Record<'feed-1' | 'feed-2' | 'feed-3', number> = { 'feed-1': 4, 'feed-2': 10, 'feed-3': 16 }

export const PLACEMENTS: readonly AdPlacement[] = ['home-top', 'feed-1', 'feed-2', 'feed-3', 'sidebar', 'article-inline', 'article-bottom', 'match-modal']
const DEVICES: readonly Device[] = ['mobile', 'tablet', 'desktop']
export const DEVICE_LABEL: Record<Device, string> = { mobile: 'móvil', tablet: 'tablet', desktop: 'escritorio' }

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}
function url(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim()
  if (t.startsWith('/')) return t
  try { const u = new URL(t); return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null } catch { return null }
}
function size(v: unknown): Size | null {
  return Array.isArray(v) && v.length === 2 && v.every((n) => typeof n === 'number' && n > 0 && n <= 4000) ? [Math.round(v[0]), Math.round(v[1])] : null
}

export function normalizeAdSlots(raw: unknown): AdSlotDef[] {
  const list = isRecord(raw) && Array.isArray(raw.slots) ? raw.slots : []
  const out: AdSlotDef[] = []
  for (const s of list) {
    if (!isRecord(s) || !PLACEMENTS.includes(s.placement as AdPlacement)) continue
    const sz = isRecord(s.sizes) ? s.sizes : {}
    const sizes = Object.fromEntries(DEVICES.map((d) => [d, size(sz[d])])) as Record<Device, Size | null>
    if (DEVICES.every((d) => !sizes[d])) continue
    const c = isRecord(s.creative) ? s.creative : null
    const creative: AdCreative | null = c ? {
      campaignId: typeof c.campaignId === 'string' || typeof c.campaignId === 'number' ? String(c.campaignId) : null,
      imageMobile: url(c.imageMobile), imageTablet: url(c.imageTablet), imageDesktop: url(c.imageDesktop),
      href: url(c.href), alt: typeof c.alt === 'string' && c.alt.trim() ? c.alt.trim().slice(0, 200) : 'Publicidad',
      advertiser: typeof c.advertiser === 'string' && c.advertiser.trim() ? c.advertiser.trim().slice(0, 80) : null,
    } : null
    out.push({
      id: typeof s.id === 'string' ? s.id : String(s.placement), name: typeof s.name === 'string' ? s.name : String(s.placement),
      placement: s.placement as AdPlacement, sizes, enabled: s.enabled !== false,
      creative: creative && (creative.imageMobile || creative.imageTablet || creative.imageDesktop) ? creative : null,
    })
  }
  return out
}

/** Imagen para un dispositivo; si falta, la del tamaño más cercano. */
export function creativeImage(c: AdCreative, device: Device): string | null {
  const order: Record<Device, (keyof AdCreative)[]> = {
    mobile: ['imageMobile', 'imageTablet', 'imageDesktop'],
    tablet: ['imageTablet', 'imageDesktop', 'imageMobile'],
    desktop: ['imageDesktop', 'imageTablet', 'imageMobile'],
  }
  for (const k of order[device]) { const v = c[k]; if (typeof v === 'string' && v) return v }
  return null
}

/** Cortes del admin: móvil < 768, tablet 768-1279, escritorio ≥ 1280. */
export function deviceFor(width: number): Device {
  return width >= 1280 ? 'desktop' : width >= 768 ? 'tablet' : 'mobile'
}

/** "feed-1 · 320×100 móvil" (etiqueta para la vista previa del admin). */
export function sizeLabel(slot: Pick<AdSlotDef, 'placement' | 'sizes'>, device: Device): string {
  const sz = slot.sizes[device]
  return sz ? `${slot.placement} · ${sz[0]}×${sz[1]}` : `${slot.placement} · no aplica en ${DEVICE_LABEL[device]}`
}

/** ¿Se muestra? Solo si está activa y tiene campaña (nunca marcos vacíos fuera de la vista previa). */
export function shouldRender(slot: AdSlotDef | undefined, preview: boolean, device: Device): boolean {
  if (!slot || !slot.sizes[device]) return false
  if (preview) return true
  return slot.enabled && slot.creative !== null && creativeImage(slot.creative, device) !== null
}

/** Una impresión por campaña y vista de página. */
export function shouldTrackImpression(seen: Set<string>, campaignId: string | null, preview: boolean): boolean {
  if (preview || !campaignId || seen.has(campaignId)) return false
  seen.add(campaignId)
  return true
}
