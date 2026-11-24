from __future__ import annotations

import logging
from datetime import datetime

from app.domain.portal.entities import PortalLayout, StageMedia

logger = logging.getLogger("cronos.portal")
_ID = "global"


class PortalLayoutUnavailableError(Exception):
    """The portal_layout table doesn't exist yet (migration not applied)."""


class SupabasePortalLayoutRepository:
    """Singleton `portal_layout` (migrations/20261124_portal_layout.sql).

    Read is fail-safe: missing table/row or an invalid stored row -> the
    default layout, so the public homepage never breaks because of it."""

    def __init__(self, client) -> None:
        self._client = client

    def get(self) -> PortalLayout:
        try:
            rows = self._client.table("portal_layout").select("*").eq("id", _ID).execute().data or []
        except Exception as exc:  # noqa: BLE001
            logger.warning("portal_layout unreadable, using default: %r", exc)
            return PortalLayout()
        if not rows:
            return PortalLayout()
        row = rows[0]
        try:
            video = StageMedia(row["video_url"], row.get("video_title") or "", row.get("video_poster")) if row.get("video_url") else None
            radio = StageMedia(row["radio_url"], row.get("radio_title") or "", row.get("radio_logo")) if row.get("radio_url") else None
            mode = row.get("stage_mode") or "news"
            if (mode == "video" and video is None) or (mode == "radio" and radio is None):
                mode = "news"
            return PortalLayout(
                mode=mode, video=video, radio=radio,
                pinned=tuple(row.get("pinned") or ()), hidden=tuple(row.get("hidden") or ()),
                updated_at=datetime.fromisoformat(row["updated_at"]) if row.get("updated_at") else None,
                updated_by=row.get("updated_by"),
            )
        except ValueError as exc:
            logger.warning("stored portal_layout invalid (%s), using default", exc)
            return PortalLayout()

    def save(self, layout: PortalLayout) -> None:
        try:
            self._client.table("portal_layout").upsert({
                "id": _ID,
                "stage_mode": layout.mode,
                "video_url": layout.video.url if layout.video else None,
                "video_title": layout.video.title if layout.video else None,
                "video_poster": layout.video.image if layout.video else None,
                "radio_url": layout.radio.url if layout.radio else None,
                "radio_title": layout.radio.title if layout.radio else None,
                "radio_logo": layout.radio.image if layout.radio else None,
                "pinned": list(layout.pinned),
                "hidden": list(layout.hidden),
                "updated_at": layout.updated_at.isoformat() if layout.updated_at else None,
                "updated_by": layout.updated_by,
            }).execute()
        except Exception as exc:
            text = str(exc)
            if "portal_layout" in text and ("does not exist" in text or "PGRST205" in text or "42P01" in text):
                raise PortalLayoutUnavailableError(
                    "Falta la tabla portal_layout: ejecuta migrations/20261124_portal_layout.sql en Supabase."
                ) from exc
            raise
