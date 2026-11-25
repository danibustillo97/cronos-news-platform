"use client";

// What is on air right now, as chips. Click a chip to select it; Supr/Delete
// removes the selected one (or the last one if none is selected). X removes too.

import { useEffect, useState } from "react";
import { X } from "lucide-react";

export function OnAirStrip({ graphics, onRemove }: { graphics: { id: string; name: string }[]; onRemove: (id: string) => void }) {
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (selected && !graphics.some((g) => g.id === selected)) setSelected(null);
  }, [graphics, selected]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Delete") return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      const id = selected ?? graphics[graphics.length - 1]?.id;
      if (!id) return;
      e.preventDefault();
      onRemove(id);
      setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [graphics, selected, onRemove]);

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto px-2 pb-2">
      <span className="flex-shrink-0 rounded bg-red-500 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-white">Al aire</span>
      {graphics.length === 0 && <span className="text-[11px] text-neutral-500">Nada en pantalla. Usa una plantilla o un dato.</span>}
      {graphics.map((g) => (
        <span key={g.id} className={`inline-flex flex-shrink-0 items-center gap-1 rounded-full border py-0.5 pl-2.5 pr-1 text-[11px] ${selected === g.id ? "border-yellow-400 bg-yellow-400/15 text-yellow-100" : "border-white/15 text-neutral-200"}`}>
          <button type="button" onClick={() => setSelected(selected === g.id ? null : g.id)} className="max-w-[180px] truncate">{g.name}</button>
          <button type="button" aria-label={`Quitar ${g.name}`} onClick={() => onRemove(g.id)} className="rounded-full p-0.5 text-neutral-400 hover:bg-white/10 hover:text-white"><X size={12} /></button>
        </span>
      ))}
      {graphics.length > 0 && <span className="ml-1 flex-shrink-0 text-[10px] text-neutral-500">Supr quita {selected ? "el elegido" : "el último"}</span>}
    </div>
  );
}
