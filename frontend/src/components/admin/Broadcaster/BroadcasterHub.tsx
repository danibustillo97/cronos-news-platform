"use client";

import { useState } from "react";
import { Radio, Video } from "lucide-react";
import BroadcasterView from "./BroadcasterView";
import RadioStation from "./radio/RadioStation";

// Broadcaster = video studio + radio station. Both stay mounted: switching
// tab (or leaving the Broadcaster view) never cuts a live video, a recording
// or the radio on air.
export default function BroadcasterHub({ active = true }: { active?: boolean }) {
  const [tab, setTab] = useState<"video" | "radio">("video");
  return (
    <div className="flex h-full min-h-0 flex-col bg-black">
      <nav aria-label="Broadcaster" className="flex flex-shrink-0 gap-1 border-b border-white/10 px-3 pt-1.5">
        {([["video", "Estudio de video", Video], ["radio", "Estación de radio", Radio]] as const).map(([id, label, Icon]) => (
          <button key={id} type="button" onClick={() => setTab(id)} aria-current={tab === id ? "page" : undefined}
            className={`-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-[12px] font-semibold ${tab === id ? "border-red-500 text-white" : "border-transparent text-neutral-500 hover:text-neutral-200"}`}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </nav>
      <div className={tab === "video" ? "min-h-0 flex-1" : "hidden"}><BroadcasterView active={active && tab === "video"} /></div>
      <div className={tab === "radio" ? "min-h-0 flex-1" : "hidden"}><RadioStation /></div>
    </div>
  );
}
