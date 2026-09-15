"use client";

// READY -- editorial content that finished processing and passed real
// validation. Not built yet: this panel exists so the Editorial space's
// three tabs are all real UI, but it deliberately shows an honest empty
// state instead of fabricated items -- Ready has nothing to list until
// Artifact (Phase 4) exists to actually produce validated content and
// Composition/Story's real APPROVED state gets a real listing endpoint
// to read from. No mock data, no fake "3 items ready".

import { CheckCircle2 } from "lucide-react";

export default function ReadyPanel() {
  return (
    <div className="bg-white/5 p-10 rounded-3xl border border-white/10 backdrop-blur-md text-center space-y-3">
      <div className="mx-auto w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-neutral-500">
        <CheckCircle2 size={22} />
      </div>
      <h3 className="text-lg font-bold text-white">Ready</h3>
      <p className="text-sm text-neutral-400 max-w-md mx-auto">
        Acá va a aparecer el contenido editorial que ya pasó por Artifact y las validaciones reales
        (fuentes, categoría, SEO, HTML, completitud, multimedia). Todavía no hay nada acá porque
        Artifact (el pipeline que produce contenido READY real) no está construido — no es una lista vacía por falta de datos, es una fase pendiente.
      </p>
    </div>
  );
}
