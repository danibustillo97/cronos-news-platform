"""StoragePort backed by Supabase Storage, for serverless deployments.

The local adapter writes uploads and generated images into the LAB workspace on disk and
serves them from this backend's /assets route. On Vercel that disk is read-only and wiped
between invocations, and GitHub Actions workers run on throwaway machines, so files must
live in Supabase Storage (public bucket) and be read straight from its CDN URL.

storage_ref format: "sb:<path inside the bucket>". Refs without the prefix are LAB/local
files from before this adapter; HybridAssetStorage keeps resolving them locally.
"""
from __future__ import annotations

import os
import re
import uuid
from pathlib import Path

from app.infrastructure.media.image_info import extension_for, image_info

_PREFIX = "sb:"
_ALLOWED_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp"}
_SAFE_SEGMENT = re.compile(r"[^A-Za-z0-9._-]+")
_MIME_BY_SUFFIX = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}


class SupabaseAssetStorage:
    def __init__(self, client, bucket: str | None = None, supabase_url: str | None = None) -> None:
        self._client = client
        self._bucket = bucket or os.getenv("ASSET_STORAGE_BUCKET", "media")
        self._base = (supabase_url or os.getenv("SUPABASE_URL", "")).rstrip("/")

    def owns(self, storage_ref: str) -> bool:
        return storage_ref.startswith(_PREFIX)

    def resolve_url(self, storage_ref: str) -> str:
        path = storage_ref[len(_PREFIX):] if self.owns(storage_ref) else storage_ref
        return f"{self._base}/storage/v1/object/public/{self._bucket}/{path}"

    def save_upload(self, story_id: str, filename: str, content: bytes) -> str:
        suffix = Path(filename).suffix.lower()
        if suffix not in _ALLOWED_SUFFIXES:
            raise ValueError(f"unsupported image type {suffix!r} -- allowed: {sorted(_ALLOWED_SUFFIXES)}")
        return self._put(story_id, "uploads", content, suffix, _MIME_BY_SUFFIX[suffix])

    def save_generated(self, story_id: str, content: bytes) -> tuple[str, str, int, int]:
        """Stores a generated image; returns (storage_ref, mime_type, width, height)."""
        mime_type, width, height = image_info(content)
        if not mime_type.startswith("image/"):
            raise ValueError("the image provider returned data that is not an image")
        return self._put(story_id, "generated", content, extension_for(mime_type), mime_type), mime_type, width, height

    def _put(self, story_id: str, folder: str, content: bytes, suffix: str, mime_type: str) -> str:
        path = f"artifacts/{_SAFE_SEGMENT.sub('_', story_id)}/{folder}/{uuid.uuid4().hex}{suffix}"
        self._client.storage.from_(self._bucket).upload(
            path, content, {"content-type": mime_type, "cache-control": "31536000", "upsert": "false"},
        )
        return f"{_PREFIX}{path}"


class HybridAssetStorage:
    """New files go to Supabase Storage; refs written before it still resolve locally."""

    def __init__(self, primary: SupabaseAssetStorage, legacy) -> None:
        self._primary = primary
        self._legacy = legacy

    def resolve_url(self, storage_ref: str) -> str:
        return self._primary.resolve_url(storage_ref) if self._primary.owns(storage_ref) else self._legacy.resolve_url(storage_ref)

    def save_upload(self, story_id: str, filename: str, content: bytes) -> str:
        return self._primary.save_upload(story_id, filename, content)

    def save_generated(self, story_id: str, content: bytes) -> tuple[str, str, int, int]:
        return self._primary.save_generated(story_id, content)
