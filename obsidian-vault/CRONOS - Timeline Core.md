---
title: CRONOS - Timeline Core
tags:
  - arquitectura
  - decision
  - timeline
---

# Timeline Core (P7)

`backend/app/domain/timeline/` — `Sequence` → `Track` → `TimelineShot` →
`Timing`/`Transform`/`Transition`. Puro dato declarativo, igual disciplina
que `sequence.json`/`animation_plan.json` de LAB (ver [[CRONOS - Render
Architecture Decision]]): Editorial/Narrative/Audio Direction *declara*
intención, código determinístico *ejecuta* — Timeline nunca vuelve a
decidir nada, solo lo modela.

## Por qué es su propio bounded context y no un método de Composition

`Composition.content.shots` (P4, `CompositionShot`) ya es una lista plana de
shots — funcionalmente casi lo mismo. La razón para separarlos ahora en vez
de esperar: Quick Reel (P8) y Story Reel (P9) van a construir un `Sequence`
**sin haber producido nunca una Composition** (P8 es reglas determinísticas
sobre assets existentes, P9 es secuenciación manual tipo Noris Viral,
ninguna pasa por `ProduceStory`). Si Timeline fuera un método de
`Composition`, P8/P9 tendrían que fabricar una `Composition` falsa solo
para tener algo de qué colgar el timeline. Separarlo ahora evita ese
acoplamiento inverso más adelante.

`build_timeline_from_composition()` (`builder.py`) es **el único builder
real hoy** — deriva un `Sequence` a partir de shots que `ProduceStory` ya
armó. Los builders de Quick Reel/Story Reel no existen todavía (YAGNI,
mismo criterio que el resto de este roadmap): se construyen cuando P8/P9
existan, no antes.

## Multi-track desde el día uno, aunque solo un track tenga datos reales

`Sequence.tracks` es una lista de `Track` (`VIDEO` / `AUDIO` / `TEXT`), no
un campo único. Hoy `build_timeline_from_composition()` solo puebla
`VIDEO` — Assembly (`CRONOS - Assembly.md`) describe el audio como "pista
única plana" y ni siquiera eso está implementado en LAB todavía (diseño
pausado), y no hay overlays de texto posicionados en ningún artifact real.
Modelar `TrackKind.AUDIO`/`TEXT` ahora sin poblarlos no es inventar datos —
es dejar el lugar correcto para cuando existan, igual que `ui_zones` en
Safe Area quedó listo antes de tener un compositor que lo consuma.

## Timing: derivado, nunca inventado

Cada `TimelineShot` tiene `Timing.start_seconds`/`duration_seconds`,
calculado por el builder recorriendo los shots en orden y avanzando el
cursor **solo** cuando `disposition == "INCLUDED"`. Un shot
`EXCLUDED_NO_ASSET`/`BLOCKED_NOT_RENDERED` queda con
`Timing.duration_seconds == 0` (no ocupa tiempo físico) pero conserva
`declared_duration_seconds` para trazabilidad — exactamente la distinción
`declared_duration_seconds` vs `included_duration_seconds` que
`AssemblyResult` ya expone. Timeline no inventa una duración física para un
shot sin asset; sigue el mismo criterio de exclusión que Assembly.

## Transform y Transition: modelados, no poblados con datos reales

- **`Transform`** (x/y/scale/rotation) por defecto es identidad — sin
  pan/zoom. El Ken Burns de Assembly se pausó explícitamente por depender
  de "una constante de magnitud... inventada sin respaldo editorial" (ver
  [[CRONOS - Assembly]]). Timeline deja el campo listo pero no fabrica un
  valor — todo `TimelineShot` hoy es `Transform()` identidad.
- **`Transition`** replica el vocabulario real de Assembly
  (`declared`/`applied`/`downgraded`): v1 de Assembly solo ejecuta `CUT`,
  así que declarar `FADE`/`DISSOLVE` sin marcarlas `downgraded=True` sería
  mentir sobre qué se aplicó de verdad. La entidad lo hace estructuralmente
  imposible (`__post_init__` rechaza `CUT` no aplicado y rechaza
  `applied and downgraded` a la vez) — no es una validación decorativa,
  es la misma disciplina de no fabricar resultados que ya usa Assembly.

## CURRENT / DESIGNED / FUTURE

- **CURRENT**: el modelo y el builder desde Composition existen, están
  testeados (`tests/domain/test_timeline.py`), pero **nada los llama
  todavía** — ni `ProduceStory` construye un `Sequence` hoy, ni hay
  endpoint que lo exponga. Mismo patrón de gap anotado a propósito que P3
  (`AssetRepository`) y P6 (`validate_elements` sin caller): construir esa
  integración es su propia tarea.
- **DESIGNED**: cuando exista un compositor/QA layer, produce los rects de
  cada `TimelineShot` (posición real en pantalla, considerando `Transform`)
  y se los pasa a `validate_elements` (P6) antes del export — cerrando el
  loop entre P6 y P7 que hoy son dos piezas sin conectar.
- **FUTURE**: Quick Reel (P8) y Story Reel (P9) obtienen sus propios
  builders (`build_timeline_from_*`) que no dependen de una Composition
  producida. Cuando Assembly implemente Ken Burns/`FADE`/`DISSOLVE` reales,
  esos valores llegan a `Transform`/`Transition` vía un adapter nuevo, no
  reescribiendo estas entidades.
