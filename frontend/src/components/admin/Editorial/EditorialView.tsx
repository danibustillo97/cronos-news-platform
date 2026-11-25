"use client";

import { useState } from "react";
import { BarChart3, Clapperboard, Megaphone, PenLine } from "lucide-react";
import EditorialBoard from "@/components/admin/Editorial/EditorialBoard";
import AdsStudio from "@/components/admin/Editorial/ads/AdsStudio";
import PollsStudio from "@/components/admin/Editorial/polls/PollsStudio";
import CapsulesStudio from "@/components/admin/Editorial/capsules/CapsulesStudio";

// Editorial tabs:
//  - Redacción: find, write, review and publish (the Kanban board).
//  - Anuncios:  ad slots with exact sizes per device, campaigns and a live
//               portal preview where the selected slot is outlined.
//  - Encuestas: polls and debates shown on the homepage, the feed and articles.
//  - Cápsulas:  efemérides, ¿sabías que? and legends for the reels feed and TikTok.
type Tab = "redaccion" | "anuncios" | "encuestas" | "capsulas";

export default function EditorialView() {
  const [tab, setTab] = useState<Tab>("redaccion");
  return (
    <div className="flex h-full min-h-0 flex-col bg-[#080808]">
      <nav aria-label="Editorial" className="flex flex-shrink-0 gap-1 border-b border-white/10 px-3 pt-2 sm:px-5">
        {([["redaccion", "Redacción", PenLine], ["anuncios", "Anuncios", Megaphone], ["encuestas", "Encuestas", BarChart3], ["capsulas", "Cápsulas", Clapperboard]] as const).map(([id, label, Icon]) => (
          <button
            key={id} type="button" onClick={() => setTab(id)} aria-current={tab === id ? "page" : undefined}
            className={`-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-[12.5px] font-semibold ${tab === id ? "border-yellow-400 text-white" : "border-transparent text-neutral-500 hover:text-neutral-200"}`}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
      </nav>
      <div className="min-h-0 flex-1">
        {tab === "redaccion" ? <EditorialBoard /> : tab === "anuncios" ? <AdsStudio /> : tab === "encuestas" ? <PollsStudio /> : <CapsulesStudio />}
      </div>
    </div>
  );
}
