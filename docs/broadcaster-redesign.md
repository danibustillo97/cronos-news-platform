# NEXUS SPORT Broadcast — redesign: architecture map and migration plan

Status: Phase 1 in progress. Every phase keeps the existing features working and is validated
(type check, lint, tests, real-browser screenshots at 1366×768, 1600×940 and 390×844) before the next one starts.

## 1. What exists today (inventory)

| Area | Where | What it does (keep) |
|---|---|---|
| Shell | `admin/page.tsx` → `BroadcasterHub.tsx` → `BroadcasterView.tsx` (~2.8k lines) | Video studio + radio tabs; admin sidebar hidden in the broadcaster (edge reveal). |
| Modes | `studioMode: "normal" \| "football"` | Normal = classic preview/program switcher with scenes, sources, widgets. Football = `FootballStage`. **Both stay.** |
| Program output | `programCanvasRef` (1920×1080 canvas) + `compositor.ts` (`drawScene`, `drawTransition`) | Everything that goes on air is drawn here; `captureStream` feeds WHIP (Emitir) and the recorder. |
| Scenes / layouts | `BroadcastScene` (`layout: auto/single/split/triple/pip/set-*`), `programSceneSnapshot`, `previewSceneId`, `takeScene()` | Preview → Program with cut/fade transitions (Space / Enter). |
| Sources | `BroadcastInput` (camera, screen, video, image, audio), guest room (WebRTC link), media library (IndexedDB) | Cameras, screen, guests, clips, backgrounds. |
| Audio | `audioMixer.ts` (`ProgramMixer`), `AudioBar`, `sfx.ts`, `music.ts` | Program bus → stream; SFX; show music. |
| Graphics engine | `football/designs.ts` (HTML designs) → `raster.ts` (HTML→SVG→bitmap) → compositor cache | Scoreboards (pro/elite…), stats, line-ups, goal card, multi, poll, ticker (cinta), recap show, ad box. Renders **independently of the UI** (same output in overlay/export). |
| Match data | `useFootballMatch` (`fm`), `matchBinding.ts`, `liveBoard.ts`, `/api/matches/*`, `/api/football/*` (incl. `recap`) | Live sync every 15 s, any match bound to its own graphic, goal alerts, recap, odds. |
| Placement | `placement.ts` (`findPlacement`, `settle`) + `virtualSets.ts` (`cameraRects`) | Graphics never cover camera frames or each other. |
| Virtual studios | `virtualSets.ts` (6+1 layouts × 5 themes incl. Champions, Junior) | Canvas-drawn sets; cameras fitted in frames. |
| Automatic show | `recap.ts`, `AutoShowPanel.tsx` | Matchday program with analysis, numbers, parlays, music. |
| Keyboard | Football stage (capture phase): 1–9 match slots, 0 hide all, assignable letters; studio: Space/Enter take, Shift+F fade, R record, F1–F5, Delete, arrows | **No shortcut is removed or changed.** |

## 2. Gaps against the brief

1. No shared design system: colours/radii/borders are hard-coded per component (several greys, two yellows).
2. Football mode acts straight on Program — no preview/program distinction there.
3. Right panel is a flat toggle list, not contextual to the selected scene.
4. Library mixes scenes/sets/backgrounds; no "camera sources", "presenter" or "graphic packages" sections.
5. No 3D presenter. **Noris has no model file yet**: only `Downloads/noris_front_fullbody_reference.png` and a Blender blockout script (`football-intelligence-platform/.../characters/noris/build_noris.py`, never exported). A real rigged `noris.glb` (with idle / walk / run clips) is needed.
6. Fullscreen program view exists only as a footer button.

## 3. Reuse decisions

- Keep `compositor.ts` as the single renderer of Program; new pieces (presenter) become **layers drawn by the compositor**, so streaming/recording keep working untouched.
- Keep `designs.ts` as the graphics engine; new graphics are new variants there (same cache/raster path).
- Keep all data hooks; the contextual panel only re-arranges existing actions (`stageToggle`, `toggleMatch`, `airForMatch`, polls, recap).
- Three.js / @react-three/fiber / drei are **already dependencies** → no new packages for Noris.

## 4. Phases

1. **Design system + workspace** — tokens (`--nx-*` in `.nx-studio`), shared UI classes (`football/ui.ts`), five areas: top production bar, left library, central program canvas, right contextual panel, bottom production deck. Pure re-arrangement/restyle, same handlers.
2. **Scene library, preview/program, contextual controls** — football mode gets an optional Preview bus (prepare scene + graphics, TAKE to air) reusing `takeScene`; right panel switches content by selected scene (match, debate, show, camera).
3. **Graphics + data** — substitution card, cards (yellow/red) card, comparative player stats, debate result graphic, event timeline; all fed by existing match data.
4. **Noris 3D presenter** — `presenter/` module: R3F scene rendered off-screen with alpha → compositor layer (position/scale per scene); `useGLTF` + `AnimationMixer` with idle/walk/run state machine mapped from clip names; configurable camera, key/fill/rim lights, contact shadows; model from `/models/noris.glb` or uploaded `.glb` (IndexedDB). Hooks ready for TTS + lip-sync (viseme morph targets) and script cues. No static image fallback.
5. **Animation, transitions, virtual studios** — animated graphic in/out, stinger transitions, presenter walk-in cues, refined sets.
6. **Responsive, performance, validation** — phone production layout, frame-time budget (raster cache hits, presenter at 30 fps), end-to-end checks.

## Phase 1 — done (commit ff3d367)

Tokens `--nx-*` + `football/ui.ts`; top production bar, production library (scenes by group, camera sources,
virtual studios, graphic package, backgrounds), program canvas status (PROGRAM / al aire / REC, fullscreen),
contextual panel and production deck restyled. No handler or shortcut changed.

## Phase 2 — Preview / Program in football mode (done)

**How it works**
- Work mode in the program header: **Directo** (as before: every action goes to Program) or **Preparar**.
- In *Preparar* the studio has a real Preview bus (`pvwScene` + `pvwGraphics` in `BroadcasterView`) drawn by the same
  compositor on its own canvas (green PREVIEW monitor next to the red PROGRAM monitor).
- Every stage action is routed by one helper (`currentBus()` → `setLook`, `setBusGraphics`, `exitBus`): scenes,
  virtual studios, backgrounds, graphic toggles, keys 1–9, and Marcador / Alineac. / Stats of any match.
  No logic was duplicated: the same functions take a bus.
- **TAKE** (`takeFootball`) sends Preview to Program with the existing transition engine (`transitionStateRef`,
  `drawTransition`): Corte, Fundido, Barrido, A negro. Space = TAKE with the chosen transition, Enter = TAKE with fade
  (same keys as the classic studio). The footer TAKE follows the mode.
- Timed graphics prepared in Preview (line-ups 20 s, stats 15 s) store `autoOut` and start their clock only after TAKE;
  when they leave Program their Preview copy is removed too (`exitEverywhere`), so a later TAKE does not bring them back.
- Always straight to Program: "Ocultar todo"/key 0 (panic), the automatic show, live goal alerts.
- Preview tools: tap a graphic on the PREVIEW monitor to remove it, **Igualar** (copy Program to Preview), vaciar.
- Right panel is **contextual**: the scene group on screen (Partido / Debate y análisis / Sin cámara / Programa
  automático) reorders the graphics by usefulness and offers the matching action (elegir partido, lanzar votación,
  programa automático). Each graphic shows *EN PREVIEW* and/or *AL AIRE*.
- Smart placement (`settle`) runs on both buses with each bus's own set layout.

**Noris readiness (no model invented)** — `presenterLayer.ts`: the compositor draws a registered presenter source
between studio and graphics on Program/Preview (`drawPresenter`), feet on the bottom of its rect. Nothing is registered
until a real rigged `noris.glb` exists, so nothing is drawn. Unit-tested.

**Validated** — tsc, eslint (0 errors), vitest (all), and in a real browser: Preparar → scene only in Preview while
Program unchanged → Space → Program; ticker + key 1 prepared → TAKE (Corte) → Program; Directo → Estadísticas straight
to Program.

## Phase 3 — advanced sports graphics (done)

All content comes from real data; nothing is estimated. Pure builders in `football/eventGraphics.ts` (tested against a
real Champions match, Sabah FK 1-4 Barcelona), designs in `football/designs.ts`.

| Graphic | Source | Notes |
|---|---|---|
| **Cambio** (`sub`) | match-detail `sub` events; "X replaces Y (because of an injury)" | Entra / Sale, minute, crest, "por lesión" tag. |
| **Tarjeta** (`card`) | `yellow` / `red` events | Card drawn in its colour, player, team, minute. |
| **Línea de tiempo** (`timeline`) | goals, cards, subs with minutes | Home above / away below the axis, half-time mark, scorers labelled. |
| **Duelo** (`duel`) | `/api/matches/insights/player/{id}` (ESPN season stats + last games) | Only rows both players have: goals, assists, starts, shots, on target, shot accuracy, goals in last 5. Defaults to starting attackers (`duelDefault`). |
| **Resultado del debate** (`poll-result`) | the portal poll on air (`getPollBoard`) | Percentages, winner highlighted, total votes. |

- **Automatic**: when the main match (auto sync) registers a card or a substitution, the full card/sub graphic goes on air
  (instead of the generic "último evento").
- **Manual**: right panel → *Gráficos del partido* for the active match (number key, a card in *Partidos de hoy*, or any
  result of *Jornada de ayer*, now clickable). They honour Directo / Preparar like everything else.
- Each graphic carries its own data (`setGraphicData`, keyed by the graphic's title), so Preview and Program can show
  different substitutions or duels at the same time; the compositor cache is invalidated through the data version.

**Validated** — tsc, eslint (0 errors), vitest (all, incl. 6 new data tests), real browser on the real match: timeline,
last substitution (Fariñas ↔ Gavi 86'), last booking (Lepinjica 69'), duel (season stats). *Not exercised live*: the
debate result needs a poll launched from the admin (authenticated); the builder and design are unit-tested.

## Phase 4 — Noris 3D presenter: **blocked on the real model**

Verified on this machine (26-nov-2026): only `Downloads/noris_front_fullbody_reference.png` and a Blender blockout
script exist; there is **no `noris.glb`**. Phase 4 starts when a rigged GLB with idle / walk / run clips is provided.
Ready for it: `presenterLayer.ts` (compositor layer, Program/Preview), Three.js + R3F + drei already installed.
