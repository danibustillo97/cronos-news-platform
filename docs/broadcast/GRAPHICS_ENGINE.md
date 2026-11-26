# Graphics Engine

Rendering: `football/designs.ts` (HTML designs) → `football/raster.ts` (HTML→SVG→bitmap, cached) → `compositor.ts`
(Program / Preview, transitions) → stream / recording. Designs are independent of the control UI.

## Catalogue and priority hierarchy — `engine/graphicsCatalog.ts`
Each graphic has a **layer**, **priority** and default **duration**:
- `bug` (scoreboards), `ticker` (cinta), `side` (ad) coexist with everything;
- `lower` (goal 100, goal elsewhere 80, VAR 75, card 70, sub 60, timeline 45, last event 40, rótulo/dato 30),
  `center` (result 85, line-ups 55 as one group, player 55, stats/standings/duel 50, poll result/previa 45, poll 40, multi 35)
  and `full` (automatic show 90) hold **one graphic at a time**; `full` also clears center and lower.
- `arbitrate(onAir, incoming, force)` → which graphics leave; automatic graphics never replace a higher priority one.
- No-overlap placement (`placement.ts` `settle`) keeps graphics off camera frames and off each other.

## Library (all with real data)
Scoreboards (per competition), cinta, goal card, goal elsewhere, card, substitution, line-ups, stats, previa, duel
(player comparison), poll live, poll/debate result, timeline, **standings** (new, `/api/football/table`), **result card**
half-time/full-time (new), **featured player** (new; top scorer of the match + ESPN season card — if nobody scored it is
not invented: use the poll), multi-screen, recap show, ad box.
Each graphic: dynamic data (`setGraphicData` per graphic → Preview and Program can differ), entry/exit animation
(`leavingAt`), configurable duration (timed graphics prepared in Preview start counting at TAKE), on-air / in-preview state.
