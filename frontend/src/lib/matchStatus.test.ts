import { describe, expect, it } from 'vitest'
import { localizeStatus } from './matchStatus'

describe('localizeStatus', () => {
  it('translates ESPN status details to Spanish', () => {
    expect(localizeStatus('HT')).toBe('Entretiempo')
    expect(localizeStatus('FT')).toBe('Final')
    expect(localizeStatus('Scheduled')).toBe('Programado')
    expect(localizeStatus("63'")).toBe("63'")
    expect(localizeStatus('45+2')).toBe("45+2'")
    expect(localizeStatus('')).toBe('En juego')
    expect(localizeStatus(null, 'EN VIVO')).toBe('EN VIVO')
  })
})
