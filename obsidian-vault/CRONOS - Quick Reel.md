---
title: CRONOS - Quick Reel
tags:
  - arquitectura
  - decision
  - timeline
---

# Quick Reel (P8)

`backend/app/application/use_cases/quick_reel.py` — el primer caller real
de Timeline (P7). Toma una `Composition` ya producida y aprobada y arma un
`Sequence` con sus shots existentes, vía `build_timeline_from_composition`
(el mismo builder que P7 dejó documentado como "el único real hoy"). Cero
llamadas a LAB, cero razonamiento de Editorial/Narrative/Audio Direction —
ese es literalmente el punto de "Quick": nunca le vuelve a pedir nada a la
IA, solo re-organiza lo que ya existe.

## Qué significa "POST READY" en la práctica

El ítem del roadmap dice "POST READY + assets existentes + reglas
deterministas, sin IA". Traducido con el mapeo de [[CRONOS - Domain
Language Alignment]] (READY = `Story.status = PRODUCED`, y "para una pieza
concreta", `Composition.status = APPROVED`), Quick Reel exige ambas cosas
antes de tocar nada:

1. **`Story.status == PRODUCED`** — el POST completo está listo, no solo
   una pieza suelta.
2. **`Composition.status == APPROVED`** — la pieza específica que se va a
   convertir en reel pasó revisión editorial (`ReviewComposition`, ya
   implementado).
3. **Al menos un shot `INCLUDED`** — "assets existentes" reales, no
   `asset_refs` vacíos. Un composition con todos los shots
   `EXCLUDED_NO_ASSET`/`BLOCKED_NOT_RENDERED` no tiene nada que ensamblar;
   Quick Reel lo rechaza en vez de fabricar un placeholder (mismo criterio
   de exclusión que Assembly y que `build_timeline_from_composition` ya
   respetan).

Las tres reglas son deterministas y verificables sin IA — de ahí "sin IA"
en el nombre del ítem del roadmap: no es que Quick Reel podría usar IA y
elige no hacerlo, es que la elegibilidad entera es lógica de estado
(enums + un `any()` sobre shots), no juicio editorial.

## `QuickReelNotEligible`: un error nuevo, no reutilizar los que ya había

Ninguno de los errores existentes encajaba: no es un estado inválido de la
propia entidad (`InvalidStateTransition` es para transiciones que la
entidad rechaza sobre sí misma, no para una regla de un use case sobre dos
entidades relacionadas), no es un 404 (`NotFoundError`), y no es un gap de
LAB (`CapabilityUnavailableError` es específicamente para capacidades de
LAB no producidas todavía). Se agregó `QuickReelNotEligible` en
`app/domain/shared/errors.py` con el mismo patrón de `reason` discriminador
que `CapabilityUnavailableError` ya usa (`story_not_ready` /
`composition_not_approved` / `no_includable_shots`) — nunca un mensaje
genérico que oculte cuál de las tres reglas falló.

## CURRENT / DESIGNED / FUTURE

- **CURRENT**: el use case existe, está testeado con dobles en memoria
  (`tests/application/test_quick_reel.py`, mismo patrón que
  `test_produce_story.py`), y es el primer llamador real de
  `build_timeline_from_composition` — cierra parte del gap que P7 dejó
  anotado. **No está enchufado a `container.py` ni expuesto por ningún
  endpoint todavía** — mismo patrón de gap a propósito que P3/P6/P7: no
  existe hoy una UI que necesite invocarlo (el Studio del frontend sigue
  siendo el editor Canvas2D legado, ver [[CRONOS - Render Architecture
  Decision]]), así que diseñar un DTO de `Sequence` para HTTP ahora sería
  adivinar forma de respuesta sin un consumidor real.
- **DESIGNED**: cuando exista una superficie que lo consuma (endpoint +
  `SequenceOut`/`TrackOut`/`TimelineShotOut`, o directamente una pantalla
  de "Quick Reel" en el Studio), se registra un
  `@app.exception_handler(QuickReelNotEligible)` (422, con `reason` en el
  body) igual que ya existe para `NotFoundError`/`InvalidStateTransition`
  en `error_handlers.py`.
- **FUTURE**: si Quick Reel necesita elegir automáticamente QUÉ
  Composition de una Story usar (hoy el caller decide `composition_id`),
  esa es una regla nueva a añadir explícitamente, no algo a inferir hoy sin
  caso de uso real.
