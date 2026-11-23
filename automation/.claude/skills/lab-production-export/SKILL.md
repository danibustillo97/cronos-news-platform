---
name: lab-production-export
description: This skill should be used when the user asks to "export this story for production", "exporta esta historia", "genera el paquete de exportación", "prepara el bridge a producción", or runs `/lab-production-export <story_id>` in the LAB local editorial lab (RPA_NEWS_SCRIPT repo). Reads every artifact a story already has (editorial, media, narrative direction, audio direction, sequence, animation, render, assembly) and packages them into a self-contained, checksummed export package under lab/workspace/exports/<story_id>/ for a human to review and manually import into cronos-news-platform. Never publishes, never imports, never talks to Supabase/Vercel/Content Studio, never regenerates or re-executes anything.
---

Convierte todo lo que una historia ya tiene en LAB (editorial, media, dirección narrativa/de audio, secuencia, animación, render, ensamblaje) en un **paquete de exportación autocontenido**: `export_manifest.json` + copias reales de cada artifact/asset/video disponible, listo para que un humano lo revise y lo importe manualmente a `cronos-news-platform`. Fase 5 (ver `docs/LAB_EXPORT_FORMAT.md`) — el lado LAB del "manual production bridge".

## Principio central: `EXPORT ≠ IMPORT ≠ PUBLISH ≠ PRODUCTION`

Esta skill **empaqueta**. No importa nada a Supabase, no publica nada, no llama a ninguna API de `cronos-news-platform`, no toca Vercel ni Content Studio. El flujo completo es:

```
LAB → export-plan → VALIDACIÓN → READY_FOR_REVIEW → REVISIÓN HUMANA → export-execute → PAQUETE → import manual (fuera de LAB, tarea futura) → Production
```

Ningún paso de esta skill avanza automáticamente más allá de "paquete listo en disco". El importer (que sí tocaría Production) **no existe todavía** — es una tarea separada, futura.

## Inputs (todos solo lectura)

Editorial (`understanding.json`, `research.json`, `fact_check.json`, `editorial_analysis.json`, `story_concepts.json`, `content_plan.json`, `hooks.json`, `script.json`, `scene_plan.json` — los que existan), `media_blueprint.json`, `asset_registry.json`, `visual_style.json`, `narrative_direction.json`, `audio_plan.json`, `sequence.json`, `animation_plan.json`, `render_plan.json`, `assembly_plan.json` — todos opcionales salvo los editoriales mínimos y `media_blueprint.json` (ver Validación). Los clips reales en `videos/rendered/` y `videos/final/final_reel.mp4` cuando existan.

## Output: el paquete

`lab/workspace/exports/<story_id>/` (carpeta que ya existía reservada para esto desde Fase 1 — no se inventó una convención nueva):

```
lab/workspace/exports/<story_id>/
  export_manifest.json      -- índice raíz, ver abajo
  artifacts/
    editorial/               -- understanding.json, research.json, ...
    media_blueprint.json, asset_registry.json, visual_style.json
    narrative_direction.json, audio_plan.json
    sequence.json, animation_plan.json, render_plan.json, assembly_plan.json
  assets/                    -- copias reales de cada imagen (mismo relative_path que asset_registry.json)
  videos/
    rendered/                -- copias de cada render_shot_XX.mp4 disponible
    final/                   -- final_reel.mp4, si existe
```

Todas las referencias dentro del manifest son **relativas al paquete** (`package_relative_path`) — nunca `C:\Users\...` ni ninguna ruta absoluta. El paquete puede copiarse a otra máquina sin romper nada.

## `export_manifest.json` — qué contiene

`schema_version` (contrato versionado, hoy `"1.0.0"`), `export_id` (único por corrida de `export-plan`), `story_id`, `status` (`DRAFT`/`READY_FOR_REVIEW`/`EXPORTED` — deliberadamente sin `APPROVED`/`REJECTED`, la revisión real ocurre fuera de LAB), `workspace_item_state`, `artifacts` (por nombre, con `availability`: `PRESENT`/`MISSING`/`PENDING`/`BLOCKED`, checksum, y — cuando aplica — `artifact_id` + `upstream_valid` delegado al `validate_*()` propio de esa etapa), `assets` (con `asset_id`, `parent_asset_id`, provenance, checksum, `scene_id`/`shot_id` resueltos, etc.), `renders` (uno por shot de `render_plan.json`), `final_reel`, `provenance` (qué participó, qué se generó vs. es real, versión del contrato), `security_scan`.

## Reglas de disponibilidad — nunca ambiguas

- **`PRESENT`**: el archivo existe de verdad, checksum calculado.
- **`MISSING`**: la etapa nunca corrió para esta historia (ej. `narrative_direction.json` no existe todavía) — legítimo, no es un error.
- **`PENDING`**: existe la intención pero no la ejecución (ej. un shot con asset real cuyo render todavía no corrió).
- **`BLOCKED`**: hay una inconsistencia real — un archivo declarado que ya no existe, un render que falló, un artifact cuya propia validación (`validate_sequence`, `validate_render_plan`, etc.) devuelve errores.

## Pasos

1. Confirmar que la historia es identificable (tiene un `WorkspaceItem` en algún estado no-`INGESTED`/no-`REJECTED`) y que al menos tiene el mínimo editorial (`understanding.json`, `editorial_analysis.json`, `content_plan.json`) y `media_blueprint.json`. Si falta algo de esto, avisar al usuario — sin esto no hay nada exportable.
2. Correr:
   ```
   lab/.venv/Scripts/python.exe -m lab.cli export-plan <story_id>
   ```
   Construye `export_manifest.json` leyendo el estado real de todo (nunca copia archivos todavía), valida (delegando en el `validate_*()` de cada etapa cuando esa etapa está presente, más las reglas propias de Export: referencias resolubles, checksums, security scan), registra el job `export_plan`.
3. Reportar al usuario: cuántos elementos quedaron `PRESENT`/`MISSING`/`PENDING`/`BLOCKED`, y explicar honestamente cualquier `BLOCKED` (nunca ocultarlo). Si `validation_errors` no está vacío, explicar exactamente qué falta o qué referencia está rota — no intentar corregirlo automáticamente.
4. Si el usuario pide avanzar:
   ```
   lab/.venv/Scripts/python.exe -m lab.cli export-review <story_id>
   ```
   Vuelve a validar y, si es válido, pasa `DRAFT → READY_FOR_REVIEW`. Esto es la revisión humana — nunca se auto-aprueba.
5. Si el usuario confirma que quiere materializar el paquete:
   ```
   lab/.venv/Scripts/python.exe -m lab.cli export-execute <story_id>
   ```
   Copia de verdad (nunca genera) cada archivo `PRESENT` a `lab/workspace/exports/<story_id>/`, re-verifica cada copia contra su checksum, y marca `status: EXPORTED`. **Rechaza ejecutar si el manifest no está en `READY_FOR_REVIEW`** — no hay forma de saltarse el paso 4.
6. Reportar la ubicación del paquete, cuántos archivos se copiaron, tamaño total.

## Validación (qué bloquea el export)

Historia no identificable o `REJECTED`/`INGESTED`; falta algún artifact editorial obligatorio o `media_blueprint.json`; cualquier artifact presente cuya propia validación falle; cualquier elemento `BLOCKED` (archivo declarado ausente, render/assembly fallido); el security scan encuentra un nombre de archivo sospechoso (`.env`, algo con "token"/"secret"/"password" en el nombre). Ninguna de estas condiciones se corrige automáticamente — se reportan, y el export queda bloqueado hasta que se resuelvan en la etapa correspondiente (nunca dentro de Export).

## Seguridad

El paquete **nunca** puede contener `.env`, API keys, tokens, passwords ni credenciales de ningún proveedor — Export solo incluye una lista fija y nombrada de artifacts/assets/videos conocidos (nunca un glob de directorio), y además corre un chequeo defensivo explícito antes de cerrar cualquier export.

## Límites (qué NO hace esta skill)

No regenera ningún asset, no re-ejecuta Render ni Assembly ni Media Intelligence. No importa nada a Supabase ni a ninguna tabla de producción. No publica nada. No modifica `cronos-news-platform` de ninguna forma. No modifica ningún artifact upstream (`narrative_direction.json`, `audio_plan.json`, `sequence.json`, `animation_plan.json`, `render_plan.json`, `assembly_plan.json`, `media_blueprint.json`, `asset_registry.json`) — solo los lee. No se convierte en dependencia interna de ninguna etapa de LAB — ningún módulo interno lee `export_manifest.json`. No implementa el importer — eso es una tarea futura y separada.
