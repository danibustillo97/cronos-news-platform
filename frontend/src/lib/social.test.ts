import { describe, expect, it } from 'vitest'
import { applyReaction, compactCount, emptySummary, normalizeSummary, topReactions, validateComment } from './social'

describe('social summary', () => {
  it('normalizes the backend summary defensively', () => {
    const s = normalizeSummary({ counts: { fire: 3, goal: -1, wow: '2', bogus: 9 }, total: 1, mine: 'fire', comments: [{ id: 'c1', author: '', body: 'Golazo' }, { id: '', body: 'x' }], commentCount: 0 })!
    expect(s.counts).toEqual({ fire: 3, goal: 0, wow: 0, clap: 0, laugh: 0, sad: 0 })
    expect(s.total).toBe(3)
    expect(s.mine).toBe('fire')
    expect(s.comments).toEqual([{ id: 'c1', author: 'Anónimo', body: 'Golazo', createdAt: '' }])
    expect(s.commentCount).toBe(1)
    expect(normalizeSummary(null)).toBeNull()
  })

  it('applies optimistic reactions: add, switch, remove', () => {
    const base = emptySummary()
    const a = applyReaction(base, 'fire')
    expect(a).toMatchObject({ mine: 'fire', total: 1 })
    expect(a.counts.fire).toBe(1)
    const b = applyReaction(a, 'goal')
    expect(b).toMatchObject({ mine: 'goal', total: 1 })
    expect(b.counts).toMatchObject({ fire: 0, goal: 1 })
    const c = applyReaction(b, 'goal') // misma = quitar
    expect(c).toMatchObject({ mine: null, total: 0 })
    expect(applyReaction(b, null)).toMatchObject({ mine: null, total: 0 })
  })

  it('lists the top reactions by count', () => {
    const s = { ...emptySummary(), counts: { fire: 1, goal: 5, wow: 0, clap: 3, laugh: 0, sad: 0 } }
    expect(topReactions(s)).toEqual(['⚽', '👏', '🔥'])
  })
})

describe('validateComment', () => {
  it('requires a name and a body within limits, trimming whitespace', () => {
    expect(validateComment(' Ana ', '  Qué partidazo   ')).toEqual({ ok: true, author: 'Ana', body: 'Qué partidazo' })
    expect(validateComment('A', 'hola')).toMatchObject({ ok: false })
    expect(validateComment('Ana', ' ')).toMatchObject({ ok: false })
    expect(validateComment('Ana', 'x'.repeat(501))).toMatchObject({ ok: false, error: expect.stringContaining('500') })
    expect(validateComment('Ana', 'a\n\n\n\nb')).toEqual({ ok: true, author: 'Ana', body: 'a\n\nb' })
  })

  it('formats large counts compactly', () => {
    expect(compactCount(999)).toBe('999')
    expect(compactCount(1200)).toBe('1,2 mil')
    expect(compactCount(25000)).toBe('25 mil')
    expect(compactCount(3_400_000)).toBe('3,4 M')
  })
})

describe('comentario breve', () => {
  it('genera un nombre por defecto válido de 3 cifras', async () => {
    const { defaultAuthor, quickReplyText, QUICK_REPLIES } = await import('./social')
    expect(defaultAuthor(() => 0)).toBe('Hincha 100')
    expect(defaultAuthor(() => 0.999)).toBe('Hincha 999')
    expect(validateComment(defaultAuthor(), 'Golazo')).toMatchObject({ ok: true })
    expect(QUICK_REPLIES.map(quickReplyText)).toEqual(['⚽ Golazo', '🔥 Qué partido', '👏 Crack'])
  })
})
