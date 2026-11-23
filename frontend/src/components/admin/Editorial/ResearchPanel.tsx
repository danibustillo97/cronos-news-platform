"use client";

// "Buscar información" while writing: published articles to link (internal links help
// readers and SEO) and discovered source material to quote, inserted at the cursor.

import { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { BookOpen, ExternalLink, Link2, LoaderCircle, Quote, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import { apiFetch } from "@/studio/lab/api-client";
import { applyNewsFilters } from "./newsQuery";
import { rankMatches } from "./paletteSearch";
import { internalLink, snippetAround, sourceQuote } from "./research";
import { safeHttpUrl } from "./safeLinks";
import { sourceLabel, type DiscoveryItem } from "./DiscoveryRow";

interface PublishedHit { id: string; title: string; slug: string; category: string | null }

export default function ResearchPanel({ editor, initialQuery = "", excludeId }: { editor: Editor | null; initialQuery?: string; excludeId?: string | null }) {
  const [query, setQuery] = useState(initialQuery);
  const [published, setPublished] = useState<PublishedHit[]>([]);
  const [sources, setSources] = useState<DiscoveryItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const sourcesRequested = useRef(false);

  // Discovery material is fetched once, on the first search.
  useEffect(() => {
    if (!query.trim() || sourcesRequested.current) return;
    sourcesRequested.current = true;
    void Promise.all(["SELECTED", "SENT_TO_EDITORIAL", "DISCOVERED"].map(async (status) => {
      const res = await apiFetch(`/api/discovery/items?status=${status}&sort_by=discovered_at&sort_dir=desc&limit=100`);
      return res.ok ? ((await res.json()).items ?? []) as DiscoveryItem[] : [];
    })).then((lists) => setSources(lists.flat())).catch(() => setSources([]));
  }, [query]);

  useEffect(() => {
    const term = query.trim();
    if (!term) { setPublished([]); return; }
    let cancelled = false;
    setLoading(true);
    const timer = window.setTimeout(async () => {
      const { data } = await applyNewsFilters(supabase.from("news").select("id,title,slug,category"), { filter: "published", category: "all", search: term })
        .order("published_at", { ascending: false, nullsFirst: false })
        .limit(6);
      if (cancelled) return;
      setPublished(((data ?? []) as PublishedHit[]).filter((item) => item.id !== excludeId));
      setLoading(false);
    }, 250);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [query, excludeId]);

  const insert = (content: Parameters<Editor["commands"]["insertContent"]>[0], done: string) => {
    if (!editor) { toast.error("Haz clic en el cuerpo de la noticia y vuelve a intentarlo"); return; }
    editor.chain().focus().insertContent(content).run();
    toast.success(done);
  };

  const sourceHits = query.trim() && sources ? rankMatches(sources, query, (item) => `${item.originalTitle} ${item.rawText.slice(0, 600)}`, 5) : [];

  return (
    <section className="rounded-xl border border-white/[0.07] bg-[#0b0b0d] p-3.5">
      <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-neutral-200"><BookOpen size={13} /> Buscar información</h3>
      <label className="flex items-center gap-2 rounded-lg border border-white/[0.09] bg-[#09090b] px-2.5">
        <Search size={12} className="text-neutral-600" />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tema, equipo, jugador…" aria-label="Buscar información" className="h-8 min-w-0 flex-1 bg-transparent text-[11px] text-neutral-200 outline-none placeholder:text-neutral-600" />
        {loading && <LoaderCircle size={12} className="animate-spin text-neutral-600" />}
      </label>

      {query.trim() && (
        <div className="mt-3 space-y-3">
          <div>
            <p className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-neutral-600">Publicadas · enlazar</p>
            {published.length === 0 && !loading && <p className="text-[10px] text-neutral-600">Sin noticias publicadas sobre esto.</p>}
            {published.map((item) => (
              <div key={item.id} className="flex items-center gap-1.5 py-1">
                <span className="min-w-0 flex-1 truncate text-[11px] text-neutral-300" title={item.title}>{item.title}</span>
                <button type="button" onClick={() => insert(internalLink(item.title, item.slug), "Enlace insertado")} title="Insertar enlace en el cursor" className="rounded p-1 text-neutral-500 hover:bg-white/10 hover:text-white"><Link2 size={12} /></button>
              </div>
            ))}
          </div>
          <div>
            <p className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-neutral-600">Fuentes descubiertas · citar</p>
            {sources === null && <p className="text-[10px] text-neutral-600">Cargando fuentes…</p>}
            {sources && sourceHits.length === 0 && <p className="text-[10px] text-neutral-600">Sin material de fuentes sobre esto.</p>}
            {sourceHits.map((item) => {
              const snippet = snippetAround(item.rawText || item.originalTitle, query);
              const name = sourceLabel(item.sourceName, item.sourceDomain);
              const href = safeHttpUrl(item.originalUrl);
              return (
                <div key={item.id} className="border-t border-white/[0.05] py-1.5 first:border-t-0">
                  <div className="flex items-center gap-1.5">
                    <span className="min-w-0 flex-1 truncate text-[11px] text-neutral-300" title={item.originalTitle}>{item.originalTitle}</span>
                    <button type="button" onClick={() => insert(sourceQuote(snippet, name, item.originalUrl), "Cita insertada")} title="Insertar cita con la fuente" className="rounded p-1 text-neutral-500 hover:bg-white/10 hover:text-white"><Quote size={12} /></button>
                    {href && <a href={href} target="_blank" rel="noreferrer" title="Abrir fuente" className="rounded p-1 text-neutral-500 hover:bg-white/10 hover:text-white"><ExternalLink size={12} /></a>}
                  </div>
                  <p className="mt-0.5 line-clamp-3 text-[10px] leading-relaxed text-neutral-500">{snippet}</p>
                  <p className="text-[9px] text-neutral-600">{name}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
