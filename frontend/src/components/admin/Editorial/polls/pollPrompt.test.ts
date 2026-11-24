import { describe, expect, it } from "vitest";
import { unwrapAnswer, withCopyPaste } from "@/lib/chatgpt";
import { buildPollPrompt, parsePollAnswer } from "./pollPrompt";

describe("chatgpt delivery", () => {
  it("asks for a single code block, once", () => {
    const p = withCopyPaste(withCopyPaste("Hola"));
    expect(p.match(/ENTREGA \(obligatorio\)/g)).toHaveLength(1);
    expect(p).toContain("```text");
  });
  it("unwraps the block from a full message or a bare copy", () => {
    expect(unwrapAnswer("Claro, aquí está:\n```text\nPREGUNTA: x\n```\n¿Algo más?")).toBe("PREGUNTA: x");
    expect(unwrapAnswer("PREGUNTA: x")).toBe("PREGUNTA: x");
    expect(unwrapAnswer("```\r\nPREGUNTA: x\r\n```")).toBe("PREGUNTA: x");
  });
});

describe("poll prompt", () => {
  it("includes the source and the format", () => {
    const p = buildPollPrompt({ kind: "debate", count: 2, today: "24 de noviembre de 2026", source: { type: "news", title: "Final de la Libertadores", body: "Estudiantes y Palmeiras…" } });
    expect(p).toContain("Propón 2 DEBATES");
    expect(p).toContain("Titular: Final de la Libertadores");
    expect(p).toContain("POSTURA: etiqueta corta | argumento");
    expect(p.trimEnd().endsWith("ni preguntas.\n- No uses negritas ni viñetas que no estén en el formato.")).toBe(true);
  });
});

describe("parsePollAnswer", () => {
  it("reads several proposals inside a code block", () => {
    const answer = `Aquí tienes:
\`\`\`text
TIPO: encuesta
PREGUNTA: ¿Quién gana la final de la Libertadores?
CONTEXTO: Se juega el sábado en Montevideo.
OPCIÓN: Estudiantes
OPCIÓN: Palmeiras
===
TIPO: debate
PREGUNTA: ¿James debe ser titular?
CONTEXTO: Vuelve tras lesión.
POSTURA: Sí | Es el cerebro del equipo.
POSTURA: No | Le falta ritmo de competencia.
\`\`\``;
    const out = parsePollAnswer(answer);
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({ kind: "poll", question: "¿Quién gana la final de la Libertadores?", context: "Se juega el sábado en Montevideo.",
      options: [{ label: "Estudiantes", argument: "" }, { label: "Palmeiras", argument: "" }] });
    expect(out[1].kind).toBe("debate");
    expect(out[1].options[1]).toEqual({ label: "No", argument: "Le falta ritmo de competencia." });
  });

  it("tolerates bold labels, bullets, missing separators and accents", () => {
    const out = parsePollAnswer(`**PREGUNTA:** ¿Mejor jugador del clásico?
- **OPCION:** Falcao
- **OPCION:** Quintero
**PREGUNTA:** ¿Empate justo?
1. OPCIÓN: Sí
2. OPCIÓN: No`);
    expect(out.map((p) => p.question)).toEqual(["¿Mejor jugador del clásico?", "¿Empate justo?"]);
    expect(out[0].options.map((o) => o.label)).toEqual(["Falcao", "Quintero"]);
  });

  it("drops incomplete proposals", () => {
    expect(parsePollAnswer("PREGUNTA: ¿Sola?\nOPCIÓN: A")).toEqual([]);
  });
});
