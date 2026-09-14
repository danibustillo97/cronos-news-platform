---
title: CRONOS — Narrative & Audio Direction
tags:
  - arquitectura
  - cronos
  - lab
  - diseño
status: diseñado, no implementado — Assembly pausado hasta aprobar esto
---

# 🎭 CRONOS — Narrative & Audio Direction

Capa nueva, propuesta entre Media Intelligence (Fase 3) y Sequence (Fase 4.1) de [[LAB - Local Editorial Lab]]. Objetivo: que CRONOS no arme un slideshow de imágenes, sino contenido con arco emocional deliberado (tragedia, suspenso, victoria, caída→recuperación→éxito...) que **evoluciona** durante la historia, y que esa evolución se traduzca en decisiones audiovisuales reales.

> [!warning] Estado
> Solo diseño. No hay código, no hay artifacts nuevos escritos, no hay skills nuevas. La implementación de [[CRONOS - Assembly]] queda pausada hasta aprobar esta capa, porque Assembly necesita sus referencias.

## Qué decide cada capa (sin duplicar responsabilidades)

| Capa | Pregunta que responde | Dónde vive |
|---|---|---|
| Editorial Intelligence (Fase 2) | ¿Qué historia estamos contando? (hechos, ángulo, guion) | `lab/editorial/` |
| **Narrative Direction (nueva)** | **¿Cómo debe sentirse, y cómo evoluciona esa emoción?** | `lab/narrative/` (propuesto) |
| **Audio Direction (nueva)** | **¿Cómo debe sonar esa evolución?** | `lab/audio_direction/` (propuesto) |
| Sequence (4.1) | ¿En qué orden y duración se presentan los shots? | `lab/sequence/` |
| Animation (4.2.1/2) | ¿Qué movimiento necesita cada shot? | `lab/animation/` |
| Render (4.2.3/4) | ¿Cómo se materializa físicamente (geometría, píxeles)? | `lab/render/` |
| Assembly (pausado) | ¿Cómo se compone/ejecuta el resultado final? | `lab/assembly/` (propuesto) |

Regla general: Narrative/Audio Direction **declaran intención editorial** (una emoción, una intensidad, un "esto debería sentirse abrupto"). Las capas mecánicas (Sequence, Animation, Render) siguen siendo las **únicas dueñas** de sus valores literales (`transition_in`, `motion.type`, píxeles) — leen la intención como una señal más de criterio, nunca la copian ni la reemplazan. Ninguna de las dos capas nuevas escribe en `sequence.json`, `animation_plan.json`, `render_plan.json` ni `asset_registry.json`.

## Decisión de diseño clave: granularidad por `scene_id`, no por `shot_id`

Narrative Direction corre **antes** de Sequence — y los `shot_id` todavía no existen en ese punto (los crea Sequence). Por eso el arco emocional se declara sobre **beats** que referencian `scene_id` (ya conocido desde Fase 2/3), no `shot_id`. Como `scene_id` se preserva intacto en `SequenceShot` → `AnimationShot` → `RenderShot` (verificado en el código real), cualquier etapa futura (Assembly, Audio Direction) puede reconstruir a qué beat emocional pertenece un shot con un simple *join* por `scene_id` — **cero cambios de schema** en los tres artifacts existentes.

## `narrative_direction.json` (nuevo artifact — boceto conceptual)

Por beat (no por shot): `emotion` (vocabulario cerrado: `SUSPENSE`/`TENSION`/`TRAGEDY`/`LOW_POINT`/`TURNING_POINT`/`HOPE`/`RISE`/`VICTORY`/`NOSTALGIA`/`BITTERSWEET`/...), `emotional_intensity` (ordinal `LOW`/`MEDIUM`/`HIGH`, no un float inventado), `narrative_function`, `pacing_intention`, `visual_rhythm_intention`, `motion_intensity_intention`, `transition_intention`, `music_intention`, `silence_or_emphasis`, `narration_priority` — todos como **intención**, nunca como valor ejecutable.

## `audio_plan.json` (nuevo artifact, separado — no fusionado con Narrative Direction)

Lee `narrative_direction.json` (solo lectura, mismo patrón que Animation lee Sequence). Capas independientes por `role`: `NARRATION` / `MUSIC` / `SFX` / `AMBIENCE`. Cada `music_cue` referencia un `beat_id` (no un archivo — **no se elige proveedor ni se descarga música todavía**). Incluye `silence_windows` (silencio como decisión narrativa explícita, no como ausencia de dato) y `ducking_rules` (prioridad fija: `NARRATION > SFX > MUSIC > AMBIENCE`).

Separados en dos artifacts (no uno) porque: Sequence/Animation solo necesitan Narrative Direction (nunca Audio), Audio Direction necesita su propio ciclo de vida/skill/versión independiente, y mantiene el patrón ya usado en todo LAB (un artifact, una responsabilidad, un módulo).

## Relación con Assembly

`assembly_plan.json` gana dos referencias de solo-lectura (`narrative_direction_id`, `audio_plan_id`), mismo patrón que ya tiene con `render_plan_id`/`animation_plan_id` — **no** duplica su contenido. Dos piezas del diseño de Assembly quedan resueltas por esto:

- El punto abierto de **Ken Burns** (qué magnitud de zoom/pan usar) deja de ser una constante global inventada — pasa a resolverse por `motion_intensity_intention` del beat correspondiente.
- El **audio** deja de ser una sola pista de fondo plana — pasa a ser multi-capa, con cue points por beat, ducking y silencios explícitos.

## Explícitamente fuera de esta etapa

No se elige proveedor de música/voz, no se descarga nada, no se genera narración (TTS — nota: Production ya tiene `edge-tts-universal`, ver [[Stack Técnico]], pero es de otro universo y no se reutiliza todavía), no se modifica ninguna skill existente para que lea estos artifacts (eso es integración futura), no se toca `lab/sequence/`, `lab/animation/`, `lab/render/`.

## CURRENT / DESIGNED / FUTURE

- **CURRENT**: nada de esto existe en código.
- **DESIGNED**: este documento — artifacts, módulos, responsabilidades, granularidad por `scene_id`.
- **FUTURE**: skills (`lab-narrative-direction`, `lab-audio-direction`), integración de Sequence/Animation/Assembly leyendo estos artifacts, providers de música/voz.
