import { describe, expect, it } from "vitest";
import { DEFAULT_OPTIONS, nextTrack, planAhead, targetEnergy, type PlayedItem, type RadioTrack } from "./autoDj";

const t = (id: string, kind: RadioTrack["kind"], artist = "A", energy = 3, extra: Partial<RadioTrack> = {}): RadioTrack => ({
  id, title: id, artist, kind, url: `https://cdn/${id}.mp3`, durationS: 180, energy, mood: null, tags: [], active: true,
  playCount: 0, lastPlayedAt: null, ...extra,
});
const played = (track: RadioTrack, at: number): PlayedItem => ({ trackId: track.id, kind: track.kind, artist: track.artist, energy: track.energy, at });
const fixed = () => 0.5;

const library = [
  t("s1", "song", "Bad Bunny", 4), t("s2", "song", "Karol G", 4), t("s3", "song", "Feid", 3), t("s4", "song", "Karol G", 5),
  t("s5", "song", "Morat", 2), t("j1", "jingle"), t("j2", "jingle"), t("id1", "station_id"), t("p1", "promo"),
];
const afternoon = new Date(2026, 10, 24, 15, 20);

describe("auto DJ", () => {
  it("energy follows the daypart", () => {
    expect(targetEnergy(new Date(2026, 10, 24, 3, 0))).toBe(2);
    expect(targetEnergy(new Date(2026, 10, 24, 19, 0))).toBe(5);
  });

  it("plays a station ID at the top of the hour, once", () => {
    const top = new Date(2026, 10, 24, 16, 1);
    const history = [played(library[0], top.getTime() - 200000)];
    expect(nextTrack(library, history, top, DEFAULT_OPTIONS, fixed)!.track.kind).toBe("station_id");
    const after = [...history, played(library[7], top.getTime() - 10000), played(library[1], top.getTime())];
    expect(nextTrack(library, after, new Date(2026, 10, 24, 16, 4), DEFAULT_OPTIONS, fixed)!.track.kind).not.toBe("station_id");
  });

  it("inserts a jingle every N songs", () => {
    const base = afternoon.getTime();
    const history = [played(library[8], base - 60000), played(library[0], base), played(library[1], base + 1), played(library[2], base + 2)];
    expect(nextTrack(library, history, afternoon, DEFAULT_OPTIONS, fixed)!.track.kind).toBe("jingle");
  });

  it("never repeats the song or the artist too soon", () => {
    const base = afternoon.getTime();
    const history = [played(library[8], base - 1000), played(library[5], base), played(library[1], base + 1)]; // last song: Karol G
    const decision = nextTrack(library, history, afternoon, DEFAULT_OPTIONS, fixed)!;
    expect(decision.track.kind).toBe("song");
    expect(decision.track.artist).not.toBe("Karol G");
  });

  it("fits the afternoon energy and avoids abrupt jumps", () => {
    const base = afternoon.getTime();
    const history = [played(library[8], base - 1000), played(library[6], base)]; // jingle-free start: promo then a jingle
    const decision = nextTrack(library, history, afternoon, DEFAULT_OPTIONS, fixed)!;
    expect(decision.track.energy).toBeGreaterThanOrEqual(3);
  });

  it("plans ahead without repeating songs", () => {
    const plan = planAhead(library, [], afternoon, 8, DEFAULT_OPTIONS, fixed);
    const songs = plan.filter((d) => d.track.kind === "song").map((d) => d.track.id);
    expect(new Set(songs).size).toBe(songs.length);
    expect(plan.some((d) => d.track.kind === "jingle")).toBe(true);
  });

  it("degrades gracefully with a tiny or empty library", () => {
    expect(nextTrack([], [], afternoon)).toBeNull();
    const onlyBed = [t("b1", "bed")];
    expect(nextTrack(onlyBed, [], afternoon)!.track.id).toBe("b1");
    const one = [t("s1", "song")];
    expect(nextTrack(one, [played(one[0], 0)], afternoon, DEFAULT_OPTIONS, fixed)!.track.id).toBe("s1");
  });
});
