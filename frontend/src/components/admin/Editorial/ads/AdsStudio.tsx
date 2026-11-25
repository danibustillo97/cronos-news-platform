"use client";

// "Anuncios": every ad slot of the portal with its EXACT size per device,
// campaigns per slot (one image per device, dates, weight, pause), live
// stats, the advertiser spec sheet, and the real portal in a frame where the
// selected slot is outlined — so you see where an ad lands on each device.
// Contract: backend/app/presentation/api/ad_slots.py

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ClipboardCopy, Download, ImagePlus, Loader2, Monitor, Pause, Play, Plus, Smartphone, Tablet, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/studio/lab/api-client";
import { supabase } from "@/lib/supabaseClient";
import { type AdDevice, type AdSlotAdmin, type CampaignDraft, DEVICE_LABEL, ctr, emptyCampaign, imageFitsSlot, sizeLabel, specSheetText } from "./adSlots";

const DEVICES = [
  { id: "mobile", label: "Móvil", width: 390, icon: Smartphone },
  { id: "tablet", label: "Tablet", width: 820, icon: Tablet },
  { id: "desktop", label: "Computador", width: 1440, icon: Monitor },
] as const;

async function errorMessage(response: Response): Promise<string> {
  const body = await response.json().catch(() => null);
  return typeof body?.detail === "string" ? body.detail : `HTTP ${response.status}`;
}

function readImageSize(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { resolve({ width: img.naturalWidth, height: img.naturalHeight }); URL.revokeObjectURL(url); };
    img.onerror = () => { reject(new Error("No se pudo leer la imagen")); URL.revokeObjectURL(url); };
    img.src = url;
  });
}

export default function AdsStudio() {
  const [slots, setSlots] = useState<AdSlotAdmin[] | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string>("home-top");
  const [device, setDevice] = useState<AdDevice>("mobile");
  const [draft, setDraft] = useState<CampaignDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [frameWidth, setFrameWidth] = useState(0);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const response = await apiFetch("/api/admin/ads/slots").catch(() => null);
    if (!response?.ok) { setSetupError(response ? await errorMessage(response) : "No se pudo conectar con el backend."); setSlots([]); return; }
    setSetupError(null);
    setSlots((await response.json()).slots as AdSlotAdmin[]);
  }, []);
  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const observer = new ResizeObserver(() => setFrameWidth(box.clientWidth));
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  const slot = useMemo(() => slots?.find((s) => s.placement === selected) ?? null, [slots, selected]);
  const pages = useMemo(() => {
    const out = new Map<string, AdSlotAdmin[]>();
    for (const s of slots ?? []) out.set(s.page, [...(out.get(s.page) ?? []), s]);
    return [...out.entries()];
  }, [slots]);

  // Tell the portal preview which slot to outline and scroll to.
  const highlight = useCallback(() => {
    frameRef.current?.contentWindow?.postMessage({ type: "nexus:ads-highlight", placement: selected }, window.location.origin);
  }, [selected]);
  useEffect(() => { highlight(); }, [highlight, device]);

  const toggleSlot = async (s: AdSlotAdmin) => {
    const response = await apiFetch(`/api/admin/ads/slots/${s.placement}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled: !s.enabled }) });
    if (!response.ok) { toast.error(await errorMessage(response)); return; }
    toast.success(s.enabled ? "Espacio desactivado" : "Espacio activado");
    await load();
  };

  const upload = async (deviceId: AdDevice, file: File) => {
    if (!slot || !draft) return;
    const size = slot.sizes[deviceId];
    if (!size) return;
    try {
      const dims = await readImageSize(file);
      if (!imageFitsSlot(dims, size)) {
        toast.error(`La imagen mide ${dims.width}×${dims.height}; este espacio en ${DEVICE_LABEL[deviceId]} pide ${size[0]}×${size[1]} (o el doble para pantallas retina).`);
        return;
      }
      if (file.size > 150 * 1024 * 2) toast.warning("La imagen pesa más de 300 KB: pídele al anunciante una versión más liviana.");
      const res = await apiFetch("/api/admin/ads/upload-url", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ filename: file.name, contentType: file.type }) });
      if (!res.ok) throw new Error(await errorMessage(res));
      const { path, token, publicUrl } = await res.json();
      const { error } = await supabase.storage.from("media").uploadToSignedUrl(path, token, file, { contentType: file.type });
      if (error) throw error;
      setDraft((d) => (d ? { ...d, images: { ...d.images, [deviceId]: publicUrl } } : d));
      toast.success(`Imagen de ${DEVICE_LABEL[deviceId]} lista`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo subir la imagen");
    }
  };

  const save = async () => {
    if (!draft || !slot) return;
    if (!draft.advertiser.trim() || !/^https:\/\//.test(draft.href)) { toast.error("Escribe el anunciante y un enlace https://"); return; }
    if (!Object.values(draft.images).some(Boolean)) { toast.error("Sube al menos una imagen"); return; }
    setSaving(true);
    try {
      const body = {
        placement: slot.placement, advertiser: draft.advertiser.trim(), href: draft.href.trim(), alt: draft.alt.trim() || null,
        imageMobile: draft.images.mobile, imageTablet: draft.images.tablet, imageDesktop: draft.images.desktop,
        startsAt: draft.startsAt ? new Date(draft.startsAt).toISOString() : null, endsAt: draft.endsAt ? new Date(draft.endsAt).toISOString() : null,
        weight: draft.weight, active: true,
      };
      const response = await apiFetch(draft.id ? `/api/admin/ads/campaigns/${draft.id}` : "/api/admin/ads/campaigns", {
        method: draft.id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft.id ? { ...body, placement: undefined } : body),
      });
      if (!response.ok) throw new Error(await errorMessage(response));
      toast.success(draft.id ? "Campaña actualizada" : "Campaña publicada");
      setDraft(null);
      await load();
      frameRef.current?.contentWindow?.location.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  const patchCampaign = async (id: string, patch: Record<string, unknown>, done: string) => {
    const response = await apiFetch(`/api/admin/ads/campaigns/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    if (!response.ok) { toast.error(await errorMessage(response)); return; }
    toast.success(done);
    await load();
  };
  const removeCampaign = async (id: string, name: string) => {
    if (!window.confirm(`¿Eliminar la campaña de ${name}?`)) return;
    const response = await apiFetch(`/api/admin/ads/campaigns/${id}`, { method: "DELETE" });
    if (!response.ok) { toast.error(await errorMessage(response)); return; }
    toast.success("Campaña eliminada");
    await load();
  };

  const copySheet = async () => {
    if (!slots) return;
    await navigator.clipboard.writeText(specSheetText(slots));
    toast.success("Ficha de medidas copiada: pégala en un correo o WhatsApp para el anunciante");
  };
  const downloadSheet = () => {
    if (!slots) return;
    const rows = [["Espacio", "Ubicación", "Dispositivo", "Medida", "Formato"]];
    for (const s of slots) for (const d of ["mobile", "tablet", "desktop"] as const) {
      const size = s.sizes[d];
      if (size) rows.push([s.name, s.where, DEVICE_LABEL[d], `${size[0]}x${size[1]} px`, "JPG, PNG o WebP · máx. 150 KB"]);
    }
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "nexus-medidas-publicidad.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  if (slots === null) {
    return <div className="flex h-full items-center justify-center text-sm text-neutral-500"><Loader2 size={16} className="mr-2 animate-spin" /> Cargando espacios…</div>;
  }

  const deviceWidth = DEVICES.find((d) => d.id === device)!.width;
  const scale = frameWidth ? Math.min(1, frameWidth / deviceWidth) : 1;

  return (
    <div className="flex h-full min-h-0 flex-col lg:flex-row">
      {/* Slots + campaigns */}
      <aside className="flex max-h-[55vh] min-h-0 w-full flex-shrink-0 flex-col border-b border-white/10 bg-[#0b0b0b] lg:max-h-none lg:w-[420px] lg:border-b-0 lg:border-r">
        <div className="flex flex-wrap items-center gap-1.5 border-b border-white/10 p-3">
          <div className="mr-auto">
            <h2 className="text-[14px] font-semibold text-white">Espacios publicitarios</h2>
            <p className="text-[11px] text-neutral-500">Medidas exactas por dispositivo (estándar IAB)</p>
          </div>
          <button type="button" onClick={() => void copySheet()} className="inline-flex items-center gap-1 rounded-md border border-white/15 px-2 py-1.5 text-[11px] text-neutral-200 hover:border-white/40"><ClipboardCopy size={12} /> Ficha</button>
          <button type="button" onClick={downloadSheet} className="inline-flex items-center gap-1 rounded-md border border-white/15 px-2 py-1.5 text-[11px] text-neutral-200 hover:border-white/40"><Download size={12} /> CSV</button>
        </div>
        {setupError && <p className="m-3 rounded-lg border border-amber-500/30 bg-amber-500/[0.07] p-3 text-[11.5px] text-amber-200">{setupError}</p>}

        <div className="min-h-0 flex-1 overflow-y-auto p-2 text-[12px] text-neutral-300">
          {pages.map(([page, list]) => (
            <section key={page} className="mb-3">
              <p className="px-2 pb-1 text-[10.5px] font-semibold uppercase tracking-widest text-neutral-500">{page}</p>
              {list.map((s) => {
                const live = s.campaigns.filter((c) => c.live).length;
                const active = selected === s.placement;
                return (
                  <div key={s.placement} className={`mb-1 rounded-xl border p-2.5 ${active ? "border-yellow-400/60 bg-yellow-400/[0.05]" : "border-white/[0.07] hover:border-white/20"}`}>
                    <button type="button" onClick={() => { setSelected(s.placement); setDraft(null); }} className="w-full text-left">
                      <span className="flex items-center gap-2">
                        <span className="font-semibold text-white">{s.name}</span>
                        <span className={`ml-auto rounded-full px-1.5 py-px text-[10px] font-bold ${!s.enabled ? "bg-neutral-700 text-neutral-300" : live ? "bg-emerald-400 text-black" : "bg-white/10 text-neutral-400"}`}>
                          {!s.enabled ? "Apagado" : live ? `${live} al aire` : "Libre"}
                        </span>
                      </span>
                      <span className="mt-0.5 block text-[11px] text-neutral-500">{s.where}</span>
                      <span className="mt-1.5 flex flex-wrap gap-1">
                        {(["mobile", "tablet", "desktop"] as const).map((d) => (
                          <span key={d} className={`rounded px-1.5 py-0.5 text-[10px] tabular-nums ${s.sizes[d] ? "bg-white/[0.06] text-neutral-300" : "bg-transparent text-neutral-600 line-through"}`}>
                            {DEVICE_LABEL[d]} {sizeLabel(s.sizes[d])}
                          </span>
                        ))}
                      </span>
                    </button>
                    {active && (
                      <div className="mt-2.5 space-y-2 border-t border-white/[0.07] pt-2.5">
                        <label className="flex items-center justify-between text-[11.5px]">
                          <span>Mostrar este espacio en el portal</span>
                          <input type="checkbox" className="accent-yellow-400" checked={s.enabled} onChange={() => void toggleSlot(s)} />
                        </label>
                        {s.campaigns.map((c) => (
                          <div key={c.id} className="flex items-center gap-2 rounded-lg bg-black/30 p-2">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={c.images.mobile ?? c.images.tablet ?? c.images.desktop ?? ""} alt="" className="h-9 w-14 flex-shrink-0 rounded object-cover" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[11.5px] font-semibold text-white">{c.advertiser}</p>
                              <p className="text-[10.5px] text-neutral-500">{c.impressions.toLocaleString("es")} vistas · {c.clicks.toLocaleString("es")} clics · CTR {ctr(c.impressions, c.clicks)}{c.live ? "" : " · fuera de fechas o pausada"}</p>
                            </div>
                            <button type="button" title={c.active ? "Pausar" : "Activar"} onClick={() => void patchCampaign(c.id, { active: !c.active }, c.active ? "Campaña pausada" : "Campaña activa")} className="rounded p-1 text-neutral-400 hover:text-white">{c.active ? <Pause size={13} /> : <Play size={13} />}</button>
                            <button type="button" title="Editar" onClick={() => setDraft({ id: c.id, advertiser: c.advertiser, href: c.href, alt: c.alt ?? "", images: { ...c.images }, startsAt: c.startsAt?.slice(0, 16) ?? "", endsAt: c.endsAt?.slice(0, 16) ?? "", weight: c.weight })} className="rounded px-1 text-[10.5px] text-neutral-400 hover:text-white">Editar</button>
                            <button type="button" title="Eliminar" onClick={() => void removeCampaign(c.id, c.advertiser)} className="rounded p-1 text-neutral-500 hover:text-red-300"><Trash2 size={13} /></button>
                          </div>
                        ))}
                        {!draft && (
                          <button type="button" onClick={() => setDraft(emptyCampaign())} disabled={Boolean(setupError)} className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-yellow-400 px-3 py-2 text-[12px] font-semibold text-black hover:bg-yellow-300 disabled:opacity-40">
                            <Plus size={14} /> Nueva campaña en este espacio
                          </button>
                        )}
                        {draft && (
                          <div className="space-y-2 rounded-lg border border-white/10 bg-black/30 p-2.5">
                            <div className="flex items-center"><p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">{draft.id ? "Editar campaña" : "Nueva campaña"}</p><button type="button" onClick={() => setDraft(null)} className="ml-auto text-neutral-500 hover:text-white"><X size={13} /></button></div>
                            <input value={draft.advertiser} onChange={(e) => setDraft({ ...draft, advertiser: e.target.value })} placeholder="Anunciante (ej. Movistar)" className="w-full rounded-md border border-white/10 bg-black/40 px-2.5 py-1.5 text-white outline-none focus:border-yellow-400/60" />
                            <input value={draft.href} onChange={(e) => setDraft({ ...draft, href: e.target.value })} placeholder="https://enlace-del-anunciante.com" className="w-full rounded-md border border-white/10 bg-black/40 px-2.5 py-1.5 text-white outline-none focus:border-yellow-400/60" />
                            <input value={draft.alt} onChange={(e) => setDraft({ ...draft, alt: e.target.value })} placeholder="Texto alternativo (accesibilidad)" className="w-full rounded-md border border-white/10 bg-black/40 px-2.5 py-1.5 text-white outline-none focus:border-yellow-400/60" />
                            <div className="grid grid-cols-3 gap-1.5">
                              {(["mobile", "tablet", "desktop"] as const).map((d) => s.sizes[d] ? (
                                <label key={d} className="flex cursor-pointer flex-col items-center gap-1 rounded-md border border-dashed border-white/15 p-2 text-center text-[10px] text-neutral-400 hover:border-yellow-400/50">
                                  {draft.images[d]
                                    // eslint-disable-next-line @next/next/no-img-element
                                    ? <img src={draft.images[d] ?? ""} alt="" className="h-8 w-full rounded object-contain" />
                                    : <ImagePlus size={15} />}
                                  <span>{DEVICE_LABEL[d]}<br />{sizeLabel(s.sizes[d])}</span>
                                  <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(d, f); e.target.value = ""; }} />
                                </label>
                              ) : <span key={d} className="grid place-items-center rounded-md border border-white/5 p-2 text-center text-[10px] text-neutral-600">{DEVICE_LABEL[d]}<br />no aplica</span>)}
                            </div>
                            <div className="grid grid-cols-2 gap-1.5 text-[10.5px] text-neutral-500">
                              <label>Desde<input type="datetime-local" value={draft.startsAt} onChange={(e) => setDraft({ ...draft, startsAt: e.target.value })} className="mt-0.5 w-full rounded-md border border-white/10 bg-black/40 px-1.5 py-1 text-[11px] text-white [color-scheme:dark]" /></label>
                              <label>Hasta<input type="datetime-local" value={draft.endsAt} onChange={(e) => setDraft({ ...draft, endsAt: e.target.value })} className="mt-0.5 w-full rounded-md border border-white/10 bg-black/40 px-1.5 py-1 text-[11px] text-white [color-scheme:dark]" /></label>
                            </div>
                            <label className="flex items-center gap-2 text-[11px] text-neutral-400">Peso en la rotación
                              <input type="number" min={1} max={100} value={draft.weight} onChange={(e) => setDraft({ ...draft, weight: Math.min(100, Math.max(1, Number(e.target.value) || 1)) })} className="w-16 rounded-md border border-white/10 bg-black/40 px-2 py-1 text-white" />
                            </label>
                            <button type="button" onClick={() => void save()} disabled={saving} className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-yellow-400 px-3 py-2 text-[12px] font-semibold text-black hover:bg-yellow-300 disabled:opacity-40">
                              {saving && <Loader2 size={13} className="animate-spin" />} {draft.id ? "Guardar cambios" : "Publicar campaña"}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </section>
          ))}
        </div>
      </aside>

      {/* Live portal preview with the slot outlined */}
      <section className="flex min-h-[60vh] min-w-0 flex-1 flex-col bg-[#060606]">
        <div className="flex items-center gap-1 border-b border-white/10 px-3 py-2">
          {DEVICES.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" onClick={() => setDevice(id)} className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11.5px] ${device === id ? "bg-white/10 text-white" : "text-neutral-500 hover:text-neutral-200"}`}>
              <Icon size={13} /> {label}
            </button>
          ))}
          {slot && <span className="ml-auto truncate text-[11px] text-neutral-500">{slot.name} · {DEVICE_LABEL[device]} {sizeLabel(slot.sizes[device])}</span>}
        </div>
        <div ref={boxRef} className="relative min-h-0 flex-1 overflow-hidden">
          <div style={{ width: deviceWidth, height: `${100 / scale}%`, transform: `scale(${scale})`, transformOrigin: "top left" }}>
            <iframe ref={frameRef} title="Vista previa del portal" src="/?preview=1&ads=outline" onLoad={highlight} className="h-full w-full border-0 bg-black" />
          </div>
        </div>
      </section>
    </div>
  );
}
