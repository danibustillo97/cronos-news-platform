"""
Ruta de audio_plan.json -- vive en la misma carpeta por-historia que
sequence.json/animation_plan.json/render_plan.json/narrative_direction.json.
Importa story_media_dir de lab.media.paths (solo lectura -- ese archivo no
se modifica).
"""

from pathlib import Path

from lab.media.paths import story_media_dir


def audio_plan_path(story_id: str) -> Path:
    return story_media_dir(story_id) / "audio_plan.json"
