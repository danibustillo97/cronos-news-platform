"""
Rutas de assembly_plan.json y del video final -- viven en la misma carpeta
por-historia que sequence.json/animation_plan.json/render_plan.json.
Importa story_media_dir de lab.media.paths (solo lectura -- ese archivo no
se modifica).
"""

from pathlib import Path

from lab.media.paths import story_media_dir


def assembly_plan_path(story_id: str) -> Path:
    return story_media_dir(story_id) / "assembly_plan.json"


def final_reel_path(story_id: str) -> Path:
    return story_media_dir(story_id) / "videos" / "final" / "final_reel.mp4"
