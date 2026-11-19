"use client";

import { useCallback, useEffect, useState } from "react";
import { FileEdit, FileText, Rocket, Search } from "lucide-react";
import { apiUrl } from "@/studio/lab/api-client";
import ManualNewsDesk from "@/components/admin/Editorial/ManualNewsDesk";
import DiscoveryPanel from "@/components/admin/Editorial/DiscoveryPanel";
import RevisionWorkspace from "@/components/admin/Editorial/RevisionWorkspace";
import PublishPanel from "@/components/admin/Editorial/PublishPanel";

type EditorialTab = "news" | "discovery" | "revision" | "publish";

const TABS: { id: EditorialTab; label: string; icon: typeof Search }[] = [
  { id: "news", label: "Noticias", icon: FileText },
  { id: "discovery", label: "Descubrir IA", icon: Search },
  { id: "revision", label: "Editor", icon: FileEdit },
  { id: "publish", label: "Cola IA", icon: Rocket },
];

export default function EditorialView() {
  const [tab, setTab] = useState<EditorialTab>("news");
  const [readyCount, setReadyCount] = useState<number | null>(null);
  const [manualQueue, setManualQueue] = useState<string[]>([]);

  const consumeManualQueue = useCallback(() => setManualQueue([]), []);

  useEffect(() => {
    const fetchReadyCount = async () => {
      try {
        const response = await fetch(apiUrl("/api/artifacts?status=APPROVED&limit=100"));
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        setReadyCount(data.artifacts?.length ?? 0);
      } catch {
        setReadyCount(null);
      }
    };

    void fetchReadyCount();
  }, [tab]);

  const openManualEditor = (itemIds: string[]) => {
    setManualQueue(itemIds);
    setTab("revision");
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#080808]">
      <header className="flex flex-shrink-0 items-center border-b border-white/10 px-3 py-1.5 sm:px-5">
        <nav aria-label="Flujo editorial" className="flex min-w-0 items-center gap-1 overflow-x-auto">
          {TABS.map(({ id, label, icon: Icon }) => {
            const active = tab === id;
            const badge = id === "publish" ? readyCount : null;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                aria-current={active ? "page" : undefined}
                className={`inline-flex flex-shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
                  active
                    ? "bg-white/[0.09] text-white"
                    : "text-neutral-400 hover:bg-white/[0.06] hover:text-white"
                }`}
              >
                <Icon size={15} />
                {label}
                {badge !== null && badge > 0 && (
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${active ? "bg-black/10 text-black/70" : "bg-white/10 text-neutral-300"}`}>
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </header>

      <main className="min-h-0 flex-1">
        {tab === "news" && <ManualNewsDesk />}
        {tab === "discovery" && (
          <div className="h-full overflow-y-auto px-4 py-4 sm:px-6">
            <DiscoveryPanel onEditManually={openManualEditor} />
          </div>
        )}
        {tab === "revision" && (
          <RevisionWorkspace
            manualQueue={manualQueue}
            onManualQueueConsumed={consumeManualQueue}
            onGoToDiscovery={() => setTab("discovery")}
          />
        )}
        {tab === "publish" && (
          <div className="h-full overflow-y-auto px-4 py-4 sm:px-6">
            <PublishPanel />
          </div>
        )}
      </main>
    </div>
  );
}
