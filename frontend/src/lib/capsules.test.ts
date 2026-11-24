import { describe, expect, it } from 'vitest'
import { capsuleDateLabel, capsuleOgUrl, normalizeCapsule, normalizeCapsules, sortCapsules } from './capsules'

const base = {
  id: 'c1', kind: 'efemeride', title: 'El 5-0 en Buenos Aires', subject: 'Selección Colombia', year: 1993, date: '09-05',
  slides: [{ text: 'Colombia goleó a Argentina 5-0.', image: 'https://x.com/a.jpg' }, { text: '', image: null }, { text: 'Doblete de Rincón.', image: 'javascript:alert(1)' }],
  tags: ['Selección', 7], createdAt: '2026-11-24T00:00:00Z',
}

describe('capsules', () => {
  it('validates capsules (incl. the new "momento" kind) and their slides', () => {
    const c = normalizeCapsule(base)!
    expect(c.slides).toEqual([{ text: 'Colombia goleó a Argentina 5-0.', image: 'https://x.com/a.jpg' }, { text: 'Doblete de Rincón.', image: null }])
    expect(normalizeCapsule({ ...base, kind: 'momento' })?.kind).toBe('momento')
    expect(normalizeCapsule({ ...base, kind: 'otra' })).toBeNull()
    expect(normalizeCapsule({ ...base, slides: [] })).toBeNull()
  })

  it('reads the feed wrapper, dedupes, and puts today’s efemérides first', () => {
    const now = new Date('2026-09-05T12:00:00')
    const caps = normalizeCapsules({ capsules: [{ ...base, id: 'a', kind: 'leyenda', date: null }, { ...base, id: 'b' }, { ...base, id: 'b' }, { id: 'x' }] })
    expect(sortCapsules(caps, now).map((c) => c.id)).toEqual(['b', 'a'])
    expect(capsuleDateLabel({ date: '09-05', year: 1993 }, now)).toBe('Un día como hoy · 1993')
    expect(capsuleDateLabel({ date: '11-24', year: 1994 }, now)).toBe('24 de noviembre de 1994')
    expect(capsuleDateLabel({ date: null, year: null }, now)).toBeNull()
  })

  it('builds the /og/capsule URL for a slide', () => {
    const url = capsuleOgUrl(normalizeCapsule(base)!, 1)
    expect(url.startsWith('/og/capsule?')).toBe(true)
    const q = new URLSearchParams(url.split('?')[1])
    expect(q.get('kind')).toBe('efemeride')
    expect(q.get('year')).toBe('1993')
    expect(q.get('day')).toBe('09-05')
    expect(q.get('i')).toBe('1')
    expect(q.get('n')).toBe('2')
    expect(q.get('text')).toBe('Colombia goleó a Argentina 5-0.')
  })
})
