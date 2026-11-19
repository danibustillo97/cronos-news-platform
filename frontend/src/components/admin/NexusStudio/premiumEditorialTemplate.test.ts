import { describe, expect, it, vi } from 'vitest'
import { renderPremiumEditorial } from './premiumEditorialTemplate'

function makeContext() {
  const fillText = vi.fn()
  const fillRect = vi.fn()
  const context = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: 'left',
    textBaseline: 'top',
    imageSmoothingEnabled: false,
    imageSmoothingQuality: 'low',
    measureText: (text: string) => {
      const fontSize = Number(/(\d+)px/.exec(context.font)?.[1] ?? 16)
      return { width: Array.from(text).length * fontSize * 0.5 } as TextMetrics
    },
    fillText,
    fillRect,
    strokeRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    arcTo: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
  } as unknown as CanvasRenderingContext2D

  return { context, fillText, fillRect }
}

describe('Premium Editorial publication renderer', () => {
  it('renders the dynamic article fields and the fixed 4:5 canvas size', () => {
    const { context, fillText, fillRect } = makeContext()

    renderPremiumEditorial(context, {
      title: 'Titular real del artículo',
      category: 'Noticias',
      status: 'Publicada',
      summary: 'Resumen real del artículo.',
      publishedAt: '2026-03-01T15:30:00Z',
      readMinutes: 2,
      location: 'Bogotá',
    }, '#D84A52', null, null)

    const renderedText = fillText.mock.calls.map(([text]) => String(text))
    expect(fillRect).toHaveBeenCalledWith(0, 0, 1080, 1350)
    expect(renderedText).toContain('NOTICIAS')
    expect(renderedText).toContain('PUBLICADA')
    expect(renderedText).toContain('Titular real del artículo')
    expect(renderedText).toContain('Resumen real del artículo.')
    expect(renderedText).toContain('Bogotá')
    expect(renderedText).toContain('2 min de lectura')
  })

  it('wraps and truncates extremely long unbroken headlines within the layout', () => {
    const { context, fillText } = makeContext()

    renderPremiumEditorial(context, {
      title: 'A'.repeat(160),
      category: null,
      status: null,
      summary: null,
      publishedAt: null,
      readMinutes: 0,
      location: null,
    }, '#9466D8', null, null)

    expect(fillText.mock.calls.some(([text]) => String(text).endsWith('…'))).toBe(true)
  })
})
