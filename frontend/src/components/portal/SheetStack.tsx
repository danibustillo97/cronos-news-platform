'use client'

// Pila de ventanas flotantes: todo lo que se abre desde el feed (partido,
// tabla, antesala, jugador, cápsula, encuestas, parley) se apila y se
// navega entre ventanas sin salir de la página. X, Esc o el fondo cierran
// la de arriba; flecha "atrás" cuando hay más de una; en el teléfono,
// deslizar hacia abajo (o desde el borde izquierdo hacia la derecha)
// cierra la de arriba. Va montado una sola vez en la barra de navegación.

import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ChevronLeft, X } from 'lucide-react'
import { stackReducer, type SheetEntry, type StackItem } from '@/lib/modalStack'
import { OPEN_SHEET_EVENT } from '@/lib/sheetBus'
import type { Insight } from '@/lib/insightsFeed'
import type { Capsule } from '@/lib/capsules'
import type { Match } from '@/types/sports'
import { usePortalTheme } from '@/context/ThemeContext'
import { MatchSheetContent } from './MatchModal'
import TableSheetContent, { tableTitle } from './TableModal'
import { InsightSheetContent } from './InsightCards'
import { CapsuleSheetContent, PlayerSheetContent, PollsSheetContent } from './SheetContents'
import ParleysBoard from './ParleysBoard'

function titleOf(e: SheetEntry): string {
  switch (e.kind) {
    case 'match': return 'Partido'
    case 'table': return tableTitle(e.league)
    case 'insight': return 'Antesala'
    case 'player': return e.name ?? 'Jugador'
    case 'capsule': return (e.payload as Capsule | null)?.title ?? 'Cápsula'
    case 'polls': return 'Encuestas y debates'
    case 'parleys': return 'Parley del día'
  }
}

function Content({ entry }: { entry: SheetEntry }) {
  switch (entry.kind) {
    case 'match': return <MatchSheetContent league={entry.league} id={entry.id} preview={entry.preview as Match | undefined} />
    case 'table': return <TableSheetContent initialLeague={entry.league} />
    case 'insight': {
      const p = entry.payload as { insight: Insight; live: Match | null }
      return <InsightSheetContent insight={p.insight} live={p.live} />
    }
    case 'player': return <PlayerSheetContent id={entry.id} name={entry.name} />
    case 'capsule': return <CapsuleSheetContent capsule={entry.payload as Capsule} />
    case 'polls': return <PollsSheetContent />
    case 'parleys': return <div className="nx-thin-scroll min-h-0 flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom,0px)]"><ParleysBoard inSheet /></div>
  }
}

function Sheet({ item, depth, index, onPop }: { item: StackItem; depth: number; index: number; onPop: () => void }) {
  const reduce = useReducedMotion()
  const top = index === depth - 1
  const [drag, setDrag] = useState({ x: 0, y: 0 })
  const start = useRef<{ x: number; y: number; edge: boolean } | null>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const wide = item.entry.kind === 'parleys'

  useEffect(() => { if (top) { const t = window.setTimeout(() => closeRef.current?.focus(), 60); return () => window.clearTimeout(t) } }, [top])

  const onDown = (e: React.PointerEvent, fromHandle: boolean) => {
    const edge = e.clientX < 28
    if (!fromHandle && !edge) return
    start.current = { x: e.clientX, y: e.clientY, edge }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  const onMove = (e: React.PointerEvent) => {
    if (!start.current) return
    const dx = e.clientX - start.current.x
    const dy = e.clientY - start.current.y
    setDrag(start.current.edge ? { x: Math.max(0, dx), y: 0 } : { x: 0, y: Math.max(0, dy) })
  }
  const onUp = () => {
    if (drag.y > 100 || drag.x > 90) onPop()
    setDrag({ x: 0, y: 0 })
    start.current = null
  }

  return (
    <motion.div
      role="dialog"
      aria-modal={top}
      aria-hidden={!top}
      aria-label={titleOf(item.entry)}
      className={`absolute inset-x-0 bottom-0 mx-auto flex max-h-[94svh] w-full flex-col overflow-hidden rounded-t-[22px] border border-[var(--nx-line)] bg-[var(--nx-surface)] shadow-2xl sm:inset-0 sm:m-auto sm:h-fit sm:max-h-[88vh] sm:rounded-[22px] ${wide ? 'sm:max-w-3xl' : 'sm:max-w-2xl'} ${top ? '' : 'pointer-events-none'}`}
      style={{ zIndex: 10 + index }}
      initial={reduce ? false : { y: 80, opacity: 0.6 }}
      animate={{
        x: drag.x,
        y: drag.y,
        opacity: top ? 1 : 0.55,
        scale: top ? 1 : 0.96,
      }}
      exit={reduce ? undefined : { y: 90, opacity: 0 }}
      transition={drag.x || drag.y ? { duration: 0 } : { type: 'spring', damping: 30, stiffness: 340 }}
      onPointerDown={(e) => onDown(e, false)}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      <div>
        <div className="flex h-6 shrink-0 cursor-grab touch-none items-center justify-center sm:hidden" aria-hidden="true"
          onPointerDown={(e) => { e.stopPropagation(); onDown(e, true) }} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
          <span className="h-1.5 w-10 rounded-full bg-[var(--nx-line-strong)]" />
        </div>
        <div className="flex h-12 shrink-0 items-center gap-1 px-2 sm:pt-2">
          {depth > 1 ? (
            <button type="button" onClick={onPop} aria-label="Volver" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--nx-ink)] hover:bg-[var(--nx-surface-2)]"><ChevronLeft size={22} /></button>
          ) : <span className="w-2" />}
          <p className="min-w-0 flex-1 truncate text-[15px] font-bold text-[var(--nx-ink)]">{titleOf(item.entry)}</p>
          <button ref={closeRef} type="button" onClick={onPop} aria-label="Cerrar" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--nx-muted)] hover:bg-[var(--nx-surface-2)]"><X size={20} /></button>
        </div>
      </div>
      <Content entry={item.entry} />
    </motion.div>
  )
}

let owner: symbol | null = null

export default function SheetStack() {
  const { theme } = usePortalTheme()
  const [stack, dispatch] = useReducer(stackReducer, [])
  const [mounted, setMounted] = useState(false)
  const pop = useCallback(() => dispatch({ type: 'pop' }), [])

  useEffect(() => {
    const me = Symbol('sheet-stack')
    if (owner) return
    owner = me
    setMounted(true)
    const on = (e: Event) => dispatch({ type: 'push', entry: (e as CustomEvent<SheetEntry>).detail })
    window.addEventListener(OPEN_SHEET_EVENT, on)
    return () => { window.removeEventListener(OPEN_SHEET_EVENT, on); if (owner === me) owner = null }
  }, [])

  const open = stack.length > 0
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); pop() } }
    window.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey) }
  }, [open, pop])

  if (!mounted) return null
  return createPortal(
    <div className="nx-portal" data-theme={theme} style={{ background: 'transparent' }}>
      <AnimatePresence>
        {open && (
          <motion.div key="sheet-backdrop" className="fixed inset-0 z-[95]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
            <button type="button" aria-label="Cerrar ventana" className="absolute inset-0 bg-black/60" onClick={pop} />
            <div className="pointer-events-none absolute inset-0 sm:p-6 [&>*]:pointer-events-auto">
              <AnimatePresence>
                {stack.map((item, i) => <Sheet key={item.key} item={item} depth={stack.length} index={i} onPop={pop} />)}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>,
    document.body,
  )
}
