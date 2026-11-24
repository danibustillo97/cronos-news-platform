"""Lee (solo lectura, nunca escribe) los artifacts JSON reales que cada
etapa de LAB deja en el workspace, para que el orchestrator los espeje a
Supabase tal cual -- sin interpretarlos (el Runtime no conoce las
entidades de dominio de news/backend, eso vive del otro lado, ver
news/backend/app/infrastructure/lab/local/*_adapter.py, que van a leer
estos mismos artifacts vía Supabase en vez de vía filesystem).
"""

from __future__ import annotations

import json
from pathlib import Path

from .lab_adapter import LAB_ROOT

WORKSPACE_ROOT = LAB_ROOT / "lab" / "workspace"
REVIEW_DIR = WORKSPACE_ROOT / "review"       # editorial, tras editorial-review
MEDIA_DIR = WORKSPACE_ROOT / "media"         # media_blueprint..assembly_plan, por story_id


def _read_json(path: Path) -> dict | None:
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return None


# Qué archivo(s) reales produce cada etapa del pipeline, y en qué carpeta
# -- nombres verificados contra lab/*/paths.py y lab/editorial/artifacts.py,
# no inventados.
_EDITORIAL_ARTIFACTS = [
    "understanding", "research", "fact_check",
    "editorial_analysis", "story_concepts", "content_plan",
    "hooks", "script", "scene_plan",
]
_MEDIA_ARTIFACTS = [
    "media_blueprint", "visual_style", "asset_registry",
    "narrative_direction", "audio_plan",
    "sequence", "animation_plan", "render_plan", "assembly_plan",
]


def collect_stage_artifacts(stage_name: str, item_id: str) -> dict[str, dict]:
    """kind -> payload para todos los artifacts que ya existen en disco
    para esta etapa. Etapas que no producen JSON propio (media_init,
    media_generate, render, assembly, export, *_review) devuelven {}."""
    out: dict[str, dict] = {}

    if stage_name == "editorial":
        story_dir = REVIEW_DIR / item_id
        for name in _EDITORIAL_ARTIFACTS:
            doc = _read_json(story_dir / f"{name}.json")
            if doc is not None:
                out[name] = doc
        return out

    if stage_name == "media_init":
        return out  # solo crea carpetas, sin JSON propio

    # Toda etapa posterior (media_plan..export) comparte story_media_dir()
    # -- re-escanear es barato y upsert_intelligence es idempotente, así
    # que no hace falta un mapeo fino etapa->archivo acá.
    story_dir = MEDIA_DIR / item_id
    for name in _MEDIA_ARTIFACTS:
        doc = _read_json(story_dir / f"{name}.json")
        if doc is not None:
            out[name] = doc
    return out
