---
title: LAB -- Export Format (Fase 5, lado LAB del manual production bridge)
status: implementada (export local; el importer de Production NO está implementado)
date: 2026-09-11
---

# Export Format

Último eslabón del lado LAB: convierte todo lo que una historia ya tiene (Editorial → Media Intelligence → Narrative/Audio Direction → Sequence → Animation → Render → Assembly) en un **paquete de exportación autocontenido**, listo para revisión humana y para un futuro import manual a `cronos-news-platform`. Diseño original: `obsidian-vault/CRONOS - Tres Universos.md` (repo `cronos-news-platform`, relación `NEWS/PRODUCTION ← manual bridge → CRONOS ARCHITECTURE`) y la sección K ("Export → News") de este mismo repo en `docs/LAB_ARCHITECTURE_AUDIT.md`.

## Principio central: frontera de salida, no capa interna

`export_manifest.json` **no es** una capa del dominio de LAB. Ningún módulo interno (`lab/narrative/`, `lab/audio/`, `lab/sequence/`, `lab/animation/`, `lab/render/`, `lab/assembly/`) lo lee ni depende de él — el flujo interno sigue exactamente igual que antes de que Export existiera. `lab/export/` solo **lee** los artifacts de esos módulos (vía sus propios `load()`/`validate_*()`), nunca los modifica, nunca regenera nada, nunca ejecuta Render/Assembly/Media Intelligence de nuevo.

`EXPORT ≠ IMPORT ≠ PUBLISH ≠ PRODUCTION`. Esta etapa termina en un paquete en disco. El importer (el código que leería este paquete y escribiría en Supabase) **no existe todavía** — tarea futura y separada, fuera de este trabajo.

## Arquitectura

```
Editorial + media_blueprint.json + asset_registry.json + narrative_direction.json +
audio_plan.json + sequence.json + animation_plan.json + render_plan.json + assembly_plan.json
   (todos solo lectura -- los que existan; MISSING es una salida válida, no un error)
                                   |
                lab.export.planner.init_export_manifest()
      (calcula checksums SHA-256 de cada archivo real, decide availability
       PRESENT/MISSING/PENDING/BLOCKED por elemento, delega en el
       validate_*() propio de cada etapa presente -- no copia nada todavía)
                                   v
     lab/workspace/exports/<story_id>/export_manifest.json (status: DRAFT)
                                   |
                    lab.cli export-plan <story_id>
             (valida + registra job export_plan)
                                   |
                    lab.cli export-review <story_id>
             (re-valida, DRAFT -> READY_FOR_REVIEW -- revisión humana)
                                   v
                          status: READY_FOR_REVIEW
                                   |
                    lab.cli export-execute <story_id>
     (lab.export.packager -- copia real de cada archivo PRESENT al paquete,
      re-verifica checksums de las copias, status -> EXPORTED)
                                   v
        lab/workspace/exports/<story_id>/{artifacts,assets,videos}/...
                                   |
                    [FUERA DE ESTE TRABAJO]
                    import manual -> Production
```

`export-execute` **rechaza ejecutar** si el manifest no está en `READY_FOR_REVIEW` — no hay forma de saltarse la revisión humana desde el CLI.

## Dónde vive el paquete

`lab/workspace/exports/<story_id>/` — carpeta que **ya existía** reservada para esto desde Fase 1 (`lab.core.paths.EXPORTS_DIR`, comentario original: *"paquetes JSON exportados (Fase 4+)"*). No se inventó una convención nueva.

```
lab/workspace/exports/<story_id>/
  export_manifest.json
  artifacts/
    editorial/{understanding,research,fact_check,editorial_analysis,story_concepts,content_plan,hooks,script,scene_plan}.json
    media_blueprint.json, asset_registry.json, visual_style.json
    narrative_direction.json, audio_plan.json
    sequence.json, animation_plan.json, render_plan.json, assembly_plan.json
  assets/<mismo relative_path que asset_registry.json>
  videos/rendered/<render_shot_id>.mp4
  videos/final/final_reel.mp4
```

Todas las referencias son relativas al paquete (`package_relative_path`) — nunca una ruta absoluta de la máquina. El paquete es copiable a otro entorno sin romper nada.

## Modelo de `export_manifest.json`

Campos raíz: `schema_version` (`"1.0.0"`), `export_id` (único por corrida de `export-plan`, `export_<hex12>`), `story_id`, `status` (`DRAFT`/`READY_FOR_REVIEW`/`EXPORTED`), `source` (`{"system": "CRONOS Architecture / LAB", "repo": "RPA_NEWS_SCRIPT"}`), `workspace_item_state`, `planned_at`/`exported_at`, `artifacts` (dict por nombre), `assets` (lista), `renders` (lista, uno por shot de `render_plan.json`), `final_reel`, `provenance`, `security_scan`.

Cada entrada de `artifacts`/`assets`/`renders`/`final_reel` trae `availability` (`PRESENT`/`MISSING`/`PENDING`/`BLOCKED`), y cuando aplica: `source_relative_path` (relativo a `RPA_NEWS_SCRIPT/`, para que `export-execute` sepa de dónde copiar), `package_relative_path` (relativo al paquete), `checksum_sha256`, `size_bytes`. Las entradas de `artifacts` de una-sola-fuente (media_blueprint/asset_registry/narrative_direction/audio_plan/sequence/animation_plan/render_plan/assembly_plan) agregan `artifact_id` (su propio id, ej. `"seq_001"`) y `upstream_valid` (delegado al `validate_*()` de esa etapa — `null` si el artifact no existe).

## Reglas de `availability`

| Valor | Significa |
|---|---|
| `PRESENT` | Archivo real, checksum calculado |
| `MISSING` | La etapa nunca corrió para esta historia — legítimo |
| `PENDING` | Existe la intención pero no la ejecución (shot con asset real, render todavía no corrió) |
| `BLOCKED` | Inconsistencia real: archivo declarado pero ausente, render/assembly fallido, o `validate_*()` propio de la etapa devuelve errores |

## Validación (`validate_export_manifest`) — qué bloquea el export

No reimplementa las reglas de cada etapa — **delega** en `validate_sequence`/`validate_animation_plan`/`validate_render_plan`/`validate_narrative_direction`/`validate_audio_plan`/`validate_assembly_plan` cuando esa etapa está presente (nunca las copia, ver sección 3 del diseño: *"no convertir todos los artifacts internos en una segunda arquitectura"*). Bloquea si: la historia no es identificable o está `REJECTED`/`INGESTED`; falta algún artifact editorial obligatorio (`understanding.json`, `editorial_analysis.json`, `content_plan.json`) o `media_blueprint.json`; cualquier artifact presente cuya propia validación falle; cualquier elemento `BLOCKED`; el checksum de un archivo ya no coincide con el planificado (drift, replanificar); el security scan encuentra un nombre de archivo sospechoso. Si el manifest ya está `EXPORTED`, además re-verifica las copias físicas del paquete contra sus checksums declarados (detecta alteración posterior).

## Seguridad

`lab/export/constants.py :: FORBIDDEN_FILENAMES`/`FORBIDDEN_FILENAME_SUBSTRINGS` — chequeo defensivo explícito antes de cerrar cualquier export. Estructuralmente, Export solo incluye una lista fija y nombrada de artifacts/assets/videos conocidos (nunca un glob de directorio) — `.env`/credenciales no pueden colarse por diseño, pero el chequeo corre igual, dos veces (al planificar y de nuevo al ejecutar).

## Aislamiento

`lab/export/` lee `lab.editorial.artifacts`, `lab.media.blueprint`/`registry`/`paths`, `lab.narrative.planner`, `lab.audio.planner`, `lab.sequence.planner`, `lab.animation.planner`, `lab.render.planner`/`paths`, `lab.assembly.planner`/`paths` (todos vía sus funciones `load()`/`validate_*()` públicas, nunca de escritura) — nunca escribe ninguno de ellos. Cero imports de `learning` (no existe todavía), Production, Supabase, o cualquier provider.

## Hallazgo y fix durante esta implementación: bug pre-existente en `validate_render_plan()`

Al construir el manifest real de `793ff158b714`, `render_plan.json` (con `render_shot_02` ya en `DONE`, verificado real por la auditoría de Assembly) salía `upstream_valid: false`. Causa: la Regla 6 de `lab.render.planner.validate_render_plan()` (Etapa 3) exigía `status == "PENDING"` **siempre** — escrita antes de que existiera la Etapa 5 (Renderer real). Nunca se actualizó al agregar ejecución real. Nada en el flujo normal de LAB llama a `validate_render_plan()` después de `render-execute`, así que el bug quedó latente hasta que Export (el primer punto que sí lo hace) lo expuso.

**Fix aplicado** (autorizado explícitamente, alcance mínimo, documentado como corrección de un bug pre-existente — no un rediseño de Render): la Regla 6 ahora acepta `PENDING`/`DONE`/`FAILED` (vocabulario `RENDER_SHOT_STATUS`, sin cambios), exigiendo la forma correcta de cada uno — `DONE` con `output_path` real y `error: null`; `FAILED` con `error` no vacío y `output_path: null`; `PENDING` sin `output_path` poblado — exactamente lo que `lab.render.renderer.process_render_plan()` ya produce. No se tocó `renderer.py`, ni el contrato de `render_plan.json`, ni ninguna otra etapa. Ver `lab/render/planner.py` y `lab/tests/test_render_planner.py` (7 tests nuevos/actualizados).

## Qué falta (fuera de esta etapa)

El importer de Production (leer `export_manifest.json`, mapear a columnas de `news`, escribir en Supabase) — no implementado, tarea futura y separada. Historial de exportaciones (hoy un solo paquete vigente por historia, igual que el resto de LAB). Aprobación/rechazo explícito del export (`status` no tiene `APPROVED`/`REJECTED` — la decisión real de importar o no ocurre fuera de LAB).
