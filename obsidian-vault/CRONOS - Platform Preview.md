---
title: CRONOS - Platform Preview
tags:
  - arquitectura
  - decision
  - timeline
  - distribution
---

# Platform Preview (P10)

`backend/app/application/use_cases/platform_preview.py` — `GetPlatformPreview`.
Cierra el loop entre las tres piezas que quedaron sueltas hasta ahora:
Safe Area (P6) tenía `validate_elements` sin caller, Timeline (P7) tenía
`build_timeline_from_composition` sin caller, y el roadmap pedía
explícitamente que el preview "consuma la misma Composition +
DistributionProfile que el render" — no un modelo paralelo inventado solo
para previsualizar.

## Qué hace, literalmente

Dada una `Composition` + un `(platform, format)`:

1. Busca la `Composition` (`CompositionRepository`, ya existía).
2. Resuelve el `DistributionProfile` real vía `get_profile(platform, format)`
   (P6) — el mismo que usaría un export gate el día que exista.
3. Arma el `Sequence` real vía `build_timeline_from_composition` (P7) — el
   mismo que usaría Quick Reel (P8).
4. Devuelve ambos juntos en `PlatformPreview(sequence, profile)`.

Ningún dato nuevo, ninguna lógica de negocio nueva — es puro ensamblado de
dos piezas que ya existían y ya estaban testeadas por separado.

## Por qué NO calcula violaciones de Safe Area todavía

Era la pregunta obvia: si ya tengo el `Sequence` y el `DistributionProfile`
en el mismo lugar, ¿por qué no llamar a `validate_elements` acá mismo y
devolver también las violaciones?

Porque `validate_elements` necesita el rect en pantalla de cada **elemento
de overlay** (subtítulo, CTA, logo) — no el rect del shot de video en sí.
Un video full-bleed está *pensado* para llenar todo el canvas; Safe Area
existe para proteger overlays que se dibujan encima, no el video de fondo.
Nada en este workspace posiciona overlays todavía: el track `TEXT` de
Timeline está modelado pero vacío (ver [[CRONOS - Timeline Core]]), y no
hay ningún artifact real con coordenadas de subtítulo/CTA/logo. Calcular
"violaciones" contra el rect del shot de video sería o bien siempre-verde
(el rect cubre todo el canvas, "excede" el safe area por diseño, dato sin
valor) o inventado. Se deja para cuando exista esa pieza real — mismo
criterio de todo el roadmap.

## Por qué `PlatformPreview` no vive en `app/domain/`

Es un resultado de ensamblado de dos entidades de dos bounded contexts
distintos (`timeline.Sequence`, `distribution.DistributionProfile`) más una
búsqueda por repositorio — no tiene invariantes propias que proteger (no
hay un método que pueda romper su consistencia), así que no es una entidad
de dominio. Vive junto al use case en
`app/application/use_cases/platform_preview.py`, mismo patrón que
`PrepareDistributionInput` vive junto a `PrepareDistribution`.

## CURRENT / DESIGNED / FUTURE

- **CURRENT**: `GetPlatformPreview` existe, testeado con dobles en memoria
  (`tests/application/test_platform_preview.py`). Reutiliza errores ya
  existentes (`NotFoundError`, tanto para Composition inexistente como
  para un `(platform, format)` sin perfil de Safe Area, p.ej.
  `WEB/ARTICLE`) en vez de inventar un tipo de error nuevo para algo que
  sigue siendo, conceptualmente, "no encontrado". **Sin caller todavía** —
  mismo patrón de gap a propósito que P3/P6/P7/P8/P9: no hay UI de preview
  en el Studio (sigue siendo el editor Canvas2D legado).
- **DESIGNED**: una UI de preview dibuja el canvas del `DistributionProfile`
  (dimensiones + `safe_area` + `ui_zones`, ya expuestos por P6) y encima
  reproduce/escrubbea el `Sequence` (shots + timing, ya expuestos por P7) —
  el usuario ve exactamente qué va a exportar, con las guías de safe area
  reales superpuestas.
- **FUTURE**: cuando exista un compositor que posicione overlays de verdad
  (subtítulos/CTA/logo con coordenadas reales, no solo texto plano en
  `CompositionContent.hook`/`script`), `GetPlatformPreview` puede empezar a
  llamar también a `validate_elements` y devolver violaciones junto con el
  preview — no antes, para no fabricar un resultado de validación sin datos
  reales detrás.
