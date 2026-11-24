// Auto DJ brain -- decides WHAT plays next. Pure and deterministic given a
// random source, so it is fully testable; the audio engine only executes.
//
// Rules a radio programmer would apply:
//  * Format clock: a station ID at the top of the hour, a jingle every N songs,
//    a promo roughly every half hour.
//  * Rotation: never repeat a song within the last `songSeparation` plays,
//    never the same artist back to back (`artistSeparation`).
//  * Energy flow by daypart: morning builds up, afternoon peaks, late night
//    calms down; a song can't jump more than 2 energy levels from the last one.
//  * Freshness: songs played less (and less recently) are preferred.

export type TrackKind = "song" | "jingle" | "station_id" | "promo" | "bed";

export interface RadioTrack {
  id: string;
  title: string;
  artist: string;
  kind: TrackKind;
  url: string;
  durationS: number | null;
  energy: number;          // 1..5
  mood: string | null;
  tags: string[];
  active: boolean;
  playCount: number;
  lastPlayedAt: string | null;
}

export interface PlayedItem {
  trackId: string;
  kind: TrackKind;
  artist: string;
  energy: number;
  at: number; // epoch ms when it started
}

export interface AutoDjOptions {
  jingleEvery: number;       // songs between jingles
  promoEveryMin: number;     // minutes between promos
  songSeparation: number;    // distinct songs before one may repeat
  artistSeparation: number;  // songs before the same artist again
  dayparts: { fromHour: number; energy: number }[];
}

export const DEFAULT_OPTIONS: AutoDjOptions = {
  jingleEvery: 3,
  promoEveryMin: 30,
  songSeparation: 20,
  artistSeparation: 3,
  dayparts: [
    { fromHour: 0, energy: 2 },   // madrugada
    { fromHour: 6, energy: 3 },   // mañana
    { fromHour: 10, energy: 4 },  // media mañana
    { fromHour: 14, energy: 4 },  // tarde
    { fromHour: 18, energy: 5 },  // previa / prime time
    { fromHour: 22, energy: 3 },  // noche
  ],
};

export function targetEnergy(date: Date, options: AutoDjOptions = DEFAULT_OPTIONS): number {
  const hour = date.getHours();
  const part = [...options.dayparts].sort((a, b) => a.fromHour - b.fromHour).filter((p) => p.fromHour <= hour).pop();
  return part?.energy ?? 3;
}

function songsSince(history: PlayedItem[], predicate: (item: PlayedItem) => boolean): number {
  let count = 0;
  for (let i = history.length - 1; i >= 0; i -= 1) {
    if (predicate(history[i])) return count;
    if (history[i].kind === "song") count += 1;
  }
  return Number.POSITIVE_INFINITY;
}

export interface Decision {
  track: RadioTrack;
  reason: string;
}

/** Picks the next item to play. `random` defaults to Math.random (inject for tests). */
export function nextTrack(
  library: RadioTrack[], history: PlayedItem[], now: Date,
  options: AutoDjOptions = DEFAULT_OPTIONS, random: () => number = Math.random,
): Decision | null {
  const active = library.filter((t) => t.active && t.url);
  const pick = (kind: TrackKind) => {
    const pool = active.filter((t) => t.kind === kind);
    if (!pool.length) return null;
    const last = [...history].reverse().find((h) => h.kind === kind);
    const fresh = pool.filter((t) => t.id !== last?.trackId);
    const list = fresh.length ? fresh : pool;
    return list[Math.floor(random() * list.length)];
  };
  const last = history[history.length - 1];
  const lastWasSong = last?.kind === "song";

  // 1. Station ID at the top of the hour (once per hour).
  const hourStart = new Date(now);
  hourStart.setMinutes(0, 0, 0);
  const idThisHour = history.some((h) => h.kind === "station_id" && h.at >= hourStart.getTime());
  if (now.getMinutes() < 5 && !idThisHour && lastWasSong) {
    const id = pick("station_id");
    if (id) return { track: id, reason: "Identificación de la estación (inicio de hora)" };
  }
  // 2. Promo every ~N minutes.
  const lastPromo = [...history].reverse().find((h) => h.kind === "promo");
  if (lastWasSong && (!lastPromo || now.getTime() - lastPromo.at >= options.promoEveryMin * 60000)) {
    const promo = pick("promo");
    if (promo && history.some((h) => h.kind === "song")) return { track: promo, reason: `Promo (cada ${options.promoEveryMin} min)` };
  }
  // 3. Jingle every N songs.
  const songsSinceSweeper = songsSince(history, (h) => h.kind === "jingle" || h.kind === "station_id");
  if (lastWasSong && songsSinceSweeper >= options.jingleEvery) {
    const jingle = pick("jingle");
    if (jingle) return { track: jingle, reason: `Jingle (cada ${options.jingleEvery} canciones)` };
  }

  // 4. Song selection: rotation rules + energy flow + freshness.
  const songs = active.filter((t) => t.kind === "song");
  if (!songs.length) {
    const fallback = pick("bed") ?? pick("jingle");
    return fallback ? { track: fallback, reason: "Sin canciones: cortina" } : null;
  }
  const recentSongIds = history.filter((h) => h.kind === "song").slice(-options.songSeparation).map((h) => h.trackId);
  const recentArtists = history.filter((h) => h.kind === "song").slice(-options.artistSeparation).map((h) => h.artist.toLowerCase());
  const lastSong = [...history].reverse().find((h) => h.kind === "song");
  const target = targetEnergy(now, options);

  const score = (t: RadioTrack) => {
    let s = 0;
    s -= Math.abs(t.energy - target) * 2;                                  // fit the daypart
    if (lastSong && Math.abs(t.energy - lastSong.energy) > 2) s -= 6;       // no abrupt jumps
    s -= Math.min(5, t.playCount * 0.15);                                  // prefer less played
    const hoursAgo = t.lastPlayedAt ? (now.getTime() - new Date(t.lastPlayedAt).getTime()) / 3.6e6 : 999;
    s += Math.min(3, hoursAgo / 8);                                         // prefer not-recently-played
    return s + random() * 1.5;                                             // human variety
  };

  const tiers = [
    songs.filter((t) => !recentSongIds.includes(t.id) && !recentArtists.includes(t.artist.toLowerCase())),
    songs.filter((t) => !recentSongIds.includes(t.id)),
    songs.filter((t) => t.id !== lastSong?.trackId),
    songs,
  ];
  const pool = tiers.find((tier) => tier.length) ?? songs;
  const best = pool.map((t) => ({ t, s: score(t) })).sort((a, b) => b.s - a.s)[0].t;
  const relaxed = pool === tiers[0] ? "" : " (biblioteca corta: reglas de rotación relajadas)";
  return { track: best, reason: `Canción · energía ${best.energy} para la franja (objetivo ${target})${relaxed}` };
}

/** Plans the next `count` items without playing them (for the "A continuación" list). */
export function planAhead(
  library: RadioTrack[], history: PlayedItem[], now: Date, count: number,
  options: AutoDjOptions = DEFAULT_OPTIONS, random: () => number = Math.random,
): Decision[] {
  const plan: Decision[] = [];
  const simulated = [...history];
  let clock = now.getTime();
  for (let i = 0; i < count; i += 1) {
    const decision = nextTrack(library, simulated, new Date(clock), options, random);
    if (!decision) break;
    plan.push(decision);
    simulated.push({ trackId: decision.track.id, kind: decision.track.kind, artist: decision.track.artist, energy: decision.track.energy, at: clock });
    clock += (decision.track.durationS ?? 180) * 1000;
  }
  return plan;
}
