"""Backend-served reference for LAB-generated media (rule: frontend never
gets a raw local path). Interim seam over LAB's local export directory —
the URL shape stays the same when this moves to Supabase Storage.
"""
from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from app.infrastructure.lab.local.export_reader import resolve_workspace_root

router = APIRouter(prefix="/assets", tags=["assets"])

_MIME = {
    ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp",
    ".mp4": "video/mp4", ".mov": "video/quicktime", ".webm": "video/webm",
}


@router.get("/{story_id}/{path:path}")
def get_asset(story_id: str, path: str):
    root = resolve_workspace_root()
    story_dir = (root / story_id).resolve()
    target = (story_dir / path).resolve()

    if not str(target).startswith(str(story_dir)):
        raise HTTPException(status_code=400, detail="INVALID_PATH")
    if not target.is_file():
        raise HTTPException(status_code=404, detail="NOT_FOUND")

    media_type = _MIME.get(target.suffix.lower(), "application/octet-stream")
    return FileResponse(str(target), media_type=media_type)
