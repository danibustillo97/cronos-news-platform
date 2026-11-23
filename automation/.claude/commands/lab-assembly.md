---
description: LAB -- planifica el ensamblaje (assembly_plan.json) de una historia a partir de render_plan.json/animation_plan.json, sin ejecutar FFmpeg todavia
---

Corre la skill `lab-assembly` sobre la historia `$ARGUMENTS` (un `story_id` -- debe tener `render_plan.json` y `animation_plan.json` de Fase 4.2). Si no se pasó un `story_id`, pedíselo al usuario.

Esto produce `lab/workspace/media/<story_id>/assembly_plan.json` -- por shot, `disposition` (`INCLUDED`/`EXCLUDED_NO_ASSET`/`BLOCKED_NOT_RENDERED`), transición (`CUT` siempre en v1, con downgrade explícito si el original pedía `FADE`/`DISSOLVE`) y motion (`STATIC` siempre en v1, sin Ken Burns real todavía). **No ejecuta FFmpeg, no produce ningún video** — es solo el plan.

Reportá al usuario, en texto claro:
- Cuántos shots quedaron `INCLUDED`, `EXCLUDED_NO_ASSET` y `BLOCKED_NOT_RENDERED`, y por qué cada uno.
- Duración declarada por Sequence vs. duración que realmente quedaría incluida en el video final — si son distintas, explicar honestamente que el resultado sería un video parcial, no un error.
- Qué transiciones se bajaron a `CUT` (downgrade).
- Que el plan quedó en `DRAFT`, listo para revisión o para `/lab-assembly-execute` si el usuario lo pide.
