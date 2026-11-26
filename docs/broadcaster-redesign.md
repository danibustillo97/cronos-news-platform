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
