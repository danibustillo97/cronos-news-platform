"use client";

// "Encuestas": polls and debates for the portal. Create, edit, open/close,
// feature one on the homepage, attach one to an article, and watch results.
// Contract: backend/app/presentation/api/polls.py

import { useCallback, useEffect, useMemo, useState } from "react";
import { BarChart3, Loader2, Plus, Search, Star, Swords, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/studio/lab/api-client";
import { supabase } from "@/lib/supabaseClient";
import { emptyDraft, draftFromPoll, draftProblem, draftToPayload, percent, type AdminPoll, type PollDraft } from "./pollDraft";

interface NewsHit { id: string; title: string }

const STATUS_LABEL: Record<AdminPoll["status"], string> = { draft: "Borrador", open: "Abierta", closed: "Cerrada" };
const STATUS_STYLE: Record<AdminPoll["status"], string> = {
  draft: "border-white/15 text-neutral-400", open: "border-emerald-500/40 text-emerald-300", closed: "border-neutral-600 text-neutral-500",
};

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

  const load = useCallback(async () => {
    const response = await apiFetch("/api/admin/polls").catch(() => null);
    if (!response) { setSetupError("No se pudo conectar con el backend."); setPolls([]); return; }
    if (response.status === 503) { setSetupError(await errorMessage(response)); setPolls([]); return; }
    if (!response.ok) { setSetupError(await errorMessage(response)); setPolls([]); return; }
    setSetupError(null);
    setPolls(await response.json());
  }, []);
  useEffect(() => { void load(); }, [load]);

  const current = useMemo(() => polls?.find((p) => p.id === selected) ?? null, [polls, selected]);

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

  const startNew = (kind: PollDraft["kind"]) => { setSelected(null); setDraft(emptyDraft(kind)); setNewsQuery(""); };
  const open = (poll: AdminPoll) => { setSelected(poll.id); setDraft(draftFromPoll(poll)); setNewsQuery(""); };
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
    await load();
    if (selected === poll.id) setDraft(draftFromPoll(await response.json()));
  };

  const remove = async (poll: AdminPoll) => {
    if (!window.confirm(`¿Eliminar "${poll.question}" y sus ${poll.totalVotes} votos?`)) return;
    const response = await apiFetch(`/api/admin/polls/${poll.id}`, { method: "DELETE" });
    if (!response.ok) { toast.error(await errorMessage(response)); return; }
    toast.success("Encuesta eliminada");
    if (selected === poll.id) startNew("poll");
    await load();
  };

  if (polls === null) {
    return <div className="flex h-full items-center justify-center text-sm text-neutral-500"><Loader2 size={16} className="mr-2 animate-spin" /> Cargando encuestas…</div>;
  }

  const isDebate = draft.kind === "debate";

  return (
    <div className="flex h-full min-h-0 flex-col lg:flex-row">
      {/* List */}
      <aside className="flex max-h-[40vh] min-h-0 w-full flex-shrink-0 flex-col border-b border-white/10 bg-[#0b0b0b] lg:max-h-none lg:w-[360px] lg:border-b-0 lg:border-r">
        <div className="flex gap-1.5 border-b border-white/10 p-3">
          <button type="button" onClick={() => startNew("poll")} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-yellow-400 px-3 py-2 text-[12px] font-semibold text-black hover:bg-yellow-300">
            <Plus size={14} /> Encuesta
          </button>
          <button type="button" onClick={() => startNew("debate")} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/15 px-3 py-2 text-[12px] font-semibold text-neutral-100 hover:border-white/40">
            <Swords size={14} /> Debate
          </button>
        </div>
        {setupError && <p className="m-3 rounded-lg border border-amber-500/30 bg-amber-500/[0.07] p-3 text-[11.5px] text-amber-200">{setupError}</p>}
        <ul className="min-h-0 flex-1 overflow-y-auto p-2">
          {!setupError && polls.length === 0 && <li className="p-4 text-center text-[12px] text-neutral-500">Aún no hay encuestas. Crea la primera.</li>}
          {polls.map((poll) => (
            <li key={poll.id}>
              <button type="button" onClick={() => open(poll)}
                className={`w-full rounded-lg px-3 py-2.5 text-left ${selected === poll.id ? "bg-white/[0.08]" : "hover:bg-white/[0.04]"}`}>
                <span className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-wide text-neutral-500">
                  {poll.kind === "debate" ? <Swords size={11} /> : <BarChart3 size={11} />} {poll.kind === "debate" ? "Debate" : "Encuesta"}
                  {poll.featured && <span className="inline-flex items-center gap-0.5 text-yellow-400"><Star size={10} fill="currentColor" /> Destacada</span>}
                  <span className={`ml-auto rounded border px-1.5 py-px normal-case tracking-normal ${STATUS_STYLE[poll.status]}`}>{STATUS_LABEL[poll.status]}</span>
                </span>
                <span className="mt-1 line-clamp-2 block text-[12.5px] font-medium text-neutral-100">{poll.question}</span>
                <span className="mt-0.5 block text-[11px] text-neutral-500">{poll.totalVotes.toLocaleString("es")} votos</span>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      {/* Editor + results */}
      <section className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto grid max-w-5xl gap-6 p-4 text-[12.5px] text-neutral-300 sm:p-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-4">
            <header className="flex items-center gap-2">
              <h2 className="text-[15px] font-semibold text-white">
                {selected ? "Editar" : "Nueva"} {isDebate ? "debate" : "encuesta"}
              </h2>
              {current && (
                <div className="ml-auto flex gap-1.5">
                  <button type="button" onClick={() => void remove(current)} className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-[11.5px] text-neutral-400 hover:border-red-500/50 hover:text-red-300">
                    <Trash2 size={12} /> Eliminar
                  </button>
                </div>
              )}
            </header>

            <Label text={isDebate ? "La pregunta del debate" : "Pregunta"}>
              <input value={draft.question} onChange={(e) => patchDraft({ question: e.target.value })} maxLength={200}
                placeholder={isDebate ? "¿James Rodríguez debe ser titular en la Selección?" : "¿Quién gana la final de la Libertadores?"}
                className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-[13.5px] text-white outline-none focus:border-yellow-400/60" />
            </Label>
            <Label text="Contexto (opcional)">
              <textarea value={draft.context} onChange={(e) => patchDraft({ context: e.target.value })} maxLength={600} rows={2}
                placeholder="Una o dos líneas para situar al lector."
                className="w-full resize-y rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-white outline-none focus:border-yellow-400/60" />
            </Label>

            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">{isDebate ? "Las dos posturas" : "Opciones (2 a 6)"}</p>
              <div className={isDebate ? "grid gap-2 sm:grid-cols-2" : "space-y-1.5"}>
                {draft.options.map((option, index) => (
                  <div key={option.key} className={isDebate ? `rounded-lg border p-2.5 ${index === 0 ? "border-sky-500/30 bg-sky-500/[0.04]" : "border-rose-500/30 bg-rose-500/[0.04]"}` : "flex items-center gap-1.5"}>
                    <input value={option.label} onChange={(e) => setOption(index, { label: e.target.value })} maxLength={120}
                      placeholder={isDebate ? (index === 0 ? "A favor" : "En contra") : `Opción ${index + 1}`}
                      className="w-full rounded-md border border-white/10 bg-black/40 px-2.5 py-1.5 text-white outline-none focus:border-yellow-400/60" />
                    {isDebate ? (
                      <textarea value={option.argument} onChange={(e) => setOption(index, { argument: e.target.value })} maxLength={400} rows={3}
                        placeholder="El argumento de esta postura en 1-2 frases"
                        className="mt-1.5 w-full resize-y rounded-md border border-white/10 bg-black/40 px-2.5 py-1.5 text-[12px] text-neutral-200 outline-none focus:border-yellow-400/60" />
                    ) : draft.options.length > 2 && (
                      <button type="button" aria-label="Quitar opción" onClick={() => setDraft((d) => ({ ...d, options: d.options.filter((_, i) => i !== index) }))}
                        className="rounded-md p-1.5 text-neutral-500 hover:bg-white/5 hover:text-red-300"><X size={14} /></button>
                    )}
                  </div>
                ))}
              </div>
              {!isDebate && draft.options.length < 6 && (
                <button type="button" onClick={() => setDraft((d) => ({ ...d, options: [...d.options, { key: crypto.randomUUID(), label: "", argument: "" }] }))}
                  className="mt-1.5 inline-flex items-center gap-1 text-[11.5px] text-yellow-300 hover:text-yellow-200"><Plus size={13} /> Agregar opción</button>
              )}
              {selected && <p className="mt-1.5 text-[10.5px] text-neutral-500">Editar el texto de una opción conserva sus votos; quitarla los borra.</p>}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Label text="Estado">
                <div className="flex gap-1">
                  {(["draft", "open", "closed"] as const).map((status) => (
                    <button key={status} type="button" onClick={() => patchDraft({ status })}
                      className={`flex-1 rounded-md border px-2 py-1.5 text-[11.5px] ${draft.status === status ? "border-yellow-400 bg-yellow-400/10 text-yellow-200" : "border-white/10 text-neutral-400 hover:border-white/30"}`}>
                      {STATUS_LABEL[status]}
                    </button>
                  ))}
                </div>
              </Label>
              <Label text="Cierra (opcional)">
                <input type="datetime-local" value={draft.closesAt} onChange={(e) => patchDraft({ closesAt: e.target.value })}
                  className="w-full rounded-md border border-white/10 bg-black/40 px-2.5 py-1.5 text-white [color-scheme:dark] outline-none focus:border-yellow-400/60" />
              </Label>
            </div>

            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Dónde aparece</p>
              <div className="flex flex-wrap gap-1.5">
                {([["home", "Portada"], ["pulse", "Feed Pulso"], ["article", "En su noticia"]] as const).map(([place, label]) => {
                  const on = draft.placement.includes(place);
                  return (
                    <button key={place} type="button" aria-pressed={on}
                      onClick={() => patchDraft({ placement: on ? draft.placement.filter((p) => p !== place) : [...draft.placement, place] })}
                      className={`rounded-full border px-3 py-1 text-[11.5px] ${on ? "border-yellow-400 bg-yellow-400/10 text-yellow-200" : "border-white/10 text-neutral-400 hover:border-white/30"}`}>
                      {label}
                    </button>
                  );
                })}
                <button type="button" aria-pressed={draft.featured} onClick={() => patchDraft({ featured: !draft.featured })}
                  className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11.5px] ${draft.featured ? "border-yellow-400 bg-yellow-400 text-black" : "border-white/10 text-neutral-400 hover:border-white/30"}`}>
                  <Star size={11} fill={draft.featured ? "currentColor" : "none"} /> Destacada en portada
                </button>
              </div>
              {draft.featured && <p className="mt-1.5 text-[10.5px] text-neutral-500">Solo una puede ser la destacada: al guardar, la anterior deja de serlo.</p>}
            </div>

            <Label text="Noticia vinculada (opcional)">
              {draft.newsId ? (
                <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                  <span className="line-clamp-1 flex-1 text-neutral-200">{newsTitle ?? "…"}</span>
                  <button type="button" onClick={() => patchDraft({ newsId: "" })} className="text-[11.5px] text-neutral-400 hover:text-red-300">Quitar</button>
                </div>
              ) : (
                <div className="relative">
                  <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-500" />
                  <input value={newsQuery} onChange={(e) => setNewsQuery(e.target.value)} placeholder="Busca una noticia publicada…"
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
            </Label>

            <div className="flex items-center gap-3 border-t border-white/10 pt-4">
              <button type="button" onClick={() => void save()} disabled={saving || Boolean(problem) || Boolean(setupError)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-yellow-400 px-4 py-2 text-[12.5px] font-semibold text-black hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-40">
                {saving && <Loader2 size={14} className="animate-spin" />}
                {selected ? "Guardar cambios" : draft.status === "open" ? "Publicar" : "Guardar borrador"}
              </button>
              {problem && <span className="text-[11.5px] text-neutral-500">{problem}</span>}
            </div>
          </div>

          {/* Results */}
          <aside className="space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Resultados</p>
            {current ? (
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <p className="text-[13px] font-semibold text-white">{current.question}</p>
                <ul className="mt-3 space-y-2.5">
                  {current.options.map((option) => {
                    const pct = percent(option.votes, current.totalVotes);
                    const leader = current.totalVotes > 0 && option.votes === Math.max(...current.options.map((o) => o.votes));
                    return (
                      <li key={option.id}>
                        <div className="flex justify-between text-[12px]">
                          <span className={leader ? "font-semibold text-white" : "text-neutral-300"}>{option.label}</span>
                          <span className="tabular-nums text-neutral-400">{pct}% · {option.votes.toLocaleString("es")}</span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                          <div className={`h-full rounded-full ${leader ? "bg-yellow-400" : "bg-white/40"}`} style={{ width: `${pct}%` }} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-3 text-[11px] text-neutral-500">{current.totalVotes.toLocaleString("es")} votos en total</p>
                <div className="mt-3 flex flex-wrap gap-1.5 border-t border-white/10 pt-3">
                  {current.status !== "open" && <QuickButton onClick={() => void quick(current, { status: "open" }, "Votación abierta")}>Abrir votación</QuickButton>}
                  {current.status === "open" && <QuickButton onClick={() => void quick(current, { status: "closed" }, "Votación cerrada")}>Cerrar votación</QuickButton>}
                  {!current.featured && <QuickButton onClick={() => void quick(current, { featured: true }, "Ahora es la destacada")}>Destacar</QuickButton>}
                </div>
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-white/10 p-4 text-[11.5px] text-neutral-500">
                Los votos aparecerán aquí en cuanto la publiques. Consejo: las encuestas con 2-3 opciones y una pregunta polémica son las que más votos reciben.
              </p>
            )}
          </aside>
        </div>
      </section>
    </div>
  );
}

function Label({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-neutral-500">{text}</span>
      {children}
    </label>
  );
}

function QuickButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="rounded-md border border-white/15 px-2.5 py-1 text-[11.5px] text-neutral-200 hover:border-white/40">
      {children}
    </button>
  );
}
