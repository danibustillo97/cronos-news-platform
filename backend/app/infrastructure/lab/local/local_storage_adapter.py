"""Today's StoragePort implementation: resolves an asset's storage_ref
(a relative path inside a LAB export dir) into a URL served by THIS
backend's own /assets route — never a raw filesystem path exposed to the
frontend. When assets move to Supabase Storage, only this adapter changes.
"""
from __future__ import annotations

import os
import re
import uuid
from pathlib import Path

from app.infrastructure.lab.local.export_reader import resolve_workspace_root

# Same allow-list app/presentation/api/assets.py already serves -- an
# upload outside it would 404 on read, so it's rejected on write instead.
_ALLOWED_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp"}
_SAFE_NAME = re.compile(r"[^A-Za-z0-9._-]+")


class LocalLabStorageAdapter:
    def __init__(self, base_url: str | None = None) -> None:
        self._base_url = base_url or os.getenv("BACKEND_PUBLIC_URL", "http://localhost:8000")

    def resolve_url(self, storage_ref: str) -> str:
        # storage_ref is expected as "<story_id>/<relative_path>" once a
        # story_id prefix is attached by the caller; kept generic here.
        return f"{self._base_url}/assets/{storage_ref}"

    def save_upload(self, story_id: str, filename: str, content: bytes) -> str:
        suffix = Path(filename).suffix.lower()
        if suffix not in _ALLOWED_SUFFIXES:
            raise ValueError(f"unsupported image type {suffix!r} -- allowed: {sorted(_ALLOWED_SUFFIXES)}")
        safe_id = _SAFE_NAME.sub("_", str(uuid.uuid4()))
        relative_path = f"uploads/{safe_id}{suffix}"

        target_dir = resolve_workspace_root() / story_id / "uploads"
        target_dir.mkdir(parents=True, exist_ok=True)
        (target_dir / f"{safe_id}{suffix}").write_bytes(content)

        return f"{story_id}/{relative_path}"
