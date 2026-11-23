// Editorial rules for the `news` table shared by the Noticias desk.

export type NewsStatus = "draft" | "published" | "archived" | "enhanced";

/** Only `published` rows are public: the RLS policy and /noticia/[slug] serve nothing else. */
export const isPublic = (status: NewsStatus) => status === "published";

export const STATUS_LABEL: Record<NewsStatus, string> = {
  draft: "Borrador",
  published: "Publicada",
  archived: "Archivada",
  // Rows improved by the legacy pipeline: not public until someone publishes them.
  enhanced: "Mejorada · no pública",
};

export function toSlug(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** `slug` when free, otherwise the first free `slug-2`, `slug-3`… (slugs are unique in `news`). */
export function nextFreeSlug(slug: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  if (!used.has(slug)) return slug;
  for (let suffix = 2; suffix < 1000; suffix += 1) {
    const candidate = `${slug}-${suffix}`;
    if (!used.has(candidate)) return candidate;
  }
  return `${slug}-${Date.now()}`;
}

/** Raised when the row changed since it was opened (someone else saved in between). */
export class EditConflictError extends Error {
  constructor() {
    super("Otra persona guardó cambios en esta noticia mientras la editabas");
    this.name = "EditConflictError";
  }
}

/** Human message for a failed save (Postgres unique violation on the slug, mostly). */
export function saveErrorMessage(error: unknown): string {
  const code = typeof error === "object" && error && "code" in error ? String((error as { code: unknown }).code) : "";
  const message = error instanceof Error ? error.message : typeof error === "object" && error && "message" in error ? String((error as { message: unknown }).message) : "";
  if (code === "23505" && /slug/i.test(message)) return "Ese enlace permanente ya lo usa otra noticia; elige otro";
  if (code === "23505") return "Ya existe una noticia con esos datos";
  return message || "No se pudo guardar la noticia";
}
