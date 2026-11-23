// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { parseHtml } from "./blockModel";
import { buildImagePrompt, detectColors, detectScene } from "./imagePrompt";

const base = { excerpt: "", blocks: parseHtml("<p>Texto.</p>"), tags: [], category: "Fútbol" };

describe("image prompt", () => {
  it("picks the scene from the headline", () => {
    expect(detectScene("Junior confirma su primer fichaje para 2027")).toBe("transfer");
    expect(detectScene("Luis Díaz, baja por lesión en el ligamento")).toBe("injury");
    expect(detectScene("FCF publica audios del VAR del Once Caldas - Nacional")).toBe("referee");
    expect(detectScene("Paisas es tricampeón y levanta la copa")).toBe("trophy");
    expect(detectScene("Millonarios vence 2-1 a Santa Fe en el clásico")).toBe("match");
    expect(detectScene("América vs. Cali: hora y dónde ver el partido")).toBe("preview");
    expect(detectScene("Una noticia sin pistas")).toBe("generic");
  });

  it("uses kit colours in order of appearance, never crests", () => {
    expect(detectColors("Millonarios vence a Santa Fe").es).toEqual(["azul y blanco", "rojo y blanco"]);
    expect(detectColors("Independiente Medellín recibe al DIM").es).toEqual(["rojo y azul"]);
    expect(detectColors("El Inter de Milán y la Juventus").en).toEqual(["black and blue stripes", "black and white stripes"]);
  });

  it("ChatGPT prompt: Spanish, 3:2, editorial safety rules, disclosed caption", () => {
    const p = buildImagePrompt({ ...base, title: "Millonarios vence 2-1 a Santa Fe en el clásico" }, "chatgpt");
    expect(p.scene).toBe("match");
    for (const piece of ["3:2, 1536×1024", "azul y blanco contra rojo y blanco", "Rostros reconocibles", "Escudos, logos", "texto, letra"]) {
      expect(p.prompt).toContain(piece);
    }
    expect(p.caption).toBe("Imagen ilustrativa generada con IA");
    expect(p.alt).toBeTruthy();
  });

  it("Midjourney prompt: English with aspect ratio and negatives", () => {
    const p = buildImagePrompt({ ...base, title: "Junior confirma su primer fichaje" }, "midjourney");
    expect(p.prompt).toMatch(/^editorial sports photojournalism, a brand-new football jersey/);
    expect(p.prompt).toContain("--ar 3:2");
    expect(p.prompt).toContain("--no text, letters, logos");
  });

  it("body images follow the draft's own suggestion", () => {
    const p = buildImagePrompt({ ...base, title: "Millonarios gana", suggestion: "hinchas celebrando en la tribuna", purpose: "body" }, "chatgpt");
    expect(p.scene).toBe("fans");
    expect(p.prompt).toContain("para el cuerpo");
    expect(p.prompt).toContain("hinchas celebrando en la tribuna");
  });
});
