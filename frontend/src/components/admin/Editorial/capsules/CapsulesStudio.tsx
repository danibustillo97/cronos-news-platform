"use client";

// "Cápsulas": efemérides, ¿sabías que? and legends for the reels feed and TikTok.
// Create fast (IA automática / ChatGPT copy-paste), edit slides, preview the
// exact 9:16 render, then: copy the TikTok caption, download the carousel
// images, render a vertical video, or send it to the connected TikTok account.
// Contract: backend/app/presentation/api/capsules.py

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown, ArrowUp, Bot, CalendarDays, Globe, Landmark, ClipboardCopy, ClipboardPaste, Crown, Download, Film, ImagePlus, Lightbulb,
  Loader2, Plus, Send, Sparkles, Trash2, X,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/studio/lab/api-client";
import { supabase } from "@/lib/supabaseClient";
import { compressImage } from "@/lib/compressImage";
import { getTikTokAccount, uploadToTikTok } from "@/components/admin/SocialMedia/services/tiktok";
import { KIND_LABEL, buildCapsulePrompt, parseCapsuleAnswer, tiktokCaption, type CapsuleKind, type CapsuleProposal, type ResearchMaterial } from "./capsulePrompt";
import { downloadBlob, renderCapsuleVideo, slideImageUrl, slugify, type CapsuleRender } from "./reelVideo";
import { CapsuleCard } from "@/components/portal/FeedExtras";

interface Capsule extends CapsuleRender {
  id: string;
  caption: string;
  tags: string[];
  sources: string;
  status: "draft" | "published";
  createdAt?: string;
}
type Draft = Omit<Capsule, "id" | "createdAt"> & { id?: string };

const KIND_ICON = { efemeride: CalendarDays, sabias_que: Lightbulb, leyenda: Crown, momento: Landmark } as const;
const KIND_TONE: Record<CapsuleKind, string> = {
  efemeride: "text-yellow-300 bg-yellow-400/10", sabias_que: "text-sky-300 bg-sky-400/10", leyenda: "text-amber-300 bg-amber-400/10", momento: "text-orange-300 bg-orange-400/10",
};

const todayKey = () => {
  const d = new Date();
  return `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const humanToday = () => new Date().toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

function emptyDraft(kind: CapsuleKind): Draft {
  return { kind, title: "", subject: "", year: null, day: kind === "efemeride" ? todayKey() : "", slides: [{ text: "", image: null }, { text: "", image: null }], caption: "", tags: [], sources: "", status: "draft" };
}

function fromApi(row: Record<string, unknown>): Capsule {
  return {
    id: String(row.id), kind: row.kind as CapsuleKind, title: String(row.title ?? ""), subject: String(row.subject ?? ""),
    year: (row.year as number | null) ?? null, day: String(row.date ?? ""), slides: (row.slides as Capsule["slides"]) ?? [],
    caption: String(row.caption ?? ""), tags: (row.tags as string[]) ?? [], sources: String(row.sources ?? ""),
    status: (row.status as Capsule["status"]) ?? "draft", createdAt: row.createdAt as string | undefined,
  };
}

function toPayload(d: Draft): Record<string, unknown> {
  return {
    kind: d.kind, title: d.title.trim(), subject: d.subject.trim() || null, year: d.year, day: d.kind === "efemeride" ? d.day : null,
    slides: d.slides.filter((s) => s.text.trim()).map((s) => ({ text: s.text.trim(), image: s.image || null })),
    tags: d.tags, caption: d.caption.trim() || null, sources: d.sources.trim() || null, status: d.status,
  };
}

export function draftProblem(d: Draft): string | null {
  if (d.title.trim().length < 3) return "Escribe el título.";
  if (!d.slides.some((s) => s.text.trim())) return "Escribe al menos una diapositiva.";
  if (d.kind === "efemeride" && (!/^\d{2}-\d{2}$/.test(d.day) || !d.year)) return "La efeméride necesita fecha y año.";
  if (d.kind === "leyenda" && !d.subject.trim()) return "Escribe el nombre de la leyenda.";
  if (d.status === "published" && !d.sources.trim()) return "Para publicar, indica las fuentes (verifica los datos).";
  return null;
}

async function errorMessage(response: Response): Promise<string> {
  const body = await response.json().catch(() => null);
  return typeof body?.detail === "string" ? body.detail : `HTTP ${response.status}`;
}

export default function CapsulesStudio() {
  const [items, setItems] = useState<Capsule[] | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | CapsuleKind>("all");
  const [draft, setDraft] = useState<Draft>(emptyDraft("efemeride"));
  const [slide, setSlide] = useState(0);
  const [saving, setSaving] = useState(false);
  const [genOpen, setGenOpen] = useState(true);
  const editorRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const response = await apiFetch("/api/admin/capsules").catch(() => null);
    if (!response) { setSetupError("No se pudo conectar con el backend."); setItems([]); return; }
    if (!response.ok) { setSetupError(await errorMessage(response)); setItems([]); return; }
    setSetupError(null);
    setItems(((await response.json()) as Record<string, unknown>[]).map(fromApi));
  }, []);
  useEffect(() => { void load(); }, [load]);

  const shown = useMemo(() => (items ?? []).filter((c) => filter === "all" || c.kind === filter), [items, filter]);
  const todays = useMemo(() => (items ?? []).filter((c) => c.kind === "efemeride" && c.day === todayKey()).length, [items]);
  const problem = draftProblem(draft);
  const patch = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }));
  const setSlideText = (i: number, p: Partial<Draft["slides"][number]>) => setDraft((d) => ({ ...d, slides: d.slides.map((s, k) => (k === i ? { ...s, ...p } : s)) }));
  const focus = () => requestAnimationFrame(() => editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));

  const startNew = (kind: CapsuleKind) => { setDraft(emptyDraft(kind)); setSlide(0); setGenOpen(false); focus(); };
  const open = (c: Capsule) => { setDraft({ ...c }); setSlide(0); setGenOpen(false); focus(); };
  const applyProposal = (p: CapsuleProposal) => {
    setDraft({ kind: p.kind, title: p.title, subject: p.subject, year: p.year, day: p.day, slides: p.slides, caption: p.caption, tags: p.tags, sources: p.sources, status: "draft" });
    setSlide(0);
    setGenOpen(false);
    focus();
    toast.success("Lista en el editor. Verifica los datos y las fuentes antes de publicar.");
  };

  const save = async (override?: Partial<Draft>) => {
    const d = { ...draft, ...override };
    const why = draftProblem(d);
    if (why) { toast.error(why); return; }
    setSaving(true);
    try {
      const response = await apiFetch(d.id ? `/api/admin/capsules/${d.id}` : "/api/admin/capsules", {
        method: d.id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(d.id ? { ...toPayload(d), kind: undefined } : toPayload(d)),
      });
      if (!response.ok) throw new Error(await errorMessage(response));
      const saved = fromApi(await response.json());
      setDraft({ ...saved });
      toast.success(saved.status === "published" ? "Publicada en el feed" : "Borrador guardado");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!draft.id || !window.confirm(`¿Eliminar "${draft.title}"?`)) return;
    const response = await apiFetch(`/api/admin/capsules/${draft.id}`, { method: "DELETE" });
    if (!response.ok) { toast.error(await errorMessage(response)); return; }
    toast.success("Cápsula eliminada");
    startNew(draft.kind);
    await load();
  };

  const uploadImage = async (index: number, original: File) => {
    try {
      const file = await compressImage(original);
      const response = await apiFetch("/api/admin/capsules/upload-url", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ filename: file.name, contentType: file.type }),
      });
      if (!response.ok) throw new Error(await errorMessage(response));
      const { path, token, publicUrl } = await response.json();
      const { error } = await supabase.storage.from("media").uploadToSignedUrl(path, token, file, { contentType: file.type });
      if (error) throw error;
      setSlideText(index, { image: publicUrl });
      toast.success("Imagen lista");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo subir la imagen");
    }
  };

  if (items === null) {
    return <div className="flex h-full items-center justify-center text-sm text-neutral-500"><Loader2 size={16} className="mr-2 animate-spin" /> Cargando cápsulas…</div>;
  }

  return (
    <div className="h-full overflow-y-auto bg-[#080808] text-[12.5px] text-neutral-300">
      <header className="border-b border-white/[0.07] bg-[#0b0b0b]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 pb-2 pt-4 sm:px-6">
          <div className="w-full sm:mr-auto sm:w-auto">
            <h2 className="text-[15px] font-semibold text-white">Cápsulas para el feed y TikTok</h2>
            <p className="text-[11.5px] text-neutral-500">{todays > 0 ? `${todays} efeméride(s) para hoy` : "Sin efemérides para hoy: crea una"} · {items.length} en total</p>
          </div>
          <button type="button" onClick={() => setGenOpen((o) => !o)}
            className={`inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-[12px] font-semibold sm:flex-none ${genOpen ? "bg-yellow-400/15 text-yellow-200 ring-1 ring-yellow-400/40" : "bg-yellow-400 text-black hover:bg-yellow-300"}`}>
            <Sparkles size={14} /> Crear rápido
          </button>
          {(Object.keys(KIND_LABEL) as CapsuleKind[]).map((kind) => {
            const Icon = KIND_ICON[kind];
            return (
              <button key={kind} type="button" onClick={() => startNew(kind)}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/15 px-3 py-2 text-[12px] font-semibold text-neutral-100 hover:border-white/40 sm:flex-none">
                <Icon size={14} /> <span className="hidden sm:inline">{KIND_LABEL[kind]}</span>
              </button>
            );
          })}
        </div>
        {setupError ? (
          <p className="mx-auto mb-3 max-w-6xl px-4 sm:px-6"><span className="block rounded-lg border border-amber-500/30 bg-amber-500/[0.07] p-3 text-[11.5px] text-amber-200">{setupError}</span></p>
        ) : items.length > 0 && (
          <div className="mx-auto max-w-6xl px-4 pb-3 sm:px-6">
            <div className="mb-2 flex gap-1.5 overflow-x-auto [scrollbar-width:none]">
              {([["all", "Todas"], ["efemeride", "Efemérides"], ["momento", "Momentos históricos"], ["leyenda", "Leyendas"], ["sabias_que", "¿Sabías que?"]] as const).map(([id, label]) => (
                <button key={id} type="button" onClick={() => setFilter(id)}
                  className={`flex-shrink-0 rounded-full px-2.5 py-1 text-[11.5px] ${filter === id ? "bg-white text-black" : "text-neutral-400 hover:bg-white/[0.06] hover:text-white"}`}>{label}</button>
              ))}
            </div>
            <div className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {shown.map((c) => (
                <button key={c.id} type="button" onClick={() => open(c)} aria-current={draft.id === c.id ? "true" : undefined}
                  className={`group relative w-[118px] flex-shrink-0 snap-start overflow-hidden rounded-xl border text-left ${draft.id === c.id ? "border-yellow-400/80" : "border-white/[0.08] hover:border-white/25"}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <Thumb c={c} />
                  <span className={`absolute left-1.5 top-1.5 rounded-full px-1.5 py-px text-[9.5px] font-bold ${c.status === "published" ? "bg-emerald-400 text-black" : "bg-black/70 text-neutral-300"}`}>
                    {c.status === "published" ? "En el feed" : "Borrador"}
                  </span>
                </button>
              ))}
              {shown.length === 0 && <p className="py-3 text-[12px] text-neutral-500">Nada en este filtro.</p>}
            </div>
          </div>
        )}
      </header>

      {genOpen && !setupError && (
        <div className="mx-auto max-w-6xl px-4 pt-4 sm:px-6">
          <CapsuleGenerator onUse={applyProposal} onClose={() => setGenOpen(false)} onSavedMany={load} />
        </div>
      )}

      <div ref={editorRef} className="mx-auto grid max-w-6xl scroll-mt-2 gap-6 px-4 pb-8 pt-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-4">
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${KIND_TONE[draft.kind]}`}>
              {(() => { const Icon = KIND_ICON[draft.kind]; return <Icon size={12} />; })()} {draft.id ? "Editando" : "Nueva"} · {KIND_LABEL[draft.kind]}
            </span>
            {draft.id && <button type="button" onClick={() => void remove()} className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11.5px] text-neutral-500 hover:bg-red-500/10 hover:text-red-300"><Trash2 size={12} /> Eliminar</button>}
          </div>

          <textarea value={draft.title} onChange={(e) => patch({ title: e.target.value })} maxLength={140} rows={1} aria-label="Título"
            placeholder={draft.kind === "efemeride" ? "Colombia golea 5-0 a Argentina en Buenos Aires" : draft.kind === "leyenda" ? "El cerebro de la generación dorada" : "El gol más rápido de un Mundial"}
            className="min-h-[1.4em] w-full resize-none bg-transparent [field-sizing:content] text-[20px] font-semibold leading-snug text-white outline-none placeholder:text-neutral-600 sm:text-[22px]" />

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label={draft.kind === "leyenda" ? "Leyenda" : "Protagonista"} value={draft.subject} onChange={(subject) => patch({ subject })} placeholder={draft.kind === "leyenda" ? "Carlos Valderrama" : "Selección Colombia"} />
            <Field label="Año" value={draft.year ? String(draft.year) : ""} onChange={(v) => patch({ year: /^\d{4}$/.test(v) ? Number(v) : v ? draft.year : null })} placeholder="1993" inputMode="numeric" />
            {draft.kind === "efemeride" && (
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Día (MM-DD)</span>
                <input value={draft.day} onChange={(e) => patch({ day: e.target.value.trim() })} placeholder={todayKey()} maxLength={5}
                  className={`w-full rounded-lg border bg-black/40 px-2.5 py-1.5 text-white outline-none focus:border-yellow-400/60 ${draft.day && !/^\d{2}-\d{2}$/.test(draft.day) ? "border-red-500/60" : "border-white/10"}`} />
              </label>
            )}
          </div>

          <section>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Diapositivas · la 1ª es el gancho</p>
            <ol className="space-y-2">
              {draft.slides.map((s, i) => (
                <li key={i} onFocus={() => setSlide(i)} className={`rounded-xl border p-3 ${slide === i ? "border-yellow-400/50 bg-yellow-400/[0.03]" : "border-white/10 bg-white/[0.02]"}`}>
                  <div className="flex items-start gap-2">
                    <span className="mt-1 w-5 text-[11px] font-bold text-neutral-500">{i + 1}</span>
                    <textarea value={s.text} onChange={(e) => setSlideText(i, { text: e.target.value })} maxLength={320} rows={2}
                      placeholder={i === 0 ? "Gancho: la frase que obliga a seguir viendo" : "Máximo 180 caracteres por diapositiva"}
                      className="min-h-[2.8em] flex-1 resize-none bg-transparent [field-sizing:content] text-[13.5px] leading-relaxed text-white outline-none placeholder:text-neutral-600" />
                    <div className="flex flex-col gap-0.5">
                      <IconBtn label="Subir" disabled={i === 0} onClick={() => setDraft((d) => { const sl = [...d.slides]; [sl[i - 1], sl[i]] = [sl[i], sl[i - 1]]; return { ...d, slides: sl }; })}><ArrowUp size={13} /></IconBtn>
                      <IconBtn label="Bajar" disabled={i === draft.slides.length - 1} onClick={() => setDraft((d) => { const sl = [...d.slides]; [sl[i + 1], sl[i]] = [sl[i], sl[i + 1]]; return { ...d, slides: sl }; })}><ArrowDown size={13} /></IconBtn>
                      <IconBtn label="Quitar" disabled={draft.slides.length <= 1} onClick={() => setDraft((d) => ({ ...d, slides: d.slides.filter((_, k) => k !== i) }))}><X size={13} /></IconBtn>
                    </div>
                  </div>
                  <div className="ml-7 mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                    <span className={s.text.length > 180 ? "text-amber-400" : "text-neutral-600"}>{s.text.length}/180</span>
                    {s.image ? (
                      <span className="inline-flex items-center gap-1.5 text-neutral-400">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={s.image} alt="" className="h-6 w-6 rounded object-cover" /> Con imagen
                        <button type="button" onClick={() => setSlideText(i, { image: null })} className="text-neutral-500 hover:text-red-300">quitar</button>
                      </span>
                    ) : (
                      <label className="inline-flex cursor-pointer items-center gap-1 text-neutral-400 hover:text-white">
                        <ImagePlus size={12} /> Imagen (opcional)
                        <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadImage(i, f); e.target.value = ""; }} />
                      </label>
                    )}
                  </div>
                </li>
              ))}
            </ol>
            {draft.slides.length < 8 && (
              <button type="button" onClick={() => setDraft((d) => ({ ...d, slides: [...d.slides, { text: "", image: null }] }))}
                className="mt-2 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] text-yellow-300 hover:bg-yellow-400/10"><Plus size={13} /> Agregar diapositiva</button>
            )}
            <p className="mt-1 text-[10.5px] text-neutral-500">Imágenes: solo propias o con licencia. Sin foto, la plantilla usa un diseño tipográfico.</p>
          </section>

          <section className="grid gap-3 rounded-xl border border-white/[0.07] bg-white/[0.015] p-4">
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Texto para TikTok</span>
              <textarea value={draft.caption} onChange={(e) => patch({ caption: e.target.value })} maxLength={2200} rows={2} placeholder="Gancho de 1-2 frases (sin hashtags)"
                className="w-full resize-y rounded-lg border border-white/10 bg-black/40 px-2.5 py-2 text-white outline-none focus:border-yellow-400/60" />
            </label>
            <Field label="Etiquetas (separadas por comas)" value={draft.tags.join(", ")} onChange={(v) => patch({ tags: v.split(",").map((t) => t.trim().replace(/^#/, "")).filter(Boolean).slice(0, 12) })} placeholder="futbol, seleccioncolombia, historia" />
            <Field label="Fuentes (obligatorias para publicar)" value={draft.sources} onChange={(sources) => patch({ sources })} placeholder="FIFA; archivo El Tiempo; sitio oficial del club" />
          </section>

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => void save({ status: "draft" })} disabled={saving || Boolean(setupError)}
              className="rounded-lg border border-white/15 px-4 py-2 text-[12.5px] font-semibold text-neutral-100 hover:border-white/40 disabled:opacity-40">Guardar borrador</button>
            <button type="button" onClick={() => void save({ status: "published" })} disabled={saving || Boolean(setupError)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-yellow-400 px-4 py-2 text-[12.5px] font-semibold text-black hover:bg-yellow-300 disabled:opacity-40">
              {saving && <Loader2 size={14} className="animate-spin" />} {draft.status === "published" ? "Actualizar en el feed" : "Publicar en el feed"}
            </button>
            {problem && <span className="text-[11.5px] text-neutral-500">{problem}</span>}
          </div>
        </div>

        <aside className="space-y-3 lg:sticky lg:top-4 lg:self-start">
          <Preview draft={draft} slide={slide} onSlide={setSlide} />
          <TikTokPanel draft={draft} />
        </aside>
      </div>
    </div>
  );
}

function Preview({ draft, slide, onSlide }: { draft: Draft; slide: number; onSlide: (i: number) => void }) {
  // "Portal" = the exact card readers get (instant, no server render).
  // "TikTok" = the 1080x1920 render, only requested when this tab is open.
  const [mode, setMode] = useState<"portal" | "tiktok">("portal");
  const ready = draft.title.trim().length >= 3 && draft.slides.length > 0;
  const index = Math.min(slide, Math.max(0, draft.slides.length - 1));
  const [url, setUrl] = useState("");
  useEffect(() => { // debounce: re-render the slide 600 ms after the last keystroke
    if (!ready || mode !== "tiktok") { setUrl(""); return; }
    const t = setTimeout(() => setUrl(slideImageUrl(draft, index)), 600);
    return () => clearTimeout(t);
  }, [draft, index, ready, mode]);
  const tabs = (
    <div className="mb-2 flex rounded-lg bg-black/40 p-0.5 text-[11px]">
      {([["portal", "Así se ve en el portal"], ["tiktok", "Versión TikTok 9:16"]] as const).map(([id, label]) => (
        <button key={id} type="button" onClick={() => setMode(id)}
          className={`flex-1 rounded-md px-2 py-1.5 ${mode === id ? "bg-white/10 font-semibold text-white" : "text-neutral-500 hover:text-neutral-200"}`}>{label}</button>
      ))}
    </div>
  );
  if (mode === "portal") {
    return (
      <div>
        {tabs}
        {ready ? (
          <div className="mx-auto max-w-[340px]">
            <CapsuleCard preview capsule={{
              id: "preview", kind: draft.kind, title: draft.title.trim(), subject: draft.subject.trim() || null, year: draft.year,
              date: draft.day || null, tags: draft.tags, createdAt: new Date().toISOString(),
              slides: draft.slides.filter((s) => s.text.trim()).map((s) => ({ text: s.text.trim(), image: s.image })),
            }} />
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-white/10 p-6 text-center text-[12px] text-neutral-500">Escribe el título y las diapositivas para verla como la verán tus lectores.</p>
        )}
      </div>
    );
  }
  return (
    <div>
      {tabs}
      <div className="relative mx-auto aspect-[9/16] w-full max-w-[300px] overflow-hidden rounded-[22px] border border-white/10 bg-[#0d0d0d] shadow-2xl">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={url} src={url} alt={`Diapositiva ${index + 1}`} className="h-full w-full object-cover" />
        ) : (
          <p className="flex h-full items-center justify-center p-6 text-center text-[12px] text-neutral-500">Escribe el título y las diapositivas para ver el render 9:16 real.</p>
        )}
        <button type="button" aria-label="Anterior" onClick={() => onSlide(Math.max(0, index - 1))} className="absolute inset-y-0 left-0 w-1/3" />
        <button type="button" aria-label="Siguiente" onClick={() => onSlide(Math.min(draft.slides.length - 1, index + 1))} className="absolute inset-y-0 right-0 w-1/3" />
      </div>
      <p className="mt-2 text-center text-[10.5px] text-neutral-500">Diapositiva {index + 1} de {draft.slides.length} · toca los lados para cambiar · así sale en TikTok</p>
    </div>
  );
}

function TikTokPanel({ draft }: { draft: Draft }) {
  const [busy, setBusy] = useState<null | "images" | "video" | "send">(null);
  const [progress, setProgress] = useState(0);
  const ready = !draftProblem({ ...draft, status: "draft" });
  const name = slugify(draft.title);

  const copyCaption = async () => {
    await navigator.clipboard.writeText(tiktokCaption(draft.caption || draft.title, draft.tags));
    toast.success("Texto de TikTok copiado (con hashtags)");
  };
  const downloadImages = async () => {
    setBusy("images");
    try {
      for (let i = 0; i < draft.slides.length; i += 1) {
        const blob = await fetch(slideImageUrl(draft, i)).then((r) => { if (!r.ok) throw new Error("render"); return r.blob(); });
        downloadBlob(blob, `${name}-${i + 1}.png`);
        await new Promise((r) => setTimeout(r, 350));
      }
      toast.success("Imágenes descargadas: súbelas a TikTok como carrusel de fotos");
    } catch {
      toast.error("No se pudieron generar las imágenes");
    } finally {
      setBusy(null);
    }
  };
  const makeVideo = async (send: boolean) => {
    setBusy(send ? "send" : "video");
    setProgress(0);
    try {
      if (send) {
        const account = await getTikTokAccount().catch(() => null);
        if (!account?.connected) throw new Error("Conecta tu cuenta de TikTok en Social Media Studio primero.");
      }
      const { blob, ext } = await renderCapsuleVideo(draft, setProgress);
      if (!send) {
        downloadBlob(blob, `${name}.${ext}`);
        toast.success(`Video 9:16 listo (${ext.toUpperCase()}, ${(blob.size / 1e6).toFixed(1)} MB)`);
        return;
      }
      const result = await uploadToTikTok(blob, { title: tiktokCaption(draft.caption || draft.title, draft.tags).slice(0, 150), privacyLevel: "PUBLIC" });
      if (!result.success) throw new Error(result.error || "TikTok rechazó el video");
      toast.success("Enviado a TikTok: ábrelo en la app (bandeja de borradores) para agregar música y publicar");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo crear el video");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Distribuir en TikTok</p>
      <div className="grid gap-1.5">
        <PanelBtn icon={ClipboardCopy} onClick={() => void copyCaption()} disabled={!draft.title.trim()}>Copiar texto + hashtags</PanelBtn>
        <PanelBtn icon={Download} onClick={() => void downloadImages()} disabled={!ready || busy !== null} busy={busy === "images"}>Descargar carrusel (PNG 9:16)</PanelBtn>
        <PanelBtn icon={Film} onClick={() => void makeVideo(false)} disabled={!ready || busy !== null} busy={busy === "video"}>
          {busy === "video" ? `Grabando video… ${Math.round(progress * 100)}%` : "Crear video vertical"}
        </PanelBtn>
        <PanelBtn icon={Send} primary onClick={() => void makeVideo(true)} disabled={!ready || busy !== null} busy={busy === "send"}>
          {busy === "send" ? `Preparando… ${Math.round(progress * 100)}%` : "Enviar a mi TikTok"}
        </PanelBtn>
      </div>
      <p className="mt-2 text-[10.5px] leading-relaxed text-neutral-500">
        El video se graba en tiempo real: deja esta pestaña visible. Llega a TikTok como borrador para que le pongas música de su biblioteca (con licencia) y lo publiques.
      </p>
    </div>
  );
}

// ── Crear rápido ─────────────────────────────────────────────────────────────
function CapsuleGenerator({ onUse, onClose, onSavedMany }: { onUse: (p: CapsuleProposal) => void; onClose: () => void; onSavedMany: () => Promise<void> }) {
  const [kind, setKind] = useState<CapsuleKind>("efemeride");
  const [day, setDay] = useState(todayKey());
  const [focusText, setFocusText] = useState("");
  const [busy, setBusy] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasted, setPasted] = useState("");
  const [proposals, setProposals] = useState<CapsuleProposal[]>([]);
  const [material, setMaterial] = useState<ResearchMaterial | null>(null);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [searching, setSearching] = useState(false);

  useEffect(() => { setMaterial(null); setPicked(new Set()); }, [kind, day]);

  const search = async () => {
    if (kind === "efemeride" && !/^\d{2}-\d{2}$/.test(day)) { toast.error("La fecha va como MM-DD"); return; }
    if (kind !== "efemeride" && focusText.trim().length < 3) { toast.error("Escribe qué buscar: la leyenda, el momento o el tema."); return; }
    setSearching(true);
    try {
      const response = await apiFetch("/api/admin/research", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, day: kind === "efemeride" ? day : undefined, query: kind === "efemeride" ? undefined : focusText }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(typeof body?.detail === "string" ? body.detail : `HTTP ${response.status}`);
      const found = body as ResearchMaterial;
      setMaterial(found);
      setPicked(new Set(found.facts.map((_, i) => i).slice(0, 12)));
      toast.success(found.facts.length ? `${found.facts.length} hechos encontrados en Wikipedia` : `${found.sources.length} fuentes encontradas`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo buscar");
    } finally {
      setSearching(false);
    }
  };

  const groundedMaterial = (): ResearchMaterial | undefined =>
    material ? { facts: material.facts.filter((_, i) => picked.has(i)), sources: material.sources } : undefined;
  const prompt = () => buildCapsulePrompt({
    kind, count: kind === "leyenda" && focusText.trim() ? 2 : 4, focus: kind === "efemeride" ? day : focusText,
    today: humanToday(), research: groundedMaterial(),
  });
  const read = (text: string) => {
    const found = parseCapsuleAnswer(text, kind, kind === "efemeride" ? day : "");
    if (!found.length) { toast.error("No encontré cápsulas en la respuesta (revisa TÍTULO y DIAPOSITIVA)."); return false; }
    setProposals(found);
    toast.success(`${found.length} cápsula(s) lista(s)`);
    return true;
  };
  const generate = async () => {
    if (kind === "efemeride" && !/^\d{2}-\d{2}$/.test(day)) { toast.error("La fecha va como MM-DD"); return; }
    setBusy(true);
    try {
      const response = await apiFetch("/api/admin/capsules/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: prompt() }) });
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
    await navigator.clipboard.writeText(prompt());
    toast.success("Prompt copiado. En ChatGPT pulsa «Copiar código» y pégalo aquí.");
    setPasteOpen(true);
  };
  const saveAllDrafts = async () => {
    let ok = 0;
    for (const p of proposals) {
      const response = await apiFetch("/api/admin/capsules", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toPayload({ ...p, status: "draft" })),
      }).catch(() => null);
      if (response?.ok) ok += 1;
    }
    toast.success(`${ok} borrador(es) guardado(s). Revísalos y publícalos.`);
    await onSavedMany();
  };

  return (
    <div className="rounded-xl border border-yellow-400/30 bg-yellow-400/[0.03] p-4">
      <div className="flex items-center gap-2">
        <Sparkles size={15} className="text-yellow-300" />
        <h3 className="text-[13px] font-semibold text-white">Crear rápido</h3>
        <button type="button" onClick={onClose} aria-label="Cerrar" className="ml-auto rounded p-1 text-neutral-500 hover:bg-white/5 hover:text-white"><X size={14} /></button>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {(Object.keys(KIND_LABEL) as CapsuleKind[]).map((k) => (
          <button key={k} type="button" onClick={() => setKind(k)}
            className={`rounded-full border px-3 py-1 text-[11.5px] ${kind === k ? "border-yellow-400 bg-yellow-400/10 text-yellow-200" : "border-white/10 text-neutral-400 hover:border-white/30"}`}>{KIND_LABEL[k]}</button>
        ))}
      </div>
      <div className="mt-3">
        {kind === "efemeride" ? (
          <label className="flex items-center gap-2 text-[12px] text-neutral-400">
            Efemérides del día
            <input value={day} onChange={(e) => setDay(e.target.value.trim())} maxLength={5} className="w-20 rounded-md border border-white/10 bg-black/40 px-2 py-1 text-white outline-none focus:border-yellow-400/60" />
            <span className="text-neutral-600">(MM-DD · hoy es {todayKey()})</span>
          </label>
        ) : (
          <input value={focusText} onChange={(e) => setFocusText(e.target.value)} maxLength={200}
            placeholder={kind === "leyenda" ? "Nombre de la leyenda (vacío = que proponga varias)" : kind === "momento" ? "Momento (ej.: Atlético Nacional campeón de la Libertadores 1989)" : "Tema (vacío = datos curiosos variados)"}
            className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-[12.5px] text-white outline-none focus:border-yellow-400/60" />
        )}
      </div>

      {/* 1. Research (optional but recommended): real, citable facts */}
      <div className="mt-3 rounded-lg border border-white/10 bg-black/20 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => void search()} disabled={searching}
            className="inline-flex items-center gap-1.5 rounded-lg border border-sky-400/40 bg-sky-400/10 px-3 py-1.5 text-[12px] font-semibold text-sky-200 hover:border-sky-300 disabled:opacity-50">
            {searching ? <Loader2 size={13} className="animate-spin" /> : <Globe size={13} />} Buscar en internet
          </button>
          <span className="text-[11px] text-neutral-500">
            {material ? "La IA solo podrá usar lo que marques aquí, con su enlace como fuente." : "Recomendado: trae hechos reales de Wikipedia para que la IA no invente."}
          </span>
        </div>
        {material && material.facts.length > 0 && (
          <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto pr-1">
            {material.facts.map((f, i) => (
              <li key={`${f.year}-${i}`}>
                <label className="flex cursor-pointer items-start gap-2 rounded-md px-1.5 py-1 text-[12px] text-neutral-300 hover:bg-white/[0.04]">
                  <input type="checkbox" className="mt-0.5 accent-yellow-400" checked={picked.has(i)}
                    onChange={() => setPicked((s) => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n; })} />
                  <span><b className="text-white">{f.year}</b>{f.section && f.section !== "Acontecimientos" ? <span className="text-neutral-500"> · {f.section.toLowerCase()}</span> : null} — {f.text}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
        {material && material.sources.length > 0 && material.facts.length === 0 && (
          <ul className="mt-2 space-y-1.5">
            {material.sources.map((s) => (
              <li key={s.url} className="text-[11.5px] text-neutral-400">
                <a href={s.url} target="_blank" rel="noreferrer" className="font-semibold text-sky-300 hover:underline">{s.title}</a> — {s.excerpt.slice(0, 160)}…
              </li>
            ))}
          </ul>
        )}
        {material && !material.facts.length && !material.sources.length && <p className="mt-2 text-[11.5px] text-neutral-500">Sin resultados. Prueba con otro nombre o fecha.</p>}
      </div>

      {/* 2. Generate with the grounded prompt */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        <button type="button" onClick={() => void generate()} disabled={busy}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-yellow-400 px-3 py-2 text-[12px] font-semibold text-black hover:bg-yellow-300 disabled:opacity-50 sm:w-auto">
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Bot size={14} />} Generar con IA
        </button>
        <button type="button" onClick={() => void copy()} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/15 px-3 py-2 text-[12px] font-semibold text-neutral-100 hover:border-white/40 sm:flex-none">
          <ClipboardCopy size={14} /> Copiar prompt para ChatGPT
        </button>
        <button type="button" onClick={() => setPasteOpen((o) => !o)} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/15 px-3 py-2 text-[12px] font-semibold text-neutral-100 hover:border-white/40 sm:flex-none">
          <ClipboardPaste size={14} /> Pegar respuesta
        </button>
      </div>
      {pasteOpen && (
        <div className="mt-3 rounded-lg border border-white/10 bg-black/30 p-3">
          <textarea value={pasted} onChange={(e) => setPasted(e.target.value)} rows={5} placeholder="TÍTULO: …"
            className="w-full resize-y rounded-md border border-white/10 bg-black/40 px-2.5 py-2 font-mono text-[11.5px] text-neutral-200 outline-none focus:border-yellow-400/60" />
          <button type="button" onClick={() => { if (read(pasted)) setPasteOpen(false); }} disabled={!pasted.trim()}
            className="mt-2 rounded-md bg-white px-3 py-1.5 text-[11.5px] font-semibold text-black disabled:opacity-40">Leer respuesta</button>
        </div>
      )}
      {proposals.length > 0 && (
        <>
          <div className="mt-4 flex items-center gap-2">
            <p className="text-[11.5px] text-neutral-400">Verifica cada dato antes de publicar: la IA puede equivocarse con fechas y cifras.</p>
            <button type="button" onClick={() => void saveAllDrafts()} className="ml-auto flex-shrink-0 rounded-md border border-white/15 px-2.5 py-1 text-[11.5px] text-neutral-200 hover:border-white/40">Guardar todas como borrador</button>
          </div>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {proposals.map((p, i) => (
              <li key={`${p.title}-${i}`} className="flex flex-col overflow-hidden rounded-lg border border-white/10 bg-[#111]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <Thumb c={p} short />
                <div className="flex flex-1 flex-col p-2.5">
                  <p className="text-[12px] font-semibold leading-snug text-white">{p.title}</p>
                  <p className="mt-1 text-[10.5px] text-neutral-500">{p.slides.length} diapositivas{p.sources ? ` · ${p.sources}` : " · sin fuentes"}</p>
                  <button type="button" onClick={() => onUse(p)} className="mt-2 rounded-md bg-yellow-400 px-3 py-1.5 text-[11.5px] font-semibold text-black hover:bg-yellow-300">Editar esta</button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

const THUMB_TONE: Record<CapsuleKind, string> = { efemeride: "#facc15", sabias_que: "#38bdf8", leyenda: "#eab308", momento: "#f97316" };

/** Light thumbnail: the first slide photo (small) or a typographic tile. Never the 1080x1920 render. */
function Thumb({ c, short = false }: { c: CapsuleRender; short?: boolean }) {
  const image = c.slides.find((s) => s.image)?.image ?? null;
  return (
    <div className={`relative w-full overflow-hidden bg-[#111] ${short ? "aspect-[4/5] max-h-56" : "aspect-[9/16]"}`}
      style={{ backgroundImage: `radial-gradient(120% 70% at 20% 0%, ${THUMB_TONE[c.kind]}40 0%, #0d0d0d 65%)` }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {image && <img src={image} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover opacity-60" />}
      <div className="absolute inset-x-2 bottom-2">
        <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: THUMB_TONE[c.kind] }}>{KIND_LABEL[c.kind]}{c.year ? ` · ${c.year}` : ""}</span>
        <p className="mt-0.5 line-clamp-3 text-[11px] font-bold leading-tight text-white">{c.title}</p>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, inputMode }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; inputMode?: "numeric" }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-neutral-500">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} inputMode={inputMode}
        className="w-full rounded-lg border border-white/10 bg-black/40 px-2.5 py-1.5 text-white outline-none focus:border-yellow-400/60" />
    </label>
  );
}

function IconBtn({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return <button type="button" aria-label={label} onClick={onClick} disabled={disabled} className="rounded p-1 text-neutral-500 hover:bg-white/5 hover:text-white disabled:opacity-20">{children}</button>;
}

function PanelBtn({ icon: Icon, onClick, disabled, busy, primary, children }: { icon: typeof Send; onClick: () => void; disabled?: boolean; busy?: boolean; primary?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-left text-[12px] font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${primary ? "bg-white text-black hover:bg-neutral-200" : "border border-white/10 text-neutral-100 hover:border-white/30"}`}>
      {busy ? <Loader2 size={14} className="animate-spin" /> : <Icon size={14} />} {children}
    </button>
  );
}
