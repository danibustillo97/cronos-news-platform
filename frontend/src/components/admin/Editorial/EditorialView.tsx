"use client";

import { useCallback, useEffect, useState } from "react";
import { FileEdit, Rocket, Search } from "lucide-react";
import { apiUrl } from "@/studio/lab/api-client";
import DiscoveryPanel from "@/components/admin/Editorial/DiscoveryPanel";
import RevisionWorkspace from "@/components/admin/Editorial/RevisionWorkspace";
import PublishPanel from "@/components/admin/Editorial/PublishPanel";

type EditorialTab = "discovery" | "revision" | "publish";

const TABS: { id: EditorialTab; label: string; icon: typeof Search }[] = [
  { id: "discovery", label: "Descubrir", icon: Search },
  { id: "revision", label: "Editar", icon: FileEdit },
  { id: "publish", label: "Publicar", icon: Rocket },
];

export default function EditorialView() {
  const [tab, setTab] = useState<EditorialTab>("discovery");
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
      <header className="flex flex-shrink-0 flex-col gap-3 border-b border-white/10 px-4 py-3 sm:flex-row sm:items-center sm:px-6">
        <div className="flex items-center gap-3 sm:mr-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-500/10 text-red-400">
            <FileEdit size={17} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">Editorial</h2>
            <p className="text-[11px] text-neutral-500">Noticias, edición y publicación</p>
          </div>
        </div>

        <nav aria-label="Flujo editorial" className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          {TABS.map(({ id, label, icon: Icon }) => {
            const active = tab === id;
            const badge = id === "publish" ? readyCount : null;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                aria-current={active ? "page" : undefined}
                className={`inline-flex flex-shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-semibold transition-colors ${
                  active
                    ? "bg-white text-neutral-950"
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
