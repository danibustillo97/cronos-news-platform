// Abre ventanas flotantes apiladas desde cualquier parte (feed, rieles,
// modales). Las escucha SheetStack (montado en la barra de navegación).

import type { SheetEntry } from '@/lib/modalStack'

export const OPEN_SHEET_EVENT = 'nexus:open-sheet'

export function openSheet(entry: SheetEntry): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent<SheetEntry>(OPEN_SHEET_EVENT, { detail: entry }))
}

/** Clic normal: abrir ventana en vez de navegar (el enlace queda para SEO y clic medio). */
export function interceptToSheet(entry: SheetEntry) {
  return (e: { button: number; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean; preventDefault: () => void }) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    e.preventDefault()
    openSheet(entry)
  }
}
