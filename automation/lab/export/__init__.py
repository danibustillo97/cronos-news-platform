"""
Export de LAB -- Fase 5, lado LAB del "manual production bridge" (ver
obsidian-vault/CRONOS - Tres Universos.md, repo cronos-news-platform).

El export_manifest.json NO es una capa interna del dominio -- es la
FRONTERA DE SALIDA de LAB. Ningun modulo interno (Narrative, Audio,
Sequence, Animation, Render, Assembly) lo lee ni depende de el; el flujo
interno sigue usando sus artifacts normales exactamente igual que antes de
que Export existiera.

Responde: "dado que una historia ya paso por Editorial/Media/Narrative/
Audio/Sequence/Animation/Render/Assembly, como empaqueto lo que existe hoy
en un paquete autocontenido, trazable y copiable, listo para que un humano
lo revise y lo importe manualmente a Production?"

EXPORT != IMPORT. EXPORT != PUBLISH. EXPORT != PRODUCTION. Este paquete no
llega solo a ningun lado -- un humano lo revisa (`export-review`) y
despues lo copia/importa manualmente fuera de LAB. Ningun codigo de LAB
llama a Supabase, Vercel, o a ninguna API de `cronos-news-platform`.

Solo lee artifacts existentes (media_blueprint.json, asset_registry.json,
sequence.json, animation_plan.json, render_plan.json,
narrative_direction.json, audio_plan.json, assembly_plan.json, los
artifacts editoriales, los assets reales y los videos ya renderizados) --
nunca los modifica, nunca regenera nada, nunca ejecuta Render/Assembly/
Media Intelligence. `lab/export/planner.py` (puro, solo lectura + hashing)
construye `export_manifest.json`; `lab/export/packager.py` es quien copia
archivos de verdad al paquete (`export-execute`).

No importa nada de `lab/learning/` (no existe todavia) ni de ningun
provider externo.

Ver docs/LAB_EXPORT_FORMAT.md y obsidian-vault/CRONOS - Tres Universos.md
(cronos-news-platform) para el diseno original aprobado.
"""
