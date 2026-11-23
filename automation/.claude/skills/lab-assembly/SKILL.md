---
name: lab-assembly
description: This skill should be used when the user asks to "assemble this story into a final video", "ensambla el video final de esta historia", "genera el final reel", "concatena los shots renderizados", or runs `/lab-assembly <story_id>` in the LAB local editorial lab (RPA_NEWS_SCRIPT repo). Reads render_plan.json/animation_plan.json (and narrative_direction.json/audio_plan.json when they exist) and produces assembly_plan.json — classifying every shot as INCLUDED/EXCLUDED_NO_ASSET/BLOCKED_NOT_RENDERED — then, on request, runs real FFmpeg to concatenate the already-rendered clips into videos/final/final_reel.mp4. Never generates images/video/audio, never selects a provider, never invents content for missing shots.
---

Ejecuta la última etapa de Fase 4.2: convierte los shots que ya se renderizaron individualmente (`videos/rendered/*.mp4`, Fase 4.2.5) en un único `videos/final/final_reel.mp4`. **No toma ninguna decisión editorial nueva** — ejecuta/compone decisiones que Editorial, Narrative Direction, Audio Direction, Sequence, Animation y Render ya tomaron.

## Inputs (todos solo lectura)

- `render_plan.json` (obligatorio) — geometría y `status` real (`DONE`/`FAILED`/`PENDING`) de cada shot.
- `animation_plan.json` (obligatorio) — `motion.type` y `transition_in`/`transition_out` declarados (`render_plan.json` no los propaga).
- `narrative_direction.json` (opcional) — si existe, su `narrative_direction_id` queda referenciado en el plan, solo trazabilidad.
- `audio_plan.json` (opcional) — si existe, su `audio_plan_id` queda referenciado en el plan, solo trazabilidad. **Assembly no mezcla audio en esta etapa** — ver abajo.
- Los clips reales ya escritos en `videos/rendered/<render_shot_id>.mp4` por el Renderer (Fase 4.2.5) — Assembly los consume tal cual, nunca vuelve a calcular geometría ni filtros.

## Output

- `assembly_plan.json` — plan determinista, por shot: `disposition`, motivo, orden, duración, transición (`declared`/`applied`/`downgraded`), motion (`declared_type`/`applied`/`reason`).
- `videos/final/final_reel.mp4` — solo tras `assembly-execute`, con FFmpeg real.

## Reglas de inclusión (exactas, sin ambigüedad)

| `render_plan.json` dice... | `disposition` |
|---|---|
| `status: DONE` (asset real, ya renderizado) | `INCLUDED` |
| `asset_id: null` (shot texto-only) | `EXCLUDED_NO_ASSET` |
| `asset_id` real pero `status: PENDING` o `FAILED` | `BLOCKED_NOT_RENDERED` |

`BLOCKED_NOT_RENDERED` **nunca** se oculta como una exclusión silenciosa — el `disposition_reason` explica exactamente qué falta (correr `render-execute`, o que falló de verdad). Un shot `EXCLUDED_NO_ASSET` es un hueco permanente en esta etapa (texto-only, nunca tuvo imagen); un shot `BLOCKED_NOT_RENDERED` es resoluble (correr Render primero).

## Transiciones (v1)

Solo `CUT` se ejecuta — es gratis con el demuxer `concat` de FFmpeg (corte duro, sin filtro). Si un shot declaró `FADE`/`DISSOLVE` (en `animation_plan.json`), Assembly **no inventa** el filtro — lo baja a `CUT` de forma explícita y auditable (`downgraded: true` en `assembly_plan.json`), nunca en silencio. `DISSOLVE` real necesitaría `xfade` (clips solapados, no el demuxer `concat`) — etapa futura, no esta.

## Motion (v1)

Todo shot `INCLUDED` queda con `motion.applied: "STATIC"` — no hay Ken Burns real todavía. Motivo: ningún artifact upstream (`sequence.json`/`animation_plan.json`/`render_plan.json`) define parámetros numéricos de movimiento (escala inicial/final, dirección de pan), y el propio Renderer (Fase 4.2.5) tampoco los ejecuta — solo geometría estática. Assembly **no inventa** esa magnitud (sería "una intensidad narrativa" fabricada, y convertiría a Assembly en un nuevo Motion Planner) — solo documenta `motion.declared_type` para trazabilidad.

## Relación con Narrative Direction y Audio Direction

Assembly **lee** sus artifacts (cuando existen) solo para referenciarlos por id en `assembly_plan.json` — nunca reinterpreta el arco emocional ni la dirección de audio, nunca los modifica. Si una historia todavía no tiene `narrative_direction.json`/`audio_plan.json`, `assembly-plan` igual funciona — esas referencias quedan en `null`, no es un error.

## Relación con Render

Assembly nunca recalcula geometría ni vuelve a ejecutar FFmpeg sobre las imágenes fuente — reutiliza tal cual los clips que `lab/render/renderer.py` ya produjo. Si `render_plan.json` cambia después de planificar (por ejemplo, corrés `render-execute` de nuevo tras `assembly-plan`), `assembly-review`/una nueva corrida de `assembly-plan` lo detectan — la validación siempre compara contra el estado *actual* de `render_plan.json`.

## Pasos

1. Confirmar que la historia tiene `render_plan.json` y `animation_plan.json` (Fase 4.2). Si falta alguno, avisar al usuario y detenerse — no inventar un plan.
2. Correr:
   ```
   lab/.venv/Scripts/python.exe -m lab.cli assembly-plan <story_id>
   ```
   Esto construye `assembly_plan.json` de forma 100% determinista (sin criterio editorial — clasificación e inclusión son matemática sobre datos ya reales), valida, y registra el job `assembly_plan`.
3. Reportar al usuario: cuántos shots quedaron `INCLUDED`/`EXCLUDED_NO_ASSET`/`BLOCKED_NOT_RENDERED` (y por qué cada uno), duración declarada vs. duración realmente incluida, y qué transiciones se bajaron a `CUT`. Ser explícito si el resultado va a ser un video parcial — no es un error, es honesto.
4. Si el usuario pide ejecutar de verdad (no automático — nunca correr esto sin que lo pidan):
   ```
   lab/.venv/Scripts/python.exe -m lab.cli assembly-execute <story_id>
   ```
   Ejecuta FFmpeg real (concatenación de los clips `INCLUDED`, sin audio) y escribe `videos/final/final_reel.mp4`. Si no hay ningún shot `INCLUDED`, esto falla explícitamente (`output.status: FAILED`) — nunca genera un video vacío o ficticio.
5. Reportar el resultado real (duración, resolución, códec, tamaño — de `ffprobe`, no inventado) o el error si FFmpeg falló.
6. `assembly_plan.json` queda en `DRAFT` tras el paso 2 — no lo marques listo para revisión vos mismo; eso lo hace el usuario vía `lab.cli assembly-review <story_id>` si lo pide.

## Validación

`validate_assembly_plan()` (invocada por `assembly-plan`/`assembly-review`) comprueba: referencias reales (`render_shot_id` existe en `render_plan.json`, coherencia de `shot_id`/`scene_id`/`order`/`duration_seconds`), que la `disposition` coincide con el estado *actual* de `render_plan.json` (no el de cuando se planificó), que todo shot `INCLUDED` tiene su clip real en disco, vocabulario cerrado (`disposition`, `motion.applied`, `transition.applied`), y consistencia del flag `downgraded`.

## Restricciones (qué NO hace esta skill)

**No genera música, voz ni ningún asset.** No genera ni edita ninguna imagen. No selecciona proveedor de ningún tipo (imagen, audio, video). No descarga música. No ejecuta TTS. No genera SFX. No mezcla audio en el video final — solo referencia `audio_plan_id`, nunca lo ejecuta. No inventa Ken Burns real ni transiciones complejas (`DISSOLVE`). No inventa contenido para shots `EXCLUDED_NO_ASSET`/`BLOCKED_NOT_RENDERED` — un video parcial es un resultado válido y esperado, nunca se rellena con algo fabricado. No modifica `sequence.json`, `animation_plan.json`, `render_plan.json`, `narrative_direction.json`, `audio_plan.json`, `media_blueprint.json` ni `asset_registry.json` — solo los lee. No exporta ni publica nada a Production — eso es Fase 5, no implementada.
