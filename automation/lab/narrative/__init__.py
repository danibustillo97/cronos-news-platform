"""
Narrative Direction de LAB (capa nueva, entre Fase 3 y Fase 4.1).

Responde "como debe sentirse la historia mientras se cuenta" -- distinto de
Editorial Intelligence (lab/editorial/, Fase 2: "que historia estamos
contando"). Declara un arco emocional por beat (no por shot -- los shots
todavia no existen en este punto del pipeline, los crea Sequence) que
referencia scene_id de media_blueprint.json. Solo declara intencion
editorial (emotion, pacing, motion_intensity_intention, etc.) -- nunca
valores ejecutables; Sequence/Animation/Render/Assembly siguen siendo las
unicas duenas de sus valores literales.

No ejecuta FFmpeg, no genera multimedia, no decide audio (eso es Audio
Direction, capa separada, no implementada). No modifica media_blueprint.json,
asset_registry.json, sequence.json, animation_plan.json ni render_plan.json.

Ver docs/LAB_NARRATIVE_DIRECTION.md y obsidian-vault/CRONOS - Narrative & Audio
Direction.md (cronos-news-platform) para el diseno original aprobado.
"""
