// Pila de ventanas flotantes: todo lo que se abre desde el feed se apila
// (Antesala → Ver partido → Jugador → atrás). Lógica pura (reducer).

export type SheetEntry =
  | { kind: 'match'; league: string; id: string; preview?: unknown }
  | { kind: 'table'; league: string }
  | { kind: 'insight'; insightId: string; payload: unknown }
  | { kind: 'player'; id: string; name?: string }
  | { kind: 'capsule'; payload: unknown }
  | { kind: 'polls' }
  | { kind: 'parleys' }

export interface StackItem { key: string; entry: SheetEntry }
export type StackAction = { type: 'push'; entry: SheetEntry } | { type: 'pop' } | { type: 'clear' }

export const MAX_DEPTH = 6

/** Identidad de una ventana: abrir la misma que ya está arriba no la duplica. */
export function entryId(e: SheetEntry): string {
  switch (e.kind) {
    case 'match': return `match:${e.league}:${e.id}`
    case 'table': return `table:${e.league}`
    case 'insight': return `insight:${e.insightId}`
    case 'player': return `player:${e.id}`
    case 'capsule': return `capsule:${(e.payload as { id?: string } | null)?.id ?? ''}`
    default: return e.kind
  }
}

let seq = 0

export function stackReducer(stack: StackItem[], action: StackAction): StackItem[] {
  switch (action.type) {
    case 'push': {
      const id = entryId(action.entry)
      // Si ya está abierta más abajo, se vuelve a ella (sin duplicar).
      const at = stack.findIndex((s) => entryId(s.entry) === id)
      if (at >= 0) return stack.slice(0, at + 1)
      const next = [...stack, { key: `${id}#${++seq}`, entry: action.entry }]
      return next.length > MAX_DEPTH ? next.slice(next.length - MAX_DEPTH) : next
    }
    case 'pop': return stack.slice(0, -1)
    case 'clear': return []
    default: return stack
  }
}
