// Abre la ventana del partido desde cualquier parte (marcador, feed,
// rieles, hub) sin acoplar componentes: un evento del navegador que
// escucha MatchModalHost (montado en la barra de navegación del portal).

import type { Match } from '@/types/sports'
import { openSheet } from '@/lib/sheetBus'

export const OPEN_MATCH_EVENT = 'nexus:open-match'
export interface OpenMatchDetail { league: string; id: string; preview?: Match }

export function openMatch(detail: OpenMatchDetail): void {
  // Va a la pila de ventanas (se puede apilar sobre una antesala, un jugador…).
  openSheet({ kind: 'match', league: detail.league, id: detail.id, preview: detail.preview })
}

/** Clic normal (sin teclas modificadoras ni botón central): abrir ventana en vez de navegar. */
export function shouldIntercept(e: { button: number; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean }): boolean {
  return e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey
}
