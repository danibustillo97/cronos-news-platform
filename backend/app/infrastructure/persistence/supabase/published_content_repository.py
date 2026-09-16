"""Read-only PublishedContentRepository: the same pre-existing `news`
table both the legacy scraper's direct-publish path and Editorial's own
PublishArtifact (see app/infrastructure/publishing/legacy_news_publisher.py)
write into -- filtered to status='published', the same condition the
public site's own RLS policy already uses. This never writes; Publish
already owns the one real write path into this table.
"""
from __future__ import annotations

from datetime import datetime

from app.domain.publication.entities import PublishedContent
from app.domain.shared.ids import PublishedContentId
from app.infrastructure.persistence.supabase.guard import raise_if_schema_missing

_PUBLISHED = "published"


class SupabasePublishedContentRepository:
    def __init__(self, client) -> None:
        self._client = client

    def find_by_id(self, content_id: str) -> PublishedContent | None:
        try:
            res = (
                self._client.table("news").select("*").eq("id", content_id).eq("status", _PUBLISHED)
                .maybe_single().execute()
            )
        except Exception as exc:
            raise_if_schema_missing(exc, "news")
            raise
        return self._to_entity(res.data) if res and res.data else None

    def find_by_slug(self, slug: str) -> PublishedContent | None:
        try:
            res = (
                self._client.table("news").select("*").eq("slug", slug).eq("status", _PUBLISHED)
                .maybe_single().execute()
            )
        except Exception as exc:
            raise_if_schema_missing(exc, "news")
            raise
        return self._to_entity(res.data) if res and res.data else None

    def list_recent(self, limit: int = 20, category: str | None = None) -> list[PublishedContent]:
        try:
            query = self._client.table("news").select("*").eq("status", _PUBLISHED)
            if category:
                query = query.eq("category", category)
            res = query.order("published_at", desc=True).limit(limit).execute()
        except Exception as exc:
            raise_if_schema_missing(exc, "news")
            raise
        return [self._to_entity(row) for row in (res.data or [])]

    @staticmethod
    def _to_entity(row: dict) -> PublishedContent:
        return PublishedContent(
            id=PublishedContentId.of(row["id"]), title=row["title"], subtitle=row.get("subtitle"),
            slug=row["slug"], excerpt=row.get("excerpt"), summary=row.get("summary"),
            content=row.get("content") or "", category=row.get("category"), tags=row.get("tags") or [],
            image_url=row.get("image_url"), author=row.get("author"), source_name=row.get("source"),
            source_url=row.get("source_url"),
            published_at=_parse_dt(row.get("published_at")), updated_at=_parse_dt(row.get("updated_at")),
        )


def _parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
