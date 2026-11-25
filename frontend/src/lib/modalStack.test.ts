import { describe, expect, it } from 'vitest'
import { MAX_DEPTH, entryId, stackReducer, type StackItem } from './modalStack'

describe('modal stack', () => {
  it('pushes, pops and clears', () => {
    let s: StackItem[] = []
    s = stackReducer(s, { type: 'push', entry: { kind: 'insight', insightId: 'i1', payload: {} } })
    s = stackReducer(s, { type: 'push', entry: { kind: 'match', league: 'col.1', id: '9' } })
    s = stackReducer(s, { type: 'push', entry: { kind: 'player', id: '258906' } })
    expect(s.map((x) => x.entry.kind)).toEqual(['insight', 'match', 'player'])
    s = stackReducer(s, { type: 'pop' })
    expect(s.map((x) => x.entry.kind)).toEqual(['insight', 'match'])
    expect(stackReducer(s, { type: 'clear' })).toEqual([])
    expect(stackReducer([], { type: 'pop' })).toEqual([])
  })

  it('reopening a window already in the stack goes back to it instead of duplicating', () => {
    let s: StackItem[] = []
    s = stackReducer(s, { type: 'push', entry: { kind: 'match', league: 'col.1', id: '9' } })
    s = stackReducer(s, { type: 'push', entry: { kind: 'player', id: '1' } })
    s = stackReducer(s, { type: 'push', entry: { kind: 'match', league: 'col.1', id: '9' } })
    expect(s.map((x) => entryId(x.entry))).toEqual(['match:col.1:9'])
  })

  it('caps the depth', () => {
    let s: StackItem[] = []
    for (let i = 0; i < MAX_DEPTH + 3; i++) s = stackReducer(s, { type: 'push', entry: { kind: 'player', id: String(i) } })
    expect(s).toHaveLength(MAX_DEPTH)
    expect(s[s.length - 1].entry).toEqual({ kind: 'player', id: String(MAX_DEPTH + 2) })
  })
})
