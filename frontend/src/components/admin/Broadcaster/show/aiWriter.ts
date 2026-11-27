// AI editor-narrator: the configured AI provider (the same one the editorial tools use, through
// the existing admin endpoint — no new service, no new keys) rewrites the narration of each
// segment like a TV analyst would: connecting facts, explaining why they matter, building
// transitions. It receives ONLY verified facts (what is on screen, the base line, the computed
// insights, the table) and every line it returns is checked: a number that is not in the facts
// rejects the line and the verified base line stays. If the AI is unavailable, the edition
// keeps its base narration and says so.

import { apiFetch } from "@/studio/lab/api-client";
import type { RecapMatch } from "../football/recap";
import type { ShowData } from "./editorial";
import { dayInsights, matchInsights } from "./insights";
import type { Beat, Edition, ScreenContent, Segment } from "./types";

const CHUNK = 16;          // beats per call (keeps prompt and answer small)
const PARALLEL = 3;

function screenFacts(s?: ScreenContent): string {
  if (!s) return "";
  switch (s.type) {
    case "result": return `pantalla: ${s.league} · ${s.home.name} ${s.home.score ?? ""}-${s.away.score ?? ""} ${s.away.name} (${s.status}) · goles ${[...s.scorers.home, ...s.scorers.away].join(", ") || "—"}`;
    case "stats": return `pantalla: estadísticas ${s.home.name} vs ${s.away.name}: ${s.rows.map((r) => `${r.label} ${r.home}-${r.away}`).join("; ")}`;
    case "table": return `pantalla: tabla ${s.title}: ${s.rows.map((r) => `${r.pos}. ${r.team} ${r.points} pts (${r.played} PJ, dif ${r.gd})`).join("; ")}`;
    case "fixtures": return `pantalla: próximos partidos: ${s.rows.map((r) => `${r.day ?? ""} ${r.time} ${r.home.name} vs ${r.away.name} (${r.league})`).join("; ")}`;
    case "numbers": return `pantalla: ${s.title}: ${s.items.map((i) => `${i.label} ${i.value}`).join("; ")}`;
    case "poll": return `pantalla: votación «${s.question}» ${s.total ? s.options.map((o) => `${o.label} ${o.votes} votos`).join("; ") : "sin votos todavía"}`;
    case "headline": return `pantalla: noticia «${s.title}» ${s.body ?? ""} (fuente ${s.source}${s.provisional ? ", SIN CONFIRMAR" : ""})`;
    case "headlines": return `pantalla: titulares: ${s.items.join(" | ")}`;
    case "title": return `pantalla: título ${s.kicker} · ${s.title}${s.subtitle ? ` · ${s.subtitle}` : ""}`;
    case "closing": return `pantalla: cierre: ${s.lines.join(" | ")}`;
  }
}

/** Facts of the whole edition the narrator may connect (insights + tables), compact. */
export function editionContext(data: ShowData, results: RecapMatch[]): string {
  const lines: string[] = [];
  for (const m of results.slice(0, 14)) {
    const keys = matchInsights(m, data.standings[m.league]?.rows ?? []).slice(0, 3).map((k) => k.text);
    lines.push(`- ${m.leagueName}: ${m.home.name} ${m.home.score}-${m.away.score} ${m.away.name}.${keys.length ? " " + keys.join(" ") : ""}${m.impact[0] ? " " + m.impact[0] : ""}`);
  }
  const day = dayInsights(results).map((k) => `- ${k.text}`);
  const tables = Object.values(data.standings).slice(0, 3).map((t) => `- Tabla ${t.leagueName}: ${t.rows.slice(0, 6).map((r) => `${r.pos}. ${r.team} ${r.points}${r.group ? ` (${r.group})` : ""}`).join(", ")}`);
  return [...lines, ...day, ...tables].join("\n").slice(0, 6000);
}

function prompt(seg: Segment, beats: Beat[], context: string, previous: string): string {
  const facts = beats.map((b) => JSON.stringify({ id: b.id, base: b.narration!.text, ...(screenFacts(b.screen) ? { en_pantalla: screenFacts(b.screen) } : {}), ...(b.lower ? { rotulo: `${b.lower.kicker}: ${b.lower.text}` } : {}) })).join("\n");
  return `Eres el editor jefe y el narrador-analista principal de NEXUS SPORT, un programa deportivo de televisión en Colombia.
Estás escribiendo el bloque «${seg.title}». Reescribe la narración de cada beat para que suene como un gran narrador y analista de TV: que conecte los datos, explique por qué importan, aporte tensión y contexto, y que las transiciones entre historias sean naturales. Nada de leer datos en lista: cuéntalos.

REGLAS DE VERACIDAD (obligatorias, sin excepción):
- Usa SOLO los hechos de este mensaje (beats y CONTEXTO). No inventes nombres, cifras, rachas, historia, lesiones, declaraciones, fichajes ni opiniones de terceros.
- Escribe todas las cantidades con dígitos (2 goles, minuto 89). No uses cifras que no estén en los hechos.
- No pronostiques marcadores. Lo marcado «SIN CONFIRMAR» se dice con «según» y aclarando que no está confirmado.
- No califiques un partido como clásico, histórico, récord, racha, invicto o «primera vez» si los hechos no lo dicen. No atribuyas intenciones ni digas que alguien «tenía controlado» un partido.
- No digas dónde se jugó un partido (país, ciudad, estadio) ni de qué país es un equipo si los hechos no lo dicen.
- Cuenta bien: si dices cuántos goles hubo en un tramo, verifica con los minutos. Ante la duda, no cuentes.
- Cada beat debe hablar de lo que está en pantalla en ese momento (puedes conectar con el CONTEXTO).
- Español neutro de Colombia, frases para decir en voz alta, 1 a 3 frases y máximo 45 palabras por beat. No repitas muletillas ni empieces dos beats igual.

CONTEXTO DE LA EDICIÓN (hechos verificados):
${context || "(sin contexto adicional)"}
${previous ? `\nLo último que se dijo antes de este bloque: «${previous}»\n` : ""}
BEATS (en orden):
${facts}

Responde SOLO con JSON válido, sin texto adicional: {"beats":[{"id":"<id>","text":"<narración>"}]} con exactamente los mismos ids.`;
}

const numbers = (t: string) => (t.match(/\d+(?:[.,]\d+)?/g) ?? []).map((n) => n.replace(",", "."));
const WORDS: Record<string, number> = { dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, veinte: 20, treinta: 30, cuarenta: 40, cincuenta: 50, cien: 100 };
const fold = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
/** Claims that need a fact behind them: if the facts don't use the word, the line can't either. */
const CLAIMS = /clasic|histori|record|racha|invict|primera vez|nunca|siempre|consecutiv|seguid|lesion|declar|dijo|fichaj|sancion|portugal|espana|inglaterra|italia|alemania|francia|holanda|paises bajos|belgica|escocia|turquia|grecia|chequia|republica checa|austria|suiza|argentina|brasil|uruguay|mexico|estados unidos|lisboa|madrid|barcelona|londres|manchester|milan|roma|munich|paris|bogota|medellin|cali|barranquilla|estadio/g;

/** Accepts the AI line only if every number (digits or words) and every strong claim is in the facts it was given. */
export function acceptLine(text: string, allowed: Set<string>, factsText = ""): boolean {
  const t = text.trim();
  if (t.length < 4 || t.length > 420 || /undefined|null|\{|\}|<|>/.test(t)) return false;
  if (!numbers(t).every((n) => allowed.has(n) || allowed.has(String(Number(n))))) return false;
  const words = fold(t).match(/[a-z]+/g) ?? [];
  if (!words.every((w) => !(w in WORDS) || allowed.has(String(WORDS[w])))) return false;
  const facts = fold(factsText);
  return (fold(t).match(CLAIMS) ?? []).every((c) => facts.includes(c));
}

function parse(text: string): { id: string; text: string }[] {
  const a = text.indexOf("{"), b = text.lastIndexOf("}");
  if (a < 0 || b <= a) throw new Error("respuesta sin JSON");
  const body = JSON.parse(text.slice(a, b + 1)) as { beats?: { id?: unknown; text?: unknown }[] };
  return (body.beats ?? []).filter((x) => typeof x.id === "string" && typeof x.text === "string").map((x) => ({ id: x.id as string, text: (x.text as string).trim() }));
}

async function ask(p: string): Promise<string> {
  const res = await apiFetch("/api/admin/capsules/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: p }) });
  const body = await res.json().catch(() => null) as { text?: string; detail?: string } | null;
  if (!res.ok || !body?.text) throw new Error(typeof body?.detail === "string" ? body.detail : `HTTP ${res.status}`);
  return body.text;
}

export interface AiReport { ok: boolean; rewritten: number; rejected: number; total: number; error?: string }

/** Rewrites the narration of the edition in place (returns a new edition). Never throws. */
export async function aiRewrite(edition: Edition, context: string, onProgress: (msg: string) => void, askFn: (p: string) => Promise<string> = ask): Promise<{ edition: Edition; report: AiReport }> {
  const jobs: { seg: number; beats: Beat[]; previous: string }[] = [];
  edition.segments.forEach((seg, i) => {
    const spoken = seg.beats.filter((b) => b.narration);
    const prevSeg = edition.segments[i - 1];
    const prevLine = prevSeg?.beats.filter((b) => b.narration).slice(-1)[0]?.narration?.text ?? "";
    for (let k = 0; k < spoken.length; k += CHUNK) jobs.push({ seg: i, beats: spoken.slice(k, k + CHUNK), previous: k === 0 ? prevLine : spoken[k - 1].narration!.text });
  });
  const replaced = new Map<string, string>();
  let rejected = 0, failed = 0, lastError = "", done = 0;
  const total = jobs.reduce((n, j) => n + j.beats.length, 0);

  const run = async (j: (typeof jobs)[number]) => {
    const seg = edition.segments[j.seg];
    const p = prompt(seg, j.beats, context, j.previous);
    const allowed = new Set(numbers(p));
    try {
      const out = parse(await askFn(p));
      const wanted = new Set(j.beats.map((b) => b.id));
      for (const o of out) {
        if (!wanted.has(o.id)) continue;
        if (acceptLine(o.text, allowed, p)) replaced.set(o.id, o.text); else rejected++;
      }
    } catch (err) { failed++; lastError = err instanceof Error ? err.message : String(err); }
    done++;
    onProgress(`La IA está escribiendo la narración… ${done}/${jobs.length} bloques`);
  };
  onProgress(`La IA está escribiendo la narración… 0/${jobs.length} bloques`);
  const queue = [...jobs];
  await Promise.all(Array.from({ length: Math.min(PARALLEL, queue.length) }, async () => { while (queue.length) await run(queue.shift()!); }));

  const segments = edition.segments.map((s) => {
    const n = s.beats.filter((b) => replaced.has(b.id)).length;
    return n ? { ...s, ai: n, beats: s.beats.map((b) => (replaced.has(b.id) && b.narration ? { ...b, narration: { ...b.narration, text: replaced.get(b.id)!, base: b.narration.text } } : b)) } : s;
  });
  const report: AiReport = { ok: failed < jobs.length, rewritten: replaced.size, rejected, total, error: failed ? lastError : undefined };
  return { edition: { ...edition, segments }, report };
}
