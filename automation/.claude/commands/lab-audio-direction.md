---
description: LAB -- planifica la direccion de audio (tracks NARRATION/MUSIC/SFX/AMBIENCE por beat, silencios deliberados, prioridad de mezcla) de una historia, sin generar ni ejecutar nada
---

Corre la skill `lab-audio-direction` sobre la historia `$ARGUMENTS` (un `story_id` -- debe tener `narrative_direction.json`). Si no se pasó un `story_id`, pedíselo al usuario.

Esto produce `lab/workspace/media/<story_id>/audio_plan.json` -- por beat de `narrative_direction.json`, qué capas de audio hacen falta (`NARRATION`/`MUSIC`/`SFX`/`AMBIENCE`), dónde el silencio es una decisión deliberada (con su `treatment`), y la regla fija de prioridad de mezcla. **No genera ni ejecuta nada** — no hay proveedor, no hay archivo de audio, no hay FFmpeg. Es solo intención sonora, complementaria a `lab-narrative-direction` (que decide el arco emocional), no un reemplazo.

Reportá al usuario, en texto claro:
- Cuántos tracks hay y de qué `role` (cuántos `NARRATION`/`MUSIC`/`SFX`/`AMBIENCE`).
- Cuántas ventanas de silencio hay y con qué `treatment`.
- Que la dirección de audio quedó en `DRAFT`, lista para que el usuario la revise o pida `/lab-audio-status` más tarde.
