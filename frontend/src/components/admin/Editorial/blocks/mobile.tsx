"use client";

// Touch / small-screen editing: a block toolbar docked above the on-screen
// keyboard (insert, change type, format, move, delete) and bottom sheets.
// On desktop the same actions live in the hover gutter and the selection
// toolbar; those depend on hover and a precise pointer, so they don't exist
// on phones and touch tablets.

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import {
  ArrowDown, ArrowUp, Bold, Check, Copy, Heading2, Heading3, Italic, Link2, List, ListOrdered, Pilcrow, Plus, Quote, Trash2, X,
} from "lucide-react";
import { toast } from "sonner";
import type { Block } from "./blockModel";

const TOUCH_QUERY = "(max-width: 1023px), (pointer: coarse)";

/** True on phones, small tablets and any touch-first device. */
export function useTouchLayout(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(TOUCH_QUERY);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(TOUCH_QUERY).matches,
    () => false,
  );
}

/** Pixels the on-screen keyboard covers at the bottom of the layout viewport. */
export function useKeyboardInset(enabled: boolean): number {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!enabled || !vv) return;
    const update = () => setInset(Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)));
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => { vv.removeEventListener("resize", update); vv.removeEventListener("scroll", update); };
  }, [enabled]);
  return enabled ? inset : 0;
}

export type ConvertTarget = "paragraph" | "heading2" | "heading3" | "quote" | "list" | "olist";

const TYPES: { to: ConvertTarget; icon: typeof Pilcrow; label: string }[] = [
  { to: "paragraph", icon: Pilcrow, label: "Párrafo" },
  { to: "heading2", icon: Heading2, label: "Subtítulo" },
  { to: "heading3", icon: Heading3, label: "Subtítulo pequeño" },
  { to: "quote", icon: Quote, label: "Cita" },
  { to: "list", icon: List, label: "Lista" },
  { to: "olist", icon: ListOrdered, label: "Lista numerada" },
];

function currentType(block: Block): ConvertTarget | null {
  if (block.type === "paragraph") return "paragraph";
  if (block.type === "heading") return block.level === 2 ? "heading2" : "heading3";
  if (block.type === "quote") return "quote";
  if (block.type === "list") return block.ordered ? "olist" : "list";
  return null;
}

/** Links the selected text, restoring the selection that prompt() steals. */
function addLink() {
  const selection = window.getSelection();
  const range = selection && selection.rangeCount ? selection.getRangeAt(0).cloneRange() : null;
  if (!range || range.collapsed) {
    toast("Selecciona primero el texto que quieres enlazar.");
    return;
  }
  const url = window.prompt("Enlace (https://…)");
  if (!url || !/^https?:\/\//i.test(url.trim())) return;
  selection?.removeAllRanges();
  selection?.addRange(range);
  document.execCommand("createLink", false, url.trim());
}

export function MobileBlockToolbar({
  block, isFirst, isLast, bottom, onInsert, onConvert, onMove, onDuplicate, onDelete, onDone,
}: {
  block: Block; isFirst: boolean; isLast: boolean; bottom: number;
  onInsert: () => void; onConvert: (to: ConvertTarget) => void; onMove: (d: -1 | 1) => void;
  onDuplicate: () => void; onDelete: () => void; onDone: () => void;
}) {
  const type = currentType(block);
  const text = type !== null;
  const btn = "flex h-11 min-w-11 flex-shrink-0 items-center justify-center rounded-lg px-2 text-neutral-700 active:bg-neutral-200 disabled:opacity-30";
  const sep = <span className="mx-0.5 h-6 w-px flex-shrink-0 bg-neutral-200" />;
  return (
    <div
      role="toolbar" aria-label="Herramientas del bloque"
      style={{ bottom }}
      // Keep focus and the text selection inside the block while tapping.
      onPointerDown={(e) => e.preventDefault()} onMouseDown={(e) => e.preventDefault()}
      className="fixed inset-x-0 z-40 flex items-center border-t border-neutral-200 bg-white/95 font-sans shadow-[0_-6px_24px_rgba(0,0,0,0.08)] backdrop-blur pb-[env(safe-area-inset-bottom)]"
    >
      <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto px-1.5 py-1 [scrollbar-width:none]">
        <button type="button" onClick={onInsert} aria-label="Insertar bloque debajo"
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-yellow-400 text-black active:bg-yellow-300">
          <Plus size={20} />
        </button>
        {text && (
          <>
            {sep}
            {TYPES.map(({ to, icon: Icon, label }) => (
              <button key={to} type="button" aria-label={label} aria-pressed={type === to} onClick={() => onConvert(to)}
                className={`${btn} ${type === to ? "bg-neutral-900 text-white active:bg-neutral-800" : ""}`}>
                <Icon size={18} />
              </button>
            ))}
            {sep}
            <button type="button" aria-label="Negrita" className={btn} onClick={() => document.execCommand("bold")}><Bold size={18} /></button>
            <button type="button" aria-label="Cursiva" className={btn} onClick={() => document.execCommand("italic")}><Italic size={18} /></button>
            <button type="button" aria-label="Enlace" className={btn} onClick={addLink}><Link2 size={18} /></button>
          </>
        )}
        {sep}
        <button type="button" aria-label="Subir bloque" className={btn} disabled={isFirst} onClick={() => onMove(-1)}><ArrowUp size={18} /></button>
        <button type="button" aria-label="Bajar bloque" className={btn} disabled={isLast} onClick={() => onMove(1)}><ArrowDown size={18} /></button>
        <button type="button" aria-label="Duplicar bloque" className={btn} onClick={onDuplicate}><Copy size={17} /></button>
        <button type="button" aria-label="Eliminar bloque" className={`${btn} text-red-600`} onClick={onDelete}><Trash2 size={18} /></button>
      </div>
      <button type="button" onClick={onDone} aria-label="Terminar de editar el bloque"
        className="mr-1.5 flex h-11 flex-shrink-0 items-center gap-1 rounded-lg bg-neutral-900 px-3 text-xs font-semibold text-white active:bg-neutral-700">
        <Check size={15} /> Listo
      </button>
    </div>
  );
}

/** Bottom sheet for phones; closes on backdrop tap. */
export function BottomSheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40 font-sans" onClick={onClose}>
      <div className="max-h-[85dvh] w-full overflow-y-auto rounded-t-2xl bg-white pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-2xl"
        onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 flex items-center justify-between bg-white px-4 pb-2 pt-3">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">{title}</span>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="-mr-2 rounded-full p-2 text-neutral-400 active:bg-neutral-100"><X size={18} /></button>
        </div>
        <div className="px-3">{children}</div>
      </div>
    </div>
  );
}
