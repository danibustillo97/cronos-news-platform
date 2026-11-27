import { describe, expect, it } from "vitest";
import { estimateSeconds, lineKey, PROFILES, segment } from "./narration";
import { spokenDate, spokenTime, voiceTestScript } from "./narratorScript";
import type { Categories, CenterMatch } from "./matchStatus";

const match = (id: string, home: string, away: string, kickoff: string, status: CenterMatch["status"], hs = 0, as = 0): CenterMatch => ({
  id, league: "col.1", leagueName: "Liga BetPlay", kickoff, status, statusName: "", detail: "", clock: "", period: 0,
  home: { id: "h", name: home, short: home.slice(0, 3), score: hs }, away: { id: "a", name: away, short: away.slice(0, 3), score: as },
  seenAt: 0, missing: 0, stale: false,
} as CenterMatch);
const empty: Categories = { live: [], upcoming: [], finishedToday: [], previous: [] };
const NOW = Date.parse("2026-11-27T17:00:00Z"); // 12:00 in Bogotá

describe("narration segmentation", () => {
  it("splits sentences with the profile's pauses and keeps ¡…! marks", () => {
    const segs = segment("Buenas noches. ¡Gol de Millonarios! ¿Quién lo para?", "EPIC");
    expect(segs.map((s) => s.text)).toEqual(["Buenas noches.", "¡Gol de Millonarios!", "¿Quién lo para?"]);
    expect(segs.every((s) => s.pauseAfterMs === PROFILES.EPIC.sentencePauseMs)).toBe(true);
  });

  it("lets long sentences breathe at clauses and adds the trailing pause", () => {
    const long = "El equipo de Gamero dominó la primera media hora con presión alta y salida limpia, encontró los espacios a la espalda de los laterales y terminó convirtiendo esa superioridad en un gol que premia la insistencia.";
    const segs = segment(long, "ANALYSIS", false, 500);
    expect(segs.length).toBeGreaterThan(1);
    expect(segs[0].pauseAfterMs).toBe(PROFILES.ANALYSIS.clausePauseMs);
    expect(segs[segs.length - 1].pauseAfterMs).toBe(PROFILES.ANALYSIS.sentencePauseMs + 500);
  });

  it("emphasis slows the delivery and is part of the cache key", () => {
    expect(segment("Final del partido.", "EPIC", true)[0].speed).toBeLessThan(1);
    const v = { provider: "kokoro" as const, voice: "em_santa" };
    expect(lineKey({ id: "1", text: "x", profile: "EPIC" }, v)).not.toBe(lineKey({ id: "1", text: "x", profile: "EPIC", emphasis: true }, v));
    expect(lineKey({ id: "1", text: "x", profile: "EPIC" }, v)).not.toBe(lineKey({ id: "1", text: "x", profile: "EPIC" }, { provider: "kokoro", voice: "em_alex" }));
  });

  it("estimates duration from text and pauses", () => {
    expect(estimateSeconds([{ text: "a".repeat(150), pauseAfterMs: 1000 }])).toBeCloseTo(11, 0);
  });
});

describe("speakable (what the voice says)", () => {
  it("reads minutes, ordinals, scores and abbreviations like a narrator", async () => {
    const { speakable } = await import("./narration");
    expect(speakable("Cambiaso 37' · Silva 90+3'")).toBe("Cambiaso 37, Silva 90 más 3");
    expect(speakable("Olympiacos queda 9.º con 10 puntos")).toBe("Olympiacos queda noveno con 10 puntos");
    expect(speakable("Juventus goleó 4-1 a Omonia")).toBe("Juventus goleó 4 a 1 a Omonia");
    expect(speakable("Maignan (e.c.) y Kane (p)")).toBe("Maignan en contra y Kane de penal");
    expect(speakable("Millonarios vs América")).toBe("Millonarios contra América");
  });
});

describe("spoken Spanish (Colombia time)", () => {
  it("says kick-off times the way a narrator does, in Bogotá time", () => {
    expect(spokenTime("2026-11-28T01:40:00Z")).toBe("a las 8 y 40 de la noche"); // 20:40 Bogotá
    expect(spokenTime("2026-11-27T20:00:00Z")).toBe("a las 3 de la tarde");
    expect(spokenTime("2026-11-27T06:00:00Z")).toBe("a la 1 de la mañana");
    expect(spokenDate(NOW)).toMatch(/viernes.*27.*noviembre/);
  });
});

describe("60-second voice test script", () => {
  it("only names real matches of the day and never invents one", () => {
    const cats: Categories = { ...empty, upcoming: [match("1", "Millonarios", "América de Cali", "2026-11-28T01:40:00Z", "SCHEDULED")] };
    const text = voiceTestScript(cats, NOW).map((l) => l.text).join(" ");
    expect(text).toContain("Millonarios y América de Cali");
    expect(text).toContain("a las 8 y 40 de la noche");
    expect(text).not.toMatch(/en juego ahora/);
    const none = voiceTestScript(empty, NOW).map((l) => l.text).join(" ");
    expect(none).toContain("no hay partidos programados");
  });

  it("puts live matches first with the epic profile and the real score", () => {
    const cats: Categories = { ...empty, live: [match("2", "Deportivo Cali", "Atlético Bucaramanga", "2026-11-27T23:35:00Z", "LIVE", 1, 0)] };
    const script = voiceTestScript(cats, NOW);
    const live = script.find((l) => l.text.includes("Deportivo Cali"))!;
    expect(live.profile).toBe("EPIC");
    expect(live.text).toContain("1 a 0");
  });

  it("stays around one minute with many matches and drops dangling section headers", () => {
    const many = Array.from({ length: 30 }, (_, i) => match(`u${i}`, `Local ${i}`, `Visitante ${i}`, "2026-11-28T01:40:00Z", "SCHEDULED"));
    const script = voiceTestScript({ ...empty, upcoming: many }, NOW);
    const secs = script.reduce((t, l) => t + estimateSeconds(segment(l.text, l.profile, l.emphasis, l.pauseAfterMs ?? 0)), 0);
    expect(secs).toBeLessThan(70);
    expect(script.length).toBeLessThan(many.length);
    expect(script[script.length - 3].text).not.toMatch(/^Lo que viene/);
  });
});
