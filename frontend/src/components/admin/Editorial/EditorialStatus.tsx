// One place for how article states read to the newsroom -- plain language,
// never internal names (Artifact, Story, Discovery, VALIDATED...).

export type StatusTone = "neutral" | "info" | "warn" | "ok" | "danger";

const STATUS: Record<string, { label: string; tone: StatusTone }> = {
  DISCOVERED: { label: "Nueva", tone: "neutral" },
  SELECTED: { label: "Guardada", tone: "neutral" },
  AI_QUEUED: { label: "IA en cola", tone: "info" },
  AI_RUNNING: { label: "IA redactando…", tone: "info" },
  AI_FAILED: { label: "La IA falló", tone: "danger" },
  AI_PENDING: { label: "Esperando IA", tone: "info" },
  AI_COMPLETED: { label: "IA terminó", tone: "info" },
  AI_REVIEW_REQUIRED: { label: "IA terminó", tone: "info" },
  DRAFT: { label: "Borrador", tone: "neutral" },
  REVIEW_REQUIRED: { label: "Con avisos", tone: "warn" },
  VALIDATED: { label: "Por aprobar", tone: "info" },
  APPROVED: { label: "Lista para publicar", tone: "ok" },
  SCHEDULED: { label: "Programada", tone: "info" },
  PUBLISHING: { label: "Publicando…", tone: "info" },
  PUBLISHED: { label: "Publicada", tone: "ok" },
  ARCHIVED: { label: "En papelera", tone: "neutral" },
  REJECTED: { label: "Rechazada", tone: "danger" },
};

const TONE_CLASS: Record<StatusTone, string> = {
  neutral: "bg-white/[0.06] text-neutral-300",
  info: "bg-sky-500/10 text-sky-300",
  warn: "bg-amber-500/10 text-amber-300",
  ok: "bg-emerald-500/10 text-emerald-300",
  danger: "bg-red-500/10 text-red-300",
};

export function statusLabel(status: string): { label: string; tone: StatusTone } {
  return STATUS[status] ?? { label: status, tone: "neutral" };
}

export function StatusPill({ status, issues = 0 }: { status: string; issues?: number }) {
  const { label, tone } = statusLabel(status);
  const text = status === "REVIEW_REQUIRED" && issues > 0 ? `${issues} ${issues === 1 ? "aviso" : "avisos"}` : label;
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-medium ${TONE_CLASS[tone]}`}>
      {text}
    </span>
  );
}
