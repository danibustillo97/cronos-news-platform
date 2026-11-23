import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BroadcastGraphic, FootballScoreboard } from "./graphicExport";
import { drawScene, drawTransition, footballDesignFor, setLiveFootballMatch, type BroadcastScene } from "./compositor";
import { baseFills, fakeCanvas } from "./testCanvas";

const drawMotion = vi.hoisted(() => vi.fn());
vi.mock("./football/motion", async (importOriginal) => ({ ...(await importOriginal<object>()), drawMotion }));
vi.mock("./football/raster", () => ({ getDesignImage: () => ({ naturalWidth: 960, naturalHeight: 170 }) }));

const match: FootballScoreboard = {
  homeTeam: "Local", awayTeam: "Visita", homeScore: 1, awayScore: 0, period: "1T", clockSeconds: 600, addedTime: 0,
  homeYellow: 0, awayYellow: 0, homeRed: 0, awayRed: 0,
};
const scoreboard: BroadcastGraphic = { id: "board", mode: "football", name: "Marcador", kind: "scoreboard", title: "", subtitle: "", accent: "#ef4444", variant: "elite" };
const scene = (id: string): BroadcastScene => ({ id, name: id, inputIds: [], graphicId: null });
const noMedia = () => [new Map(), new Map()] as const;

describe("compositor", () => {
  beforeEach(() => {
    setLiveFootballMatch(match);
    drawMotion.mockClear();
  });
  afterEach(() => vi.restoreAllMocks());

  it("crossfades: the outgoing scene stays opaque while the incoming one is layered at the progress alpha", () => {
    const { canvas, calls } = fakeCanvas();
    drawTransition(canvas, scene("a"), scene("b"), [], ...noMedia(), [], [], "fade", 0.3);
    const bases = baseFills(calls);
    expect(bases[0].alpha).toBe(1);
    const layered = bases.findIndex((call) => call.alpha === 0.3);
    expect(layered).toBeGreaterThan(0);
    // Nothing opaque may cover the outgoing scene once the incoming pass starts.
    expect(bases.slice(layered).every((call) => call.alpha <= 0.3)).toBe(true);
  });

  it("fades football graphics together with the program when going to black", () => {
    const { canvas } = fakeCanvas();
    drawScene(canvas, scene("a"), [], ...noMedia(), [scoreboard], 0.2, "program");
    expect(drawMotion).toHaveBeenCalledTimes(1);
    expect(drawMotion.mock.calls[0][0].opacity).toBe(0.2);
  });

  it("replays the entry animation on Program even if the widget was already showing in Preview", () => {
    let now = 1000;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    const preview = fakeCanvas(1280, 720);
    const program = fakeCanvas();
    const widget = { ...scoreboard, id: "board-entry" };
    for (; now < 1600; now += 66) drawScene(preview.canvas, scene("a"), [], ...noMedia(), [widget], 1, "preview");
    drawMotion.mockClear();
    drawScene(program.canvas, scene("a"), [], ...noMedia(), [widget], 1, "program");
    expect(drawMotion.mock.calls[0][0].elapsed).toBe(0);
  });

  it("reuses the same design object until the match, the clock second or the widget changes", () => {
    let seconds = 600;
    setLiveFootballMatch(match, () => seconds);
    const widget = { ...scoreboard, id: "board-memo" };
    const first = footballDesignFor(widget);
    expect(footballDesignFor(widget)).toBe(first);
    seconds = 601;
    const ticked = footballDesignFor(widget);
    expect(ticked).not.toBe(first);
    expect(ticked.html).toContain("10:01");
    expect(footballDesignFor({ ...widget, style: { showCards: false } })).not.toBe(ticked);
    setLiveFootballMatch({ ...match, homeScore: 2 }, () => seconds);
    expect(footballDesignFor(widget)).not.toBe(ticked);
  });
});
