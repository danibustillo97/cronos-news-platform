"use client";

// "Encuestas": polls and debates for the portal. Create, edit, open/close,
// feature one on the homepage, attach one to an article, and watch results.
// Layout: a horizontal rail of polls on top (no side list stealing width),
// the editor in the middle and a live portal preview beside it (below on
// phones), with a sticky save bar on small screens.
// Contract: backend/app/presentation/api/polls.py

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BarChart3, ChevronLeft, ChevronRight, Eye, Link2, Loader2, Plus, Search, Sparkles, Star, Swords, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/studio/lab/api-client";
import { supabase } from "@/lib/supabaseClient";
import { emptyDraft, draftFromPoll, draftProblem, draftToPayload, percent, type AdminPoll, type PollDraft } from "./pollDraft";
import PollGenerator from "./PollGenerator";
import type { PollProposal } from "./pollPrompt";

interface NewsHit { id: string; title: string }
type Filter = "all" | AdminPoll["status"];

const STATUS_LABEL: Record<AdminPoll["status"], string> = { draft: "Borrador", open: "Abierta", closed: "Cerrada" };
const STATUS_DOT: Record<AdminPoll["status"], string> = { draft: "bg-neutral-500", open: "bg-emerald-400", closed: "bg-neutral-700" };

async function errorMessage(response: Response): Promise<string> {
  const body = await response.json().catch(() => null);
  return body?.detail && typeof body.detail === "string" ? body.detail : `HTTP ${response.status}`;
}

export default function PollsStudio() {
  const [polls, setPolls] = useState<AdminPoll[] | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState<PollDraft>(emptyDraft("poll"));
  const [saving, setSaving] = useState(false);
  const [newsQuery, setNewsQuery] = useState("");
  const [newsHits, setNewsHits] = useState<NewsHit[]>([]);
  const [newsTitle, setNewsTitle] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [generatorOpen, setGeneratorOpen] = useState(true);
  const railRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const response = await apiFetch("/api/admin/polls").catch(() => null);
    if (!response) { setSetupError("No se pudo conectar con el backend."); setPolls([]); return; }
    if (!response.ok) { setSetupError(await errorMessage(response)); setPolls([]); return; }
    setSetupError(null);
    setPolls(await response.json());
  }, []);
  useEffect(() => { void load(); }, [load]);

  const current = useMemo(() => polls?.find((p) => p.id === selected) ?? null, [polls, selected]);
  const counts = useMemo(() => {
    const c = { all: 0, draft: 0, open: 0, closed: 0 } as Record<Filter, number>;
    for (const p of polls ?? []) { c.all += 1; c[p.status] += 1; }
    return c;
  }, [polls]);
  const shown = useMemo(() => (polls ?? []).filter((p) => filter === "all" || p.status === filter), [polls, filter]);

  // Article link: show the linked title, search published news to link one.
  useEffect(() => {
    if (!draft.newsId) { setNewsTitle(null); return; }
    supabase.from("news").select("title").eq("id", draft.newsId).maybeSingle()
      .then(({ data }) => setNewsTitle((data as { title?: string } | null)?.title ?? draft.newsId));
  }, [draft.newsId]);
  useEffect(() => {
    const q = newsQuery.trim();
    if (q.length < 3) { setNewsHits([]); return; }
    const timer = setTimeout(() => {
      supabase.from("news").select("id,title").eq("status", "published").ilike("title", `%${q}%`)
        .order("published_at", { ascending: false }).limit(6)
        .then(({ data }) => setNewsHits((data as NewsHit[] | null) ?? []));
    }, 250);
    return () => clearTimeout(timer);
  }, [newsQuery]);

  const focusEditor = () => requestAnimationFrame(() => editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  const startNew = (kind: PollDraft["kind"]) => { setSelected(null); setDraft(emptyDraft(kind)); setNewsQuery(""); setGeneratorOpen(false); focusEditor(); };
  const applyProposal = (proposal: PollProposal, newsId: string | null) => {
    setSelected(null);
    setNewsQuery("");
    setDraft({
      ...emptyDraft(proposal.kind),
      question: proposal.question,
      context: proposal.context,
      options: proposal.options.map((o) => ({ key: crypto.randomUUID(), label: o.label, argument: o.argument })),
      newsId: newsId ?? "",
      placement: newsId ? ["home", "pulse", "article"] : ["home", "pulse"],
    });
    setGeneratorOpen(false);
    focusEditor();
    toast.success("Listo en el formulario: revísala y publícala.");
  };
  const open = (poll: AdminPoll) => { setSelected(poll.id); setDraft(draftFromPoll(poll)); setNewsQuery(""); setGeneratorOpen(false); focusEditor(); };
  const patchDraft = (patch: Partial<PollDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const setOption = (index: number, patch: Partial<PollDraft["options"][number]>) =>
    setDraft((d) => ({ ...d, options: d.options.map((o, i) => (i === index ? { ...o, ...patch } : o)) }));

  const problem = draftProblem(draft);

  const save = async () => {
    if (problem) { toast.error(problem); return; }
    setSaving(true);
    try {
      const response = await apiFetch(selected ? `/api/admin/polls/${selected}` : "/api/admin/polls", {
        method: selected ? "PATCH" : "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draftToPayload(draft, Boolean(selected))),
      });
      if (!response.ok) throw new Error(await errorMessage(response));
      const poll: AdminPoll = await response.json();
      toast.success(selected ? "Encuesta actualizada" : draft.status === "open" ? "Encuesta publicada" : "Borrador guardado");
      await load();
      setSelected(poll.id);
      setDraft(draftFromPoll(poll));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  const quick = async (poll: AdminPoll, patch: Record<string, unknown>, done: string) => {
    const response = await apiFetch(`/api/admin/polls/${poll.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch),
    });
    if (!response.ok) { toast.error(await errorMessage(response)); return; }
    toast.success(done);
    const updated: AdminPoll = await response.json();
    await load();
    if (selected === poll.id) setDraft(draftFromPoll(updated));
  };

  const remove = async (poll: AdminPoll) => {
    if (!window.confirm(`¿Eliminar "${poll.question}" y sus ${poll.totalVotes} votos?`)) return;
    const response = await apiFetch(`/api/admin/polls/${poll.id}`, { method: "DELETE" });
    if (!response.ok) { toast.error(await errorMessage(response)); return; }
    toast.success("Encuesta eliminada");
    if (selected === poll.id) startNew("poll");
    await load();
  };

  const scrollRail = (dir: -1 | 1) => railRef.current?.scrollBy({ left: dir * 520, behavior: "smooth" });

  if (polls === null) {
    return <div className="flex h-full items-center justify-center text-sm text-neutral-500"><Loader2 size={16} className="mr-2 animate-spin" /> Cargando encuestas…</div>;
  }

  const isDebate = draft.kind === "debate";
  const saveLabel = selected ? "Guardar cambios" : draft.status === "open" ? "Publicar" : "Guardar borrador";

  return (
    <div className="h-full overflow-y-auto bg-[#080808] text-[12.5px] text-neutral-300">
      {/* ── Top: actions + rail of polls ─────────────────────────────── */}
      <header className="border-b border-white/[0.07] bg-[#0b0b0b]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 pb-2 pt-4 sm:px-6">
          <div className="w-full sm:mr-auto sm:w-auto">
            <h2 className="text-[15px] font-semibold text-white">Encuestas y debates</h2>
            <p className="text-[11.5px] text-neutral-500">{counts.open} abiertas · {counts.all} en total</p>
          </div>
          <button type="button" onClick={() => setGeneratorOpen((o) => !o)}
            className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-semibold sm:flex-none ${generatorOpen ? "bg-yellow-400/15 text-yellow-200 ring-1 ring-yellow-400/40" : "bg-yellow-400 text-black hover:bg-yellow-300"}`}>
            <Sparkles size={14} /> Crear rápido
          </button>
          <button type="button" onClick={() => startNew("poll")} className="inline-flex flex-1 items-center justify-center gap-1.5 sm:flex-none rounded-lg border border-white/15 px-3 py-2 text-[12px] font-semibold text-neutral-100 hover:border-white/40">
            <Plus size={14} /> Encuesta
          </button>
          <button type="button" onClick={() => startNew("debate")} className="inline-flex flex-1 items-center justify-center gap-1.5 sm:flex-none rounded-lg border border-white/15 px-3 py-2 text-[12px] font-semibold text-neutral-100 hover:border-white/40">
            <Swords size={14} /> Debate
          </button>
        </div>

        {setupError ? (
          <p className="mx-auto mb-3 max-w-6xl px-4 sm:px-6"><span className="block rounded-lg border border-amber-500/30 bg-amber-500/[0.07] p-3 text-[11.5px] text-amber-200">{setupError}</span></p>
        ) : polls.length > 0 && (
          <div className="mx-auto max-w-6xl px-4 pb-3 sm:px-6">
            <div className="mb-2 flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none]">
              {([["all", "Todas"], ["open", "Abiertas"], ["draft", "Borradores"], ["closed", "Cerradas"]] as const).map(([id, label]) => (
                <button key={id} type="button" onClick={() => setFilter(id)}
                  className={`flex-shrink-0 rounded-full px-2.5 py-1 text-[11.5px] ${filter === id ? "bg-white text-black" : "text-neutral-400 hover:bg-white/[0.06] hover:text-white"}`}>
                  {label} <span className="opacity-60">{counts[id]}</span>
                </button>
              ))}
              <span className="ml-auto hidden flex-shrink-0 gap-1 md:flex">
                <button type="button" aria-label="Anteriores" onClick={() => scrollRail(-1)} className="rounded-full border border-white/10 p-1 text-neutral-400 hover:text-white"><ChevronLeft size={14} /></button>
                <button type="button" aria-label="Siguientes" onClick={() => scrollRail(1)} className="rounded-full border border-white/10 p-1 text-neutral-400 hover:text-white"><ChevronRight size={14} /></button>
              </span>
            </div>
            <div ref={railRef} className="-mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {shown.length === 0 && <p className="py-3 text-[12px] text-neutral-500">Nada en este filtro.</p>}
              {shown.map((poll) => <RailCard key={poll.id} poll={poll} active={selected === poll.id} onClick={() => open(poll)} />)}
            </div>
          </div>
        )}
      </header>

      {generatorOpen && !setupError && (
        <div className="mx-auto max-w-6xl px-4 pt-4 sm:px-6">
          <PollGenerator onUse={applyProposal} onClose={() => setGeneratorOpen(false)} />
        </div>
      )}

      {/* ── Editor + live preview ───────────────────────────────────── */}
      <div ref={editorRef} className="mx-auto grid max-w-6xl scroll-mt-2 gap-6 px-4 pb-8 pt-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:pb-10">
        <div className="min-w-0 space-y-5">
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${isDebate ? "bg-rose-500/10 text-rose-200" : "bg-sky-500/10 text-sky-200"}`}>
              {isDebate ? <Swords size={12} /> : <BarChart3 size={12} />} {selected ? "Editando" : "Nueva"} · {isDebate ? "debate" : "encuesta"}
            </span>
            {current && (
              <button type="button" onClick={() => void remove(current)} className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11.5px] text-neutral-500 hover:bg-red-500/10 hover:text-red-300">
                <Trash2 size={12} /> Eliminar
              </button>
            )}
          </div>

          <textarea value={draft.question} onChange={(e) => patchDraft({ question: e.target.value })} maxLength={200} rows={1}
            aria-label="Pregunta"
            placeholder={isDebate ? "¿James Rodríguez debe ser titular en la Selección?" : "¿Quién gana la final de la Libertadores?"}
            className="min-h-[1.4em] w-full resize-none bg-transparent [field-sizing:content] text-[20px] font-semibold leading-snug text-white outline-none placeholder:text-neutral-600 sm:text-[22px]" />
          <textarea value={draft.context} onChange={(e) => patchDraft({ context: e.target.value })} maxLength={600} rows={1}
            aria-label="Contexto"
            placeholder="Contexto opcional: una línea para situar al lector."
            className="-mt-3 min-h-[1.5em] w-full resize-none bg-transparent [field-sizing:content] text-[13px] text-neutral-400 outline-none placeholder:text-neutral-600" />

          <section>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">{isDebate ? "Las dos posturas" : "Opciones"}</p>
            <div className={isDebate ? "grid gap-2 sm:grid-cols-2" : "space-y-1.5"}>
              {draft.options.map((option, index) => (
                <div key={option.key} className={isDebate ? `rounded-xl border p-3 ${index === 0 ? "border-sky-500/30 bg-sky-500/[0.05]" : "border-rose-500/30 bg-rose-500/[0.05]"}` : "group flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-3 focus-within:border-yellow-400/50"}>
                  {!isDebate && <span className="w-4 text-[11px] font-semibold text-neutral-600">{index + 1}</span>}
                  <input value={option.label} onChange={(e) => setOption(index, { label: e.target.value })} maxLength={120}
                    placeholder={isDebate ? (index === 0 ? "A favor" : "En contra") : `Opción ${index + 1}`}
                    className={isDebate ? "w-full bg-transparent text-[14px] font-semibold text-white outline-none placeholder:text-neutral-600" : "w-full bg-transparent py-2.5 text-[13.5px] text-white outline-none placeholder:text-neutral-600"} />
                  {isDebate ? (
                    <textarea value={option.argument} onChange={(e) => setOption(index, { argument: e.target.value })} maxLength={400} rows={3}
                      placeholder="El argumento de esta postura en 1–2 frases"
                      className="mt-1.5 w-full resize-none bg-transparent text-[12.5px] leading-relaxed text-neutral-300 outline-none placeholder:text-neutral-600" />
                  ) : draft.options.length > 2 && (
                    <button type="button" aria-label="Quitar opción" onClick={() => setDraft((d) => ({ ...d, options: d.options.filter((_, i) => i !== index) }))}
                      className="rounded-md p-1 text-neutral-600 opacity-0 hover:text-red-300 focus:opacity-100 group-hover:opacity-100"><X size={14} /></button>
                  )}
                </div>
              ))}
            </div>
            {!isDebate && draft.options.length < 6 && (
              <button type="button" onClick={() => setDraft((d) => ({ ...d, options: [...d.options, { key: crypto.randomUUID(), label: "", argument: "" }] }))}
                className="mt-2 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] text-yellow-300 hover:bg-yellow-400/10"><Plus size={13} /> Agregar opción</button>
            )}
            {selected && <p className="mt-1.5 text-[10.5px] text-neutral-500">Editar el texto de una opción conserva sus votos; quitarla los borra.</p>}
          </section>

          <section className="grid gap-4 rounded-xl border border-white/[0.07] bg-white/[0.015] p-4 sm:grid-cols-2">
            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Estado</p>
              <div className="flex rounded-lg bg-black/40 p-0.5">
                {(["draft", "open", "closed"] as const).map((status) => (
                  <button key={status} type="button" onClick={() => patchDraft({ status })}
                    className={`flex-1 rounded-md px-2 py-1.5 text-[11.5px] ${draft.status === status ? "bg-white/10 font-semibold text-white" : "text-neutral-500 hover:text-neutral-200"}`}>
                    {STATUS_LABEL[status]}
                  </button>
                ))}
              </div>
            </div>
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Cierra (opcional)</span>
              <input type="datetime-local" value={draft.closesAt} onChange={(e) => patchDraft({ closesAt: e.target.value })}
                className="w-full rounded-lg border border-white/10 bg-black/40 px-2.5 py-1.5 text-white [color-scheme:dark] outline-none focus:border-yellow-400/60" />
            </label>

            <div className="sm:col-span-2">
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Dónde aparece</p>
              <div className="flex flex-wrap gap-1.5">
                {([["home", "Portada"], ["pulse", "Feed"], ["article", "En su noticia"]] as const).map(([place, label]) => {
                  const on = draft.placement.includes(place);
                  return (
                    <button key={place} type="button" aria-pressed={on}
                      onClick={() => patchDraft({ placement: on ? draft.placement.filter((p) => p !== place) : [...draft.placement, place] })}
                      className={`rounded-full border px-3 py-1 text-[11.5px] ${on ? "border-yellow-400/70 bg-yellow-400/10 text-yellow-200" : "border-white/10 text-neutral-400 hover:border-white/30"}`}>
                      {label}
                    </button>
                  );
                })}
                <button type="button" aria-pressed={draft.featured} onClick={() => patchDraft({ featured: !draft.featured })}
                  className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11.5px] ${draft.featured ? "border-yellow-400 bg-yellow-400 font-semibold text-black" : "border-white/10 text-neutral-400 hover:border-white/30"}`}>
                  <Star size={11} fill={draft.featured ? "currentColor" : "none"} /> Debate del día
                </button>
              </div>
              {draft.featured && <p className="mt-1.5 text-[10.5px] text-neutral-500">Solo una ocupa el espacio bajo la noticia destacada: al guardar, la anterior lo deja.</p>}
            </div>

            <div className="sm:col-span-2">
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Noticia vinculada</p>
              {draft.newsId ? (
                <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/30 px-3 py-2">
                  <Link2 size={13} className="flex-shrink-0 text-neutral-500" />
                  <span className="line-clamp-1 flex-1 text-neutral-200">{newsTitle ?? "…"}</span>
                  <button type="button" onClick={() => patchDraft({ newsId: "" })} className="text-[11.5px] text-neutral-400 hover:text-red-300">Quitar</button>
                </div>
              ) : (
                <div className="relative">
                  <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-500" />
                  <input value={newsQuery} onChange={(e) => setNewsQuery(e.target.value)} placeholder="Opcional: busca una noticia publicada…"
                    className="w-full rounded-lg border border-white/10 bg-black/40 py-2 pl-8 pr-3 text-white outline-none focus:border-yellow-400/60" />
                  {newsHits.length > 0 && (
                    <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-white/10 bg-[#141414] shadow-xl">
                      {newsHits.map((hit) => (
                        <li key={hit.id}>
                          <button type="button" onClick={() => { patchDraft({ newsId: hit.id, placement: draft.placement.includes("article") ? draft.placement : [...draft.placement, "article"] }); setNewsQuery(""); }}
                            className="w-full px-3 py-2 text-left text-[12px] text-neutral-200 hover:bg-white/[0.06]">{hit.title}</button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* Desktop save row */}
          <div className="hidden items-center gap-3 lg:flex">
            <SaveButton saving={saving} disabled={saving || Boolean(problem) || Boolean(setupError)} onClick={() => void save()} label={saveLabel} />
            {problem && <span className="text-[11.5px] text-neutral-500">{problem}</span>}
          </div>
        </div>

        {/* Live preview (sticky on desktop, below the form on phones) */}
        <aside className="lg:sticky lg:top-4 lg:self-start">
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-500"><Eye size={12} /> Así se verá en el portal</p>
          <Preview draft={draft} poll={current} />
          {current && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {current.status !== "open" && <QuickButton onClick={() => void quick(current, { status: "open" }, "Votación abierta")}>Abrir votación</QuickButton>}
              {current.status === "open" && <QuickButton onClick={() => void quick(current, { status: "closed" }, "Votación cerrada")}>Cerrar votación</QuickButton>}
              {!current.featured && <QuickButton onClick={() => void quick(current, { featured: true }, "Ahora es el debate del día")}>Hacerla debate del día</QuickButton>}
            </div>
          )}
        </aside>
      </div>

      {/* Phone/tablet sticky save bar */}
      <div className="sticky bottom-0 z-30 border-t border-white/10 bg-[#0b0b0b]/95 py-3 pl-[4.25rem] pr-4 backdrop-blur md:pl-6 lg:hidden">
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          <span className="min-w-0 flex-1 truncate text-[11.5px] text-neutral-500">{problem ?? (selected ? "Cambios listos para guardar" : "Lista para publicar")}</span>
          <SaveButton saving={saving} disabled={saving || Boolean(problem) || Boolean(setupError)} onClick={() => void save()} label={saveLabel} />
        </div>
      </div>
    </div>
  );
}

function RailCard({ poll, active, onClick }: { poll: AdminPoll; active: boolean; onClick: () => void }) {
  const leader = poll.totalVotes > 0 ? Math.max(...poll.options.map((o) => o.votes)) : 0;
  const pct = percent(leader, poll.totalVotes);
  return (
    <button type="button" onClick={onClick} aria-current={active ? "true" : undefined}
      className={`flex w-[230px] flex-shrink-0 snap-start flex-col rounded-xl border p-3 text-left transition ${active ? "border-yellow-400/70 bg-yellow-400/[0.06]" : "border-white/[0.08] bg-white/[0.02] hover:border-white/20"}`}>
      <span className="flex items-center gap-1.5 text-[10.5px] text-neutral-500">
        <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[poll.status]}`} />
        {poll.kind === "debate" ? "Debate" : "Encuesta"} · {STATUS_LABEL[poll.status]}
        {poll.featured && <Star size={10} className="ml-auto text-yellow-400" fill="currentColor" />}
      </span>
      <span className="mt-1.5 line-clamp-2 min-h-[2.6em] text-[12.5px] font-medium leading-snug text-neutral-100">{poll.question}</span>
      <span className="mt-2 h-1 overflow-hidden rounded-full bg-white/10"><span className="block h-full rounded-full bg-yellow-400/80" style={{ width: `${pct}%` }} /></span>
      <span className="mt-1.5 text-[10.5px] text-neutral-500">{poll.totalVotes.toLocaleString("es")} votos{poll.totalVotes > 0 ? ` · lidera con ${pct}%` : ""}</span>
    </button>
  );
}

/** Portal-style card built from the draft; shows real results when editing a saved poll. */
function Preview({ draft, poll }: { draft: PollDraft; poll: AdminPoll | null }) {
  const [mode, setMode] = useState<"vote" | "results">("vote");
  const votesFor = (index: number) => poll?.options.find((o) => o.id === draft.options[index]?.id)?.votes ?? 0;
  const total = poll?.totalVotes ?? 0;
  const results = mode === "results";
  const isDebate = draft.kind === "debate";
  const question = draft.question.trim() || (isDebate ? "La pregunta del debate" : "Tu pregunta aparecerá aquí");

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#111]">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2">
        <span className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-yellow-400">{draft.featured ? (isDebate ? "El debate del día" : "La pregunta del día") : isDebate ? "Debate" : "Encuesta"}</span>
        <div className="flex rounded-md bg-black/50 p-0.5 text-[10.5px]">
          {(["vote", "results"] as const).map((m) => (
            <button key={m} type="button" onClick={() => setMode(m)} className={`rounded px-2 py-0.5 ${mode === m ? "bg-white/10 text-white" : "text-neutral-500"}`}>
              {m === "vote" ? "Antes de votar" : "Resultados"}
            </button>
          ))}
        </div>
      </div>
      <div className="p-4">
        <p className="text-[16px] font-bold leading-snug text-white">{question}</p>
        {draft.context.trim() && <p className="mt-1 text-[12px] text-neutral-400">{draft.context}</p>}

        {isDebate ? (
          <div className="mt-3 space-y-2">
            {results && (
              <div className="flex h-1.5 overflow-hidden rounded-full bg-rose-400/70">
                <span className="bg-sky-400" style={{ width: `${total ? percent(votesFor(0), total) : 50}%` }} />
              </div>
            )}
            {draft.options.map((o, i) => (
              <div key={o.key} className={`rounded-xl border p-3 ${i === 0 ? "border-sky-500/30 bg-sky-500/[0.06]" : "border-rose-500/30 bg-rose-500/[0.06]"}`}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className={`text-[10px] font-bold uppercase tracking-wide ${i === 0 ? "text-sky-300" : "text-rose-300"}`}>Lado {i === 0 ? "A" : "B"}</span>
                  {results && <span className="text-[13px] font-bold tabular-nums text-white">{percent(votesFor(i), total)}%</span>}
                </div>
                <p className="mt-0.5 text-[13px] font-semibold text-white">{o.label || `Postura ${i + 1}`}</p>
                {o.argument && <p className="mt-1 text-[11.5px] leading-relaxed text-neutral-400">{o.argument}</p>}
              </div>
            ))}
          </div>
        ) : (
          <ul className="mt-3 space-y-1.5">
            {draft.options.map((o, i) => {
              const pct = percent(votesFor(i), total);
              return (
                <li key={o.key} className="relative overflow-hidden rounded-lg border border-white/10 px-3 py-2">
                  {results && <span className="absolute inset-y-0 left-0 bg-yellow-400/15" style={{ width: `${pct}%` }} />}
                  <span className="relative flex justify-between gap-2 text-[12.5px]">
                    <span className="text-neutral-100">{o.label || `Opción ${i + 1}`}</span>
                    {results && <span className="tabular-nums text-neutral-400">{pct}%</span>}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-3 text-[10.5px] text-neutral-500">{results ? `${total.toLocaleString("es")} votos` : "Toca una opción para votar"}</p>
      </div>
    </div>
  );
}

function SaveButton({ saving, disabled, onClick, label }: { saving: boolean; disabled: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg bg-yellow-400 px-4 py-2 text-[12.5px] font-semibold text-black hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-40">
      {saving && <Loader2 size={14} className="animate-spin" />} {label}
    </button>
  );
}

function QuickButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="rounded-md border border-white/15 px-2.5 py-1 text-[11.5px] text-neutral-200 hover:border-white/40">
      {children}
    </button>
  );
}
