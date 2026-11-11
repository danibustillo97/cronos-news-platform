"use client";

// The real NodeView for a BODY_IMAGE block -- rendered INLINE inside the
// document flow (section 7: "debe existir como un bloque REAL dentro del
// documento"), not a separate side panel. Reuses the exact same real
// backend actions (generate/upload/replace/delete) as FeaturedImageHero/
// MediaRequirementBlock -- no parallel image infrastructure.

import { useRef, useState } from "react";
import { NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { AlertTriangle, ImagePlus, Pencil, RefreshCw, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { apiUrl } from "@/studio/lab/api-client";
import { useEditorialImageContext } from "./EditorialImageContext";

const PROVENANCE_LABEL: Record<string, string> = {
  HUMAN_UPLOADED: "Subida manualmente",
};

function provenanceLabel(provenance: string | null | undefined): string | null {
  if (!provenance) return null;
  if (PROVENANCE_LABEL[provenance]) return PROVENANCE_LABEL[provenance];
  const [kind, provider, model] = provenance.split(":");
  if (kind === "AI_GENERATED") return `Generada con IA · ${provider}${model ? ` (${model})` : ""}`;
  return provenance;
}

export default function EditorialImageView({ node, deleteNode, editor }: NodeViewProps) {
  const ctx = useEditorialImageContext();
  const placeholderId = node.attrs.placeholderId as string | null;
  const requirement = ctx?.mediaRequirements.find((m) => m.placeholderId === placeholderId) ?? null;
  const readOnly = !editor.isEditable;

  const [editingPrompt, setEditingPrompt] = useState(false);
  const [promptDraft, setPromptDraft] = useState(requirement?.prompt ?? "");
  const [captionDraft, setCaptionDraft] = useState(requirement?.caption ?? "");
  const [altDraft, setAltDraft] = useState(requirement?.altText ?? "");
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!ctx || !placeholderId) {
    if (readOnly) return null;
    return (
      <NodeViewWrapper as="div" className="my-3 rounded-xl border border-red-500/20 bg-red-500/[0.04] p-3 text-[12px] text-red-300 flex items-center gap-1.5">
        <AlertTriangle size={13} /> Bloque de imagen inválido
      </NodeViewWrapper>
    );
  }
  if (!requirement) {
    if (readOnly) return null;
    return (
      <NodeViewWrapper as="div" className="my-3 rounded-xl border border-red-500/20 bg-red-500/[0.04] p-3 text-[12px] text-red-300 flex items-center gap-1.5">
        <AlertTriangle size={13} /> Imagen no encontrada ({placeholderId}) -- fue eliminada del artifact
      </NodeViewWrapper>
    );
  }

  if (readOnly) {
    // Vista previa (Evolución del Artifact section 15): the SAME document
    // model and the SAME node the editor renders -- never a second,
    // hand-reconstructed representation. Only the chrome differs: no edit
    // controls, just what a reader would actually see.
    if (!requirement.assetUrl) return null;
    return (
      <NodeViewWrapper as="figure" className="my-4" contentEditable={false}>
        <img src={requirement.assetUrl} alt={requirement.altText ?? ""} className="w-full rounded-xl object-cover" />
        {requirement.caption && (
          <figcaption className="mt-1.5 text-[12px] text-neutral-500">{requirement.caption}</figcaption>
        )}
      </NodeViewWrapper>
    );
  }

  const patch = async (body: Record<string, unknown>) => {
    const res = await fetch(apiUrl(`/api/artifacts/${ctx.artifactId}/media/${placeholderId}`), {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    ctx.onMediaChanged();
  };

  const savePrompt = async () => {
    setBusy(true);
    try {
      await patch({ prompt: promptDraft });
      toast.success("Prompt guardado");
      setEditingPrompt(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar el prompt");
    } finally {
      setBusy(false);
    }
  };

  const saveCaption = async () => {
    try {
      await patch(captionDraft.trim() ? { caption: captionDraft } : { clearCaption: true });
    } catch {
      toast.error("No se pudo guardar el pie de foto");
    }
  };

  const saveAlt = async () => {
    try {
      await patch(altDraft.trim() ? { altText: altDraft } : { clearAltText: true });
    } catch {
      toast.error("No se pudo guardar el alt text");
    }
  };

  const generate = async () => {
    setBusy(true);
    try {
      const res = await fetch(apiUrl(`/api/artifacts/${ctx.artifactId}/media/${placeholderId}/generate`), { method: "POST" });
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
          if (updated.status === "COMPLETED") { toast.success("Imagen generada"); ctx.onMediaChanged(); }
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
      const res = await fetch(apiUrl(`/api/artifacts/${ctx.artifactId}/media/${placeholderId}/upload`), { method: "POST", body: form });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail || body?.message || `HTTP ${res.status}`);
      }
      toast.success(requirement.assetUrl ? "Imagen reemplazada" : "Imagen subida");
      ctx.onMediaChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo subir la imagen");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      const res = await fetch(apiUrl(`/api/artifacts/${ctx.artifactId}/media/${placeholderId}`), { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail || body?.message || `HTTP ${res.status}`);
      }
      deleteNode();
      ctx.onMediaChanged();
      toast.success("Imagen eliminada del artículo");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo eliminar");
      setBusy(false);
    }
  };

  const provenance = provenanceLabel(requirement.assetProvenance);

  return (
    <NodeViewWrapper as="div" className="my-4 rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden" contentEditable={false}>
      <div className="flex items-center justify-between px-3 pt-2.5">
        <span className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wide">Imagen del cuerpo</span>
        {provenance && <span className="text-[10px] text-neutral-600">{provenance}</span>}
      </div>
      <div className="w-full bg-white/5 flex items-center justify-center min-h-[140px]">
        {requirement.assetUrl ? (
          <img src={requirement.assetUrl} alt={altDraft} className="w-full max-h-[360px] object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-1.5 text-neutral-700 py-10">
            <ImagePlus size={24} />
            <span className="text-[11px]">Sin imagen todavía</span>
          </div>
        )}
      </div>
      <div className="p-3 space-y-2">
        {editingPrompt ? (
          <div className="space-y-1.5">
            <div className="text-[10.5px] text-neutral-500">Prompt de generación</div>
            <textarea value={promptDraft} onChange={(e) => setPromptDraft(e.target.value)} rows={2}
              className="w-full bg-black/20 border border-white/10 rounded-lg px-2 py-1.5 text-[12px] text-white resize-none" />
            <div className="flex items-center gap-1.5">
              <button onClick={savePrompt} disabled={busy} className="text-[11px] font-medium px-2.5 py-1 rounded-md bg-white/10 text-white hover:bg-white/20 disabled:opacity-50">Guardar</button>
              <button onClick={() => { setEditingPrompt(false); setPromptDraft(requirement.prompt); }} className="text-[11px] text-neutral-500 hover:text-white px-2 py-1">Cancelar</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setEditingPrompt(true)} className="text-left w-full group">
            <span className="text-[10.5px] text-neutral-600">Prompt: </span>
            <span className="text-[12px] text-neutral-400 group-hover:text-neutral-200">{requirement.prompt || "(sin prompt)"}</span>
          </button>
        )}

        <div>
          <div className="text-[10.5px] text-neutral-500 mb-1">Pie de foto</div>
          <input
            value={captionDraft} onChange={(e) => setCaptionDraft(e.target.value)} onBlur={saveCaption}
            placeholder="Texto que verá el lector debajo de la imagen"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-[12px] text-white"
          />
        </div>
        <div>
          <div className="text-[10.5px] text-neutral-500 mb-1">Alt text</div>
          <input
            value={altDraft} onChange={(e) => setAltDraft(e.target.value)} onBlur={saveAlt}
            placeholder="Descripción para accesibilidad/SEO"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-[12px] text-white"
          />
        </div>

        <div className="flex items-center gap-1.5 pt-1 border-t border-white/5">
          <button onClick={generate} disabled={busy}
            className="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 disabled:opacity-50">
            {busy ? <RefreshCw className="animate-spin" size={12} /> : <ImagePlus size={12} />}
            {requirement.assetUrl ? "Regenerar" : "Generar"}
          </button>
          <button onClick={() => fileInputRef.current?.click()} disabled={busy}
            className="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-white/5 text-neutral-300 hover:bg-white/10 disabled:opacity-50">
            <Upload size={12} /> {requirement.assetUrl ? "Reemplazar" : "Subir"}
          </button>
          <button onClick={() => setEditingPrompt(true)} disabled={busy}
            className="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-white/5 text-neutral-300 hover:bg-white/10 disabled:opacity-50">
            <Pencil size={12} /> Editar prompt
          </button>
          <button onClick={remove} disabled={busy}
            className="ml-auto flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg text-neutral-500 hover:text-red-300 hover:bg-red-500/10 disabled:opacity-50">
            <Trash2 size={12} /> Eliminar
          </button>
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
        </div>
      </div>
    </NodeViewWrapper>
  );
}
