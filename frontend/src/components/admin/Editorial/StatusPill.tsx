"use client";

import { TONE_CLASSES, type StatusMeta } from "./statusMeta";

// Discrete by design (section 11: "visualmente claros pero discretos") --
// small text pill, never a large colored badge.
export default function StatusPill({ meta }: { meta: StatusMeta }) {
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${TONE_CLASSES[meta.tone]}`}>
      {meta.label}
    </span>
  );
}
