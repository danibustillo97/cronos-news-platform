from __future__ import annotations

import logging
from datetime import datetime

from app.domain.automation.entities import EditorialAutomationSettings

logger = logging.getLogger("cronos.automation")
_SINGLETON_ID = "global"


class SupabaseEditorialAutomationRepository:
    """`editorial_automation` singleton (migrations/20261123_editorial_pipeline.sql).

    Fail-safe on read: if the table or row doesn't exist yet, automation is
    reported as OFF -- an unapplied migration must never turn on spending."""

    def __init__(self, client) -> None:
        self._client = client

    def get(self) -> EditorialAutomationSettings:
        try:
            rows = self._client.table("editorial_automation").select("*").eq("id", _SINGLETON_ID).execute().data or []
        except Exception as exc:  # noqa: BLE001 -- missing table => OFF, logged
            logger.warning("editorial_automation unreadable, treating as OFF: %r", exc)
            return EditorialAutomationSettings()
        if not rows:
            return EditorialAutomationSettings()
        row = rows[0]
        return EditorialAutomationSettings(
            enabled=bool(row.get("enabled")),
            max_articles_per_run=int(row.get("max_articles_per_run") or 2),
            max_articles_per_day=int(row.get("max_articles_per_day") or 10),
            min_text_chars=int(row.get("min_text_chars") if row.get("min_text_chars") is not None else 400),
            # Columns from migrations/20261127_autopublish.sql; missing => auto-publish OFF.
            auto_publish=bool(row.get("auto_publish")) and bool(row.get("enabled")),
            min_originality=int(row.get("min_originality") or 85),
            updated_at=datetime.fromisoformat(row["updated_at"]) if row.get("updated_at") else None,
            updated_by=row.get("updated_by"),
        )

    def save(self, settings: EditorialAutomationSettings) -> None:
        row = {
            "id": _SINGLETON_ID,
            "enabled": settings.enabled,
            "max_articles_per_run": settings.max_articles_per_run,
            "max_articles_per_day": settings.max_articles_per_day,
            "min_text_chars": settings.min_text_chars,
            "updated_at": (settings.updated_at.isoformat() if settings.updated_at else None),
            "updated_by": settings.updated_by,
            "auto_publish": settings.auto_publish,
            "min_originality": settings.min_originality,
        }
        try:
            self._client.table("editorial_automation").upsert(row).execute()
        except Exception as exc:  # noqa: BLE001
            if "auto_publish" not in str(exc) and "min_originality" not in str(exc):
                raise
            if settings.auto_publish:
                raise ValueError(
                    "Falta aplicar la migración 20261127_autopublish.sql en Supabase para activar la publicación automática."
                ) from exc
            row.pop("auto_publish"); row.pop("min_originality")
            self._client.table("editorial_automation").upsert(row).execute()
