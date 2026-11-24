import { describe, expect, it } from "vitest";
import { buildCapsulePrompt, humanDay, parseCapsuleAnswer, tiktokCaption } from "./capsulePrompt";

describe("capsule prompt", () => {
  it("efemérides ask for the exact date and copy-paste delivery", () => {
    const p = buildCapsulePrompt({ kind: "efemeride", count: 3, focus: "09-05", today: "viernes, 5 de septiembre de 2026" });
    expect(p).toContain("un 5 de septiembre");
    expect(p).toContain("FECHA: MM-DD");
    expect(p).toContain("NO incluyas esa cápsula");
    expect(p).toContain("```text");
  });
  it("legend with a name focuses on that legend", () => {
    expect(buildCapsulePrompt({ kind: "leyenda", count: 1, focus: "Carlos Valderrama", today: "hoy" })).toContain("CONMEMORAR a la leyenda Carlos Valderrama");
  });
  it("grounds the prompt on research material", () => {
    const p = buildCapsulePrompt({ kind: "efemeride", count: 2, focus: "09-05", today: "hoy", research: {
      facts: [{ year: 1993, text: "Colombia golea 5-0 a Argentina.", section: "Acontecimientos", url: "https://es.wikipedia.org/wiki/5_de_septiembre" }],
      sources: [] } });
    expect(p).toContain("Usa ÚNICAMENTE el MATERIAL DE INVESTIGACIÓN");
    expect(p).toContain("- 1993: Colombia golea 5-0 a Argentina. [https://es.wikipedia.org/wiki/5_de_septiembre]");
  });
  it("humanDay", () => { expect(humanDay("11-24")).toBe("24 de noviembre"); });
});

describe("parseCapsuleAnswer", () => {
  it("reads several capsules from a code block", () => {
    const answer = `\`\`\`text
TIPO: efemeride
TÍTULO: Colombia golea 5-0 a Argentina en Buenos Aires
PROTAGONISTA: Selección Colombia
FECHA: 09-05
AÑO: 1993
DIAPOSITIVA: Un día como hoy, Colombia silenció el Monumental.
DIAPOSITIVA: Rincón, Asprilla y Valencia firmaron el 5-0.
TEXTO TIKTOK: La noche que el Monumental aplaudió a Colombia.
ETIQUETAS: #seleccioncolombia, historia, eliminatorias
FUENTES: FIFA; archivo El Tiempo
===
TIPO: efemeride
TÍTULO: Otro hito
FECHA: 5 de septiembre
AÑO: 2001
DIAPOSITIVA: Texto
\`\`\``;
    const out = parseCapsuleAnswer(answer, "efemeride", "11-24");
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ kind: "efemeride", day: "09-05", year: 1993, subject: "Selección Colombia", tags: ["seleccioncolombia", "historia", "eliminatorias"], sources: "FIFA; archivo El Tiempo" });
    expect(out[0].slides).toHaveLength(2);
    expect(out[1].day).toBe("09-05");
  });

  it("uses fallbacks and drops capsules without slides", () => {
    const out = parseCapsuleAnswer("**TÍTULO:** El gol más rápido\n- DIAPOSITIVA: 2,4 segundos.\nTÍTULO: Sin diapositivas", "sabias_que");
    expect(out).toEqual([expect.objectContaining({ kind: "sabias_que", title: "El gol más rápido", day: "", slides: [{ text: "2,4 segundos.", image: null }] })]);
  });

  it("builds a TikTok caption with unique hashtags", () => {
    expect(tiktokCaption("La noche histórica.", ["Futbol", "#historia"])).toBe("La noche histórica.\n\n#futbol #historia #nexusfutbol");
  });
});
