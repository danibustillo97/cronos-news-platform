import { describe, expect, it } from 'vitest'
import { buildArticleSeoTitle } from './seoTitle'

describe('buildArticleSeoTitle', () => {
  it('adds the brand to a short headline', () => {
    expect(buildArticleSeoTitle('Junior ganó el clásico')).toBe('Junior ganó el clásico | Nexus News')
  })

  it('keeps long search titles within the configured display limit', () => {
    const result = buildArticleSeoTitle('Final de la Copa Libertadores 2026: fecha y sede confirmadas')
    expect(result.length).toBeLessThanOrEqual(60)
    expect(result.endsWith(' | Nexus News')).toBe(true)
  })

  it('does not cut a word in the middle', () => {
    const result = buildArticleSeoTitle('Mercado de fichajes: Zabiri, Wirtz y Fernandes marcan la agenda')
    const prefix = result.slice(0, -' | Nexus News'.length)
    expect(prefix.endsWith(' ')).toBe(false)
    expect(result.length).toBeLessThanOrEqual(60)
  })

  it('collapses whitespace and handles an empty headline', () => {
    expect(buildArticleSeoTitle('  James   Rodríguez  ')).toBe('James Rodríguez | Nexus News')
    expect(buildArticleSeoTitle('   ')).toBe('Noticias deportivas | Nexus News')
  })
})
