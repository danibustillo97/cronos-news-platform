from __future__ import annotations

import uuid

_ALLOWED = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif"}
MAX_BYTES = 8 * 1024 * 1024


class SupabaseArticleImageStorage:
    """Article images (cover + body blocks) go to the public `media` bucket,
    same as ad banners: the URL the editor shows is the exact URL the portal
    renders -- no local disk, no admin-only /assets route in between."""

    _BUCKET = "media"

    def __init__(self, client) -> None:
        self._client = client

    def upload(self, artifact_id: str, content: bytes, content_type: str) -> str:
        ext = _ALLOWED.get((content_type or "").split(";")[0].strip().lower())
        if ext is None:
            raise ValueError("Formato no permitido: usa JPG, PNG, WebP o GIF")
        if not content:
            raise ValueError("El archivo está vacío")
        if len(content) > MAX_BYTES:
            raise ValueError("La imagen supera 8 MB")
        path = f"articles/{artifact_id}/{uuid.uuid4().hex}.{ext}"
        bucket = self._client.storage.from_(self._BUCKET)
        bucket.upload(path, content, {"content-type": content_type, "upsert": "false"})
        return bucket.get_public_url(path)
