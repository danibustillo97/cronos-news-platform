"use client";

// Revisión 2.0's real hero block for the FEATURED image -- distinct
// placement from body images (section 9/10: Asset ≠ Placement, and
// featured vs body are different real MediaRequirement.kind values).
// Same real backend actions as MediaRequirementBlock (generate/upload/
// replace, real jobs, real assets) -- just the prominent top-of-editor
// layout the featured image deserves.

import { useRef, useState } from "react";
import { ExternalLink, ImagePlus, Pencil, RefreshCw, Upload } from "lucide-react";
import { toast } from "sonner";
import { apiUrl } from "@/studio/lab/api-client";
import type { MediaRequirement } from "./MediaRequirementBlock";

export default function FeaturedImageHero({
  artifactId, requirement, onChanged,
}: {
  artifactId: string;
  requirement: MediaRequirement;
  onChanged: () => void;
}) {
  const [editingPrompt, setEditingPrompt] = useState(false);
  const [promptDraft, setPromptDraft] = useState(requirement.prompt);
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const savePrompt = async () => {
    setBusy(true);
    try {
      const res = await fetch(apiUrl(`/api/artifacts/${artifactId}/media/${requirement.placeholderId}`), {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: promptDraft }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success("Prompt guardado");
      setEditingPrompt(false);
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar el prompt");
    } finally {
      setBusy(false);
    }
  };

  const generate = async () => {
    setBusy(true);
    try {
      const res = await fetch(apiUrl(`/api/artifacts/${artifactId}/media/${requirement.placeholderId}/generate`), { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message || `HTTP ${res.status}`);
      }
      const job: { id: string } = await res.json();
      toast.success("Generando imagen real -- puede tardar unos segundos");
      const poll = setInterval(async () => {
        const r = await fetch(apiUrl(`/api/artifacts/media/jobs/${job.id}`));
        if (!r.ok) return;
        const updated = await r.json();
        if (updated.status === "COMPLETED" || updated.status === "FAILED") {
          clearInterval(poll);
          setBusy(false);
          if (updated.status === "COMPLETED") { toast.success("Imagen generada"); onChanged(); }
          else toast.error(`Generación falló: ${updated.error}`);
        }
      }, 3000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo iniciar la generación");
      setBusy(false);
    }
  };

  const upload = async (file: File) => {
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(apiUrl(`/api/artifacts/${artifactId}/media/${requirement.placeholderId}/upload`), { method: "POST", body: form });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail || body?.message || `HTTP ${res.status}`);
      }
      toast.success(requirement.assetUrl ? "Imagen reemplazada" : "Imagen subida");
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo subir la imagen");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
      <div className="flex flex-col md:flex-row">
        <div className="md:w-3/5 aspect-video md:aspect-auto bg-white/5 flex items-center justify-center relative">
          {requirement.assetUrl ? (
            <img src={requirement.assetUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="flex flex-col items-center gap-1.5 text-neutral-700 py-10">
              <ImagePlus size={28} />
              <span className="text-[11px]">Sin imagen destacada</span>
            </div>
          )}
        </div>
        <div className="flex flex-col p-3.5 md:w-2/5">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[11px] font-semibold text-neutral-300">Imagen destacada</span>
          {requirement.assetUrl && (
            <a href={requirement.assetUrl} target="_blank" rel="noreferrer" className="text-neutral-500 hover:text-white">
            <ExternalLink size={12} />
            </a>
          )}
        </div>
        <p className="text-xs leading-relaxed text-neutral-500">
          {requirement.assetUrl ? "Imagen lista para la publicación." : "Aún no se ha seleccionado una imagen."}
        </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 border-t border-white/5 px-3.5 py-2.5">
        <button onClick={() => fileInputRef.current?.click()} disabled={busy}
        className="flex items-center gap-1.5 rounded-lg bg-white/5 px-2.5 py-1.5 text-[11.5px] font-semibold text-neutral-300 hover:bg-white/10 disabled:opacity-50">
        <Upload size={12} /> {requirement.assetUrl ? "Cambiar imagen" : "Subir imagen"}
        </button>
        <details className="group relative">
        <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-lg bg-white/5 px-2.5 py-1.5 text-[11.5px] font-medium text-neutral-400 hover:bg-white/10 hover:text-neutral-200">
          <Pencil size={12} /> IA opcional
        </summary>
        <div className="absolute left-0 top-full z-20 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-white/10 bg-neutral-950 p-3 shadow-2xl">
          {editingPrompt ? (
            <>
              <textarea
                value={promptDraft}
                onChange={(event) => setPromptDraft(event.target.value)}
                rows={4}
                className="w-full resize-y rounded-lg border border-white/10 bg-black/30 px-2.5 py-2 text-xs text-white outline-none focus:border-white/30"
              />
              <div className="mt-2 flex items-center gap-2">
                <button onClick={savePrompt} disabled={busy} className="rounded-md bg-white/10 px-2.5 py-1.5 text-[11px] font-medium text-white hover:bg-white/20 disabled:opacity-50">Guardar prompt</button>
                <button onClick={() => { setEditingPrompt(false); setPromptDraft(requirement.prompt); }} className="px-2 py-1.5 text-[11px] text-neutral-500 hover:text-white">Cancelar</button>
              </div>
            </>
          ) : (
            <>
              <p className="text-xs leading-relaxed text-neutral-400">{requirement.prompt || "Sin instrucciones configuradas."}</p>
              <div className="mt-3 flex items-center gap-2">
                <button onClick={() => setEditingPrompt(true)} disabled={busy} className="rounded-md bg-white/5 px-2.5 py-1.5 text-[11px] font-medium text-neutral-300 hover:bg-white/10 disabled:opacity-50">Editar instrucciones</button>
                <button onClick={generate} disabled={busy} className="inline-flex items-center gap-1.5 rounded-md bg-purple-500/15 px-2.5 py-1.5 text-[11px] font-semibold text-purple-200 hover:bg-purple-500/25 disabled:opacity-50">
                  {busy ? <RefreshCw className="animate-spin" size={12} /> : <RefreshCw size={12} />}
                  Generar
                </button>
              </div>
            </>
          )}
        </div>
        </details>
        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
      </div>
    </div>
  );
}
