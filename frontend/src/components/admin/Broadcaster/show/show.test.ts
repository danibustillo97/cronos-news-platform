import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildEdition, collectItems, isClassic, upset, type ShowData } from "./editorial";
import { Director, type DirectorState } from "./director";
import type { RecapMatch } from "../football/recap";
import type { Edition } from "./types";

const NOW = Date.parse("2026-11-27T17:00:00Z"); // 12:00 Bogotá, Friday 27
const rm = (id: string, league: string, home: string, away: string, hs: number, as: number, extra: Partial<RecapMatch> = {}): RecapMatch => ({
  id, league, leagueName: league === "col.1" ? "Liga BetPlay" : "Premier League", date: "2026-11-26T23:00Z",
  home: { id: "h" + id, name: home, short: home.slice(0, 3).toUpperCase(), score: hs }, away: { id: "a" + id, name: away, short: away.slice(0, 3).toUpperCase(), score: as },
  goals: { home: Array.from({ length: hs }, (_, i) => ({ player: `Jugador L${i}`, minute: `${10 + i * 20}'`, kind: "goal" as const })), away: Array.from({ length: as }, (_, i) => ({ player: `Jugador V${i}`, minute: `${15 + i * 20}'`, kind: "goal" as const })) },
  reds: [], stats: [{ label: "Posesión", home: 61, away: 39, percent: true }, { label: "Remates", home: 14, away: 6 }, { label: "Al arco", home: 6, away: 2 }],
  headline: `${home} venció ${hs}-${as} a ${away}`, analysis: [`${home} tuvo la pelota el 61 por ciento del tiempo.`], impact: [`${home} sube al tercer lugar con 30 puntos.`], table: [], ...extra,
});

function data(over: Partial<ShowData> = {}): ShowData {
  return {
    now: NOW,
    recaps: [
      { day: "20261126", leagues: [{ league: "col.1", leagueName: "Liga BetPlay", matches: [rm("m1", "col.1", "Millonarios", "Santa Fe", 3, 1), rm("m2", "col.1", "Junior", "Once Caldas", 1, 1)] }] },
      { day: "20261122", leagues: [{ league: "eng.1", leagueName: "Premier League", matches: [rm("m3", "eng.1", "Chelsea", "Arsenal", 2, 0)] }] },
    ],
    live: [
      { id: "l1", league: "col.1", leagueName: "Liga BetPlay", kickoff: "2026-11-27T16:00Z", status: "LIVE", clock: "55'", home: { name: "Deportivo Cali", score: 1 }, away: { name: "Bucaramanga", score: 0 } },
      { id: "l2", league: "col.1", leagueName: "Liga BetPlay", kickoff: "2026-11-26T16:00Z", status: "FINISHED", home: { name: "Viejo FC", score: 2 }, away: { name: "Pasado FC", score: 2 } },
    ],
    upcoming: [
      { id: "u1", league: "col.1", leagueName: "Liga BetPlay", kickoff: "2026-11-28T01:40:00Z", status: "SCHEDULED", home: { name: "Millonarios" }, away: { name: "América de Cali" } },
      { id: "u0", league: "col.1", leagueName: "Liga BetPlay", kickoff: "2026-11-27T10:00:00Z", status: "SCHEDULED", home: { name: "Ya Pasó" }, away: { name: "Expirado" } },
    ],
    news: [
      { id: "n1", title: "Junior tendría a Brayan Rovira para 2027", summary: "Las partes ultiman detalles del contrato.", source: "Semana", published_at: "2026-11-27T13:00:00Z" },
      { id: "n2", title: "La Dimayor confirmó el calendario de cuadrangulares", summary: "El torneo arranca el 3 de diciembre.", source: "Dimayor", published_at: "2026-11-27T12:00:00Z" },
      { id: "n3", title: "Noticia vieja", published_at: "2026-11-10T12:00:00Z" },
    ],
    standings: { "col.1": { leagueName: "Liga BetPlay", rows: [{ pos: 1, team: "Millonarios", played: 19, points: 38, gd: 15 }, { pos: 2, team: "América de Cali", played: 19, points: 35, gd: 10 }, { pos: 3, team: "Junior", played: 19, points: 33, gd: 8 }] } },
    polls: [],
    logos: {},
    ...over,
  };
}
const texts = (e: Edition) => e.segments.flatMap((s) => s.beats.map((b) => b.narration?.text ?? "")).filter(Boolean);

describe("editorial engine", () => {
  it("only provider-confirmed live matches are live; past ones never", () => {
    const { items } = collectItems(data(), { modes: ["today"], leagues: [], targetMin: 30 });
    const live = items.filter((i) => i.kind === "live");
    expect(live.map((i) => i.matchId)).toEqual(["l1"]);
    expect(live[0].priority).toBe("CRITICAL");
  });

  it("modes pick the right period: yesterday excludes older days, week includes them", () => {
    const y = collectItems(data(), { modes: ["yesterday"], leagues: [], targetMin: 30 }).items.filter((i) => i.kind === "result");
    expect(y.map((i) => i.matchId).sort()).toEqual(["m1", "m2"]);
    const w = collectItems(data(), { modes: ["week"], leagues: [], targetMin: 30 }).items.filter((i) => i.kind === "result");
    expect(w.map((i) => i.matchId).sort()).toEqual(["m1", "m2", "m3"]);
  });

  it("rumours are attributed and flagged, old news and expired fixtures never air", () => {
    const e = buildEdition(data(), { modes: ["today", "upcoming"], leagues: [], targetMin: 30 });
    const rumour = Object.values(e.items).find((i) => i.id === "news:n1")!;
    expect(rumour.verification).toBe("PROVISIONAL");
    expect(texts(e).some((t) => t.startsWith("Según Semana") && t.includes("no está confirmado"))).toBe(true);
    expect(Object.keys(e.items)).not.toContain("news:n3");
    expect(Object.keys(e.items)).not.toContain("fix:u0");
  });

  it("a classic, Colombia time and table context in what's next — and no score prediction", () => {
    const e = buildEdition(data(), { modes: ["upcoming"], leagues: [], targetMin: 30 });
    const next = e.segments.find((s) => s.kind === "next")!;
    const t = next.beats.map((b) => b.narration?.text ?? "").join(" ");
    expect(t).toContain("a las 8 y 40 de la noche");
    expect(t).toContain("Millonarios llega 1° con 38 puntos");
    expect(t).not.toMatch(/ganará|pronóstico.*\d-\d/);
  });

  it("every item airs once and nothing undefined/NaN reaches the narration", () => {
    const e = buildEdition(data(), { modes: ["yesterday", "today", "upcoming"], leagues: [], targetMin: 30 });
    const ids = e.segments.flatMap((s) => s.itemIds);
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of texts(e)) expect(t).not.toMatch(/undefined|NaN|null/);
    expect(e.segments[0].kind).toBe("opening");
    expect(e.segments[e.segments.length - 1].kind).toBe("closing");
  });

  it("the analysis reveals stats one by one and the debate never invents votes", () => {
    const e = buildEdition(data(), { modes: ["yesterday"], leagues: [], targetMin: 30 });
    const analysis = e.segments.find((s) => s.kind === "analysis")!;
    const reveals = analysis.beats.map((b) => (b.screen?.type === "stats" ? b.screen.reveal : null)).filter((r) => r !== null);
    expect(reveals).toEqual([0, 1, 2, 3]);
    const debate = e.segments.find((s) => s.kind === "debate")!;
    const poll = debate.beats.find((b) => b.screen?.type === "poll")!.screen!;
    expect(poll.type === "poll" && poll.state).toBe("none");
    expect(debate.beats.map((b) => b.narration?.text).join(" ")).not.toMatch(/\d+ votos/);
    const withPoll = buildEdition(data({ polls: [{ id: "p1", matchId: "m1", question: "¿Figura del clásico?", status: "open", options: [{ label: "Jugador L0", votes: 30 }, { label: "Jugador V0", votes: 10 }] }] }), { modes: ["yesterday"], leagues: [], targetMin: 30 });
    expect(texts(withPoll).some((t) => t.includes("40 votos reales") && t.includes("75 por ciento"))).toBe(true);
  });

  it("durations follow the content: max scales with the target and short material is not padded", () => {
    const e15 = buildEdition(data(), { modes: ["yesterday"], leagues: [], targetMin: 15 });
    const e60 = buildEdition(data(), { modes: ["yesterday"], leagues: [], targetMin: 60 });
    expect(e60.segments[0].maxS).toBe(e15.segments[0].maxS * 4);
    expect(e60.estimatedS).toBeLessThan(60 * 60 * 0.6);
    expect(e60.warnings.some((w) => w.includes("no se rellena"))).toBe(true);
  });

  it("detects classics and upsets from real data only", () => {
    expect(isClassic("Millonarios", "Independiente Santa Fe")).toBe(true);
    expect(isClassic("Millonarios", "Junior")).toBe(false);
    expect(upset(rm("x", "col.1", "A", "B", 0, 1, { odds: { home: 1.5, draw: 3.8, away: 6.5 } }))).toBe(true);
    expect(upset(rm("y", "col.1", "A", "B", 1, 0, { odds: { home: 1.5, draw: 3.8, away: 6.5 } }))).toBe(false);
  });
});

describe("director", () => {
  const fakeRenderer = () => {
    const calls: string[] = [];
    return { calls, r: { setStage: (s: string) => calls.push(`stage:${s}`), setShot: (s: string) => calls.push(`shot:${s}`), setScreen: (c: { type: string } | null) => calls.push(`screen:${c?.type}`), setLower: () => calls.push("lower"), setOverlay: () => undefined, setSide: () => undefined } };
  };
  beforeEach(() => { vi.useFakeTimers(); vi.stubGlobal("window", globalThis); });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it("applies visuals before the voice, waits for each line and ends", async () => {
    const e = buildEdition(data(), { modes: ["yesterday"], leagues: [], targetMin: 15 });
    const { calls, r } = fakeRenderer();
    const spoken: string[] = [];
    let last: DirectorState | null = null;
    const d = new Director(e, { renderer: r as never, narrate: async (l) => { calls.push("voice"); spoken.push(l.text); }, onState: (s) => { last = s; } });
    d.setVoice(true);
    d.play(0);
    await vi.runAllTimersAsync();
    expect(last!.status).toBe("done");
    expect(calls.indexOf("stage:OPENING")).toBeLessThan(calls.indexOf("voice"));
    expect(spoken.length).toBe(e.segments.reduce((n, s) => n + s.beats.filter((b) => b.narration).length, 0));
  });

  it("SEMI waits for approval; MANUAL waits at the end of each segment", async () => {
    const e = buildEdition(data(), { modes: ["yesterday"], leagues: [], targetMin: 15 });
    let last: DirectorState | null = null;
    const { r } = fakeRenderer();
    const d = new Director(e, { renderer: r as never, narrate: async () => undefined, onState: (s) => { last = s; } });
    d.setVoice(true);
    d.setMode("SEMI");
    d.play(0);
    await vi.advanceTimersByTimeAsync(10);
    expect(last!.status).toBe("awaiting-approval");
    d.approve();
    await vi.advanceTimersByTimeAsync(10);
    expect(last!.status).not.toBe("awaiting-approval");
    d.setMode("MANUAL");
    await vi.advanceTimersByTimeAsync(60_000);
    expect(["awaiting-operator", "awaiting-approval"]).toContain(last!.status);
    d.stop();
    expect(last!.status).toBe("idle");
  });

  it("without a voice it shows captions timed by reading length (never a fake voice)", async () => {
    const e = buildEdition(data(), { modes: ["yesterday"], leagues: [], targetMin: 15 });
    const captions: (string | undefined)[] = [];
    const { r } = fakeRenderer();
    const d = new Director(e, { renderer: { ...r, setOverlay: (o: { caption?: string }) => { if ("caption" in o) captions.push(o.caption); } } as never, onState: () => undefined });
    d.setVoice(true); // requested, but no provider → captions
    expect(d.state.voice).toBe("subtítulos");
    d.play(0);
    await vi.advanceTimersByTimeAsync(5000);
    expect(captions.filter(Boolean).length).toBeGreaterThan(0);
    d.stop();
  });
});
