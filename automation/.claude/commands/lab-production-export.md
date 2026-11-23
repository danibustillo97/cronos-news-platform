---
description: LAB -- construye el export_manifest.json (Fase 5) leyendo el estado real de todos los artifacts de una historia, sin copiar archivos todavia
---

Corre la skill `lab-production-export` sobre la historia `$ARGUMENTS` (un `story_id`). Si no se pasó, pedíselo al usuario.

Esto produce `lab/workspace/exports/<story_id>/export_manifest.json` -- un índice de todo lo que la historia tiene hoy (editorial, media, narrative/audio direction, sequence, animation, render, assembly), con `availability` (`PRESENT`/`MISSING`/`PENDING`/`BLOCKED`) por elemento y checksums. **No copia ningún archivo todavía** — eso es `/lab-export-execute`, después de revisión humana.

Reportá al usuario, en texto claro:
- Cuántos elementos quedaron `PRESENT`, `MISSING`, `PENDING` y `BLOCKED` — explicá honestamente cualquier `BLOCKED`, nunca lo ocultes.
- El resultado del security scan.
- Que el manifest quedó en `DRAFT`, listo para `/lab-export-status` o para que el usuario pida `export-review` cuando esté conforme.
