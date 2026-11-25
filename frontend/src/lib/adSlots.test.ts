import { describe, expect, it } from 'vitest'
import { creativeImage, deviceFor, normalizeAdSlots, shouldRender, shouldTrackImpression, sizeLabel } from './adSlots'

const raw = { slots: [
  { id: 's1', name: 'Feed 1', placement: 'feed-1', sizes: { mobile: [320, 100], tablet: [728, 90], desktop: [728, 90] }, enabled: true,
    creative: { campaignId: 42, imageMobile: 'https://cdn.x.com/m.png', imageTablet: null, imageDesktop: 'https://cdn.x.com/d.png', href: 'https://anunciante.com', alt: 'Promo', advertiser: 'Marca' } },
  { id: 's2', placement: 'sidebar', sizes: { mobile: null, tablet: null, desktop: [300, 600] }, enabled: false, creative: null },
  { id: 's3', placement: 'otro', sizes: {} },
  { id: 's4', placement: 'feed-2', sizes: { mobile: null, tablet: null, desktop: null } },
  { id: 's5', placement: 'feed-3', sizes: { mobile: [320, 100], tablet: [728, 90], desktop: [970, 250] }, creative: { imageMobile: 'javascript:x', href: 'x' } },
] }

describe('ad slots', () => {
  const slots = normalizeAdSlots(raw)
  it('keeps only well-formed slots and valid creatives', () => {
    expect(slots.map((s) => s.placement)).toEqual(['feed-1', 'sidebar', 'feed-3'])
    expect(slots[1].sizes.mobile).toBeNull()
    expect(slots[2].creative).toBeNull()
    expect(normalizeAdSlots({ detail: 'x' })).toEqual([])
  })

  it('picks the image per device with sensible fallback', () => {
    const c = slots[0].creative!
    expect(creativeImage(c, 'mobile')).toBe('https://cdn.x.com/m.png')
    expect(creativeImage(c, 'tablet')).toBe('https://cdn.x.com/d.png')
    expect(creativeImage(c, 'desktop')).toBe('https://cdn.x.com/d.png')
    expect([deviceFor(390), deviceFor(767), deviceFor(768), deviceFor(1279), deviceFor(1280)]).toEqual(['mobile', 'mobile', 'tablet', 'tablet', 'desktop'])
    expect(c.campaignId).toBe('42')
  })

  it('never renders empty frames except in admin preview, and respects per-device availability', () => {
    expect(shouldRender(slots[0], false, 'mobile')).toBe(true)
    expect(shouldRender(slots[1], false, 'desktop')).toBe(false) // apagada y sin campaña
    expect(shouldRender(slots[1], true, 'desktop')).toBe(true)
    expect(shouldRender(slots[1], true, 'mobile')).toBe(false) // la lateral no existe en móvil
    expect(shouldRender(undefined, true, 'mobile')).toBe(false)
    expect(sizeLabel(slots[0], 'mobile')).toBe('feed-1 · 320×100')
    expect(sizeLabel(slots[1], 'mobile')).toBe('sidebar · no aplica en móvil')
  })

  it('tracks one impression per campaign per page view, never in preview', () => {
    const seen = new Set<string>()
    expect(shouldTrackImpression(seen, '42', false)).toBe(true)
    expect(shouldTrackImpression(seen, '42', false)).toBe(false)
    expect(shouldTrackImpression(new Set(), '42', true)).toBe(false)
    expect(shouldTrackImpression(new Set(), null, false)).toBe(false)
  })
})
