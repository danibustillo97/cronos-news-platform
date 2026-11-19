"use client";

// Revisión 2.0 -- one real row in the "En revisión" queue: a real
// thumbnail (the artifact's own featured-image asset, if one is
// configured yet -- never a stock/placeholder photo), real source name
// and relative time, the real status pill, and the real warning/media
// counts already computed elsewhere. Purely presentational -- every
// value here already exists on the artifact.

import { ImageIcon, AlertTriangle, ImagePlus } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import StatusPill from "./StatusPill";
import { ARTIFACT_STATUS } from "./statusMeta";

interface MediaRequirement { kind: "FEATURE_IMAGE" | "BODY_IMAGE" | "VIDEO"; assetId: string | null; assetUrl: string | null; }
interface ValidationIssue { check: string; detail: string; severity?: "BLOCKING" | "WARNING"; }

export interface QueueArtifact {
  id: string;
  title: string;
  categoryId: string | null;
  status: string;
  sources: { sourceName: string | null; sourceDomain: string }[];
  createdAt: string;
  mediaRequirements: MediaRequirement[];
  validationIssues: ValidationIssue[];
}

export default function ArtifactQueueRow({
  artifact, categoryName, selected, onSelect,
}: {
  artifact: QueueArtifact;
  categoryName: string | null;
  selected: boolean;
  onSelect: () => void;
}) {
  const meta = ARTIFACT_STATUS[artifact.status] ?? { label: artifact.status, tone: "neutral" as const };
  const featured = artifact.mediaRequirements.find((m) => m.kind === "FEATURE_IMAGE");
  const pending = artifact.mediaRequirements.filter((m) => !m.assetId).length;
  const source = artifact.sources[0];
  const timeAgo = (() => {
    try {
      return formatDistanceToNow(new Date(artifact.createdAt), { addSuffix: true, locale: es });
    } catch {
      return null;
    }
  })();

  return (
    <button
      onClick={onSelect}
      className={`w-full text-left px-3 py-3 border-l-2 transition-colors ${
        selected ? "border-l-red-500 bg-white/[0.05]" : "border-l-transparent hover:bg-white/[0.03]"
      }`}
    >
      <div className="flex gap-2.5">
        <div className="w-11 h-11 rounded-lg bg-white/5 flex-shrink-0 overflow-hidden flex items-center justify-center">
          {featured?.assetUrl ? (
            <img src={featured.assetUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <ImageIcon size={16} className="text-neutral-700" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[10.5px] mb-0.5">
            {categoryName && <span className="text-neutral-500 truncate">{categoryName}</span>}
            <span className="ml-auto flex-shrink-0"><StatusPill meta={meta} /></span>
          </div>
          <div className="text-[13px] font-medium text-white leading-snug line-clamp-2">{artifact.title}</div>
          <div className="text-[10.5px] text-neutral-500 mt-0.5 truncate">
            {source?.sourceName ?? source?.sourceDomain ?? "—"}{timeAgo ? ` · ${timeAgo}` : ""}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2.5 mt-1.5 pl-[54px] text-[10.5px] text-neutral-500">
        {artifact.validationIssues.length > 0 && (
          <span className="flex items-center gap-1 text-amber-400">
            <AlertTriangle size={10} /> {artifact.validationIssues.length} advertencia{artifact.validationIssues.length === 1 ? "" : "s"}
          </span>
        )}
        {artifact.mediaRequirements.length > 0 && (
          <span className={`flex items-center gap-1 ${pending > 0 ? "text-amber-400" : "text-neutral-500"}`}>
            <ImagePlus size={10} />
            {artifact.mediaRequirements.length} material{artifact.mediaRequirements.length === 1 ? "" : "es"}
            {pending > 0 ? ` · ${pending} pendiente${pending === 1 ? "" : "s"}` : ""}
          </span>
        )}
      </div>
    </button>
  );
}
