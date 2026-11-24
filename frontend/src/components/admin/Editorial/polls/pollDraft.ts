// Pure helpers for the admin poll editor (tested in pollDraft.test.ts).

export type PollKind = "poll" | "debate";
export type PollStatus = "draft" | "open" | "closed";
export type Placement = "home" | "pulse" | "article";

export interface AdminPoll {
  id: string;
  kind: PollKind;
  question: string;
  context: string | null;
  options: { id: string; label: string; argument: string | null; votes: number }[];
  totalVotes: number;
  status: PollStatus;
  closesAt: string | null;
  newsId: string | null;
  featured: boolean;
  placement: Placement[];
  createdAt: string;
}

export interface DraftOption { key: string; id?: string; label: string; argument: string }

export interface PollDraft {
  kind: PollKind;
  question: string;
  context: string;
  options: DraftOption[];
  status: PollStatus;
  closesAt: string; // datetime-local value ("" = never)
  newsId: string;
  featured: boolean;
  placement: Placement[];
}

const key = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2));

export function emptyDraft(kind: PollKind): PollDraft {
  return {
    kind, question: "", context: "", status: "open", closesAt: "", newsId: "", featured: false,
    placement: kind === "debate" ? ["home", "pulse"] : ["home", "pulse"],
    options: kind === "debate"
      ? [{ key: key(), label: "A favor", argument: "" }, { key: key(), label: "En contra", argument: "" }]
      : [{ key: key(), label: "", argument: "" }, { key: key(), label: "", argument: "" }],
  };
}

/** ISO timestamp -> value for <input type="datetime-local"> in the browser's local time. */
export function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function draftFromPoll(poll: AdminPoll): PollDraft {
  return {
    kind: poll.kind, question: poll.question, context: poll.context ?? "", status: poll.status,
    closesAt: toLocalInput(poll.closesAt), newsId: poll.newsId ?? "", featured: poll.featured,
    placement: poll.placement?.length ? poll.placement : ["home"],
    options: poll.options.map((o) => ({ key: o.id, id: o.id, label: o.label, argument: o.argument ?? "" })),
  };
}

/** First reason the draft can't be saved, in Spanish, or null. */
export function draftProblem(draft: PollDraft): string | null {
  if (draft.question.trim().length < 3) return "Escribe la pregunta.";
  const labels = draft.options.map((o) => o.label.trim());
  if (labels.some((l) => !l)) return "Completa todas las opciones.";
  if (new Set(labels.map((l) => l.toLocaleLowerCase())).size !== labels.length) return "Hay opciones repetidas.";
  if (draft.kind === "debate") {
    if (draft.options.length !== 2) return "Un debate tiene exactamente dos posturas.";
    if (draft.options.some((o) => !o.argument.trim())) return "Escribe el argumento de cada postura.";
  } else if (draft.options.length < 2 || draft.options.length > 6) {
    return "Una encuesta tiene de 2 a 6 opciones.";
  }
  if (draft.placement.length === 0) return "Elige al menos un lugar donde mostrarla.";
  if (draft.placement.includes("article") && !draft.newsId) return "Vincula una noticia o quita “En su noticia”.";
  if (draft.closesAt && draft.status === "open" && new Date(draft.closesAt).getTime() <= Date.now()) return "La fecha de cierre ya pasó.";
  return null;
}

export function draftToPayload(draft: PollDraft, editing: boolean): Record<string, unknown> {
  const options = draft.options.map((o) => ({
    ...(o.id ? { id: o.id } : {}), label: o.label.trim(), argument: draft.kind === "debate" ? o.argument.trim() : null,
  }));
  const closesAt = draft.closesAt ? new Date(draft.closesAt).toISOString() : null;
  const base = {
    question: draft.question.trim(), context: draft.context.trim() || null, status: draft.status,
    featured: draft.featured, placement: draft.placement, options,
  };
  if (editing) {
    return { ...base, newsId: draft.newsId, ...(closesAt ? { closesAt } : { clearClosesAt: true }) };
  }
  return { ...base, kind: draft.kind, newsId: draft.newsId || null, closesAt };
}

/** Whole-number percentage that never shows NaN. */
export function percent(votes: number, total: number): number {
  return total > 0 ? Math.round((votes / total) * 100) : 0;
}
