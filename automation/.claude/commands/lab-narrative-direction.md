---
description: LAB -- planifica la direccion narrativa/emocional (arco por beat, referenciando scene_id) de una historia, sin decidir shots ni ejecutar nada
---

Corre la skill `lab-narrative-direction` sobre la historia `$ARGUMENTS` (un `story_id` -- debe tener `media_blueprint.json` de Fase 3). Si no se pasó un `story_id`, pedíselo al usuario.

Esto produce `lab/workspace/media/<story_id>/narrative_direction.json` -- un arco emocional declarativo por beat (emoción, intensidad, función narrativa, e intención de ritmo/movimiento/transición/música/silencio/prioridad de narración), referenciando `scene_id` real. **No decide nada ejecutable** — es solo intención editorial, complementaria a `lab-editorial-narrative` (que decide qué cuenta la historia), no un reemplazo.

Reportá al usuario, en texto claro:
- Cuántos beats tiene la dirección narrativa y qué arco emocional resultó (la secuencia de `emotion` en orden).
- Cuántas escenas quedaron cubiertas.
- Que la dirección narrativa quedó en `DRAFT`, lista para que el usuario la revise o pida `/lab-narrative-status` más tarde.
