"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { FileEdit, FileText, Rocket, Search } from "lucide-react";
import { apiFetch } from "@/studio/lab/api-client";
import ManualNewsDesk from "@/components/admin/Editorial/ManualNewsDesk";
import DiscoveryPanel from "@/components/admin/Editorial/DiscoveryPanel";
import RevisionWorkspace from "@/components/admin/Editorial/RevisionWorkspace";
import PublishPanel from "@/components/admin/Editorial/PublishPanel";
import CommandPalette, { type PaletteCommand } from "@/components/admin/Editorial/CommandPalette";
import type { NewsDeskRequest } from "@/components/admin/Editorial/ManualNewsDesk";

type EditorialTab = "news" | "discovery" | "revision" | "publish";

const TABS: { id: EditorialTab; label: string; icon: typeof Search }[] = [
  // One name per stage of the flow (they used to mix "Editor", "Cola IA", "Artifact").
  { id: "news", label: "Noticias", icon: FileText },
  { id: "discovery", label: "Descubrir", icon: Search },
  { id: "revision", label: "Revisión", icon: FileEdit },
  { id: "publish", label: "Publicar", icon: Rocket },
];

export default function EditorialView() {
  const [tab, setTab] = useState<EditorialTab>("news");
  const [counts, setCounts] = useState<{ revision: number | null; publish: number | null }>({ revision: null, publish: null });
  const seenForReviewRef = useRef<Set<string> | null>(null);
  const [manualQueue, setManualQueue] = useState<string[]>([]);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [newsRequest, setNewsRequest] = useState<NewsDeskRequest | null>(null);
  const [artifactRequest, setArtifactRequest] = useState<{ id: string; nonce: number } | null>(null);

  // Ctrl/⌘+K opens the search palette from any editorial tab.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const consumeManualQueue = useCallback(() => setManualQueue([]), []);

  // Jobs finish on GitHub Actions while the editor works elsewhere: tab counters refresh every
  // minute (and on tab change), and a toast announces articles that just became reviewable.
  useEffect(() => {
    let cancelled = false;
    const list = async (status: string, limit: number): Promise<Array<{ id: string; title: string }>> => {
      const response = await apiFetch(`/api/artifacts?status=${status}&limit=${limit}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return (await response.json()).artifacts ?? [];
    };
    const refresh = async () => {
      if (document.hidden) return;
      try {
        const [drafts, review, validated, approved] = await Promise.all([
          list("DRAFT", 50), list("REVIEW_REQUIRED", 50), list("VALIDATED", 50), list("APPROVED", 100),
        ]);
        if (cancelled) return;
        const reviewable = [...review, ...validated];
        const seen = seenForReviewRef.current;
        const fresh = seen ? reviewable.filter((item) => !seen.has(item.id)) : [];
        seenForReviewRef.current = new Set(reviewable.map((item) => item.id));
        if (fresh.length) {
          toast.success(fresh.length === 1 ? `Listo para revisar: ${fresh[0].title}` : `${fresh.length} artículos nuevos listos para revisar`, {
            action: { label: "Abrir", onClick: () => setTab("revision") },
          });
        }
        setCounts({ revision: drafts.length + reviewable.length, publish: approved.length });
      } catch {
        if (!cancelled) setCounts({ revision: null, publish: null });
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 60_000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [tab]);

  const openManualEditor = (itemIds: string[]) => {
    setManualQueue(itemIds);
    setTab("revision");
  };

  const runCommand = (command: PaletteCommand) => {
    const nonce = Date.now();
    if (command.kind === "open-news") { setTab("news"); setNewsRequest({ kind: "open", id: command.id, nonce }); }
    else if (command.kind === "new-news") { setTab("news"); setNewsRequest({ kind: "new", nonce }); }
    else if (command.kind === "open-artifact") {
      if (command.status === "APPROVED") setTab("publish");
      else { setTab("revision"); setArtifactRequest({ id: command.id, nonce }); }
    } else if (command.kind === "write-discovery") openManualEditor([command.id]);
    else setTab(command.tab);
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#080808]">
      <header className="flex flex-shrink-0 items-center border-b border-white/10 px-3 py-1.5 sm:px-5">
        <nav aria-label="Flujo editorial" className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          {TABS.map(({ id, label, icon: Icon }) => {
            const active = tab === id;
            const badge = id === "publish" ? counts.publish : id === "revision" ? counts.revision : null;
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
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          className="ml-2 hidden flex-shrink-0 items-center gap-2 rounded-md border border-white/10 px-2.5 py-1.5 text-[11px] text-neutral-400 hover:bg-white/[0.06] hover:text-white sm:inline-flex"
        >
          <Search size={13} /> Buscar
          <kbd className="rounded border border-white/10 px-1 text-[9px] text-neutral-500">Ctrl K</kbd>
        </button>
      </header>
      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} onCommand={runCommand} />}

      {/* Every tab stays mounted: switching tabs must never discard an article being written. */}
      <main className="min-h-0 flex-1">
        <div className={tab === "news" ? "h-full" : "hidden"}><ManualNewsDesk active={tab === "news"} request={newsRequest} /></div>
        <div className={tab === "discovery" ? "h-full overflow-y-auto px-4 py-4 sm:px-6" : "hidden"}>
          <DiscoveryPanel active={tab === "discovery"} onEditManually={openManualEditor} />
        </div>
        <div className={tab === "revision" ? "h-full" : "hidden"}>
          <RevisionWorkspace
            active={tab === "revision"}
            openRequest={artifactRequest}
            manualQueue={manualQueue}
            onManualQueueConsumed={consumeManualQueue}
            onGoToDiscovery={() => setTab("discovery")}
          />
        </div>
        <div className={tab === "publish" ? "h-full overflow-y-auto px-4 py-4 sm:px-6" : "hidden"}>
          <PublishPanel active={tab === "publish"} />
        </div>
      </main>
    </div>
  );
}
