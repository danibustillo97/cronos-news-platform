---
description: LAB -- ejecuta FFmpeg real sobre assembly_plan.json, produce videos/final/final_reel.mp4. Sin costo de API, pero SI crea un archivo de video en disco.
---

Ensamblá de verdad los shots `INCLUDED` de la historia `$ARGUMENTS` (un `story_id` -- debe tener `assembly_plan.json`, ver `/lab-assembly`). Si no se pasó, pedíselo al usuario.

**Esta etapa produce el video final y escribe un archivo en disco.** No llama a ninguna API externa ni genera audio (FFmpeg corre 100% local, sin mezclar sonido todavía) — avisá al usuario antes de correrlo si no es obvio por contexto que lo está pidiendo a propósito.

Pasos:

1. Si `lab/workspace/media/<story_id>/assembly_plan.json` no existe todavía, avisar y sugerir `/lab-assembly <story_id>` primero.

2. Ejecutar:
   ```
   lab/.venv/Scripts/python.exe -m lab.cli assembly-execute <story_id>
   ```
   Esto concatena con el demuxer `concat` de FFmpeg los clips ya renderizados (`videos/rendered/*.mp4`) de los shots `INCLUDED`, y escribe `videos/final/final_reel.mp4`. Si no hay ningún shot `INCLUDED`, falla explícitamente — nunca genera un video vacío o ficticio. Reescribe `assembly_plan.json` con el resultado real (`output.status: DONE/FAILED`, `relative_path`/`error`).

3. Reportar al usuario, en texto claro: si terminó OK, la duración/resolución/códec/tamaño real del video (de `ffprobe`, nunca inventado); si falló, el error tal cual, sin intentar corregirlo automáticamente.

**Nunca**: generar audio, música o TTS; llamar a ningún proveedor; tocar producción; modificar `render_plan.json`, `animation_plan.json`, `narrative_direction.json`, `audio_plan.json`, `sequence.json` o `asset_registry.json`; inventar contenido para completar un video que quedó parcial.
