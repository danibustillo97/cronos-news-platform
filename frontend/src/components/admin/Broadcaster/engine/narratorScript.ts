// Spoken Spanish helpers and the 60-second voice test, built ONLY from the real
// matches of the Colombia day (match centre). No match → no claim about it.

import type { CenterMatch, Categories } from "./matchStatus";
import { estimateSeconds, lineSegments, type NarrationLine } from "./narration";

const TZ = "America/Bogota";

/** "a las 3 de la tarde", "a las 8 y 40 de la noche" — Colombia time, the way a narrator says it. */
export function spokenTime(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", minute: "numeric", hour12: false }).formatToParts(new Date(iso));
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0) % 24;
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const part = h < 12 ? "de la mañana" : h < 19 ? "de la tarde" : "de la noche";
  const art = h12 === 1 ? "a la 1" : `a las ${h12}`;
  return m === 0 ? `${art} ${part}` : `${art} y ${m} ${part}`;
}

/** "viernes 27 de noviembre" in Colombia. */
export function spokenDate(at: number | string | Date): string {
  return new Intl.DateTimeFormat("es-CO", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" }).format(new Date(at));
}

export const spokenScore = (a: number, b: number) => `${a} a ${b}`;

function greeting(now: number): string {
  const h = Number(new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", hour12: false }).format(new Date(now))) % 24;
  return h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches";
}

let n = 0;
const line = (text: string, profile: NarrationLine["profile"], extra: Partial<NarrationLine> = {}): NarrationLine => ({ id: `t${++n}`, text, profile, ...extra });

/**
 * About one minute of narration over today's real matches: live first, then what is
 * coming, then today's results. Stops adding matches once the minute is full.
 */
export function voiceTestScript(cats: Categories, now = Date.now(), targetS = 60): NarrationLine[] {
  const open: NarrationLine[] = [
    line(`${greeting(now)}, Colombia. Esto es NEXUS SPORT.`, "FRIENDLY", { pauseAfterMs: 300 }),
    line(`Hoy es ${spokenDate(now)}, y esto es lo que deja el día en el fútbol.`, "NEWS"),
  ];
  const close: NarrationLine[] = [
    line("Aquí seguimos cada partido en tiempo real: el marcador, los goles y los números que explican lo que pasa en la cancha.", "NEWS"),
    line("Quédese con nosotros. Esto apenas comienza.", "FRIENDLY"),
  ];
  const body: NarrationLine[] = [];
  const say = (m: CenterMatch) => `${m.home.name} y ${m.away.name}`;
  if (cats.live.length) body.push(line(cats.live.length === 1 ? "Hay un partido en juego ahora mismo." : `Hay ${cats.live.length} partidos en juego ahora mismo.`, "EPIC", { emphasis: true }));
  cats.live.forEach((m) => body.push(line(`En ${m.leagueName}, ${m.home.name} ${spokenScore(m.home.score, m.away.score)} ${m.away.name}${m.status === "HT" ? ", en el descanso" : ""}.`, "EPIC")));
  if (cats.upcoming.length) body.push(line("Lo que viene en la jornada.", "EXPECTATION", { pauseAfterMs: 150 }));
  cats.upcoming.forEach((m) => body.push(line(`${spokenTime(m.kickoff)}, en ${m.leagueName}: ${say(m)}.`, "EXPECTATION")));
  if (cats.finishedToday.length) body.push(line("Y los resultados que ya están cerrados.", "NEWS", { pauseAfterMs: 150 }));
  cats.finishedToday.forEach((m) => body.push(line(`En ${m.leagueName}, ${m.home.name} ${spokenScore(m.home.score, m.away.score)} ${m.away.name}.`, "NEWS")));
  if (!body.length) body.push(line("Por ahora no hay partidos programados en las ligas que seguimos. En cuanto ruede el balón, aquí lo va a ver.", "NEWS"));

  const seconds = (ls: NarrationLine[]) => ls.reduce((t, l) => t + estimateSeconds(lineSegments(l)), 0);
  const fixed = seconds(open) + seconds(close);
  const kept: NarrationLine[] = [];
  for (const l of body) {
    if (kept.length && fixed + seconds([...kept, l]) > targetS + 6) break;
    kept.push(l);
  }
  // a section header with nothing under it would be a lie of omission: drop dangling headers
  while (kept.length && /^(Lo que viene|Y los resultados)/.test(kept[kept.length - 1].text)) kept.pop();
  return [...open, ...kept, ...close];
}
