from __future__ import annotations

from app.domain.settings.entities import SiteSeoSettings
from app.infrastructure.persistence.supabase.guard import raise_if_schema_missing

_SINGLETON_ID = "global"


class SupabaseSiteSettingsRepository:
    """`site_settings` is a singleton table -- exactly one row, id='global',
    seeded by the schema migration with the values that used to be
    hardcoded in frontend/src/app/layout.tsx (see supabase_setup/
    cronos_platform_schema.sql). get_seo never needs to invent a default:
    the row always exists once the schema is applied."""

    def __init__(self, client) -> None:
        self._client = client

    def get_seo(self) -> SiteSeoSettings:
        try:
            rows = self._client.table("site_settings").select("*").eq("id", _SINGLETON_ID).execute().data or []
        except Exception as exc:
            raise_if_schema_missing(exc, "site_settings")
            raise

        if not rows:
            raise LookupError(
                f'"site_settings" has no row with id={_SINGLETON_ID!r} -- '
                f"the schema migration's seed insert was not applied"
            )
        row = rows[0]
        return SiteSeoSettings(
            site_title=row["site_title"], meta_description=row["meta_description"],
            keywords=list(row.get("keywords") or []),
        )

    def save_seo(self, settings: SiteSeoSettings) -> None:
        try:
            self._client.table("site_settings").upsert({
                "id": _SINGLETON_ID,
                "site_title": settings.site_title,
                "meta_description": settings.meta_description,
                "keywords": settings.keywords,
            }).execute()
        except Exception as exc:
            raise_if_schema_missing(exc, "site_settings")
            raise
