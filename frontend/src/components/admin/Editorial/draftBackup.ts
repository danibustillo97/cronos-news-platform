// Browser copy of an article being edited in Noticias, written on every change and removed
// once the article is saved. Closing the tab, switching admin sections or a lost session
// no longer throws the text away: reopening the article offers to restore it.

const PREFIX = "nexus-news-draft:";
const MAX_AGE_MS = 14 * 24 * 3600 * 1000;

export interface DraftBackup<T> {
  savedAt: number;
  draft: T;
}

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const storage = (): StorageLike | null => {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
};

/** `null` article id = a new, never saved article. */
export const backupKey = (articleId: string | null) => `${PREFIX}${articleId ?? "new"}`;

export function writeBackup<T>(articleId: string | null, draft: T, store: StorageLike | null = storage(), now = Date.now()) {
  try {
    store?.setItem(backupKey(articleId), JSON.stringify({ savedAt: now, draft } satisfies DraftBackup<T>));
  } catch {
    // Storage full or blocked: the editor keeps working, only the safety copy is missing.
  }
}

export function readBackup<T>(articleId: string | null, store: StorageLike | null = storage(), now = Date.now()): DraftBackup<T> | null {
  try {
    const raw = store?.getItem(backupKey(articleId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DraftBackup<T>;
    if (typeof parsed?.savedAt !== "number" || !parsed.draft || now - parsed.savedAt > MAX_AGE_MS) {
      store?.removeItem(backupKey(articleId));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearBackup(articleId: string | null, store: StorageLike | null = storage()) {
  try {
    store?.removeItem(backupKey(articleId));
  } catch {
    // nothing to clean up
  }
}

/** Stable comparison of two drafts (field order independent). */
export function sameDraft(a: object, b: object): boolean {
  const normalize = (value: object) => JSON.stringify(Object.fromEntries(Object.entries(value).sort(([x], [y]) => x.localeCompare(y))));
  return normalize(a) === normalize(b);
}
