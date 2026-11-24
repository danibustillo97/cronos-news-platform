import { describe, expect, it } from 'vitest'
import { DEFAULT_LAYOUT } from '@/types/portal'
import { applyLayout, layoutSignature, missingPinned, normalizeLayout, parsePortalMessage, resolveStage } from './portalLayout'

const story = (id: string, published_at: string) => ({ id, published_at })

describe('normalizeLayout', () => {
  it('falls back to DEFAULT_LAYOUT on anything that is not an object', () => {
    for (const raw of [null, undefined, 'x', 42, [], true]) {
      expect(normalizeLayout(raw)).toEqual(DEFAULT_LAYOUT)
    }
  })

  it('accepts the layout directly or wrapped in { layout }', () => {
    const layout = { stage: { mode: 'news' }, pinned: ['a'], hidden: ['b'], updatedAt: '2026-11-24T10:00:00Z' }
    expect(normalizeLayout(layout)).toEqual({ ...layout, stage: { mode: 'news' } })
    expect(normalizeLayout({ layout })).toEqual(normalizeLayout(layout))
  })

  it('repairs each malformed piece independently', () => {
    const out = normalizeLayout({
      stage: { mode: 'tv', video: { url: 'javascript:alert(1)', title: 'x' } },
      pinned: ['a', '', 'a', 7, null, { id: 'z' }],
      hidden: 'b',
    })
    expect(out.stage).toEqual({ mode: 'news' })
    expect(out.pinned).toEqual(['a', '7'])
    expect(out.hidden).toEqual([])
    expect(out.updatedAt).toBeNull()
  })

  it('keeps valid video/radio config with default titles', () => {
    const out = normalizeLayout({
      stage: { mode: 'radio', radio: { url: 'https://radio.example.com/live.mp3', logo: 'not a url' }, video: { url: 'https://youtu.be/dQw4w9WgXcQ', title: '  Final  ' } },
    })
    expect(out.stage.radio).toEqual({ url: 'https://radio.example.com/live.mp3', title: 'Radio en vivo', logo: null })
    expect(out.stage.video).toEqual({ url: 'https://youtu.be/dQw4w9WgXcQ', title: 'Final', poster: null })
  })
})

describe('applyLayout', () => {
  const items = [
    story('old', '2026-11-20T10:00:00Z'),
    story('new', '2026-11-24T10:00:00Z'),
    story('mid', '2026-11-22T10:00:00Z'),
    story('bad-date', 'nope'),
  ]

  it('orders by recency without a layout', () => {
    expect(applyLayout(items, DEFAULT_LAYOUT).map((i) => i.id)).toEqual(['new', 'mid', 'old', 'bad-date'])
  })

  it('puts pinned first in their own order and drops hidden ones', () => {
    const out = applyLayout(items, { pinned: ['old', 'missing', 'mid'], hidden: ['new'] })
    expect(out.map((i) => i.id)).toEqual(['old', 'mid', 'bad-date'])
  })

  it('hidden wins over pinned and duplicates are removed', () => {
    const out = applyLayout([...items, story('new', '2026-11-25T00:00:00Z')], { pinned: ['new'], hidden: ['new'] })
    expect(out.map((i) => i.id)).toEqual(['mid', 'old', 'bad-date'])
  })

  it('reports pinned ids that still need to be fetched', () => {
    expect(missingPinned(items, { pinned: ['x', 'old', 'y'], hidden: ['y'] })).toEqual(['x'])
  })
})

describe('resolveStage', () => {
  it('falls back to news when the stream URL is not playable', () => {
    expect(resolveStage(normalizeLayout({ stage: { mode: 'video', video: { url: 'https://example.com/page', title: 't' } } }))).toEqual({ mode: 'news' })
    expect(resolveStage(normalizeLayout({ stage: { mode: 'video' } }))).toEqual({ mode: 'news' })
    expect(resolveStage(normalizeLayout({ stage: { mode: 'radio' } }))).toEqual({ mode: 'news' })
  })

  it('resolves video and radio stages', () => {
    const video = resolveStage(normalizeLayout({ stage: { mode: 'video', video: { url: 'https://cdn.x.com/live.m3u8', title: 'Clásico' } } }))
    expect(video).toMatchObject({ mode: 'video', title: 'Clásico', source: { kind: 'hls' } })
    expect(resolveStage(normalizeLayout({ stage: { mode: 'video', video: { url: 'https://kick.com/nexus', title: 'K' } } }))).toMatchObject({ mode: 'video', source: { kind: 'kick' } })
    const radio = resolveStage(normalizeLayout({ stage: { mode: 'radio', radio: { url: 'https://r.x.com/live.aac', title: 'Nexus Radio' } } }))
    expect(radio).toMatchObject({ mode: 'radio', title: 'Nexus Radio', source: { kind: 'native' } })
  })
})

describe('parsePortalMessage', () => {
  const self = 'https://nexusnews.info'

  it('ignores other origins and unknown messages', () => {
    expect(parsePortalMessage('https://evil.example', self, { type: 'nexus:portal-layout', layout: {} })).toBeNull()
    expect(parsePortalMessage('', self, { type: 'nexus:portal-layout' })).toBeNull()
    expect(parsePortalMessage(self, self, 'nexus:portal-layout')).toBeNull()
    expect(parsePortalMessage(self, self, { type: 'otro' })).toBeNull()
    expect(parsePortalMessage(self, self, null)).toBeNull()
  })

  it('validates draft layouts, falling back piece by piece', () => {
    const msg = parsePortalMessage(self, self, {
      type: 'nexus:portal-layout',
      layout: { stage: { mode: 'video', video: { url: 'https://youtu.be/dQw4w9WgXcQ', title: 'En vivo' } }, pinned: ['a'], hidden: 'x' },
    })
    expect(msg).toEqual({
      type: 'layout',
      layout: { stage: { mode: 'video', video: { url: 'https://youtu.be/dQw4w9WgXcQ', title: 'En vivo', poster: null } }, pinned: ['a'], hidden: [], updatedAt: null },
    })
    expect(parsePortalMessage(self, self, { type: 'nexus:portal-layout', layout: 'roto' })).toEqual({ type: 'layout', layout: DEFAULT_LAYOUT })
  })

  it('accepts only known scroll targets', () => {
    expect(parsePortalMessage(self, self, { type: 'nexus:portal-scroll-to', target: 'sports' })).toEqual({ type: 'scroll', target: 'sports' })
    expect(parsePortalMessage(self, self, { type: 'nexus:portal-scroll-to', target: 'footer' })).toBeNull()
  })

  it('produces a stable signature for identical layouts', () => {
    expect(layoutSignature(normalizeLayout({ pinned: ['a'] }))).toBe(layoutSignature(normalizeLayout({ pinned: ['a'], updatedAt: 'x' })))
  })
})
