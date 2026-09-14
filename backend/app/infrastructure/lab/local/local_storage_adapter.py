"""Today's StoragePort implementation: resolves an asset's storage_ref
(a relative path inside a LAB export dir) into a URL served by THIS
backend's own /assets route — never a raw filesystem path exposed to the
frontend. When assets move to Supabase Storage, only this adapter changes.
"""
from __future__ import annotations

import os


class LocalLabStorageAdapter:
    def __init__(self, base_url: str | None = None) -> None:
        self._base_url = base_url or os.getenv("BACKEND_PUBLIC_URL", "http://localhost:8000")

    def resolve_url(self, storage_ref: str) -> str:
        # storage_ref is expected as "<story_id>/<relative_path>" once a
        # story_id prefix is attached by the caller; kept generic here.
        return f"{self._base_url}/assets/{storage_ref}"
