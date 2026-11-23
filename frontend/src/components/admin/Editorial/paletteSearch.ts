// Matching and ranking for the editorial command palette (Ctrl/⌘+K): accent- and
// case-insensitive, every word of the query must appear, prefix matches rank first.

export const normalizeText = (value: string) =>
  value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("es").replace(/\s+/g, " ").trim();

/** 0 = no match; higher is better. */
export function matchScore(text: string, query: string): number {
  const haystack = normalizeText(text);
  const words = normalizeText(query).split(" ").filter(Boolean);
  if (!words.length) return 1;
  let score = 0;
  for (const word of words) {
    const index = haystack.indexOf(word);
    if (index < 0) return 0;
    const wordStart = index === 0 || haystack[index - 1] === " ";
    score += wordStart ? 3 : 1;
    if (index === 0) score += 2;
  }
  return score;
}

export function rankMatches<T>(items: T[], query: string, text: (item: T) => string, limit = 6): T[] {
  return items
    .map((item, order) => ({ item, order, score: matchScore(text(item), query) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .slice(0, limit)
    .map((entry) => entry.item);
}
