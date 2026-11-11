"use client";

// Section 2's "Papelera" -- real, read-only view of ARCHIVED artifacts
// (GET /api/artifacts?status=ARCHIVED, the real status already persisted
// by Archivar). No restore action here: the domain has no real
// un-archive operation, and this task explicitly forbids inventing
// functionality that doesn't exist -- this is honestly just "what did I
// remove", not a undo tray.

import { useEffect, useState } from "react";
import { Trash2, X } from "lucide-react";
import { apiUrl } from "@/studio/lab/api-client";

interface ArchivedArtifact {
  id: string;
  title: string;
  createdAt: string;
}

export default function ArchivedDrawer({ onClose }: { onClose: () => void }) {
  const [items, setItems] = useState<ArchivedArtifact[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(apiUrl("/api/artifacts?status=ARCHIVED&limit=100"));
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setItems(data.artifacts ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo cargar la papelera");
      }
    })();
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-neutral-950 border border-white/10 rounded-2xl w-full max-w-md max-h-[70vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 flex-shrink-0">
          <h3 className="text-sm font-bold text-white flex items-center gap-2"><Trash2 size={14} /> Papelera</h3>
          <button onClick={onClose} className="text-neutral-500 hover:text-white"><X size={16} /></button>
        </div>
        <div className="overflow-y-auto flex-1 p-2">
          {error ? (
            <div className="text-red-400 text-xs p-3">{error}</div>
          ) : items === null ? (
            <div className="text-neutral-500 text-xs p-3">Cargando…</div>
          ) : items.length === 0 ? (
            <div className="text-neutral-500 text-xs text-center p-6">No hay artículos eliminados.</div>
          ) : (
            <div className="divide-y divide-white/5">
              {items.map((a) => (
                <div key={a.id} className="px-2.5 py-2.5 text-[13px] text-neutral-300">{a.title}</div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
