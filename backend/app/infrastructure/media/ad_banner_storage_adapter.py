from __future__ import annotations

import uuid


class SupabaseAdBannerStorageAdapter:
    """Uploads a banner creative into the same public `media` bucket the
    rest of the site's images already live in (see infrastructure/
    database/supabase_setup/tighten_media_storage_rls.sql). Goes through
    the backend's service-role Supabase client, so it bypasses that
    bucket's RLS entirely -- the browser never uploads here directly."""

    _BUCKET = "media"

    def __init__(self, client) -> None:
        self._client = client

    def upload(self, filename: str, content: bytes, content_type: str) -> str:
        ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "jpg"
        path = f"banners/{uuid.uuid4()}.{ext}"
        self._client.storage.from_(self._BUCKET).upload(
            path, content, {"content-type": content_type, "upsert": "true"},
        )
        return self._client.storage.from_(self._BUCKET).get_public_url(path)
