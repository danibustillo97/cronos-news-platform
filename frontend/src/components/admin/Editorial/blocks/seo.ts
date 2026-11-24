// Real, explainable on-page SEO for a news article -- computed live from the
// exact content that will be published. Every check is a measurable rule with
// a concrete fix; no black-box score. Weights favour what moves the needle for
// news: Google News/Discover eligibility, title/lead keyword placement,
// structure and readability (Spanish), and AdSense-safe value (length,
// originality, attribution).

import { isTextBlock, plainText, type Block } from "./blockModel";

export type CheckStatus = "pass" | "warn" | "fail";
export type CheckGroup = "Titular" | "Google" | "Contenido" | "Legibilidad" | "Medios" | "Fuentes" | "Monetización";

export interface SeoCheck {
  id: string;
  group: CheckGroup;
  label: string;
  status: CheckStatus;
  detail: string;
  fix?: string;
  weight: number;
}

export interface SeoInput {
  title: string;
  excerpt: string;
  blocks: Block[];
  seoTitle: string;
  seoDescription: string;
  slug: string;
  tags: string[];
  categoryId: string | null;
  coverUrl: string | null;
  keyword?: string;
  originality?: number | null; // 0..100 from the plagiarism check, when run
}

export interface SeoReport {
  score: number;
  keyword: string;
  keywordSource: "manual" | "auto";
  words: number;
  readability: number | null;
  readabilityLabel: string;
  checks: SeoCheck[];
  verifyMarks: number;
  /** Sentence around each [VERIFICAR] mark, so the editor can find it. */
  verifySnippets: string[];
}

const STOP = new Set(`a al ante bajo con contra de del desde durante e el en entre es esa ese eso esta este esto ha hasta
la las le les lo los mas más me mi muy no nos o para pero por que qué se sin sobre su sus te tras tu un una uno unos unas
y ya como cómo cuando donde dónde fue ser son será tiene tienen hace así otro otra hoy ayer vs tras ante sus porque cual
cuál quien quién este estos estas aquí ahora tras entre todo toda todos todas nuevo nueva gran tras luego dice dijo`.split(/\s+/));

export function fold(text: string): string {
  return text.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function words(text: string): string[] {
  return (text.match(/[\p{L}\p{N}]+/gu) ?? []);
}

export function sentences(text: string): string[] {
  return text.split(/(?<=[.!?¿¡…])\s+(?=[A-ZÁÉÍÓÚÑ¿¡"«“0-9])/u).map((s) => s.trim()).filter((s) => words(s).length > 0);
}

/** Spanish syllable estimate: vowel groups, with hiatus on stressed i/u. */
export function syllables(word: string): number {
  const w = word.toLowerCase();
  const groups = w.match(/[aeiouáéíóúü]+/g) ?? [];
  let count = 0;
  for (const g of groups) {
    // strong vowels (a,e,o + accented) split into separate syllables; í/ú break diphthongs
    const strong = (g.match(/[aeoáéóíú]/g) ?? []).length;
    count += Math.max(1, strong);
  }
  return Math.max(1, count);
}

/** Fernández-Huerta (Spanish Flesch): 206.84 − 0.60·P − 1.02·F. */
export function fernandezHuerta(text: string): number | null {
  const ws = words(text);
  const ss = sentences(text);
  if (ws.length < 30 || !ss.length) return null;
  const p = (ws.reduce((sum, w) => sum + syllables(w), 0) / ws.length) * 100;
  const f = (ss.length / ws.length) * 100;
  return Math.round(Math.max(0, Math.min(100, 206.84 - 0.6 * p - 1.02 * f)));
}

function readabilityLabel(score: number | null): string {
  if (score === null) return "Texto muy corto para medir";
  if (score >= 80) return "Muy fácil";
  if (score >= 65) return "Fácil (ideal para noticias)";
  if (score >= 55) return "Normal";
  if (score >= 40) return "Algo difícil";
  return "Difícil";
}

function contains(haystack: string, needle: string): boolean {
  const n = fold(needle).trim();
  if (!n) return false;
  return new RegExp(`(^|[^\\p{L}\\p{N}])${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^\\p{L}\\p{N}])`, "u").test(fold(haystack));
}

function countOccurrences(haystack: string, needle: string): number {
  const n = fold(needle).trim();
  if (!n) return 0;
  const re = new RegExp(`(^|[^\\p{L}\\p{N}])${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=$|[^\\p{L}\\p{N}])`, "gu");
  return (fold(haystack).match(re) ?? []).length;
}

/**
 * Focus keyword guess: the 1–3 word phrase from the title that the body
 * repeats most (proper names weigh more). Editors can override it.
 */
export function suggestKeyword(title: string, body: string): string {
  const titleWords = words(title);
  const candidates = new Map<string, number>();
  for (let size = 3; size >= 1; size -= 1) {
    for (let i = 0; i + size <= titleWords.length; i += 1) {
      const gram = titleWords.slice(i, i + size);
      if (STOP.has(fold(gram[0])) || STOP.has(fold(gram[gram.length - 1]))) continue;
      if (gram.every((w) => w.length < 4 && !/\d/.test(w))) continue;
      const phrase = gram.join(" ");
      const hits = countOccurrences(body, phrase);
      if (!hits && size > 1) continue;
      const proper = gram.filter((w) => /^\p{Lu}/u.test(w)).length;
      candidates.set(phrase, hits * (1 + size * 0.6) + proper * 1.5 + (i === 0 ? 0.5 : 0));
    }
  }
  const best = [...candidates.entries()].sort((a, b) => b[1] - a[1])[0];
  return best ? best[0] : titleWords.filter((w) => !STOP.has(fold(w))).slice(0, 2).join(" ");
}

function findVerifySnippets(title: string, body: string): string[] {
  const out: string[] = [];
  if (/\[VERIFICAR/i.test(title)) out.push(`Titular: ${title.trim()}`);
  for (const sentence of body.split(/(?<=[.!?])\s+|\n+/)) {
    const marks = sentence.match(/\[VERIFICAR[^\]]*\]/gi)?.length ?? 0;
    const s = sentence.trim();
    for (let i = 0; i < marks; i++) out.push(s.length > 160 ? `${s.slice(0, 157)}…` : s);
  }
  return out;
}

function check(id: string, group: CheckGroup, label: string, weight: number, status: CheckStatus, detail: string, fix?: string): SeoCheck {
  return { id, group, label, weight, status, detail, fix: status === "pass" ? undefined : fix };
}

export function analyzeSeo(input: SeoInput): SeoReport {
  const textBlocks = input.blocks.filter(isTextBlock);
  const paragraphs = input.blocks.filter((b) => b.type === "paragraph").map((b) => plainText(b.type === "paragraph" ? b.html : ""));
  const headings = input.blocks.filter((b) => b.type === "heading").map((b) => plainText(b.type === "heading" ? b.html : ""));
  const body = textBlocks.map((b) => plainText(b.html)).join("\n");
  const wordCount = words(body).length;
  const keyword = (input.keyword?.trim() || suggestKeyword(input.title, `${input.excerpt}\n${body}`)).trim();
  const keywordSource = input.keyword?.trim() ? "manual" : "auto";
  const checks: SeoCheck[] = [];
  const verifyMarks = (body.match(/\[VERIFICAR[^\]]*\]/gi) ?? []).length + (input.title.match(/\[VERIFICAR/gi) ?? []).length;
  const verifySnippets = verifyMarks ? findVerifySnippets(input.title, body) : [];

  // ── Titular ───────────────────────────────────────────────────────────────
  const tLen = input.title.trim().length;
  checks.push(check("title-length", "Titular", "Largo del titular", 8,
    tLen >= 45 && tLen <= 70 ? "pass" : tLen >= 30 && tLen <= 85 ? "warn" : "fail",
    `${tLen} caracteres (ideal 45–70)`, tLen < 45 ? "Agrega el dato clave: quién, qué y el contexto." : "Recórtalo: Google y el portal lo cortan después de 70."));
  const kwInTitle = contains(input.title, keyword);
  const kwEarly = kwInTitle && fold(input.title).indexOf(fold(keyword)) <= Math.max(25, input.title.length / 2);
  checks.push(check("title-keyword", "Titular", "Palabra clave en el titular", 8,
    kwEarly ? "pass" : kwInTitle ? "warn" : "fail",
    kwEarly ? `«${keyword}» aparece al inicio` : kwInTitle ? `«${keyword}» aparece, pero tarde` : `No incluye «${keyword}»`,
    "Pon la palabra clave en la primera mitad del titular."));
  const caps = (input.title.match(/\b[A-ZÁÉÍÓÚÑ]{4,}\b/g) ?? []).filter((w) => !/^(FIFA|UEFA|VAR|CONMEBOL|DIMAYOR|NBA|MLS|ESPN|AFA|FCF|PSG)$/.test(w));
  const clickbait = caps.length > 0 || /[!?]{2,}/.test(input.title) || /\b(no creer[áa]s|incre[ií]ble|impactante|lo que pas[oó] despu[eé]s)\b/i.test(input.title);
  checks.push(check("title-clickbait", "Titular", "Sin clickbait (Google News)", 4, clickbait ? "fail" : "pass",
    clickbait ? "Mayúsculas, signos repetidos o frases gancho" : "Titular informativo",
    "Google News y Discover penalizan el sensacionalismo: informa el hecho."));

  // ── Google (resultado de búsqueda) ───────────────────────────────────────
  const stLen = (input.seoTitle || input.title).trim().length;
  checks.push(check("seo-title", "Google", "Título SEO", 6,
    stLen >= 40 && stLen <= 60 ? "pass" : stLen >= 30 && stLen <= 65 ? "warn" : "fail",
    `${stLen} caracteres (ideal 40–60)${input.seoTitle ? "" : " · se usa el titular"}`,
    "Escribe un título SEO de 40–60 caracteres con la palabra clave al inicio."));
  const dLen = input.seoDescription.trim().length;
  const kwInDesc = contains(input.seoDescription, keyword);
  checks.push(check("meta-description", "Google", "Meta descripción", 7,
    dLen >= 120 && dLen <= 158 && kwInDesc ? "pass" : dLen >= 80 && dLen <= 170 ? "warn" : "fail",
    `${dLen} caracteres (ideal 120–158)${dLen && !kwInDesc ? " · sin la palabra clave" : ""}`,
    "Resume el hecho en 120–158 caracteres e incluye la palabra clave."));
  const slugWords = input.slug.split("-").filter(Boolean);
  const kwSlug = fold(keyword).split(/\s+/).filter((w) => w.length > 2).every((w) => input.slug.includes(w.replace(/[^a-z0-9]/g, "")));
  checks.push(check("slug", "Google", "URL (slug)", 4,
    input.slug.length > 0 && input.slug.length <= 75 && slugWords.length <= 10 && kwSlug ? "pass" : input.slug.length > 0 ? "warn" : "fail",
    input.slug ? `/noticia/${input.slug} (${input.slug.length} car.)` : "Sin slug",
    "Corto (≤ 75 caracteres), sin palabras vacías y con la palabra clave."));

  // ── Contenido ────────────────────────────────────────────────────────────
  checks.push(check("length", "Contenido", "Extensión", 8,
    wordCount >= 600 ? "pass" : wordCount >= 350 ? "warn" : "fail",
    `${wordCount} palabras (recomendado 600–1.200 para noticia completa)`,
    "Agrega contexto: antecedentes, cifras, declaraciones y qué viene después."));
  const lead = paragraphs[0] ?? "";
  checks.push(check("lead-keyword", "Contenido", "Palabra clave en el primer párrafo", 6,
    contains(lead, keyword) || contains(input.excerpt, keyword) ? "pass" : "fail",
    contains(lead, keyword) ? "El primer párrafo la menciona" : "El primer párrafo no la menciona",
    "Responde qué, quién, cuándo y dónde en las 2 primeras frases, con la palabra clave."));
  const leadWords = words(lead).length;
  checks.push(check("lead-length", "Contenido", "Entrada directa (pirámide invertida)", 4,
    leadWords > 0 && leadWords <= 45 ? "pass" : leadWords <= 70 ? "warn" : "fail",
    `Primer párrafo: ${leadWords} palabras (ideal ≤ 45)`, "Arranca con el hecho principal en una o dos frases cortas."));
  const density = wordCount ? (countOccurrences(body, keyword) * words(keyword).length * 100) / wordCount : 0;
  checks.push(check("density", "Contenido", "Densidad de la palabra clave", 4,
    density >= 0.4 && density <= 2.5 ? "pass" : density > 2.5 ? "warn" : wordCount < 150 ? "warn" : "fail",
    `${density.toFixed(1)}% (ideal 0,4–2,5%)`, density > 2.5 ? "Suena forzado: usa sinónimos y variaciones." : "Menciónala de forma natural 2–4 veces más."));
  const needHeadings = Math.floor(wordCount / 350);
  checks.push(check("headings", "Contenido", "Subtítulos", 5,
    headings.length >= Math.max(1, needHeadings) || wordCount < 300 ? "pass" : headings.length > 0 ? "warn" : "fail",
    `${headings.length} subtítulo(s) para ${wordCount} palabras`, "Un subtítulo cada 250–350 palabras ayuda a Google y a quien lee en el celular."));
  const kwHeading = headings.some((h) => contains(h, keyword) || fold(keyword).split(" ").some((w) => w.length > 3 && contains(h, w)));
  if (headings.length) {
    checks.push(check("heading-keyword", "Contenido", "Palabra clave en un subtítulo", 3, kwHeading ? "pass" : "warn",
      kwHeading ? "Al menos un subtítulo la usa" : "Ningún subtítulo la usa", "Usa la palabra clave o una variante en un subtítulo."));
  }
  const longParagraphs = paragraphs.filter((p) => words(p).length > 110).length;
  checks.push(check("paragraphs", "Contenido", "Párrafos cortos", 3, longParagraphs === 0 ? "pass" : longParagraphs <= 1 ? "warn" : "fail",
    longParagraphs ? `${longParagraphs} párrafo(s) de más de 110 palabras` : "Todos los párrafos son legibles en celular", "Divide los párrafos largos en 2–4 frases."));

  // ── Legibilidad ──────────────────────────────────────────────────────────
  const fh = fernandezHuerta(body);
  checks.push(check("readability", "Legibilidad", "Facilidad de lectura (Fernández-Huerta)", 6,
    fh === null ? "warn" : fh >= 60 ? "pass" : fh >= 45 ? "warn" : "fail",
    fh === null ? "Aún muy corto para medir" : `${fh}/100 · ${readabilityLabel(fh)}`, fh === null ? "Sigue escribiendo." : "Frases más cortas y palabras más comunes."));
  const ss = sentences(body);
  const longSentences = ss.filter((s) => words(s).length > 35).length;
  checks.push(check("sentences", "Legibilidad", "Frases largas", 3,
    longSentences === 0 ? "pass" : longSentences / Math.max(1, ss.length) <= 0.15 ? "warn" : "fail",
    `${longSentences} de ${ss.length} frases con más de 35 palabras`, "Parte las frases largas en dos."));

  // ── Medios ───────────────────────────────────────────────────────────────
  checks.push(check("cover", "Medios", "Imagen de portada", 6, input.coverUrl ? "pass" : "fail",
    input.coverUrl ? "Tiene portada" : "Sin portada", "Discover y redes casi nunca muestran una noticia sin imagen grande (≥ 1200 px)."));
  const images = input.blocks.filter((b) => b.type === "image") as Extract<Block, { type: "image" }>[];
  const withoutAlt = images.filter((img) => !img.alt.trim()).length;
  if (images.length) {
    checks.push(check("alt", "Medios", "Texto alternativo en imágenes", 3, withoutAlt === 0 ? "pass" : "warn",
      withoutAlt ? `${withoutAlt} de ${images.length} imágenes sin texto alternativo` : "Todas las imágenes lo tienen",
      "Describe qué se ve: ayuda a Google Imágenes y a la accesibilidad."));
  }
  const media = input.blocks.filter((b) => b.type === "image" || b.type === "embed").length;
  checks.push(check("body-media", "Medios", "Imagen o video en el cuerpo", 2, media > 0 || wordCount < 400 ? "pass" : "warn",
    media ? `${media} elemento(s) multimedia` : "Solo texto", "Un video o foto a mitad de nota mejora el tiempo de lectura."));

  // ── Fuentes y confianza (E-E-A-T) ────────────────────────────────────────
  const htmlAll = textBlocks.map((b) => b.html).join(" ");
  const links = (htmlAll.match(/<a\s[^>]*href=/gi) ?? []).length;
  const attribution = /\b(según|de acuerdo con|informó|confirmó|declaró|reveló|publicó|indicó|aseguró)\b/i.test(body);
  checks.push(check("attribution", "Fuentes", "Atribución de la información", 4, attribution || links > 0 ? "pass" : "fail",
    attribution ? "Cita de dónde sale la información" : "No atribuye la información a ninguna fuente",
    "Agrega «según…», «confirmó…» o un enlace a la fuente oficial."));
  const quotes = input.blocks.some((b) => b.type === "quote") || /[«"“][^»"”]{20,}[»"”]/.test(body);
  checks.push(check("quotes", "Fuentes", "Declaraciones textuales", 2, quotes ? "pass" : "warn",
    quotes ? "Incluye declaraciones" : "Sin declaraciones entre comillas", "Una cita del protagonista da autoridad y tiempo de lectura."));
  if (verifyMarks) {
    checks.push(check("verify", "Fuentes", "Datos por verificar", 6, "fail",
      `${verifyMarks} dato(s) marcados [VERIFICAR] por la IA`, "Confirma esos datos con la fuente y borra la marca antes de publicar."));
  }

  // ── Google News / Monetización ───────────────────────────────────────────
  checks.push(check("category", "Google", "Categoría", 3, input.categoryId ? "pass" : "fail",
    input.categoryId ? "Asignada" : "Sin categoría", "Elige la categoría: define la sección y las noticias relacionadas."));
  checks.push(check("tags", "Google", "Etiquetas", 2, input.tags.length >= 3 && input.tags.length <= 8 ? "pass" : input.tags.length ? "warn" : "fail",
    `${input.tags.length} etiquetas (ideal 3–8)`, "Equipos, jugadores y competición principales."));
  const exLen = input.excerpt.trim().length;
  checks.push(check("excerpt", "Google", "Entradilla", 3, exLen >= 90 && exLen <= 240 ? "pass" : exLen ? "warn" : "fail",
    `${exLen} caracteres (ideal 90–240)`, "Una o dos frases con el hecho y por qué importa."));
  if (input.originality !== undefined && input.originality !== null) {
    checks.push(check("originality", "Monetización", "Originalidad", 10,
      input.originality >= 80 ? "pass" : input.originality >= 60 ? "warn" : "fail",
      `${Math.round(input.originality)}% original frente a las fuentes`,
      "Reescribe con tus palabras las frases marcadas: el contenido copiado no posiciona y AdSense lo rechaza."));
  } else {
    checks.push(check("originality", "Monetización", "Originalidad", 0, "warn",
      "Sin analizar todavía", "Pulsa «Analizar originalidad» antes de publicar."));
  }
  checks.push(check("ad-ready", "Monetización", "Espacio para anuncios", 3,
    wordCount >= 600 ? "pass" : wordCount >= 400 ? "warn" : "fail",
    wordCount >= 600 ? "Admite anuncio arriba, en medio y al final" : `Con ${wordCount} palabras cabe poca publicidad`,
    "A partir de ~600 palabras el artículo sostiene varios espacios de anuncio."));

  // Structure/readability checks can't be judged on a stub: below 150 words
  // they are "pending", never free points.
  if (wordCount < 150) {
    const unmeasurable = new Set(["lead-length", "density", "headings", "heading-keyword", "paragraphs", "readability", "sentences", "body-media"]);
    for (const c of checks) {
      if (unmeasurable.has(c.id)) {
        c.status = "warn";
        c.detail = "Pendiente: escribe al menos 150 palabras para medirlo";
        c.fix = c.fix ?? "Sigue escribiendo.";
      }
    }
  }

  const total = checks.reduce((sum, c) => sum + c.weight, 0);
  const earned = checks.reduce((sum, c) => sum + (c.status === "pass" ? c.weight : c.status === "warn" ? c.weight * 0.5 : 0), 0);
  return {
    score: total ? Math.round((earned / total) * 100) : 0,
    keyword, keywordSource, words: wordCount, readability: fh, readabilityLabel: readabilityLabel(fh), checks, verifyMarks, verifySnippets,
  };
}
