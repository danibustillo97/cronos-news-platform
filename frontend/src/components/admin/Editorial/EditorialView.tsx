"use client";

import { useState } from "react";
import { BarChart3, LayoutTemplate, PenLine } from "lucide-react";
import EditorialBoard from "@/components/admin/Editorial/EditorialBoard";
import PortadaStudio from "@/components/admin/Editorial/portada/PortadaStudio";
import PollsStudio from "@/components/admin/Editorial/polls/PollsStudio";

// Editorial tabs:
//  - Redacción: find, write, review and publish (the Kanban board).
//  - Portada:   the homepage as readers see it -- pinned and hidden stories,
//               live preview (live video/radio are switched by the Broadcaster).
//  - Encuestas: polls and debates shown on the homepage, the feed and articles.
type Tab = "redaccion" | "portada" | "encuestas";

export default function EditorialView() {
  const [tab, setTab] = useState<Tab>("redaccion");
  return (
    <div className="flex h-full min-h-0 flex-col bg-[#080808]">
      <nav aria-label="Editorial" className="flex flex-shrink-0 gap-1 border-b border-white/10 px-3 pt-2 sm:px-5">
        {([["redaccion", "Redacción", PenLine], ["portada", "Portada", LayoutTemplate], ["encuestas", "Encuestas", BarChart3]] as const).map(([id, label, Icon]) => (
          <button
            key={id} type="button" onClick={() => setTab(id)} aria-current={tab === id ? "page" : undefined}
            className={`-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-[12.5px] font-semibold ${tab === id ? "border-yellow-400 text-white" : "border-transparent text-neutral-500 hover:text-neutral-200"}`}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
      </nav>
      <div className="min-h-0 flex-1">
        {tab === "redaccion" ? <EditorialBoard /> : tab === "portada" ? <PortadaStudio /> : <PollsStudio />}
      </div>
    </div>
  );
}
