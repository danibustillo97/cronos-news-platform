---
title: CRONOS - Story Reel
tags:
  - arquitectura
  - decision
  - timeline
---

# Story Reel (P9)

`backend/app/domain/timeline/story_reel.py` — `ManualShotSpec` +
`build_timeline_from_manual_shots`. El segundo builder real de Timeline
(P7), y el contraparte manual de Quick Reel (P8): en vez de derivar un
`Sequence` de una `Composition` ya producida por LAB, lo arma directo a
partir de shots que un editor curó a mano — ninguna llamada a LAB, ningún
estado de Story/Composition que verificar, ninguna capability de
Editorial/Narrative/Audio Direction involucrada.

## Qué es "Noris Viral" acá (y qué no)

El roadmap describe P9 como "secuencia manual tipo Noris Viral". "Noris
Viral" es uno de los valores de la enumeración `content_type` que pide el
spec de producto (`news | history | documentary | opinion | data | story |
social | Noris Viral`, ver el gap ya documentado en [[CRONOS - Domain
Language Alignment]] P2) — no hay, más allá de ese nombre, una spec
estructural propia de qué formato tiene un "Noris Viral". Este pase
implementa exactamente lo que el roadmap sí especifica sin ambigüedad —
"secuencia manual" — y no inventa reglas específicas de Noris que nadie
pidió todavía (mismo criterio YAGNI que dejó `content_type` sin resolver
en P2).

## Por qué no hay "eligibility gate" como en Quick Reel

Quick Reel necesita verificar `Story.status`/`Composition.status`/shots
`INCLUDED` porque deriva de algo que otro proceso (LAB, vía ProduceStory)
ya decidió — necesita confirmar que esa decisión terminó y fue aprobada.
Story Reel no deriva de nada: un humano elige cada shot a mano, así que no
existe un estado previo que verificar. Lo que sí se valida es estructural,
en `ManualShotSpec.__post_init__`:

- `shot_id` no vacío.
- `duration_seconds > 0`.
- `asset_refs` no vacío — un shot armado a mano sin ningún asset no tiene
  sentido (a diferencia de LAB, que sí puede declarar honestamente un shot
  `EXCLUDED_NO_ASSET` cuando su propio pipeline no encontró un asset real).
  Acá no existe ese caso legítimo: si el editor no tiene un asset para el
  shot, no lo agrega, punto — por eso `build_timeline_from_manual_shots`
  nunca produce un `TimelineShot` con disposition distinta de `INCLUDED`.

`scene_id` se hace igual a `shot_id` a propósito: no hay `MediaPlan.scenes`
detrás de un shot manual, así que inventar un `scene_id` separado sería
fabricar un concepto que no aplica acá.

## Qué NO valida (limitación real, no descuido)

`asset_refs` no se verifica contra ningún almacén real de Assets — el gap
de P3 sigue abierto (`AssetRepository` no tiene adaptor Supabase, ver
[[CRONOS - Domain Language Alignment]] y el roadmap P3): hoy no hay forma
de confirmar que un `asset_ref` apunta a algo que de verdad existe. Story
Reel valida lo único que puede validar sin esa pieza — que la lista no
esté vacía — y confía en que el caller (eventualmente una UI donde el
editor arrastra assets reales) le pase referencias reales.

## CURRENT / DESIGNED / FUTURE

- **CURRENT**: el builder existe, es puro (dataclasses + validación, sin
  I/O), testeado (`tests/domain/test_story_reel.py`). Igual que Quick Reel,
  **no hay caller todavía** — ninguna UI de "secuenciación manual" existe
  hoy en el Studio (el editor actual sigue siendo Canvas2D legado, ver
  [[CRONOS - Render Architecture Decision]]).
- **DESIGNED**: una UI de Story Reel construiría una lista de
  `ManualShotSpec` (un asset arrastrado + duración elegida por el editor)
  y llamaría a `build_timeline_from_manual_shots` para previsualizar el
  resultado antes de exportar — el mismo `Sequence` que consumiría Platform
  Preview (P10) y que Safe Area (P6) validaría antes del export real.
- **FUTURE**: si "Noris Viral" resulta tener reglas propias de verdad
  (plantilla de duración, número fijo de shots, transición obligatoria),
  se agregan como una validación adicional explícita cuando exista ese
  requerimiento — no antes.
