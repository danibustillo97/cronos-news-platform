"use client";

// PUBLISH -- the final stage (READY -> PUBLISH -> público). Not built yet
// for the new Editorial flow: real distribution/publish state already
// exists for the legacy pipeline (see components/admin/Distribution/),
// but nothing here fabricates a "published" status for content that
// hasn't actually gone out. Honest empty state until Ready is real and
// there's something genuine to publish through this flow.

import { Rocket } from "lucide-react";

export default function PublishPanel() {
  return (
    <div className="bg-white/5 p-10 rounded-3xl border border-white/10 backdrop-blur-md text-center space-y-3">
      <div className="mx-auto w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-neutral-500">
        <Rocket size={22} />
      </div>
      <h3 className="text-lg font-bold text-white">Publish</h3>
      <p className="text-sm text-neutral-400 max-w-md mx-auto">
        Acá va a vivir el estado real de publicación (READY_TO_PUBLISH / PUBLISHING / PUBLISHED / SCHEDULED / FAILED)
        para lo que salga de este flujo editorial. Hoy no hay nada READY todavía, así que no hay nada que publicar --
        la distribución real que ya funciona (TikTok, etc.) sigue en la pestaña Distribución mientras este flujo se termina de construir.
      </p>
    </div>
  );
}
