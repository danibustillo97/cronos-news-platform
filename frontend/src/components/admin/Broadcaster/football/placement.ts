// Smart placement: when a graphic goes on air, it takes the first candidate spot
// that does not overlap anything already on screen (e.g. a lower third pressed
// while the line-ups are up moves to the free side). Coordinates: 1920x1080 frame,
// positions in percent like the rest of the studio. Pure + tested.

export interface Rect { x: number; y: number; w: number; h: number }
export interface Spot { x: number; y: number }

export const FRAME = { w: 1920, h: 1080 };

export const CANDIDATES: Record<string, Spot[]> = {
  lower: [{ x: 4, y: 78 }, { x: 52, y: 78 }, { x: 52, y: 8 }, { x: 28, y: 62 }],
  dato: [{ x: 24.5, y: 66 }, { x: 24.5, y: 6 }, { x: 24.5, y: 40 }],
  "goal-alert": [{ x: 26.5, y: 74 }, { x: 26.5, y: 4 }, { x: 26.5, y: 40 }],
  poll: [{ x: 26, y: 50 }, { x: 26, y: 8 }, { x: 52, y: 30 }, { x: 2, y: 30 }],
  pro: [{ x: 2.5, y: 3.5 }, { x: 63, y: 3.5 }],
  elite: [{ x: 3, y: 4 }, { x: 60, y: 4 }],
  events: [{ x: 4, y: 82 }, { x: 52, y: 82 }, { x: 52, y: 8 }],
  stats: [{ x: 3, y: 17 }, { x: 60, y: 17 }],
  prematch: [{ x: 23, y: 26 }],
  multi: [{ x: 17.7, y: 12 }],
  "lineup-home": [{ x: 3, y: 17 }],
  "lineup-away": [{ x: 74, y: 17 }],
};

export function rectAt(spot: Spot, size: { w: number; h: number }, scale = 1): Rect {
  return { x: (spot.x / 100) * FRAME.w, y: (spot.y / 100) * FRAME.h, w: size.w * scale, h: size.h * scale };
}

export function overlaps(a: Rect, b: Rect, margin = 8): boolean {
  return a.x < b.x + b.w + margin && a.x + a.w + margin > b.x && a.y < b.y + b.h + margin && a.y + a.h + margin > b.y;
}

const inside = (r: Rect) => r.x >= 0 && r.y >= 0 && r.x + r.w <= FRAME.w && r.y + r.h <= FRAME.h;

/** First candidate spot for `variant` that is inside the frame and free; falls back to the default spot. */
export function findFreeSpot(variant: string, size: { w: number; h: number }, occupied: Rect[], fallback: Spot): Spot {
  const spots = CANDIDATES[variant] ?? [fallback];
  for (const spot of spots) {
    const r = rectAt(spot, size);
    if (inside(r) && !occupied.some((o) => overlaps(r, o))) return spot;
  }
  return spots[0] ?? fallback;
}
