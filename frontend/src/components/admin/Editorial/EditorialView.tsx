"use client";

// EDITORIAL — the one editorial space in NEXUS. Discovery, Ready and
// Publish are internal tabs of THIS SAME space, not separate sidebar
// entries: Discovery is the first phase of the editorial flow, not a
// module outside it.
//
//   DISCOVERY -> ARTIFACT -> READY -> PUBLISH
//
// This component only switches between the three panels and renders a
// shared sub-nav -- no business logic lives here.

import { useState } from "react";
import { Compass, CheckCircle2, Rocket } from "lucide-react";
import DiscoveryPanel from "@/components/admin/Editorial/DiscoveryPanel";
import ReadyPanel from "@/components/admin/Editorial/ReadyPanel";
import PublishPanel from "@/components/admin/Editorial/PublishPanel";

type EditorialTab = "discovery" | "ready" | "publish";

const TABS: { id: EditorialTab; label: string; icon: typeof Compass }[] = [
  { id: "discovery", label: "Discovery", icon: Compass },
  { id: "ready", label: "Ready", icon: CheckCircle2 },
  { id: "publish", label: "Publish", icon: Rocket },
];

export default function EditorialView() {
  const [tab, setTab] = useState<EditorialTab>("discovery");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-1 bg-white/5 p-1.5 rounded-2xl border border-white/10 w-fit">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
              tab === id ? "bg-white text-black" : "text-neutral-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      {tab === "discovery" && <DiscoveryPanel onAdvance={() => setTab("ready")} />}
      {tab === "ready" && <ReadyPanel />}
      {tab === "publish" && <PublishPanel />}
    </div>
  );
}
