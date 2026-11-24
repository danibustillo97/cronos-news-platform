from __future__ import annotations

import logging
from datetime import datetime

from app.domain.content.profile import ContentProfile, CustomSource

logger = logging.getLogger("cronos.content_profile")
_ID = "global"


class ContentProfileUnavailableError(Exception):
    """The content_profile table doesn't exist yet (migration not applied)."""


class SupabaseContentProfileRepository:
    """Singleton `content_profile` (migrations/20261123b_content_profile.sql).

    Read is fail-safe: missing table/row -> the default profile (Fútbol, every
    competition, setup not completed), so the scraper keeps working."""

    def __init__(self, client) -> None:
        self._client = client

    def get(self) -> ContentProfile:
        try:
            rows = self._client.table("content_profile").select("*").eq("id", _ID).execute().data or []
        except Exception as exc:  # noqa: BLE001
            logger.warning("content_profile unreadable, using default: %r", exc)
            return ContentProfile()
        if not rows:
            return ContentProfile()
        row = rows[0]
        try:
            return ContentProfile(
                mode=row.get("mode") or "football",
                setup_completed=bool(row.get("setup_completed")),
                competitions=tuple(row.get("competitions") or ()),
                focuses=tuple(row.get("focuses") or ()),
                disabled_sources=tuple(row.get("disabled_sources") or ()),
                custom_sources=tuple(
                    CustomSource(url=s["url"], name=s.get("name"), covers=tuple(s.get("covers") or ("general",)))
                    for s in (row.get("custom_sources") or []) if s.get("url")
                ),
                priority_terms=tuple(row.get("priority_terms") or ()),
                blocked_terms=tuple(row.get("blocked_terms") or ()),
                updated_at=datetime.fromisoformat(row["updated_at"]) if row.get("updated_at") else None,
                updated_by=row.get("updated_by"),
            )
        except ValueError as exc:  # a stored id no longer in the catalog
            logger.warning("stored content_profile invalid (%s), using default", exc)
            return ContentProfile()

    def save(self, profile: ContentProfile) -> None:
        try:
            self._client.table("content_profile").upsert({
                "id": _ID,
                "mode": profile.mode,
                "setup_completed": profile.setup_completed,
                "competitions": list(profile.competitions),
                "focuses": list(profile.focuses),
                "disabled_sources": list(profile.disabled_sources),
                "custom_sources": [{"url": s.url, "name": s.name, "covers": list(s.covers)} for s in profile.custom_sources],
                "priority_terms": list(profile.priority_terms),
                "blocked_terms": list(profile.blocked_terms),
                "updated_at": profile.updated_at.isoformat() if profile.updated_at else None,
                "updated_by": profile.updated_by,
            }).execute()
        except Exception as exc:
            if "content_profile" in str(exc) and ("does not exist" in str(exc) or "PGRST205" in str(exc) or "42P01" in str(exc)):
                raise ContentProfileUnavailableError(
                    "Falta la tabla content_profile: ejecuta migrations/20261123b_content_profile.sql en Supabase."
                ) from exc
            raise
