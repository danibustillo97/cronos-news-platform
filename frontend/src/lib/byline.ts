// Article bylines. An editor's email used to be written as the author and was then
// published on the article, in OpenGraph/JSON-LD metadata and in /creador/<email> pages.

/** Same fallback the backend publisher and the public site already use. */
export const DEFAULT_BYLINE = "Nexus News";

const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/;

export const looksLikeEmail = (value: string) => EMAIL.test(value);

/** Name safe to show publicly: never an email address. */
export function publicAuthorName(author: string | null | undefined): string {
  const value = (author ?? "").trim();
  return value && !looksLikeEmail(value) ? value : DEFAULT_BYLINE;
}

interface EditorLike {
  user_metadata?: Record<string, unknown> | null;
}

/** Display name of the signed-in editor from their profile, or the newsroom byline. */
export function editorByline(user: EditorLike | null | undefined): string {
  const meta = user?.user_metadata ?? {};
  for (const key of ["full_name", "name", "display_name"]) {
    const value = meta[key];
    if (typeof value === "string" && value.trim() && !looksLikeEmail(value)) return value.trim();
  }
  return DEFAULT_BYLINE;
}

/**
 * Byline to store when saving: an existing author is kept (editing an article does not
 * re-sign it), unless it is missing or is an email address left by older versions.
 */
export function resolveByline(existing: string | null | undefined, user: EditorLike | null | undefined): string {
  const value = (existing ?? "").trim();
  return value && !looksLikeEmail(value) ? value : editorByline(user);
}
