"use client";

// "Portada": the homepage as readers see it, controlled from here.
// Left: stage status (live video/radio are driven by the Broadcaster), pinned & hidden stories.
// Right: the REAL homepage in an iframe (?preview=1) receiving the draft via
// postMessage, so every change is previewed before it goes live.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown, ArrowUp, Eye, EyeOff, Loader2, Monitor, Newspaper, Pin, PinOff, Radio, RotateCcw, Search, Smartphone,
  Tablet, Tv,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/studio/lab/api-client";
import { supabase } from "@/lib/supabaseClient";
import { DEFAULT_LAYOUT, PORTAL_MSG_LAYOUT, PORTAL_MSG_READY, PORTAL_MSG_SCROLL, type PortalLayout } from "@/types/portal";

// Shared contract with the public portal.
type LayoutDraft = PortalLayout;
const DEFAULT: LayoutDraft = DEFAULT_LAYOUT;

interface Story { id: string; title: string; image_url: string | null; category: string | null; published_at: string | null; slug: string }

const DEVICES = [
  { id: "mobile", label: "Móvil", width: 390, icon: Smartphone },
  { id: "tablet", label: "Tablet", width: 820, icon: Tablet },
  { id: "desktop", label: "Escritorio", width: 1440, icon: Monitor },
] as const;

function ago(iso: string | null): string {
  if (!iso) return "";
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 60) return `hace ${Math.max(1, m)} min`;
  if (m < 1440) return `hace ${Math.round(m / 60)} h`;
  return new Date(iso).toLocaleDateString("es", { day: "numeric", month: "short" });
}

async function errorMessage(response: Response): Promise<string> {
  const body = await response.json().catch(() => null);
  return body?.detail || body?.message || `HTTP ${response.status}`;
}

export default function PortadaStudio() {
  const [saved, setSaved] = useState<LayoutDraft | null>(null);
  const [draft, setDraft] = useState<LayoutDraft>(DEFAULT);
  const [stories, setStories] = useState<Story[]>([]);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [device, setDevice] = useState<(typeof DEVICES)[number]["id"]>("desktop");
  const [frameWidth, setFrameWidth] = useState(0);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  // ── load ───────────────────────────────────────────────────────────────
  useEffect(() => {
    apiFetch("/api/portal/layout")
      .then(async (r) => (r.ok ? r.json() : DEFAULT))
      .then((layout: LayoutDraft) => { setSaved(layout); setDraft(layout); })
      .catch(() => { setSaved(DEFAULT); setDraft(DEFAULT); });
    supabase.from("news").select("id,title,image_url,category,published_at,slug")
      .eq("status", "published").order("published_at", { ascending: false }).limit(120)
      .then(({ data }) => setStories((data as Story[] | null) ?? []));
  }, []);

  // ── live preview (postMessage contract with the portal) ────────────────
  const postDraft = useCallback(() => {
    frameRef.current?.contentWindow?.postMessage({ type: PORTAL_MSG_LAYOUT, layout: draft }, window.location.origin);
  }, [draft]);
  useEffect(() => { postDraft(); }, [postDraft]);
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin === window.location.origin && event.data?.type === PORTAL_MSG_READY) postDraft();
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [postDraft]);
  const scrollPreview = (target: "stage" | "feed" | "sports") =>
    frameRef.current?.contentWindow?.postMessage({ type: PORTAL_MSG_SCROLL, target }, window.location.origin);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const observer = new ResizeObserver(() => setFrameWidth(box.clientWidth));
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  const dirty = useMemo(() => JSON.stringify({ ...draft, updatedAt: null }) !== JSON.stringify({ ...(saved ?? DEFAULT), updatedAt: null }), [draft, saved]);
  const byId = useMemo(() => new Map(stories.map((s) => [s.id, s])), [stories]);

  // ── edits ──────────────────────────────────────────────────────────────
  const togglePin = (id: string) => setDraft((d) => {
    if (d.pinned.includes(id)) return { ...d, pinned: d.pinned.filter((x) => x !== id) };
    if (d.pinned.length >= 12) { toast.error("Máximo 12 noticias fijadas"); return d; }
    return { ...d, pinned: [...d.pinned, id], hidden: d.hidden.filter((x) => x !== id) };
  });
  const toggleHidden = (id: string) => setDraft((d) => (d.hidden.includes(id)
    ? { ...d, hidden: d.hidden.filter((x) => x !== id) }
    : { ...d, hidden: [...d.hidden, id], pinned: d.pinned.filter((x) => x !== id) }));
  const movePin = (index: number, delta: -1 | 1) => setDraft((d) => {
    const pinned = [...d.pinned];
    const target = index + delta;
    if (target < 0 || target >= pinned.length) return d;
    [pinned[index], pinned[target]] = [pinned[target], pinned[index]];
    return { ...d, pinned };
  });
  const makeFeatured = (id: string) => setDraft((d) => ({ ...d, pinned: [id, ...d.pinned.filter((x) => x !== id)].slice(0, 12), hidden: d.hidden.filter((x) => x !== id) }));

  const apply = async () => {
    setSaving(true);
    try {
      const body: LayoutDraft = {
        ...draft,
        stage: {
          mode: draft.stage.mode,
          ...(draft.stage.video?.url ? { video: draft.stage.video } : {}),
          ...(draft.stage.radio?.url ? { radio: draft.stage.radio } : {}),
        },
      };
      const response = await apiFetch("/api/portal/layout", {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error(await errorMessage(response));
      const next: LayoutDraft = await response.json();
      setSaved(next);
      setDraft(next);
      toast.success("Portada actualizada.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo actualizar la portada");
    } finally {
      setSaving(false);
    }
  };

  const visible = stories.filter((s) => !query.trim() || s.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const deviceWidth = DEVICES.find((d) => d.id === device)!.width;
  const scale = frameWidth ? Math.min(1, frameWidth / deviceWidth) : 1;

  if (!saved) {
    return <div className="flex h-full items-center justify-center text-sm text-neutral-500"><Loader2 size={16} className="mr-2 animate-spin" /> Cargando portada…</div>;
  }

  return (
    <div className="flex h-full min-h-0 flex-col lg:flex-row">
      {/* Controls */}
      <aside className="flex min-h-0 w-full flex-shrink-0 flex-col border-b border-white/10 bg-[#0b0b0b] lg:w-[380px] lg:border-b-0 lg:border-r">
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 text-[12.5px] text-neutral-300">
          <section>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Escenario de la portada</h3>
            {draft.stage.mode === "news" ? (
              <div className="flex items-start gap-2.5 rounded-lg border border-white/10 bg-white/[0.03] p-3">
                <Newspaper size={16} className="mt-0.5 flex-shrink-0 text-neutral-400" />
                <p className="text-[11.5px] leading-relaxed text-neutral-400">
                  Muestra la noticia destacada (la 1ª fijada o la más reciente). Al salir al aire desde el <b className="text-neutral-200">Broadcaster</b>,
                  el video o la radio ocupan este espacio solos y al terminar vuelve la noticia.
                </p>
              </div>
            ) : (
              <div className="rounded-lg border border-red-500/40 bg-red-500/[0.07] p-3">
                <p className="flex items-center gap-2 text-[12px] font-semibold text-red-200">
                  <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" /><span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" /></span>
                  {draft.stage.mode === "video" ? <><Tv size={14} /> Video en vivo</> : <><Radio size={14} /> Radio al aire</>} desde el Broadcaster
                </p>
                <p className="mt-1 truncate text-[11.5px] text-neutral-400">{(draft.stage.mode === "video" ? draft.stage.video?.title : draft.stage.radio?.title) || "Sin título"}</p>
                <button type="button" onClick={() => setDraft((d) => ({ ...d, stage: { ...d.stage, mode: "news" } }))}
                  className="mt-2.5 inline-flex items-center gap-1.5 rounded-md border border-white/15 px-2.5 py-1.5 text-[11.5px] text-neutral-200 hover:border-white/40">
                  <Newspaper size={13} /> Volver a la noticia en la portada
                </button>
                <p className="mt-1.5 text-[10.5px] text-neutral-500">Úsalo si la transmisión se cortó y la portada quedó en vivo. Pulsa “Aplicar” para confirmarlo.</p>
              </div>
            )}
          </section>

          <section>
            <h3 className="mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
              Fijadas en portada <span className="normal-case tracking-normal text-neutral-600">{draft.pinned.length}/12 · la 1ª es la destacada</span>
            </h3>
            {draft.pinned.length === 0 && <p className="rounded-lg border border-dashed border-white/10 p-3 text-[11.5px] text-neutral-500">Sin fijadas: la portada muestra las más recientes. Fija una noticia para destacarla.</p>}
            <ol className="space-y-1.5">
              {draft.pinned.map((id, index) => {
                const story = byId.get(id);
                return (
                  <li key={id} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] p-2">
                    <span className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${index === 0 ? "bg-yellow-400 text-black" : "bg-white/10 text-neutral-300"}`}>{index + 1}</span>
                    <span className="min-w-0 flex-1 truncate text-white">{story?.title ?? "Noticia no disponible"}</span>
                    <IconButton label="Subir" disabled={index === 0} onClick={() => movePin(index, -1)}><ArrowUp size={13} /></IconButton>
                    <IconButton label="Bajar" disabled={index === draft.pinned.length - 1} onClick={() => movePin(index, 1)}><ArrowDown size={13} /></IconButton>
                    <IconButton label="Desfijar" onClick={() => togglePin(id)}><PinOff size={13} /></IconButton>
                  </li>
                );
              })}
            </ol>
          </section>

          <section>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Noticias publicadas</h3>
            <label className="mb-2 flex h-9 items-center gap-2 rounded-lg border border-white/10 bg-black/40 px-2.5">
              <Search size={14} className="text-neutral-500" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar noticia"
                className="min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-neutral-600" />
            </label>
            {stories.length === 0 && <p className="text-[11.5px] text-neutral-500">Todavía no hay noticias publicadas.</p>}
            <ul className="space-y-1">
              {visible.map((s) => {
                const pinned = draft.pinned.includes(s.id);
                const hidden = draft.hidden.includes(s.id);
                return (
                  <li key={s.id} className={`flex items-center gap-2 rounded-lg p-1.5 ${hidden ? "opacity-40" : ""} hover:bg-white/[0.04]`}>
                    {s.image_url
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={s.image_url} alt="" className="h-10 w-14 flex-shrink-0 rounded object-cover" />
                      : <span className="h-10 w-14 flex-shrink-0 rounded bg-white/5" />}
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 text-[12px] leading-snug text-white">{s.title}</span>
                      <span className="text-[10.5px] text-neutral-500">{[s.category, ago(s.published_at)].filter(Boolean).join(" · ")}</span>
                    </span>
                    <IconButton label="Hacerla destacada" onClick={() => makeFeatured(s.id)}><span className="text-[10px] font-bold">1º</span></IconButton>
                    <IconButton label={pinned ? "Desfijar" : "Fijar en portada"} active={pinned} onClick={() => togglePin(s.id)}><Pin size={13} /></IconButton>
                    <IconButton label={hidden ? "Mostrar en portada" : "Ocultar de la portada"} onClick={() => toggleHidden(s.id)}>{hidden ? <EyeOff size={13} /> : <Eye size={13} />}</IconButton>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>

        <div className="flex flex-shrink-0 items-center gap-2 border-t border-white/10 p-3">
          <span className={`text-[11px] ${dirty ? "text-amber-300" : "text-neutral-500"}`}>
            {dirty ? "Cambios sin aplicar (la vista previa ya los muestra)" : saved.updatedAt ? `Al día · ${ago(saved.updatedAt)}` : "Al día"}
          </span>
          <div className="ml-auto flex gap-1.5">
            {dirty && (
              <button type="button" onClick={() => setDraft(saved)} title="Descartar cambios" className="rounded-md p-2 text-neutral-400 hover:bg-white/10 hover:text-white"><RotateCcw size={14} /></button>
            )}
            <button type="button" onClick={() => void apply()} disabled={!dirty || saving}
              className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500 px-3 py-1.5 text-[12px] font-bold text-black disabled:opacity-40">
              {saving && <Loader2 size={13} className="animate-spin" />} Aplicar a la portada
            </button>
          </div>
        </div>
      </aside>

      {/* Live preview: the real homepage */}
      <section className="flex min-h-[60vh] min-w-0 flex-1 flex-col bg-[#050505]">
        <div className="flex flex-shrink-0 flex-wrap items-center gap-1.5 border-b border-white/10 px-3 py-2">
          {DEVICES.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" onClick={() => setDevice(id)}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-medium ${device === id ? "bg-white/10 text-white" : "text-neutral-400 hover:text-white"}`}>
              <Icon size={13} /> {label}
            </button>
          ))}
          <span className="mx-1 h-4 w-px bg-white/10" />
          {([["stage", "Escenario"], ["feed", "Feed"], ["sports", "Deportes"]] as const).map(([target, label]) => (
            <button key={target} type="button" onClick={() => scrollPreview(target)} className="rounded-md px-2 py-1.5 text-[11px] text-neutral-400 hover:text-white">{label}</button>
          ))}
          <span className="ml-auto text-[10.5px] text-neutral-500">Vista previa real · {deviceWidth}px</span>
        </div>
        <div ref={boxRef} className="min-h-0 flex-1 overflow-auto p-3">
          <div style={{ width: deviceWidth * scale, height: `calc((100vh - 9rem) )` }} className="mx-auto">
            <iframe
              ref={frameRef} src="/?preview=1" title="Vista previa de la portada" onLoad={postDraft}
              style={{ width: deviceWidth, height: `calc((100vh - 9rem) / ${scale})`, transform: `scale(${scale})`, transformOrigin: "top left" }}
              className="rounded-xl border border-white/10 bg-white shadow-2xl"
            />
          </div>
        </div>
      </section>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="block">
      <span className="text-[10.5px] text-neutral-400">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="mt-0.5 w-full rounded-md border border-white/10 bg-black px-2 py-1.5 text-[12px] text-white outline-none focus:border-white/30" />
    </label>
  );
}

function IconButton({ label, onClick, disabled, active, children }: {
  label: string; onClick: () => void; disabled?: boolean; active?: boolean; children: React.ReactNode;
}) {
  return (
    <button type="button" title={label} aria-label={label} onClick={onClick} disabled={disabled}
      className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md disabled:opacity-30 ${active ? "bg-yellow-400 text-black" : "text-neutral-400 hover:bg-white/10 hover:text-white"}`}>
      {children}
    </button>
  );
}
