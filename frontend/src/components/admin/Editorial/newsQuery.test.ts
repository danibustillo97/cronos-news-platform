import { describe, expect, it } from "vitest";
import { applyNewsFilters, EDITORIAL_ROWS, sanitizeSearch, type FilterableQuery } from "./newsQuery";

class Recorder implements FilterableQuery {
  calls: Array<[string, ...unknown[]]> = [];
  or(filters: string) { this.calls.push(["or", filters]); return this; }
  eq(column: string, value: unknown) { this.calls.push(["eq", column, value]); return this; }
}

describe("applyNewsFilters", () => {
  it("always limits the list to editorial rows", () => {
    const query = applyNewsFilters(new Recorder(), { filter: "all", category: "all", search: "" });
    expect(query.calls).toEqual([["or", EDITORIAL_ROWS]]);
  });

  it("filters by status and category in the database", () => {
    const query = applyNewsFilters(new Recorder(), { filter: "draft", category: "Fútbol", search: "" });
    expect(query.calls).toEqual([["or", EDITORIAL_ROWS], ["eq", "status", "draft"], ["eq", "category", "Fútbol"]]);
  });

  it("searches title, subtitle, slug and category", () => {
    const query = applyNewsFilters(new Recorder(), { filter: "all", category: "all", search: "  Copa América " });
    expect(query.calls[1]).toEqual(["or", "title.ilike.*Copa América*,subtitle.ilike.*Copa América*,slug.ilike.*Copa América*,category.ilike.*Copa América*"]);
  });
});

describe("sanitizeSearch", () => {
  it("drops characters that would break or widen a PostgREST filter", () => {
    expect(sanitizeSearch("gol),status.eq.archived,(x")).toBe("gol status.eq.archived x");
    expect(sanitizeSearch("100% *real*")).toBe("100 real");
  });

  it("caps very long terms", () => {
    expect(sanitizeSearch("a".repeat(200))).toHaveLength(80);
  });
});
