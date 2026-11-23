// Server-side filters for the Noticias list. Filtering used to happen in the browser over
// the first 200 rows, so once imports and published news filled those rows, drafts and
// older articles vanished from the list and from search.

export type NewsFilter = "all" | "draft" | "published" | "archived";

export interface NewsQueryInput {
  filter: NewsFilter;
  category: string; // "all" or a category name
  search: string;
}

/** The PostgREST filter methods this module uses (a Supabase query builder has them). */
export interface FilterableQuery {
  or(filters: string): FilterableQuery;
  eq(column: string, value: unknown): FilterableQuery;
}

// External imports are raw material, not editorial drafts: they only belong in this list
// once published (same rule the desk always had, now applied by the database).
export const EDITORIAL_ROWS = "status.in.(published,enhanced),and(source_url.is.null,source.is.null)";

/** Characters with meaning inside a PostgREST `or=(...)` filter are dropped from the term. */
export function sanitizeSearch(term: string): string {
  return term.replace(/[,()*%\\:"']/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}

// Typed loosely on purpose: Supabase's builder generics are too deep to infer through a helper.
export function applyNewsFilters<Q>(query: Q, input: NewsQueryInput): Q {
  let next = (query as unknown as FilterableQuery).or(EDITORIAL_ROWS);
  if (input.filter !== "all") next = next.eq("status", input.filter);
  if (input.category !== "all") next = next.eq("category", input.category);
  const term = sanitizeSearch(input.search);
  if (term) {
    const pattern = `*${term}*`;
    next = next.or(`title.ilike.${pattern},subtitle.ilike.${pattern},slug.ilike.${pattern},category.ilike.${pattern}`);
  }
  return next as unknown as Q;
}
