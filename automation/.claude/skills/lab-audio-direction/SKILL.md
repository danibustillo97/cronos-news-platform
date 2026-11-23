---
name: lab-audio-direction
description: This skill should be used when the user asks to "plan the audio direction for this story", "planifica la direccion de audio de esta historia", "decide como debe sonar esta historia", "genera el audio_plan.json", or runs `/lab-audio-direction <story_id>` in the LAB local editorial lab (RPA_NEWS_SCRIPT repo). Reads a story's narrative_direction.json (emotional beats) and produces audio_plan.json — declarative NARRATION/MUSIC/SFX/AMBIENCE tracks per beat, silence windows, and the fixed mixing-priority rule. Never selects a provider, never downloads music, never runs TTS, never generates or edits any audio file, never runs FFmpeg, never does Assembly's job.
---

Convierte el arco emocional ya declarado por Narrative Direction en una dirección de audio declarativa: por beat, qué capas de audio hacen falta (narración, música, efectos, ambiente), dónde el silencio es una decisión deliberada, y con qué prioridad se mezclarían esas capas entre sí. El resultado es puro **intención sonora**, `audio_plan.json` — nunca un archivo de audio, nunca un proveedor, nunca una ejecución.

## Por qué existe esta capa, separada de `lab-narrative-direction` y de `lab-editorial-narrative`

`lab-editorial-narrative` (Fase 2) decide **qué** cuenta la historia. `lab-narrative-direction` decide **cómo debe sentirse** esa historia y cómo evoluciona esa emoción, por beat. Esta skill decide algo distinto todavía: **cómo debe sonar** esa evolución — no la reemplaza, no la duplica, la *lee* (solo lectura) y responde a ella. La relación es de una sola vía: Narrative Direction → Audio Direction → una futura ejecución sonora (no implementada). Nunca al revés — Audio Direction no puede alterar el arco emocional que ya se declaró.

## Principio central: dirección, no ejecución

Ejemplos de lo que esta skill SÍ hace (declarar intención) vs. lo que NO hace (ejecutar):

| Sí (esta skill) | No (etapa futura, fuera de esta skill) |
|---|---|
| `"role": "MUSIC"`, beat con tensión creciente | Descargar o generar un archivo `.mp3` |
| `"role": "NARRATION"`, prioridad alta | Ejecutar TTS con un proveedor |
| `"treatment": "MUSIC_DUCK"` en un beat con énfasis | `ffmpeg -af volume=... -ss 8.2 -to 9.1` |

## Granularidad: por `beat_id` de Narrative Direction, nunca por `scene_id` ni `shot_id`

Esta skill corre **sobre** `narrative_direction.json`, no sobre `sequence.json` — todavía no existe ninguna secuencia de shots en este punto del pipeline (Audio Direction es independiente de en qué orden temporal termine ejecutándose; eso es trabajo de Sequence/Animation/Render/Assembly). Cada track y cada ventana de silencio referencia un `beat_id` real — nunca inventa uno, nunca referencia `scene_id`/`shot_id` directamente.

## Pasos

1. Confirmar que la historia tiene `lab/workspace/media/<story_id>/narrative_direction.json`. Si falta, avisar al usuario y sugerir `/lab-narrative-direction <story_id>` primero — no inventar un arco emocional.
2. Leer `narrative_direction.json` completo: cada beat con su `emotion`, `emotional_intensity`, `music_intention`, `silence_or_emphasis`, `narration_priority`. Esa es la única fuente de verdad de intención emocional — no se reinterpreta ni se contradice.
3. Para cada beat, decidir qué **tracks** hacen falta (0 o más — un beat puede no necesitar ninguna capa nueva, o puede necesitar varias a la vez):
   - `role` (`NARRATION`/`MUSIC`/`SFX`/`AMBIENCE` — vocabulario cerrado, ver `lab/audio/constants.py`)
   - `beat_id` (el beat real al que pertenece)
   - `fade_in`/`fade_out` (`NONE`/`SOFT`/`HARD`)
   - `notes` (texto libre, opcional)
   
   **Obligatorio**: todo beat con `narration_priority: true` en `narrative_direction.json` necesita al menos un track `NARRATION` que lo cubra — no puede quedar sin dirección de audio si Narrative Direction ya pidió que la narración tenga prioridad ahí.
   
   No repitas el mismo `role` dos veces para el mismo `beat_id` — es ambiguo, `validate_audio_plan()` lo rechaza.
4. Para cada beat con `silence_or_emphasis` distinto de `NONE`, decidir si hace falta una **silence_window**:
   - **Obligatorio** cuando `silence_or_emphasis: "SILENCE"` — ese beat necesita una ventana de silencio declarada, con `treatment` (`FULL_SILENCE`/`AMBIENCE_ONLY`/`MUSIC_DUCK`) explicando cómo se manifestaría.
   - Opcional cuando `silence_or_emphasis: "EMPHASIS"` — puede sostener música/ambiente de fondo sin necesitar una ventana propia.
   - Nunca declares una `silence_window` sobre un beat con `silence_or_emphasis: "NONE"` — `validate_audio_plan()` lo rechaza como inconsistente.
5. `ducking_rules` — no la reinventes: es fija por diseño, `NARRATION > SFX > MUSIC > AMBIENCE`. `lab.audio.planner.default_ducking_rules()` ya la genera; no hace falta escribirla a mano.
6. Escribir `audio_plan.json` en `lab/workspace/media/<story_id>/audio_plan.json` con `Write`, directo. Esquema completo con ejemplo: `docs/LAB_AUDIO_DIRECTION.md`.
7. Correr:
   ```
   lab/.venv/Scripts/python.exe -m lab.cli audio-record <story_id>
   ```
   Valida referencias (`beat_id` reales, sin duplicados de `role`+`beat_id`), vocabulario cerrado, consistencia de `silence_windows` contra `silence_or_emphasis`, cobertura obligatoria (narración prioritaria, silencios declarados), y la regla fija de `ducking_rules`. Registra el job `audio_direction`. Si devuelve errores, corregir `audio_plan.json` y volver a correr — no ignorar los errores.
8. Reportar al usuario: cuántos tracks por `role`, cuántas ventanas de silencio, y que la dirección de audio quedó en `DRAFT` — no la marques lista para revisión vos mismo; eso lo hace el usuario vía `lab.cli audio-review <story_id>` si lo pide.

## Qué NO hace esta skill

No elige proveedor de música ni de voz. No descarga música. No genera ni ejecuta TTS. No genera SFX reales. No genera ni edita ningún archivo de audio. No ejecuta FFmpeg. No hace mezcla real ni ducking ejecutable ni fades ejecutables — solo los declara como intención. No hace el trabajo de Assembly (componer/ejecutar el resultado final). No modifica `narrative_direction.json`, `sequence.json`, `animation_plan.json`, `render_plan.json`, `media_blueprint.json` ni `asset_registry.json` — solo lee `narrative_direction.json`. No reutiliza ni reemplaza `lab-narrative-direction` ni `lab-editorial-narrative` — son tres skills separadas, con artifacts separados.
