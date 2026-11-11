"use client";

// Section 13-15 -- one real multimedia requirement as an editorial
// block: real current asset (or none), a real editable prompt, and the
// real actions the backend actually supports (Generar/Subir/Reemplazar).
// No fake progress bars -- generation is a real QUEUED/RUNNING/COMPLETED/
// FAILED job (see MediaGenerationJobOut), polled the same way the
// Artifact drawer already does.

import { useRef, useState } from "react";
import { ImagePlus, RefreshCw, Upload, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";
import { apiUrl } from "@/studio/lab/api-client";

export interface MediaRequirement {
  placeholderId: string;
  kind: "FEATURE_IMAGE" | "BODY_IMAGE" | "VIDEO";
  prompt: string;
  assetId: string | null;
  assetUrl: string | null;
  caption?: string | null;
  altText?: string | null;
  assetProvenance?: string | null;
}

const KIND_LABEL: Record<MediaRequirement["kind"], string> = {
  FEATURE_IMAGE: "Imagen destacada",
  BODY_IMAGE: "Imagen del cuerpo",
  VIDEO: "Video",
};

export default function MediaRequirementBlock({
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
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: promptDraft }),
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
      const res = await fetch(apiUrl(`/api/artifacts/${artifactId}/media/${requirement.placeholderId}/generate`), {
        method: "POST",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message || `HTTP ${res.status}`);
      }
      const job: { id: string; status: string } = await res.json();
      toast.success("Generando imagen real -- puede tardar unos segundos");
      const poll = setInterval(async () => {
        const r = await fetch(apiUrl(`/api/artifacts/media/jobs/${job.id}`));
        if (!r.ok) return;
        const updated = await r.json();
        if (updated.status === "COMPLETED" || updated.status === "FAILED") {
          clearInterval(poll);
          setBusy(false);
          if (updated.status === "COMPLETED") {
            toast.success("Imagen generada");
            onChanged();
          } else {
            toast.error(`Generación falló: ${updated.error}`);
          }
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
      const res = await fetch(apiUrl(`/api/artifacts/${artifactId}/media/${requirement.placeholderId}/upload`), {
        method: "POST", body: form,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail || body?.message || `HTTP ${res.status}`);
      }
      toast.success("Imagen subida");
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo subir la imagen");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 space-y-2.5">
      <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wide">
        {KIND_LABEL[requirement.kind]}
      </div>

      <div className="flex gap-3">
        <div className="w-24 h-24 rounded-lg bg-white/5 flex items-center justify-center overflow-hidden flex-shrink-0">
          {requirement.assetUrl ? (
            <img src={requirement.assetUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <ImagePlus size={22} className="text-neutral-700" />
          )}
        </div>

        <div className="flex-1 min-w-0 space-y-1.5">
          {editingPrompt ? (
            <div className="space-y-1.5">
              <textarea
                value={promptDraft}
                onChange={(e) => setPromptDraft(e.target.value)}
                rows={2}
                className="w-full bg-black/30 border border-white/10 rounded-lg px-2 py-1.5 text-[12px] text-white resize-none"
              />
              <div className="flex items-center gap-1.5">
                <button onClick={savePrompt} disabled={busy}
                  className="flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md bg-white/10 text-white hover:bg-white/20 disabled:opacity-50">
                  <Check size={11} /> Guardar
                </button>
                <button onClick={() => { setEditingPrompt(false); setPromptDraft(requirement.prompt); }}
                  className="flex items-center gap-1 text-[11px] text-neutral-500 hover:text-white px-2 py-1">
                  <X size={11} /> Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setEditingPrompt(true)} className="text-left w-full group">
              <p className="text-[12px] text-neutral-400 line-clamp-2 group-hover:text-neutral-200">{requirement.prompt}</p>
              <span className="text-[10.5px] text-neutral-600 flex items-center gap-1 mt-0.5 group-hover:text-neutral-400">
                <Pencil size={9} /> Editar prompt
              </span>
            </button>
          )}
        </div>
      </div>

      {requirement.kind !== "VIDEO" && (
        <div className="flex items-center gap-1.5 pt-1 border-t border-white/5">
          <button onClick={generate} disabled={busy}
            className="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 disabled:opacity-50">
            {busy ? <RefreshCw className="animate-spin" size={12} /> : <ImagePlus size={12} />}
            {requirement.assetUrl ? "Regenerar" : "Generar imagen"}
          </button>
          <button onClick={() => fileInputRef.current?.click()} disabled={busy}
            className="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-white/5 text-neutral-300 hover:bg-white/10 disabled:opacity-50">
            <Upload size={12} /> {requirement.assetUrl ? "Reemplazar" : "Subir imagen"}
          </button>
          <input
            ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }}
          />
        </div>
      )}
    </div>
  );
}
