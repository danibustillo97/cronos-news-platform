"""
Assembly de LAB -- ultima etapa de Fase 4.2. Convierte los shots ya
renderizados individualmente (videos/rendered/*.mp4, Fase 4.2.5) en un
unico video final: videos/final/final_reel.mp4.

Ejecuta/compone decisiones ya tomadas por etapas anteriores -- no vuelve a
tomar ninguna decision editorial. Lee render_plan.json + animation_plan.json
(transiciones -- render_plan.json no las propaga) y, cuando existen,
narrative_direction.json/audio_plan.json (referencias opcionales, solo
lectura) -- nunca escribe ninguno de ellos.

Clasifica cada shot en INCLUDED/EXCLUDED_NO_ASSET/BLOCKED_NOT_RENDERED
(lab.assembly.planner), resuelve transiciones (v1 solo ejecuta CUT --
FADE/DISSOLVE quedan declarados con downgrade explicito, nunca en
silencio) y motion (v1 solo aplica STATIC -- ningun artifact upstream
define parametros numericos de Ken Burns, y el propio Renderer tampoco los
ejecuta; Assembly no inventa esa magnitud, ver lab.assembly.motion), y
concatena con FFmpeg real los clips YA renderizados de los shots INCLUDED
(lab.assembly.assembler) -- nunca vuelve a calcular geometria ni filtros,
esa logica ya vive en lab/render/renderer.py y no se duplica aca.

No genera audio, no descarga musica, no ejecuta TTS, no llama ningun
provider. No modifica sequence.json, animation_plan.json, render_plan.json,
narrative_direction.json, audio_plan.json, media_blueprint.json ni
asset_registry.json.

Ver docs/LAB_ASSEMBLY.md y obsidian-vault/CRONOS - Assembly.md
(cronos-news-platform) para el diseno original aprobado.
"""
