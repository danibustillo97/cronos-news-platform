"use client";

// "Crear rápido": proposals for polls/debates from a published story, today's
// matches or a free topic. Same two modes as the article editor:
//  - IA automática: the backend runs the prompt with the configured provider.
//  - ChatGPT: copy the prompt, paste the answer (one code block) back.
// One prompt and one parser for both (pollPrompt.ts).

import { useEffect, useState } from "react";
import { Bot, ClipboardCopy, ClipboardPaste, Loader2, Newspaper, Search, Sparkles, Trophy, Type, X } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/studio/lab/api-client";
import { supabase } from "@/lib/supabaseClient";
import { buildPollPrompt, parsePollAnswer, type PollProposal, type PollSource } from "./pollPrompt";
import type { PollKind } from "./pollDraft";

type SourceType = PollSource["type"];
interface NewsPick { id: string; title: string; excerpt: string | null; content: string | null }
interface Match { homeTeam: string; awayTeam: string; leagueName: string; status: string; statusDetail?: string; homeScore?: number; awayScore?: number; date: string }

const stripHtml = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

function describeMatch(m: Match): string {
  const when = new Date(m.date).toLocaleString("es-CO", { weekday: "short", hour: "numeric", minute: "2-digit" });
  const score = m.status === "scheduled" ? when : `${m.homeScore ?? 0}-${m.awayScore ?? 0} (${m.status === "live" ? `en vivo ${m.statusDetail ?? ""}`.trim() : "final"})`;
  return `${m.homeTeam} vs ${m.awayTeam} · ${m.leagueName} · ${score}`;
}

export default function PollGenerator({ onUse, onClose }: {
  onUse: (proposal: PollProposal, newsId: string | null) => void;
  onClose: () => void;
}) {
  const [sourceType, setSourceType] = useState<SourceType>("news");
  const [kind, setKind] = useState<PollKind | "mix">("mix");
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<NewsPick[]>([]);
  const [news, setNews] = useState<NewsPick | null>(null);
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [topic, setTopic] = useState("");
  const [busy, setBusy] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasted, setPasted] = useState("");
  const [proposals, setProposals] = useState<PollProposal[]>([]);

  // Latest published stories by default; search narrows them.
  useEffect(() => {
    if (sourceType !== "news") return;
    const q = query.trim();
    const timer = setTimeout(() => {
      let req = supabase.from("news").select("id,title,excerpt,content").eq("status", "published");
      if (q.length >= 3) req = req.ilike("title", `%${q}%`);
      req.order("published_at", { ascending: false }).limit(6).then(({ data }) => setHits((data as NewsPick[] | null) ?? []));
    }, q ? 250 : 0);
    return () => clearTimeout(timer);
  }, [query, sourceType]);

  useEffect(() => {
    if (sourceType !== "matches" || matches) return;
    fetch("/api/sports/scoreboard").then((r) => (r.ok ? r.json() : [])).then((rows: Match[]) => {
      setMatches(rows);
      setPicked(new Set(rows.map((_, i) => i).slice(0, 6)));
    }).catch(() => setMatches([]));
  }, [sourceType, matches]);

  const source = (): PollSource | null => {
    if (sourceType === "news") {
      if (!news) return null;
      return { type: "news", title: news.title, excerpt: news.excerpt ?? undefined, body: stripHtml(news.content ?? "") };
    }
    if (sourceType === "matches") {
      const list = (matches ?? []).filter((_, i) => picked.has(i)).map(describeMatch);
      return list.length ? { type: "matches", matches: list } : null;
    }
    return topic.trim().length >= 8 ? { type: "topic", text: topic } : null;
  };

  const missing = sourceType === "news" ? "Elige una noticia." : sourceType === "matches" ? "Elige al menos un partido." : "Escribe el tema (mínimo 8 caracteres).";

  const prompt = () => {
    const src = source();
    if (!src) { toast.error(missing); return null; }
    const today = new Date().toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    return buildPollPrompt({ kind, count: 3, source: src, today });
  };

  const read = (answer: string) => {
    const found = parsePollAnswer(answer);
    if (!found.length) { toast.error("No encontré propuestas en la respuesta. Revisa que traiga PREGUNTA y OPCIÓN/POSTURA."); return false; }
    setProposals(found);
    toast.success(`${found.length} propuesta(s) lista(s). Elige una.`);
    return true;
  };

  const generate = async () => {
    const text = prompt();
    if (!text) return;
    setBusy(true);
    try {
      const response = await apiFetch("/api/admin/polls/ai", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: text }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(typeof body?.detail === "string" ? body.detail : `HTTP ${response.status}`);
      read(body.text);
    } catch (err) {
      toast.error(err instanceof Error ? `${err.message} · Usa el modo ChatGPT.` : "La IA no respondió. Usa el modo ChatGPT.");
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    const text = prompt();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Prompt copiado. Pégalo en ChatGPT, copia su bloque con «Copiar código» y pégalo aquí.");
      setPasteOpen(true);
    } catch {
      toast.error("El navegador no dejó copiar al portapapeles.");
    }
  };

  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setPasted(text);
      if (read(text)) setPasteOpen(false);
    } catch {
      toast.error("Pega con Ctrl+V dentro del recuadro.");
    }
  };

  return (
    <div className="rounded-xl border border-yellow-400/30 bg-yellow-400/[0.03] p-4">
      <div className="flex items-center gap-2">
        <Sparkles size={15} className="text-yellow-300" />
        <h3 className="text-[13px] font-semibold text-white">Crear rápido</h3>
        <span className="text-[11px] text-neutral-500">3 propuestas listas para usar</span>
        <button type="button" onClick={onClose} aria-label="Cerrar" className="ml-auto rounded p-1 text-neutral-500 hover:bg-white/5 hover:text-white"><X size={14} /></button>
      </div>

      {/* Source */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {([["news", "Desde una noticia", Newspaper], ["matches", "Partidos de hoy", Trophy], ["topic", "Tema libre", Type]] as const).map(([id, label, Icon]) => (
          <button key={id} type="button" onClick={() => setSourceType(id)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11.5px] ${sourceType === id ? "border-yellow-400 bg-yellow-400/10 text-yellow-200" : "border-white/10 text-neutral-400 hover:border-white/30"}`}>
            <Icon size={12} /> {label}
          </button>
        ))}
        <span className="mx-1 hidden w-px bg-white/10 sm:block" /><span className="basis-full sm:hidden" />
        {([["mix", "Mezcla"], ["poll", "Encuestas"], ["debate", "Debates"]] as const).map(([id, label]) => (
          <button key={id} type="button" onClick={() => setKind(id)}
            className={`rounded-full border px-3 py-1 text-[11.5px] ${kind === id ? "border-white bg-white/10 text-white" : "border-white/10 text-neutral-400 hover:border-white/30"}`}>
            {label}
          </button>
        ))}
      </div>

      <div className="mt-3">
        {sourceType === "news" && (
          news ? (
            <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/30 px-3 py-2">
              <Newspaper size={13} className="flex-shrink-0 text-neutral-500" />
              <span className="line-clamp-1 flex-1 text-[12.5px] text-neutral-100">{news.title}</span>
              <button type="button" onClick={() => setNews(null)} className="text-[11.5px] text-neutral-400 hover:text-white">Cambiar</button>
            </div>
          ) : (
            <div>
              <div className="relative">
                <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-500" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Busca una noticia publicada (o elige una reciente)…"
                  className="w-full rounded-lg border border-white/10 bg-black/40 py-2 pl-8 pr-3 text-[12.5px] text-white outline-none focus:border-yellow-400/60" />
              </div>
              <ul className="mt-1.5 space-y-0.5">
                {hits.map((hit) => (
                  <li key={hit.id}>
                    <button type="button" onClick={() => setNews(hit)} className="w-full rounded-md px-2.5 py-1.5 text-left text-[12px] text-neutral-300 hover:bg-white/[0.06] hover:text-white">
                      {hit.title}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )
        )}
        {sourceType === "matches" && (
          matches === null ? <p className="flex items-center gap-2 text-[12px] text-neutral-500"><Loader2 size={13} className="animate-spin" /> Cargando partidos…</p>
            : matches.length === 0 ? <p className="text-[12px] text-neutral-500">No hay partidos hoy en las ligas seguidas. Usa una noticia o un tema libre.</p>
              : (
                <ul className="grid gap-1 sm:grid-cols-2">
                  {matches.map((m, i) => (
                    <li key={`${m.homeTeam}-${m.awayTeam}-${i}`}>
                      <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[12px] text-neutral-300 hover:bg-white/[0.04]">
                        <input type="checkbox" checked={picked.has(i)} className="accent-yellow-400"
                          onChange={() => setPicked((s) => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n; })} />
                        <span className="line-clamp-1">{describeMatch(m)}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              )
        )}
        {sourceType === "topic" && (
          <textarea value={topic} onChange={(e) => setTopic(e.target.value)} rows={3} maxLength={2000}
            placeholder="Ej.: El regreso de James a la Selección para las Eliminatorias; Lorenzo lo convocó tras 6 meses sin jugar."
            className="w-full resize-y rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-[12.5px] text-white outline-none focus:border-yellow-400/60" />
        )}
      </div>

      {/* Modes */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        <button type="button" onClick={() => void generate()} disabled={busy}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-yellow-400 px-3 py-2 sm:w-auto text-[12px] font-semibold text-black hover:bg-yellow-300 disabled:opacity-50">
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Bot size={14} />} Generar con IA
        </button>
        <button type="button" onClick={() => void copy()}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/15 px-3 py-2 text-[12px] font-semibold text-neutral-100 hover:border-white/40 sm:flex-none">
          <ClipboardCopy size={14} /> Copiar prompt para ChatGPT
        </button>
        <button type="button" onClick={() => setPasteOpen((o) => !o)}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/15 px-3 py-2 text-[12px] font-semibold text-neutral-100 hover:border-white/40 sm:flex-none">
          <ClipboardPaste size={14} /> Pegar respuesta
        </button>
      </div>

      {pasteOpen && (
        <div className="mt-3 rounded-lg border border-white/10 bg-black/30 p-3">
          <p className="text-[11.5px] text-neutral-400">En ChatGPT pulsa <b className="text-neutral-200">«Copiar código»</b> sobre el bloque de la respuesta y pégalo aquí (también sirve el mensaje completo).</p>
          <textarea value={pasted} onChange={(e) => setPasted(e.target.value)} rows={5} placeholder="PREGUNTA: ¿…?"
            className="mt-2 w-full resize-y rounded-md border border-white/10 bg-black/40 px-2.5 py-2 font-mono text-[11.5px] text-neutral-200 outline-none focus:border-yellow-400/60" />
          <div className="mt-2 flex gap-1.5">
            <button type="button" onClick={() => { if (read(pasted)) setPasteOpen(false); }} disabled={!pasted.trim()}
              className="rounded-md bg-white px-3 py-1.5 text-[11.5px] font-semibold text-black disabled:opacity-40">Leer respuesta</button>
            <button type="button" onClick={() => void pasteFromClipboard()} className="rounded-md border border-white/15 px-3 py-1.5 text-[11.5px] text-neutral-200 hover:border-white/40">Pegar del portapapeles</button>
          </div>
        </div>
      )}

      {proposals.length > 0 && (
        <ul className="mt-4 grid gap-2 lg:grid-cols-3">
          {proposals.map((p, i) => (
            <li key={`${p.question}-${i}`} className="flex flex-col rounded-lg border border-white/10 bg-[#111] p-3">
              <span className="text-[10.5px] font-semibold uppercase tracking-wide text-neutral-500">{p.kind === "debate" ? "Debate" : "Encuesta"}</span>
              <p className="mt-1 text-[12.5px] font-semibold leading-snug text-white">{p.question}</p>
              {p.context && <p className="mt-1 text-[11px] text-neutral-500">{p.context}</p>}
              <ul className="mt-2 flex-1 space-y-1">
                {p.options.map((o) => (
                  <li key={o.label} className="text-[11.5px] text-neutral-300">
                    <span className="font-medium text-neutral-100">{o.label}</span>{o.argument && <span className="text-neutral-500"> — {o.argument}</span>}
                  </li>
                ))}
              </ul>
              <button type="button" onClick={() => onUse(p, sourceType === "news" ? news?.id ?? null : null)}
                className="mt-3 rounded-md bg-yellow-400 px-3 py-1.5 text-[11.5px] font-semibold text-black hover:bg-yellow-300">Usar esta</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
