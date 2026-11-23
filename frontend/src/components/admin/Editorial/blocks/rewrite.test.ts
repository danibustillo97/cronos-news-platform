// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { parseHtml, serialize } from "./blockModel";
import { applyRewrites, articlePlainText, buildRewritePrompt, parseRewrites, planRewrites } from "./rewrite";

const blocks = parseHtml(`<article>
<p>Millonarios venció 2-1 a Santa Fe en El Campín. El técnico destacó el trabajo del equipo y la actitud de los jugadores.</p>
<h2>Lo que viene</h2>
<p>Con este resultado el conjunto azul quedó <strong>líder</strong> de su grupo. El próximo rival es Junior.</p>
<ul><li>El delantero marcó su gol número diez del semestre ante el rival.</li><li>Otro dato.</li></ul>
</article>`);

describe("partial rewrite", () => {
  const targets = [
    { text: "El técnico destacó el trabajo del equipo y la actitud de los jugadores.", source: "AS" },
    { text: "Con este resultado el conjunto azul quedó líder de su grupo.", source: "Olé" },
    { text: "El delantero marcó su gol número diez del semestre ante el rival.", source: "AS" },
  ];

  it("builds a numbered prompt with only the problem sentences", () => {
    const prompt = buildRewritePrompt(targets, { keyword: "Millonarios", title: "Millonarios gana" });
    expect(prompt).toContain("[1] El técnico destacó");
    expect(prompt).toContain("[3] El delantero marcó");
    expect(prompt).toContain("«Millonarios»");
    expect(prompt).not.toContain("El próximo rival es Junior"); // untouched sentences are not sent
  });

  it("parses the usual answer shapes", () => {
    const answers = parseRewrites(`[1] «El entrenador elogió la entrega colectiva y el compromiso del plantel.»\n\n2. Tras este triunfo,\nlos azules encabezan su zona.\n**3)** El atacante llegó a diez goles en el semestre.`);
    expect(answers.get(1)).toBe("El entrenador elogió la entrega colectiva y el compromiso del plantel.");
    expect(answers.get(2)).toBe("Tras este triunfo, los azules encabezan su zona.");
    expect(answers.get(3)).toBe("El atacante llegó a diez goles en el semestre.");
  });

  it("replaces each sentence in place and leaves everything else untouched", () => {
    const answers = new Map([
      [1, "El entrenador elogió la entrega colectiva del plantel."],
      [2, "Tras este triunfo, los azules encabezan su zona."],
      [3, "El atacante llegó a diez goles en el semestre."],
    ]);
    const proposals = planRewrites(blocks, targets, answers);
    expect(proposals.every((p) => p.found)).toBe(true);
    const { blocks: next, applied } = applyRewrites(blocks, proposals);
    expect(applied).toBe(3);
    const html = serialize(next);
    expect(html).toContain("Millonarios venció 2-1 a Santa Fe en El Campín. El entrenador elogió la entrega colectiva del plantel.");
    expect(html).toContain("Tras este triunfo, los azules encabezan su zona. El próximo rival es Junior.");
    expect(html).toContain("<li>El atacante llegó a diez goles en el semestre.</li><li>Otro dato.</li>");
    expect(next[1]).toBe(blocks[1]); // the heading object is literally the same: not rebuilt
  });

  it("skips unchanged or missing answers and reports sentences it cannot find", () => {
    const proposals = planRewrites(blocks, [...targets, { text: "Una frase que ya no existe en la nota." }], new Map([[1, targets[0].text]]));
    expect(proposals[3].found).toBe(false);
    expect(applyRewrites(blocks, proposals).applied).toBe(0);
  });

  it("plain text matches what the plagiarism check reads", () => {
    const text = articlePlainText("Título", "Entradilla", blocks);
    for (const t of targets) expect(text).toContain(t.text);
  });
});
