// One prompt + one parser for polls and debates, used by both modes:
//  - "IA automática": POST /api/admin/polls/ai runs this prompt server-side.
//  - "ChatGPT": the editor copies this prompt and pastes the answer back.
// Either way the answer is parsed here into proposals the editor picks from.

import { unwrapAnswer, withCopyPaste } from "@/lib/chatgpt";
import type { PollKind } from "./pollDraft";

export type PollSource =
  | { type: "news"; title: string; excerpt?: string; body?: string }
  | { type: "topic"; text: string }
  | { type: "matches"; matches: string[] };

export interface PollPromptInput {
  kind: PollKind | "mix";
  count: number;
  source: PollSource;
  today: string;
}

export interface PollProposal {
  kind: PollKind;
  question: string;
  context: string;
  options: { label: string; argument: string }[];
}

const MAX_BODY = 3500;

function sourceBlock(source: PollSource): string {
  if (source.type === "news") {
    const body = (source.body ?? "").replace(/\s+\n/g, "\n").trim().slice(0, MAX_BODY);
    return `NOTICIA DE BASE\nTitular: ${source.title}${source.excerpt ? `\nEntradilla: ${source.excerpt}` : ""}${body ? `\n---\n${body}\n---` : ""}`;
  }
  if (source.type === "matches") {
    return `PARTIDOS DE HOY / PRÓXIMOS\n${source.matches.map((m) => `- ${m}`).join("\n")}`;
  }
  return `TEMA\n${source.text.trim()}`;
}

function kindRule(kind: PollPromptInput["kind"], count: number): string {
  if (kind === "poll") return `Propón ${count} ENCUESTAS (TIPO: encuesta).`;
  if (kind === "debate") return `Propón ${count} DEBATES (TIPO: debate).`;
  return `Propón ${count} piezas mezclando encuestas y debates (al menos un debate).`;
}

export function buildPollPrompt(input: PollPromptInput): string {
  const count = Math.min(Math.max(input.count, 1), 6);
  return withCopyPaste(`Actúa como editor de participación de un medio deportivo digital para lectores de Colombia y Latinoamérica. Hoy es ${input.today}. Tu trabajo: preguntas que la gente quiere votar y compartir, sin perder rigor.

TAREA
${kindRule(input.kind, count)} Cada una con un ángulo distinto (pronóstico, opinión, mejor jugador, decisión del técnico, comparación, polémica).

REGLAS
1. Cero invención: usa solo hechos del material. Si no hay un dato, no lo afirmes.
2. Pregunta clara y corta (máximo 110 caracteres), que se entienda sin leer la noticia, con nombres propios (equipo, jugador, competición).
3. Neutral: no insinúes la respuesta "correcta".
4. Encuesta: 2 a 4 opciones cortas (máximo 40 caracteres), que no se solapen y cubran las respuestas razonables. Incluye empate cuando aplique.
5. Debate: exactamente 2 posturas defendibles, cada una con un argumento de 1–2 frases (máximo 200 caracteres) basado en el material.
6. Contexto: una frase (máximo 160 caracteres) que sitúe al lector.
7. Nada de apuestas, política, religión ni ataques personales. Español neutro.

FORMATO (exacto; repite el bloque por cada propuesta, separadas por una línea con ===)
TIPO: encuesta
PREGUNTA: ¿…?
CONTEXTO: …
OPCIÓN: …
OPCIÓN: …
===
TIPO: debate
PREGUNTA: ¿…?
CONTEXTO: …
POSTURA: etiqueta corta | argumento
POSTURA: etiqueta corta | argumento

${sourceBlock(input.source)}`);
}

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Parses one or more proposals from an AI / ChatGPT answer. Tolerant to bold, bullets and numbering. */
export function parsePollAnswer(answer: string): PollProposal[] {
  const out: PollProposal[] = [];
  let cur: PollProposal | null = null;
  let explicitKind = false;
  const flush = () => {
    if (cur && cur.question && cur.options.length >= 2) {
      if (!explicitKind) cur.kind = cur.options.every((o) => o.argument) && cur.options.length === 2 ? "debate" : "poll";
      if (cur.kind === "debate") cur.options = cur.options.slice(0, 2);
      else cur.options = cur.options.slice(0, 6).map((o) => ({ ...o, argument: "" }));
      out.push(cur);
    }
    cur = null;
    explicitKind = false;
  };
  const start = () => { cur = { kind: "poll", question: "", context: "", options: [] }; };

  for (const raw of unwrapAnswer(answer).split("\n")) {
    const line = raw.replace(/\*\*/g, "").replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "").trim();
    if (!line) continue;
    if (/^(={3,}|-{3,})$/.test(line)) { flush(); continue; }
    const m = line.match(/^([A-Za-zÁÉÍÓÚáéíóúÑñ ]{3,20}):\s*(.*)$/);
    if (!m) continue;
    const label = fold(m[1].trim());
    const value = m[2].trim();
    if (label === "tipo") {
      if (cur && (cur as PollProposal).question) flush();
      if (!cur) start();
      (cur as unknown as PollProposal).kind = fold(value).startsWith("deb") ? "debate" : "poll";
      explicitKind = true;
    } else if (label === "pregunta") {
      if (cur && (cur as PollProposal).question) flush();
      if (!cur) start();
      (cur as unknown as PollProposal).question = value;
    } else if (label === "contexto" && cur) {
      (cur as PollProposal).context = value;
    } else if ((label === "opcion" || label === "postura" || label === "a favor" || label === "en contra") && cur && value) {
      const [optLabel, ...rest] = value.split("|");
      const isSide = label !== "opcion";
      (cur as PollProposal).options.push({
        label: (label === "a favor" || label === "en contra") && !rest.length ? m[1].trim() : optLabel.trim(),
        argument: isSide ? (rest.length ? rest.join("|").trim() : (label === "postura" ? "" : value)) : "",
      });
    }
  }
  flush();
  return out;
}
