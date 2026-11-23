---
name: lab-narrative-direction
description: This skill should be used when the user asks to "plan the narrative direction for this story", "planifica la direccion narrativa de esta historia", "decide el arco emocional", "genera el narrative_direction.json", or runs `/lab-narrative-direction <story_id>` in the LAB local editorial lab (RPA_NEWS_SCRIPT repo). Reads a story's media_blueprint.json (Fase 3 scenes) and Fase 2 narrative artifacts, and produces narrative_direction.json — a declarative emotional arc by beat (emotion, intensity, pacing/motion/transition/music intention, silence, narration priority) referencing scene_id, never shot_id. Never decides literal shot order, motion type, transitions, audio files, or anything executable — that stays owned by Sequence/Animation/Render/Assembly.
---

Convierte la historia ya escrita (Fase 2) y las escenas ya resueltas visualmente (Fase 3) en un arco emocional declarativo: por beat, qué se siente y cómo evoluciona esa emoción a lo largo de la historia. No decide orden de shots, no decide movimiento literal, no decide transición literal, no decide audio real — el resultado es puro **intención editorial**, `narrative_direction.json`.

## Por qué existe esta capa, separada de `lab-editorial-narrative`

`lab-editorial-narrative` (Fase 2) ya decide **qué** cuenta la historia — hooks, guion, `scene_plan.json`. Esta skill decide algo distinto: **cómo debe sentirse** esa historia mientras se cuenta, y cómo esa sensación evoluciona (ej. `SUSPENSE → TRAGEDY → LOW_POINT → TURNING_POINT → HOPE → RISE → VICTORY` — un ejemplo, no una plantilla obligatoria: cada historia usa la evolución que le corresponde, no todas necesitan los mismos estados). Son dos pases de juicio distintos sobre la misma historia — nunca se fusionan, nunca uno reemplaza al otro. Si `lab-editorial-narrative` todavía no corrió para esta historia (sin `hooks.json`/`script.json`/`scene_plan.json`), esta skill puede igual razonar sobre lo que sí existe (`editorial_analysis.json`, `content_plan.json`), pero avisale al usuario que falta esa capa si la nota como relevante.

## Principio central: declarar intención, no ejecutar ni decidir valores literales

`narrative_direction.json` describe cómo *debería sentirse* cada tramo de la historia — nunca decide el `motion` literal de un shot, la `transition_in`/`transition_out` literal, ni un archivo de audio. Esas decisiones siguen siendo exclusivamente de Sequence/Animation/Render/Assembly, que en el futuro (no en esta etapa) podrán leer este artifact como una señal más de criterio.

## Granularidad: por `scene_id`, nunca por `shot_id`

Esta skill corre **antes** de Sequence — los `shot_id` todavía no existen (los crea Sequence). El arco emocional se declara sobre **beats**, cada uno con una lista de `scene_id` reales (de `media_blueprint.json`). Una escena pertenece a un solo beat — no se reparte entre dos tramos emocionales distintos.

## Pasos

1. Confirmar que la historia tiene `lab/workspace/media/<story_id>/media_blueprint.json` (Fase 3, con al menos un `scene_id`). Si falta, avisar al usuario y detenerse — no inventar escenas.
2. Leer la fuente de verdad de **qué escenas existen**: `media_blueprint.json` (`scene_id` de cada una).
3. Leer la fuente de verdad **narrativa** de Fase 2 (lo que exista): `lab/workspace/review/<story_id>/scene_plan.json`, `script.json`, `editorial_analysis.json`, `content_plan.json`, `hooks.json`. De ahí sale el criterio para decidir dónde cambia la emoción y cuál es.
4. Agrupar las escenas en **beats** ordenados (`order` 1..N sin huecos) — un beat puede cubrir una o varias escenas consecutivas que comparten la misma intención emocional. No fuerces una evolución emocional que la historia no tiene: una nota corta y estable (un solo beat, una sola `emotion`) es una salida tan válida como un arco de siete tramos.
5. Para cada beat, decidir (vocabulario cerrado — ver `lab/narrative/constants.py`):
   - `emotion` (`SUSPENSE`/`TENSION`/`TRAGEDY`/`LOW_POINT`/`TURNING_POINT`/`HOPE`/`RISE`/`VICTORY`/`NOSTALGIA`/`BITTERSWEET`/`CONFLICT`/`MIXED_FEELINGS`)
   - `emotional_intensity` (`LOW`/`MEDIUM`/`HIGH` — ordinal, nunca un número inventado)
   - `narrative_function` (`HOOK`/`RISING_ACTION`/`LOW_POINT`/`TURNING_POINT`/`CLIMAX`/`RESOLUTION`/`CLOSING`)
   - `pacing_intention` (`SLOW`/`MEDIUM`/`FAST`)
   - `visual_rhythm_intention` (`STEADY`/`ACCELERATING`/`DECELERATING`)
   - `motion_intensity_intention` (`SUBTLE`/`MODERATE`/`STRONG` — señal para un futuro Assembly, nunca un valor de FFmpeg)
   - `transition_intention` (`ABRUPT`/`SOFT`/`TIME_PASSING`/`NONE` — señal para Sequence, nunca el `transition_in`/`transition_out` literal)
   - `music_intention` (`SUSPENSEFUL`/`TENSE`/`DARK_EMOTIONAL`/`RISING`/`TRIUMPHANT`/`HOPEFUL`/`MELANCHOLIC`/`NEUTRAL` — mood, nunca un archivo ni un proveedor)
   - `silence_or_emphasis` (`NONE`/`SILENCE`/`EMPHASIS` — el silencio es una decisión narrativa explícita, no la ausencia de una)
   - `narration_priority` (booleano — si este tramo debería priorizar narración sobre música/SFX cuando exista Audio Direction)
   - `notes` (texto libre, opcional)
6. Escribir `narrative_direction.json` en `lab/workspace/media/<story_id>/narrative_direction.json` con `Write`, directo. Esquema completo con ejemplo: `docs/LAB_NARRATIVE_DIRECTION.md`.
7. Correr:
   ```
   lab/.venv/Scripts/python.exe -m lab.cli narrative-record <story_id>
   ```
   Valida referencias (`scene_id` reales, sin escenas repetidas entre beats), vocabulario cerrado en cada campo, y `order` consecutivo. Registra el job `narrative_direction`. Si devuelve errores, corregir `narrative_direction.json` y volver a correr — no ignorar los errores.
8. Reportar al usuario: cuántos beats, qué arco emocional resultó (lista de `emotion` en orden), cuántas escenas quedaron cubiertas. La dirección narrativa queda en `DRAFT` — no la marques lista para revisión vos mismo; eso lo hace el usuario vía `lab.cli narrative-review <story_id>` si lo pide.

## Qué NO hace esta skill

No decide `motion`, `transition_in`/`transition_out`, orden ni duración literal de ningún shot — eso sigue siendo de Sequence. No elige proveedor de música ni voz, no genera audio, no decide `music_cue` reales (eso es Audio Direction, capa separada, no implementada todavía). No ejecuta FFmpeg ni genera ningún archivo multimedia. No modifica `media_blueprint.json`, `asset_registry.json`, `sequence.json`, `animation_plan.json` ni `render_plan.json` — solo los lee (cuando corresponde). No reutiliza ni reemplaza `lab-editorial-narrative` — son dos skills separadas, con artifacts separados.
