import { describe, expect, it } from "vitest";
import { draftFromPoll, draftProblem, draftToPayload, emptyDraft, percent, type AdminPoll } from "./pollDraft";

const poll: AdminPoll = {
  id: "p1", kind: "poll", question: "¿Quién gana?", context: null, status: "open", closesAt: null, newsId: null,
  featured: false, placement: ["home"], createdAt: "2026-11-24T10:00:00Z", totalVotes: 3,
  options: [{ id: "o1", label: "Estudiantes", argument: null, votes: 2 }, { id: "o2", label: "Palmeiras", argument: null, votes: 1 }],
};

describe("pollDraft", () => {
  it("flags incomplete drafts in Spanish", () => {
    const d = emptyDraft("poll");
    expect(draftProblem(d)).toBe("Escribe la pregunta.");
    d.question = "¿Quién gana?";
    expect(draftProblem(d)).toBe("Completa todas las opciones.");
    d.options[0].label = "Sí"; d.options[1].label = "sí";
    expect(draftProblem(d)).toBe("Hay opciones repetidas.");
    d.options[1].label = "No";
    expect(draftProblem(d)).toBeNull();
    d.placement = ["article"];
    expect(draftProblem(d)).toMatch(/Vincula una noticia/);
  });

  it("requires arguments on both debate sides", () => {
    const d = { ...emptyDraft("debate"), question: "¿James titular?" };
    expect(draftProblem(d)).toBe("Escribe el argumento de cada postura.");
    d.options = d.options.map((o) => ({ ...o, argument: "porque sí" }));
    expect(draftProblem(d)).toBeNull();
  });

  it("keeps option ids when editing so votes survive", () => {
    const d = draftFromPoll(poll);
    d.options[0].label = "Estudiantes LP";
    const payload = draftToPayload(d, true) as { options: { id?: string; label: string }[]; clearClosesAt?: boolean };
    expect(payload.options[0]).toEqual({ id: "o1", label: "Estudiantes LP", argument: null });
    expect(payload.clearClosesAt).toBe(true);
  });

  it("new polls send kind and no option ids", () => {
    const d = { ...emptyDraft("poll"), question: "¿Quién gana?" };
    d.options[0].label = "A"; d.options[1].label = "B";
    const payload = draftToPayload(d, false) as { kind: string; options: Record<string, unknown>[]; newsId: unknown };
    expect(payload.kind).toBe("poll");
    expect(payload.options.every((o) => !("id" in o))).toBe(true);
    expect(payload.newsId).toBeNull();
  });

  it("percent never divides by zero", () => {
    expect(percent(0, 0)).toBe(0);
    expect(percent(2, 3)).toBe(67);
  });
});
