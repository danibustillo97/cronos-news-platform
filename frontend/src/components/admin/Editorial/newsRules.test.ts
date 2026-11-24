import { describe, expect, it } from "vitest";
import { EditConflictError, isPublic, nextFreeSlug, saveErrorMessage, toSlug } from "./newsRules";

describe("news rules", () => {
  it("treats only published rows as public", () => {
    expect(isPublic("published")).toBe(true);
    expect(isPublic("enhanced")).toBe(false);
    expect(isPublic("draft")).toBe(false);
  });

  it("builds URL slugs without accents or symbols", () => {
    expect(toSlug("¡Gol de Último Minuto! Colombia 2–1")).toBe("gol-de-ultimo-minuto-colombia-2-1");
  });

  it("suggests the first free slug", () => {
    expect(nextFreeSlug("final", [])).toBe("final");
    expect(nextFreeSlug("final", ["final", "final-2"])).toBe("final-3");
  });

  it("explains save failures in editorial terms", () => {
    expect(saveErrorMessage({ code: "23505", message: 'duplicate key value violates unique constraint "news_slug_key"' }))
      .toBe("Ese enlace permanente ya lo usa otra noticia; elige otro");
    expect(saveErrorMessage(new Error("network down"))).toBe("network down");
    expect(saveErrorMessage(new EditConflictError())).toMatch(/Otra persona/);
  });
});
