"""
Rutas del paquete de exportación -- vive en `lab/workspace/exports/<story_id>/`,
la carpeta que ya existía reservada para esto desde Fase 1
(`lab.core.paths.EXPORTS_DIR`, comentario "paquetes JSON exportados (Fase
4+)") -- no se inventa una convención nueva. Un solo paquete vigente por
historia (mismo patrón que el resto de LAB: replanificar/re-exportar
sobreescribe).
"""

from pathlib import Path

from lab.core.paths import EXPORTS_DIR


def export_dir(story_id: str) -> Path:
    return EXPORTS_DIR / story_id


def export_manifest_path(story_id: str) -> Path:
    return export_dir(story_id) / "export_manifest.json"


def export_artifacts_dir(story_id: str) -> Path:
    return export_dir(story_id) / "artifacts"


def export_assets_dir(story_id: str) -> Path:
    return export_dir(story_id) / "assets"


def export_videos_dir(story_id: str) -> Path:
    return export_dir(story_id) / "videos"
