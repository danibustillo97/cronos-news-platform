import { describe, expect, it } from "vitest";
import { DEFAULT_BYLINE, editorByline, publicAuthorName, resolveByline } from "./byline";

describe("bylines", () => {
  it("never shows an email publicly", () => {
    expect(publicAuthorName("editor@nexusnews.info")).toBe(DEFAULT_BYLINE);
    expect(publicAuthorName("  ")).toBe(DEFAULT_BYLINE);
    expect(publicAuthorName(null)).toBe(DEFAULT_BYLINE);
    expect(publicAuthorName("Laura Gómez")).toBe("Laura Gómez");
  });

  it("signs with the editor's profile name, else the newsroom", () => {
    expect(editorByline({ user_metadata: { full_name: "Laura Gómez" } })).toBe("Laura Gómez");
    expect(editorByline({ user_metadata: { name: "Dani" } })).toBe("Dani");
    expect(editorByline({ user_metadata: { full_name: "dani@example.com" } })).toBe(DEFAULT_BYLINE);
    expect(editorByline(null)).toBe(DEFAULT_BYLINE);
  });

  it("keeps the original author when someone else edits, but replaces stored emails", () => {
    const editor = { user_metadata: { full_name: "Otro Editor" } };
    expect(resolveByline("Laura Gómez", editor)).toBe("Laura Gómez");
    expect(resolveByline("laura@nexusnews.info", editor)).toBe("Otro Editor");
    expect(resolveByline(null, editor)).toBe("Otro Editor");
  });
});
