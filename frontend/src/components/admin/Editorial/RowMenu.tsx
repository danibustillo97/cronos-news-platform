"use client";

// Small "..." popover with real actions only -- opening the real source
// URL, or copying it. No decorative menu items with nothing behind them.

import { useEffect, useRef, useState } from "react";
import { MoreHorizontal, ExternalLink, Link2 } from "lucide-react";
import { toast } from "sonner";

export default function RowMenu({ url }: { url: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        title="Más opciones"
        className="p-1.5 rounded-md text-neutral-600 opacity-70 hover:opacity-100 hover:text-white hover:bg-white/10"
      >
        <MoreHorizontal size={14} />
      </button>
      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute right-0 top-full mt-1 z-20 w-40 rounded-lg border border-white/10 bg-neutral-900 shadow-lg py-1"
        >
          <a
            href={url} target="_blank" rel="noreferrer" onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-1.5 text-xs text-neutral-300 hover:bg-white/5 hover:text-white"
          >
            <ExternalLink size={12} /> Ver fuente
          </a>
          <button
            onClick={() => {
              navigator.clipboard?.writeText(url).then(() => toast.success("Enlace copiado"));
              setOpen(false);
            }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-neutral-300 hover:bg-white/5 hover:text-white"
          >
            <Link2 size={12} /> Copiar enlace
          </button>
        </div>
      )}
    </div>
  );
}
