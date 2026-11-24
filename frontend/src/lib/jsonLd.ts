// Serialises structured data for <script type="application/ld+json">. JSON.stringify leaves
// "<" as is, so a headline containing "</script><script>..." would close the tag and run as
// script on the public page. Replacing <, > and & (and the JS line separators U+2028/U+2029)
// with their JSON unicode escapes keeps the data identical for parsers and inert inside HTML.
const BACKSLASH = String.fromCharCode(92);
const escapeChar = (char: string) => `${BACKSLASH}u${char.charCodeAt(0).toString(16).padStart(4, "0")}`;
const UNSAFE = new RegExp(`[<>&${String.fromCharCode(0x2028)}${String.fromCharCode(0x2029)}]`, "g");

export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data).replace(UNSAFE, escapeChar);
}
