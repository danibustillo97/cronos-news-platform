// One prompt + one parser for capsules (efemérides, ¿sabías que?, leyendas),
// shared by "IA automática" (POST /api/admin/capsules/ai) and "ChatGPT"
// (copy prompt, paste the code block back).

import { unwrapAnswer, withCopyPaste } from "@/lib/chatgpt";

export type CapsuleKind = "efemeride" | "sabias_que" | "leyenda" | "momento";

export interface CapsuleSlide { text: string; image: string | null }

export interface CapsuleProposal {
  kind: CapsuleKind;
  title: string;
  subject: string;
  day: string;      // "MM-DD" or ""
  year: number | null;
  slides: CapsuleSlide[];
  caption: string;
  tags: string[];
  sources: string;
}

export interface CapsulePromptInput {
  kind: CapsuleKind;
  count: number;
  /** efeméride: the date (MM-DD); leyenda: the legend's name or ""; sabías que: the topic or "" */
  focus: string;
  today: string; // human date, e.g. "martes, 24 de noviembre de 2026"
  /** Material found by "Buscar en internet": the ONLY facts the model may use when present. */
  research?: ResearchMaterial;
}

export interface ResearchMaterial {
  facts: { year: number; text: string; section?: string; url: string }[];
  sources: { title: string; url: string; excerpt: string }[];
}

export function researchBlock(material?: ResearchMaterial): string {
  if (!material || (!material.facts.length && !material.sources.length)) return "";
  const NL = "\n";
  const facts = material.facts
    .map((f) => `- ${f.year}${f.section && f.section !== "Acontecimientos" ? ` (${f.section.toLowerCase()})` : ""}: ${f.text} [${f.url}]`)
    .join(NL);
  const sources = material.sources.map((s) => `### ${s.title} [${s.url}]${NL}${s.excerpt.slice(0, 1500)}`).join(NL + NL);
  const body = [facts, sources].filter(Boolean).join(NL + NL);
  return `${NL}${NL}MATERIAL DE INVESTIGACIÓN (verificado; usa SOLO estos hechos y pon sus URL en FUENTES)${NL}${body}`;
}

export const KIND_LABEL: Record<CapsuleKind, string> = { efemeride: "Efeméride", sabias_que: "¿Sabías que?", leyenda: "Leyenda", momento: "Momento histórico" };

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

export function humanDay(day: string): string {
  const m = day.match(/^(\d{2})-(\d{2})$/);
  if (!m) return day;
  return `${Number(m[2])} de ${MONTHS[Number(m[1]) - 1] ?? ""}`;
}

function task(input: CapsulePromptInput, count: number): string {
  if (input.kind === "efemeride") {
    return `Propón ${count} EFEMÉRIDES de fútbol ocurridas un ${humanDay(input.focus)} (cualquier año). Prioriza Colombia y Sudamérica (Selección, Liga colombiana, Libertadores, futbolistas colombianos) y luego hitos mundiales (Mundiales, Champions, récords). Cada una es "Un día como hoy…".`;
  }
  if (input.kind === "leyenda") {
    return input.focus.trim()
      ? `Crea ${count} cápsula(s) para CONMEMORAR a la leyenda ${input.focus.trim()}: si es más de una, cada una con un ángulo distinto (su mejor momento, sus títulos y cifras, su legado, una anécdota documentada).`
      : `Propón ${count} LEYENDAS del fútbol para conmemorar (al menos la mitad colombianas o sudamericanas), una cápsula por leyenda.`;
  }
  if (input.kind === "momento") {
    return input.focus.trim()
      ? `Crea ${count} cápsula(s) sobre el MOMENTO HISTÓRICO: ${input.focus.trim()}. Cuenta qué pasó, por qué fue histórico y qué cambió después.`
      : `Propón ${count} MOMENTOS HISTÓRICOS del fútbol (finales, goles, hazañas, récords), al menos la mitad de Colombia o Sudamérica.`;
  }
  return input.focus.trim()
    ? `Crea ${count} cápsulas "¿SABÍAS QUE?" sobre: ${input.focus.trim()}.`
    : `Crea ${count} cápsulas "¿SABÍAS QUE?" con datos curiosos y sorprendentes del fútbol (récords, reglas, historia, Colombia y Sudamérica).`;
}

export function buildCapsulePrompt(input: CapsulePromptInput): string {
  const count = Math.min(Math.max(input.count, 1), 6);
  const efe = input.kind === "efemeride";
  return withCopyPaste(`Actúa como historiador del fútbol y guionista de contenido vertical (TikTok, Reels) para un medio deportivo de Colombia y Latinoamérica. Hoy es ${input.today}.

TAREA
${task(input, count)}

PRECISIÓN (lo más importante)
1. ${input.research && (input.research.facts.length || input.research.sources.length) ? "Usa ÚNICAMENTE el MATERIAL DE INVESTIGACIÓN de abajo; no agregues fechas, cifras ni nombres que no estén ahí." : "Solo hechos ampliamente documentados que puedas confirmar con certeza."} Si dudas de una fecha, un resultado o una cifra, NO incluyas esa cápsula: propón otra.
2. Nada de citas textuales salvo que sean célebres y verificables.
3. En FUENTES indica dónde se puede verificar (FIFA, CONMEBOL, archivo de prensa, club oficial).${efe ? `\n4. La fecha debe ser exactamente ${humanDay(input.focus)}; el año, el real del hecho.` : ""}

GUION (formato vertical)
- 3 a 5 DIAPOSITIVAS. La 1ª es el gancho (máximo 90 caracteres) que obliga a seguir viendo; las siguientes, máximo 180 caracteres cada una; la última cierra con el dato más fuerte o el legado.
- Frases cortas, español neutro, tono emocionante pero periodístico. Sin emojis dentro de las diapositivas.
- TÍTULO: máximo 70 caracteres.
- TEXTO TIKTOK: 1-2 frases con gancho (máximo 220 caracteres), sin hashtags (van en ETIQUETAS).
- ETIQUETAS: 3 a 6 hashtags relevantes sin #, separados por comas (ej.: futbol, seleccioncolombia, historia).

FORMATO (exacto; repite el bloque por cada cápsula, separadas por una línea con ===)
TIPO: ${input.kind}
TÍTULO: …
PROTAGONISTA: … (jugador, equipo o torneo)
${efe ? "FECHA: MM-DD\nAÑO: AAAA\n" : "AÑO: AAAA (si aplica; si no, déjalo vacío)\n"}DIAPOSITIVA: …
DIAPOSITIVA: …
DIAPOSITIVA: …
TEXTO TIKTOK: …
ETIQUETAS: …
FUENTES: …${researchBlock(input.research)}`);
}

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const KIND_ALIASES: Record<string, CapsuleKind> = {
  efemeride: "efemeride", efemerides: "efemeride", sabias_que: "sabias_que", "sabias que": "sabias_que",
  "¿sabias que?": "sabias_que", dato: "sabias_que", leyenda: "leyenda", leyendas: "leyenda",
  momento: "momento", "momento historico": "momento", "momentos historicos": "momento",
};

function normalizeDay(value: string): string {
  const v = value.trim();
  let m = v.match(/^(\d{1,2})[-/](\d{1,2})$/);
  if (m) return `${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  m = fold(v).match(/^(\d{1,2})\s+de\s+([a-z]+)/);
  if (m) {
    const month = MONTHS.indexOf(m[2]);
    if (month >= 0) return `${String(month + 1).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  return "";
}

/** Reads capsules from an AI / ChatGPT answer; falls back to `fallbackKind` when TIPO is missing. */
export function parseCapsuleAnswer(answer: string, fallbackKind: CapsuleKind, fallbackDay = ""): CapsuleProposal[] {
  const out: CapsuleProposal[] = [];
  let cur: CapsuleProposal | null = null;
  const blank = (): CapsuleProposal => ({ kind: fallbackKind, title: "", subject: "", day: fallbackKind === "efemeride" ? fallbackDay : "", year: null, slides: [], caption: "", tags: [], sources: "" });
  const flush = () => {
    const c = cur;
    cur = null;
    if (!c || !c.title || c.slides.length === 0) return;
    if (c.kind !== "efemeride") c.day = "";
    out.push({ ...c, slides: c.slides.slice(0, 8) });
  };

  for (const raw of unwrapAnswer(answer).split("\n")) {
    const line = raw.replace(/\*\*/g, "").replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "").trim();
    if (!line) continue;
    if (/^(={3,}|-{3,})$/.test(line)) { flush(); continue; }
    const m = line.match(/^([A-Za-zÁÉÍÓÚáéíóúÑñ ]{3,22}):\s*(.*)$/);
    if (!m) continue;
    const label = fold(m[1]);
    const value = m[2].trim();
    if (label === "tipo") {
      if (cur && (cur as CapsuleProposal).title) flush();
      cur = cur ?? blank();
      (cur as CapsuleProposal).kind = KIND_ALIASES[fold(value)] ?? fallbackKind;
      continue;
    }
    if (label === "titulo") {
      if (cur && (cur as CapsuleProposal).title) flush();
      cur = cur ?? blank();
      (cur as CapsuleProposal).title = value;
      continue;
    }
    if (!cur) continue;
    const c = cur as CapsuleProposal;
    if (label === "protagonista") c.subject = value;
    else if (label === "fecha") c.day = normalizeDay(value) || c.day;
    else if (label === "ano" || label === "anio") { const y = Number(value.match(/\d{4}/)?.[0]); c.year = Number.isFinite(y) && y > 1850 ? y : null; }
    else if (label === "diapositiva" && value) c.slides.push({ text: value, image: null });
    else if (label === "texto tiktok") c.caption = value;
    else if (label === "etiquetas") c.tags = value.split(/[,\s]+/).map((t) => t.replace(/^#/, "").trim()).filter(Boolean).slice(0, 6);
    else if (label === "fuentes") c.sources = value;
  }
  flush();
  return out;
}

/** Caption ready to paste on TikTok: hook + hashtags. */
export function tiktokCaption(caption: string, tags: string[]): string {
  const hashtags = [...new Set([...tags, "futbol", "nexusfutbol"].map((t) => t.replace(/^#/, "").replace(/\s+/g, "").toLowerCase()).filter(Boolean))].slice(0, 7);
  return `${caption.trim()}\n\n${hashtags.map((t) => `#${t}`).join(" ")}`.trim();
}
