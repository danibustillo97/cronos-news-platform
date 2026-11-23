"use client";

// Ctrl/⌘+K anywhere in the editorial: one search box over published news and drafts,
// articles in review or ready to publish, and freshly discovered stories, plus the common
// actions. Enter jumps straight to editing (a discovered story opens in the manual editor).

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Compass, FileEdit, FileText, LoaderCircle, Plus, Rocket, Search } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { apiFetch } from "@/studio/lab/api-client";
import { applyNewsFilters } from "./newsQuery";
import { rankMatches } from "./paletteSearch";
import { STATUS_LABEL, type NewsStatus } from "./newsRules";
import { sourceLabel, type DiscoveryItem } from "./discoveryModel";

export type PaletteCommand =
  | { kind: "open-news"; id: string }
  | { kind: "new-news" }
  | { kind: "open-artifact"; id: string; status: string }
  | { kind: "write-discovery"; id: string }
  | { kind: "tab"; tab: "news" | "discovery" | "revision" | "publish" };

interface Entry {
  key: string;
  group: string;
  title: string;
  hint: string;
  icon: typeof Search;
  command: PaletteCommand;
}

interface ArtifactSummary { id: string; title: string; status: string }
interface NewsSummary { id: string; title: string; status: NewsStatus; category: string | null }

const ACTIONS: Entry[] = [
  { key: "a-new", group: "Acciones", title: "Nueva noticia", hint: "N", icon: Plus, command: { kind: "new-news" } },
  { key: "a-discovery", group: "Acciones", title: "Buscar noticias nuevas (Descubrir)", hint: "", icon: Compass, command: { kind: "tab", tab: "discovery" } },
  { key: "a-revision", group: "Acciones", title: "Ir a Revisión", hint: "", icon: FileEdit, command: { kind: "tab", tab: "revision" } },
  { key: "a-publish", group: "Acciones", title: "Ir a la cola de publicación", hint: "", icon: Rocket, command: { kind: "tab", tab: "publish" } },
];

const ARTIFACT_LABEL: Record<string, string> = {
  DRAFT: "Borrador IA", REVIEW_REQUIRED: "Requiere revisión", VALIDATED: "Listo para aprobar", APPROVED: "Listo para publicar",
};

export default function CommandPalette({ onClose, onCommand }: { onClose: () => void; onCommand: (command: PaletteCommand) => void }) {
  const [query, setQuery] = useState("");
  const [news, setNews] = useState<NewsSummary[]>([]);
  const [artifacts, setArtifacts] = useState<ArtifactSummary[] | null>(null);
  const [discovered, setDiscovered] = useState<DiscoveryItem[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  // Review queue and discovery feed are small: fetched once per opening, filtered locally.
  useEffect(() => {
    let cancelled = false;
    void Promise.all(["DRAFT", "REVIEW_REQUIRED", "VALIDATED", "APPROVED"].map(async (status) => {
      const res = await apiFetch(`/api/artifacts?status=${status}&limit=50`);
      return res.ok ? ((await res.json()).artifacts ?? []) as ArtifactSummary[] : [];
    })).then((lists) => { if (!cancelled) setArtifacts(lists.flat()); }).catch(() => { if (!cancelled) setArtifacts([]); });
    void Promise.all(["DISCOVERED", "SELECTED"].map(async (status) => {
      const res = await apiFetch(`/api/discovery/items?status=${status}&sort_by=discovered_at&sort_dir=desc&limit=100`);
      return res.ok ? ((await res.json()).items ?? []) as DiscoveryItem[] : [];
    })).then((lists) => { if (!cancelled) setDiscovered(lists.flat()); }).catch(() => { if (!cancelled) setDiscovered([]); });
    return () => { cancelled = true; };
  }, []);

  // News live in the database: searched server-side, so nothing is out of reach.
  useEffect(() => {
    let cancelled = false;
    setSearching(true);
    const timer = window.setTimeout(async () => {
      const { data } = await applyNewsFilters(supabase.from("news").select("id,title,status,category"), { filter: "all", category: "all", search: query })
        .order("updated_at", { ascending: false, nullsFirst: false })
        .limit(6);
      if (!cancelled) {
        setNews((data ?? []) as NewsSummary[]);
        setSearching(false);
      }
    }, 180);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [query]);

  const entries = useMemo<Entry[]>(() => {
    const result: Entry[] = [];
    result.push(...rankMatches(ACTIONS, query, (entry) => entry.title, query ? 2 : 4));
    result.push(...news.map((item) => ({
      key: `n-${item.id}`, group: "Noticias", title: item.title || "Sin título",
      hint: `${STATUS_LABEL[item.status] ?? item.status}${item.category ? ` · ${item.category}` : ""}`,
      icon: FileText, command: { kind: "open-news", id: item.id } as PaletteCommand,
    })));
    result.push(...rankMatches(artifacts ?? [], query, (item) => item.title).map((item) => ({
      key: `r-${item.id}`, group: "Redacción IA", title: item.title || "Sin título", hint: ARTIFACT_LABEL[item.status] ?? item.status,
      icon: FileEdit, command: { kind: "open-artifact", id: item.id, status: item.status } as PaletteCommand,
    })));
    if (query.trim()) {
      result.push(...rankMatches(discovered ?? [], query, (item) => `${item.originalTitle} ${item.sourceName ?? ""}`, 5).map((item) => ({
        key: `d-${item.id}`, group: "Descubiertas", title: item.originalTitle, hint: `${sourceLabel(item.sourceName, item.sourceDomain)} · escribir`,
        icon: Compass, command: { kind: "write-discovery", id: item.id } as PaletteCommand,
      })));
    }
    return result;
  }, [query, news, artifacts, discovered]);

  useEffect(() => { setActive(0); }, [query]);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const run = (entry: Entry | undefined) => {
    if (!entry) return;
    onCommand(entry.command);
    onClose();
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown") { event.preventDefault(); setActive((index) => Math.min(entries.length - 1, index + 1)); }
    else if (event.key === "ArrowUp") { event.preventDefault(); setActive((index) => Math.max(0, index - 1)); }
    else if (event.key === "Enter") { event.preventDefault(); run(entries[active]); }
    else if (event.key === "Escape") { event.preventDefault(); onClose(); }
  };

  let lastGroup = "";
  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center bg-black/60 p-4 pt-[12vh] backdrop-blur-[2px]" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label="Buscar en el editorial" className="w-full max-w-xl overflow-hidden rounded-2xl border border-white/10 bg-neutral-950 shadow-2xl">
        <label className="flex items-center gap-2.5 border-b border-white/10 px-4">
          <Search size={15} className="text-neutral-500" />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Buscar noticias, borradores, artículos en revisión o fuentes…"
            className="h-12 min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-neutral-600"
            aria-label="Buscar"
          />
          {searching && <LoaderCircle size={14} className="animate-spin text-neutral-600" />}
          <kbd className="rounded border border-white/10 px-1.5 py-0.5 text-[9px] text-neutral-500">Esc</kbd>
        </label>
        <div ref={listRef} className="max-h-[55vh] overflow-y-auto p-1.5" role="listbox">
          {entries.length === 0 && <p className="px-3 py-6 text-center text-xs text-neutral-500">{searching ? "Buscando…" : "Sin resultados"}</p>}
          {entries.map((entry, index) => {
            const header = entry.group !== lastGroup ? entry.group : null;
            lastGroup = entry.group;
            const Icon = entry.icon;
            return (
              <div key={entry.key}>
                {header && <p className="px-2.5 pb-1 pt-2 text-[9px] font-semibold uppercase tracking-[0.16em] text-neutral-600">{header}</p>}
                <button
                  type="button"
                  role="option"
                  aria-selected={index === active}
                  data-index={index}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => run(entry)}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left ${index === active ? "bg-white/10" : "hover:bg-white/[0.05]"}`}
                >
                  <Icon size={14} className="flex-shrink-0 text-neutral-500" />
                  <span className="min-w-0 flex-1 truncate text-[12px] text-neutral-100">{entry.title}</span>
                  {entry.hint && <span className="max-w-[45%] flex-shrink-0 truncate text-[10px] text-neutral-500">{entry.hint}</span>}
                  {index === active && <ArrowRight size={12} className="flex-shrink-0 text-neutral-500" />}
                </button>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-3 border-t border-white/10 px-4 py-2 text-[10px] text-neutral-600">
          <span><kbd className="text-neutral-400">↑↓</kbd> moverse</span>
          <span><kbd className="text-neutral-400">Enter</kbd> abrir</span>
          <span className="ml-auto">Ctrl/⌘ K</span>
        </div>
      </div>
    </div>
  );
}
