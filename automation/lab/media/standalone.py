"""Genera UNA imagen real fuera del pipeline de escenas de video (media_plan/
generation_requests.json/media_blueprint.json, ver generation.py) -- para el
caso de un artículo editorial (NEXUS backend, Artifact/Publish) que solo
necesita una imagen de portada real a partir de un prompt de texto, sin
scene_id, sin blueprint, sin registro de personajes. Reusa exactamente el
mismo MediaProvider real (Gemini/Cloudflare) que ya usa generation.py --
nunca un provider distinto ni una imagen inventada/placeholder.

Guarda directo bajo workspace/exports/<story_id>/media/ (no bajo
workspace/media/<story_id>/images/generated/, que es del pipeline de
escenas) para que el backend la sirva con su endpoint /assets/{story_id}/
{path} ya existente, sin tocar storage ni rutas nuevas.
"""

from __future__ import annotations

import io
from dataclasses import dataclass

from lab.core.paths import EXPORTS_DIR
from lab.media.providers.resolver import resolve_media_provider


@dataclass
class StandaloneImageResult:
    relative_path: str  # relativo a EXPORTS_DIR/<story_id>/ -- ej. "media/FEATURE_IMAGE.png"
    mime_type: str
    width: int
    height: int
    provider: str
    model: str


def generate_standalone_image(
    story_id: str, placeholder_id: str, prompt: str, aspect_ratio: str = "16:9",
    provider_name: str | None = None,
) -> StandaloneImageResult:
    if not prompt or not prompt.strip():
        raise ValueError("prompt vacío -- no hay nada real que generar")

    provider = resolve_media_provider(provider_name)
    result = provider.generate(prompt, aspect_ratio=aspect_ratio)

    from PIL import Image

    with Image.open(io.BytesIO(result.image_bytes)) as img:
        width, height = img.size
        ext = (img.format or "PNG").lower()

    relative_path = f"media/{placeholder_id}.{ext}"
    story_exports_dir = EXPORTS_DIR / story_id
    target = story_exports_dir / "media" / f"{placeholder_id}.{ext}"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(result.image_bytes)

    return StandaloneImageResult(
        relative_path=relative_path, mime_type=result.mime_type, width=width, height=height,
        provider=provider.name, model=result.model,
    )
