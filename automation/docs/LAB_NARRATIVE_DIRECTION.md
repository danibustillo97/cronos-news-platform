---
title: LAB -- Narrative Direction
status: implementada (planificación, sin integración con Sequence/Animation/Assembly todavía)
date: 2026-09-11
---

# Narrative Direction

Capa nueva entre Media Intelligence (Fase 3) y Sequence (Fase 4.1). Responde *"¿cómo debe sentirse la historia mientras se cuenta, y cómo evoluciona esa emoción?"* — distinto de `lab-editorial-narrative` (Fase 2), que responde *"¿qué historia estamos contando?"*. Diseño original: `obsidian-vault/CRONOS - Narrative & Audio Direction.md` (repo `cronos-news-platform`) — este documento es la versión técnica de ese diseño ya aprobado, no una nueva especificación.

## Principio central: declarar intención, no ejecutar ni decidir valores literales

`narrative_direction.json` describe cómo *debería sentirse* cada tramo de la historia (`emotion`, `pacing_intention`, `motion_intensity_intention`, `transition_intention`, `music_intention`...) — nunca decide el `motion` literal de un shot, la `transition_in`/`transition_out` literal, ni ningún valor ejecutable. Sequence, Animation, Render y (a futuro) Assembly siguen siendo las únicas dueñas de sus valores literales; pueden leer este artifact como una señal más de criterio, pero no en esta etapa (esa integración queda fuera de este trabajo, ver "Qué falta").

## Arquitectura

```
media_blueprint.json (Fase 3, scene_id reales)     Artifacts narrativos (Fase 2)
   |                                                    |
   '-------------------------+--------------------------'
                              v
                skill: lab-narrative-direction
        (agrupa escenas en beats + decide emotion/
         intensity/pacing/rhythm/motion/transition/
         music intention/silence/narration_priority
         por beat -- un pase de juicio distinto del
         de lab-editorial-narrative, nunca lo reemplaza)
                              | escribe con Write
                              v
     lab/workspace/media/<story_id>/narrative_direction.json
                              |
                  lab.cli narrative-record <story_id>
        (valida referencias + vocabulario + registra job
         narrative_direction)
                              v
                narrative_direction.json validado, status: DRAFT
                              |
                  lab.cli narrative-review <story_id>   (opcional)
                              v
                        status: READY_FOR_REVIEW
```

## Granularidad: por `scene_id`, nunca por `shot_id`

Narrative Direction corre **antes** de Sequence — los `shot_id` no existen todavía (los crea Sequence). El arco emocional se declara sobre **beats**, cada uno con una lista de `scene_id` reales de `media_blueprint.json`. Como `scene_id` se preserva intacto en `SequenceShot`/`AnimationShot`/`RenderShot`, cualquier etapa futura puede reconstruir a qué beat pertenece un shot con un simple *join* por `scene_id` — **cero cambios de schema** en `sequence.json`, `animation_plan.json` ni `render_plan.json`.

## Modelo de `narrative_direction.json`

```json
{
  "narrative_direction_id": "narrative_001",
  "story_id": "793ff158b714",
  "status": "DRAFT",
  "beats": [
    {
      "beat_id": "beat_01",
      "order": 1,
      "scene_ids": ["scene_01"],
      "emotion": "SUSPENSE",
      "emotional_intensity": "MEDIUM",
      "narrative_function": "HOOK",
      "pacing_intention": "MEDIUM",
      "visual_rhythm_intention": "STEADY",
      "motion_intensity_intention": "SUBTLE",
      "transition_intention": "SOFT",
      "music_intention": "SUSPENSEFUL",
      "silence_or_emphasis": "NONE",
      "narration_priority": true,
      "notes": ""
    }
  ],
  "created_at": "2026-09-11T..."
}
```

## Vocabulario

`lab/narrative/constants.py` fija el vocabulario cerrado. `EMOTIONS` e `INTENSITY_LEVELS` vienen directo del diseño aprobado en el Vault. El resto (`NARRATIVE_FUNCTIONS`, `PACING_INTENTIONS`, `VISUAL_RHYTHM_INTENTIONS`, `MOTION_INTENSITY_INTENTIONS`, `TRANSITION_INTENTIONS`, `MUSIC_INTENTIONS`, `SILENCE_OR_EMPHASIS_VALUES`) no llegó enumerado desde ese documento (solo se nombraban los campos) — se fija acá como decisión de esta implementación, mismo criterio ya usado en `TRANSITION_TYPES` de `lab.sequence.constants` ("el brief solo menciona FADE y CUT como ejemplos; este set es una decisión de diseño razonable, extensible sin romper el esquema").

## Reglas de validación (`validate_narrative_direction(story_id)`)

No lanza — devuelve una lista de errores (vacía si es válida):

1. Cada `scene_id` referenciado debe existir en `media_blueprint.json` de la historia.
2. Una escena no puede pertenecer a dos beats distintos (sin duplicados entre beats).
3. `emotion`, `emotional_intensity`, `narrative_function`, `pacing_intention`, `visual_rhythm_intention`, `motion_intensity_intention`, `transition_intention`, `music_intention`, `silence_or_emphasis` deben ser valores del vocabulario cerrado correspondiente.
4. `narration_priority` debe ser booleano.
5. `scene_ids` no puede estar vacío en ningún beat.
6. `order` de los beats debe ser 1..N sin huecos ni repetidos.
7. Estructural: `lab/narrative/` nunca importa funciones de escritura de `lab.sequence.planner`/`lab.animation.planner`/`lab.render.planner`/`lab.media.registry`, y su único `write_text` es hacia `narrative_direction.json` — nunca toca `media_blueprint.json`, `asset_registry.json`, `sequence.json`, `animation_plan.json` ni `render_plan.json`.

## Aislamiento

`lab/narrative/` **lee** `media_blueprint.json` (`lab.media.blueprint.load`, solo lectura) — nunca lo escribe, tampoco ningún otro artifact existente. No depende de Audio Direction, Assembly, Learning, Production, Supabase ni de ningún provider externo (Gemini/Cloudflare) — cero imports hacia esos.

## Qué falta (fuera de esta etapa)

Integración real de Sequence/Animation/Assembly leyendo `narrative_direction.json` como señal de criterio (no implementada — las skills de esas etapas siguen exactamente igual que antes), Audio Direction (`audio_plan.json`, capa separada), y todo lo que dependía de esta capa en el diseño de Assembly (magnitud de Ken Burns vía `motion_intensity_intention`, audio multi-capa).
