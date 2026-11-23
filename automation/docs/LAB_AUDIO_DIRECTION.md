---
title: LAB -- Audio Direction
status: implementada (dirección/planificación, sin generación ni ejecución todavía)
date: 2026-09-11
---

# Audio Direction

Capa nueva que consume Narrative Direction. Responde *"¿cómo debe sonar la evolución emocional de la historia?"* — distinto de `lab-narrative-direction` (*"¿cómo debe sentirse?"*) y de `lab-editorial-narrative` (*"¿qué historia estamos contando?"*). Diseño original: `obsidian-vault/CRONOS - Narrative & Audio Direction.md` (repo `cronos-news-platform`) — este documento es la versión técnica de ese diseño ya aprobado.

## Principio central: dirección, no ejecución

`audio_plan.json` declara qué capas de audio harían falta y dónde — nunca genera, descarga, ni ejecuta nada. `"Music: tensión creciente en beat_03"` es una decisión válida de esta capa; `"descargar X.mp3"` o `"ffmpeg -af volume=..."` no lo son — eso pertenece a una etapa de ejecución futura, no implementada.

## Arquitectura

```
narrative_direction.json (beats: emotion, silence_or_emphasis, narration_priority, music_intention...)
                              |
                skill: lab-audio-direction
       (por beat, decide que tracks NARRATION/MUSIC/SFX/
        AMBIENCE hacen falta + silence_windows donde el
        silencio ya es intencion declarada -- lee, nunca
        reinterpreta el arco emocional)
                              | escribe con Write
                              v
        lab/workspace/media/<story_id>/audio_plan.json
                              |
                  lab.cli audio-record <story_id>
        (valida referencias + vocabulario + cobertura
         obligatoria + prioridad de mezcla fija, registra
         el job audio_direction)
                              v
                 audio_plan.json validado, status: DRAFT
                              |
                  lab.cli audio-review <story_id>   (opcional)
                              v
                        status: READY_FOR_REVIEW
```

## Granularidad: por `beat_id`, nunca por `scene_id` ni `shot_id`

Audio Direction trabaja al mismo nivel narrativo/emocional que Narrative Direction — no al nivel de ejecución temporal de Sequence/Animation/Render. Cada `track` y cada `silence_window` referencia un `beat_id` real de `narrative_direction.json`.

## Modelo de `audio_plan.json`

```json
{
  "audio_plan_id": "audio_001",
  "narrative_direction_id": "narrative_001",
  "story_id": "793ff158b714",
  "status": "DRAFT",
  "tracks": [
    {
      "track_id": "track_01",
      "role": "MUSIC",
      "beat_id": "beat_01",
      "fade_in": "SOFT",
      "fade_out": "NONE",
      "notes": ""
    },
    {
      "track_id": "track_02",
      "role": "NARRATION",
      "beat_id": "beat_01",
      "fade_in": "NONE",
      "fade_out": "NONE",
      "notes": ""
    }
  ],
  "silence_windows": [
    {
      "silence_id": "silence_01",
      "beat_id": "beat_03",
      "treatment": "MUSIC_DUCK",
      "notes": "Énfasis antes del punto de giro"
    }
  ],
  "ducking_rules": {"priority_order": ["NARRATION", "SFX", "MUSIC", "AMBIENCE"]},
  "created_at": "2026-09-11T..."
}
```

No contiene archivos, URLs ni nombres de proveedor en ningún campo.

## Vocabulario

`lab/audio/constants.py` fija el vocabulario cerrado. `AUDIO_ROLES` y `DUCKING_PRIORITY_ORDER` vienen directo del diseño aprobado (*"Capas independientes por role: NARRATION/MUSIC/SFX/AMBIENCE"* y *"ducking_rules (prioridad fija: NARRATION > SFX > MUSIC > AMBIENCE)"*). `FADE_TYPES` y `SILENCE_TREATMENTS` no llegaron enumerados desde ese documento (solo se nombraban los conceptos "Fades"/`silence_windows`) — se fijan acá como decisión de esta implementación, mismo criterio ya aplicado en `lab.narrative.constants` para sus propios vocabularios no enumerados.

## Reglas de validación (`validate_audio_plan(story_id)`)

No lanza — devuelve una lista de errores (vacía si es válida):

1. `narrative_direction_id` del plan debe coincidir con el de `narrative_direction.json` real de la historia.
2. Cada `beat_id` referenciado (en `tracks` o `silence_windows`) debe existir en `narrative_direction.json`.
3. `role`, `fade_in`, `fade_out`, `treatment` deben ser valores del vocabulario cerrado correspondiente.
4. Sin `track_id`/`silence_id` repetidos.
5. No puede haber dos tracks con el mismo `role` para el mismo `beat_id` (ambiguo).
6. Una `silence_window` solo puede referenciar un beat cuyo `silence_or_emphasis` (en `narrative_direction.json`) sea distinto de `"NONE"` — consistencia con lo que Narrative Direction ya declaró.
7. **Cobertura obligatoria**: todo beat con `silence_or_emphasis: "SILENCE"` debe tener al menos una `silence_window`; todo beat con `narration_priority: true` debe tener al menos un track `NARRATION` — no pueden quedar sin dirección de audio si Narrative Direction ya pidió esa intención ahí. (`EMPHASIS` es más débil, no obliga una `silence_window`.)
8. `ducking_rules.priority_order` debe ser exactamente `["NARRATION", "SFX", "MUSIC", "AMBIENCE"]` — nunca se re-decide por historia.
9. Estructural: `lab/audio/` nunca importa funciones de escritura de `lab.narrative.planner`/`lab.sequence.planner`/`lab.animation.planner`/`lab.render.planner`/`lab.media.registry`, y su único `write_text` es hacia `audio_plan.json`.

## Aislamiento

`lab/audio/` **lee** `narrative_direction.json` (`lab.narrative.planner.load`, solo lectura) — nunca lo escribe, tampoco ningún otro artifact existente. No depende de Assembly, Learning, Production, Supabase ni de ningún provider externo (Gemini/Cloudflare/TTS/música) — cero imports hacia esos.

## Qué falta (fuera de esta etapa)

Selección de proveedor de música/voz, descarga de música, generación de TTS, generación de SFX reales, cualquier archivo de audio real, mezcla/ducking/fades ejecutables (FFmpeg), y la integración de Assembly leyendo `audio_plan.json` (queda referenciado conceptualmente en el diseño de Assembly — `audio_plan_id` — pero Assembly sigue sin implementar).
