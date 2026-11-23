---
title: LAB -- Assembly
status: implementada (v1 -- CUT/STATIC solamente, sin audio real)
date: 2026-09-11
---

# Assembly

Última etapa de Fase 4.2. Convierte los shots ya renderizados individualmente (`videos/rendered/*.mp4`, Fase 4.2.5) en un único `videos/final/final_reel.mp4`. Diseño original: `obsidian-vault/CRONOS - Assembly.md` (repo `cronos-news-platform`) — este documento es la versión técnica de ese diseño ya aprobado, retomado tras implementar Narrative/Audio Direction.

## Principio central: ejecuta, no decide

Assembly no vuelve a tomar ninguna decisión editorial — ni qué historia contar, ni qué emoción usar, ni qué música elegir, ni qué asset generar, ni cómo animar, ni cómo renderizar. Todo eso ya lo decidieron Editorial, Media Intelligence, Narrative Direction, Audio Direction, Sequence, Animation y Render. Assembly solo compone/ejecuta lo que ya está decidido.

## Arquitectura

```
render_plan.json (status real por shot)   animation_plan.json (motion.type, transition_in/out)
              |                                          |
              '-------------------+------------------------'
                                   v
                     lab.assembly.planner.init_assembly_plan()
     (clasifica cada shot: INCLUDED/EXCLUDED_NO_ASSET/BLOCKED_NOT_RENDERED
      -- 100% mecánico, sobre datos ya reales, sin criterio editorial)
                                   |
              narrative_direction.json / audio_plan.json (opcionales,
              solo referencia por id -- lab.narrative.planner / lab.audio.planner)
                                   v
        lab/workspace/media/<story_id>/assembly_plan.json (status: DRAFT)
                                   |
                    lab.cli assembly-plan <story_id>
             (valida + registra job assembly_plan)
                                   |
                    lab.cli assembly-review <story_id>   (opcional)
                                   v
                             status: READY_FOR_REVIEW
                                   |
                    lab.cli assembly-execute <story_id>
     (lab.assembly.assembler -- FFmpeg real: concat demuxer sobre los
      clips YA renderizados de los shots INCLUDED, sin audio)
                                   v
        lab/workspace/media/<story_id>/videos/final/final_reel.mp4
```

`lab/assembly/` no tiene skill de criterio para `init_assembly_plan()` (mismo motivo que Animation/Render: la clasificación y las reglas de downgrade son matemática sobre datos ya reales, no juicio editorial) — la skill `lab-assembly` es un front-door de orquestación/reporte, mismo patrón que `lab-render-planning`. `assembly-execute` no tiene skill propia (ejecución 100% determinista, mismo criterio que `render-execute`).

## Reglas de inclusión

| Estado real en `render_plan.json` | `disposition` |
|---|---|
| `asset_id` real, `status: DONE` | `INCLUDED` |
| `asset_id: null` (texto-only) | `EXCLUDED_NO_ASSET` |
| `asset_id` real, `status: PENDING`/`FAILED` | `BLOCKED_NOT_RENDERED` |

`classify_disposition()` (`lab/assembly/planner.py`) es pura, sin I/O. `BLOCKED_NOT_RENDERED` nunca se convierte en una exclusión silenciosa — `disposition_reason` siempre explica qué falta.

## Transiciones (v1)

`resolve_transition_execution()`: solo `CUT` se ejecuta (gratis con el demuxer `concat`). `NONE`/`CUT` declarados quedan `applied: "CUT"`, `downgraded: false`. `FADE`/`DISSOLVE` declarados quedan `applied: "CUT"`, `downgraded: true` — nunca en silencio. `DISSOLVE` real necesitaría `xfade` (clips solapados, filter_complex) — no el demuxer `concat` — etapa futura.

## Motion (v1)

`lab/assembly/motion.py :: resolve_motion_execution()`: todo shot `INCLUDED` queda `applied: "STATIC"`. Ningún artifact upstream (`sequence.json`/`animation_plan.json`/`render_plan.json`) define parámetros numéricos de Ken Burns, y el Renderer (Fase 4.2.5) tampoco los ejecuta — todo clip en `videos/rendered/` es, de hecho, ya estático. Assembly documenta `motion.declared_type` para trazabilidad, sin inventar la magnitud que ninguna etapa anterior definió.

## Audio (v1 — solo referencia, sin ejecución)

`assembly_plan.json` guarda `audio_plan_id` (y `narrative_direction_id`) cuando esos artifacts existen para la historia — **son opcionales**: su ausencia no es un error, quedan en `null`. `lab/assembly/assembler.py` **nunca** los consume para mezclar audio — el `final_reel.mp4` de esta etapa sale sin sonido. Mezclar audio real es una etapa futura, no esta.

## Modelo de `assembly_plan.json`

```json
{
  "assembly_plan_id": "assembly_001",
  "render_plan_id": "render_001",
  "animation_plan_id": "anim_001",
  "narrative_direction_id": "narrative_001",
  "audio_plan_id": "audio_001",
  "story_id": "793ff158b714",
  "target_aspect_ratio": "9:16",
  "target_width": 1080, "target_height": 1920,
  "status": "DRAFT",
  "shots": [
    {
      "assembly_shot_id": "assembly_shot_02",
      "render_shot_id": "render_shot_02",
      "animation_shot_id": "anim_shot_02",
      "shot_id": "shot_02", "scene_id": "scene_02",
      "order": 2, "duration_seconds": 4.0,
      "disposition": "INCLUDED", "disposition_reason": "",
      "source_video_path": "videos/rendered/render_shot_02.mp4",
      "motion": {"declared_type": "SLOW_ZOOM_IN", "applied": "STATIC", "reason": "..."},
      "transition_in": {"declared": "FADE", "applied": "CUT", "downgraded": true},
      "transition_out": {"declared": "CUT", "applied": "CUT", "downgraded": false}
    }
  ],
  "declared_total_duration_seconds": 17.0,
  "included_duration_seconds": 4.0,
  "output": {"status": "PENDING", "relative_path": null, "error": null},
  "created_at": "..."
}
```

Shots no `INCLUDED` quedan con `source_video_path`/`motion`/`transition_in`/`transition_out` en `null` — nunca se fabrican valores para ellos.

## Reglas de validación (`validate_assembly_plan(story_id)`)

No lanza — devuelve una lista de errores. Cubre: coherencia de `render_plan_id`/`animation_plan_id` (obligatorios) y `narrative_direction_id`/`audio_plan_id` (opcionales, solo si el plan los declaró), coherencia por shot contra el `render_plan.json` **actual** (no el de cuando se planificó — si `render-execute` corrió después, `validate_assembly_plan()` lo detecta y exige replanificar), que todo shot `INCLUDED` tiene su clip real en disco, consistencia de `downgraded` con lo declarado, vocabulario cerrado, y orden idéntico al de `render_plan.json`.

## Ejecución real (`lab/assembly/assembler.py`)

`process_assembly_plan()`: si no hay ningún shot `INCLUDED`, falla explícitamente sin llamar a FFmpeg (nada real que ensamblar). Si los hay, arma una lista de concatenación (formato del demuxer `concat` de FFmpeg) sobre los clips ya existentes en `videos/rendered/`, corre `ffmpeg -f concat -safe 0 -i <lista> -c copy videos/final/final_reel.mp4` (sin re-encodear — todos los clips ya comparten códec/fps/pix_fmt, producidos por el mismo Renderer), y valida el resultado con `ffprobe` real (stream de video presente, códec, resolución, fps, duración razonable) antes de marcar `output.status: DONE`. No duplica la lógica de filtros de `lab/render/renderer.py` — reutiliza sus clips ya escritos tal cual.

`lab/config/settings.py` gana `FFPROBE_BINARY` (mismo criterio de resolución que `FFMPEG_BINARY`: override por variable de entorno > detectado en PATH > `"ffprobe"` literal).

## Aislamiento

`lab/assembly/` **lee** `render_plan.json`, `animation_plan.json`, `narrative_direction.json`, `audio_plan.json` (todos solo lectura) y los clips de `videos/rendered/` — nunca escribe ninguno de ellos, tampoco `sequence.json`, `media_blueprint.json` ni `asset_registry.json`. No depende de Learning, Production, Supabase, Vercel, GitHub Actions ni de ningún provider (Gemini/Cloudflare/audio).

## Qué falta (fuera de esta etapa)

`DISSOLVE` real (`xfade`), Ken Burns real (necesitaría una etapa que sí defina magnitudes, con respaldo editorial — no esta), mezcla de audio real, Fase 5 (export a producción), automatización sin supervisión.
