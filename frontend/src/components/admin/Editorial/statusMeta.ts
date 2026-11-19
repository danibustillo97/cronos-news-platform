// Single source of truth for Spanish status language across Editorial
// (Discovery/Artifact/Ready/Publish). Every value here maps a REAL
// backend enum member to a label + tone -- never a status that doesn't
// exist in the domain (see backend/app/domain/discovery/entities.py::
// DiscoveryStatus, backend/app/domain/artifact/entities.py::
// ArtifactStatus/ArtifactJobStatus).

export type Tone = "neutral" | "info" | "warning" | "positive" | "negative";

export interface StatusMeta {
  label: string;
  tone: Tone;
}

export const DISCOVERY_ITEM_STATUS: Record<string, StatusMeta> = {
  DISCOVERED: { label: "Nuevo", tone: "neutral" },
  SELECTED: { label: "Seleccionado", tone: "info" },
  IGNORED: { label: "Ignorado", tone: "neutral" },
  ARCHIVED: { label: "Archivado", tone: "neutral" },
  SENT_TO_EDITORIAL: { label: "En Artifact", tone: "warning" },
};

export const DISCOVERY_JOB_STATUS: Record<string, StatusMeta> = {
  QUEUED: { label: "En cola", tone: "neutral" },
  RUNNING: { label: "Buscando", tone: "info" },
  CANCELLING: { label: "Deteniendo", tone: "warning" },
  CANCELLED: { label: "Detenido", tone: "neutral" },
  COMPLETED: { label: "Completado", tone: "positive" },
  FAILED: { label: "Falló", tone: "negative" },
};

export const ARTIFACT_JOB_STATUS: Record<string, StatusMeta> = {
  QUEUED: { label: "En cola", tone: "neutral" },
  RUNNING: { label: "Generando", tone: "info" },
  REVIEW_REQUIRED: { label: "Requiere revisión", tone: "warning" },
  COMPLETED: { label: "Completado", tone: "positive" },
  FAILED: { label: "Falló", tone: "negative" },
};

export const ARTIFACT_STATUS: Record<string, StatusMeta> = {
  DRAFT: { label: "Borrador", tone: "neutral" },
  REVIEW_REQUIRED: { label: "Revisión", tone: "warning" },
  VALIDATED: { label: "Validado", tone: "info" },
  APPROVED: { label: "Listo", tone: "positive" },
  SCHEDULED: { label: "Programado", tone: "warning" },
  REJECTED: { label: "Rechazado", tone: "negative" },
  PUBLISHED: { label: "Publicado", tone: "positive" },
};

export const TONE_CLASSES: Record<Tone, string> = {
  neutral: "text-neutral-300 bg-white/10",
  info: "text-blue-300 bg-blue-500/15",
  warning: "text-amber-300 bg-amber-500/20",
  positive: "text-green-300 bg-green-500/15",
  negative: "text-red-300 bg-red-500/15",
};

// Real category GROUP names from GET /api/categories (never invented --
// see backend's seeded taxonomy). One accent color per group so a
// category pill is scannable at a glance, same idea the mock reference
// uses (Deportes=red, Economía=amber, Tecnología=cyan, ...).
export const CATEGORY_GROUP_CLASSES: Record<string, string> = {
  "Deportes": "text-red-300 bg-red-500/15",
  "Tecnología": "text-cyan-300 bg-cyan-500/15",
  "Mundo": "text-blue-300 bg-blue-500/15",
  "Entretenimiento": "text-pink-300 bg-pink-500/15",
  "Negocios": "text-emerald-300 bg-emerald-500/15",
  "Estilo de Vida": "text-purple-300 bg-purple-500/15",
  "Opinión": "text-neutral-300 bg-neutral-500/15",
};
export const CATEGORY_GROUP_FALLBACK = "text-amber-300 bg-amber-500/15";
