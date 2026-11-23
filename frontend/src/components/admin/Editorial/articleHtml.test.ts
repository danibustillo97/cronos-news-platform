import { describe, expect, it } from "vitest";
import { stripArticleWrapper, wrapArticle } from "./articleHtml";

describe("article wrapper", () => {
  it("round-trips the editor body without nesting wrappers", () => {
    const body = "<p>Uno</p><figure data-placeholder-id=\"img-1\"></figure>";
    expect(stripArticleWrapper(wrapArticle(body))).toBe(body);
    expect(wrapArticle(stripArticleWrapper(wrapArticle(body)))).toBe(wrapArticle(body));
  });

  it("accepts attributes on the wrapper and bodies without it", () => {
    expect(stripArticleWrapper('<article class="x"><p>a</p></article>')).toBe("<p>a</p>");
    expect(stripArticleWrapper("<p>sin envoltura</p>")).toBe("<p>sin envoltura</p>");
  });
});
