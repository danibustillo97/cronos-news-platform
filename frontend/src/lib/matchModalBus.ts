// Abre la ventana del partido desde cualquier parte (marcador, feed,
// rieles, hub) sin acoplar componentes: un evento del navegador que
// escucha MatchModalHost (montado en la barra de navegación del portal).

import type { Match } from '@/types/sports'

export const OPEN_MATCH_EVENT = 'nexus:open-match'
export interface OpenMatchDetail { league: string; id: string; preview?: Match }

export function openMatch(detail: OpenMatchDetail): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent<OpenMatchDetail>(OPEN_MATCH_EVENT, { detail }))
}

/** Clic normal (sin teclas modificadoras ni botón central): abrir ventana en vez de navegar. */
export function shouldIntercept(e: { button: number; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean }): boolean {
  return e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey
}
