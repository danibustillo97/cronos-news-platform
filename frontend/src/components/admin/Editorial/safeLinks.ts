// Links that come from AI output or scraped sources are shown in the editor; a malformed
// URL must not crash the panel and a non-web scheme (javascript:, data:) must not be clickable.

/** The URL when it is a valid http(s) address, otherwise null. */
export function safeHttpUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

/** Short host label ("as.com") for a link, or the raw text when it is not a valid URL. */
export function linkLabel(value: string): string {
  const url = safeHttpUrl(value);
  return url ? new URL(url).hostname.replace(/^www\./, "") : value.slice(0, 40);
}
