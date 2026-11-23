"""
Ruta de narrative_direction.json -- vive en la misma carpeta por-historia
que sequence.json/animation_plan.json/render_plan.json/media_blueprint.json.
Importa story_media_dir de lab.media.paths (solo lectura -- ese archivo no
se modifica).
"""

from pathlib import Path

from lab.media.paths import story_media_dir


def narrative_direction_path(story_id: str) -> Path:
    return story_media_dir(story_id) / "narrative_direction.json"
