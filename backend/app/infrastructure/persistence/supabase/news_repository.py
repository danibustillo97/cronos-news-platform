"""Reads/writes the PRE-EXISTING `news` table (the Editorial Desk's own
table — CRONOS' NEWS bounded context does not own it, does not replace it,
and only adds rows the same way the existing scraper already does).

Honest gap (rule #10): this legacy table has no distinct
`source_published_at` column — `published_at` is set by the scraper to
"now" at scrape time, which is really an ingestion timestamp, not the
article's real original publish date. We do NOT misrepresent it as
source_published_at; we leave that field genuinely null until the
ingestion pipeline is corrected to capture it.
"""
from __future__ import annotations

from datetime import datetime, timezone

from app.domain.news.entities import News, NewsProvenance, NewsStatus
from app.domain.shared.ids import NewsId
from app.infrastructure.persistence.supabase.guard import raise_if_schema_missing


class SupabaseNewsRepository:
    def __init__(self, client) -> None:
        self._client = client

    def find_by_id(self, news_id: str) -> News | None:
        try:
            res = self._client.table("news").select("*").eq("id", news_id).maybe_single().execute()
        except Exception as exc:
            raise_if_schema_missing(exc, "news")
            raise
        return self._to_entity(res.data) if res and res.data else None

    def list_recent(self, limit: int) -> list[News]:
        try:
            res = (
                self._client.table("news").select("*")
                .order("published_at", desc=True).limit(limit).execute()
            )
        except Exception as exc:
            raise_if_schema_missing(exc, "news")
            raise
        return [self._to_entity(row) for row in (res.data or [])]

    def save(self, news: News) -> None:
        # CRONOS' NEWS context only ever inserts new rows the same way the
        # existing scraper does — it never rewrites the Editorial Desk's
        # own editorial fields (title/content/status).
        payload = {
            "id": str(news.id),
            "title": news.headline,
            "content": news.normalized_content or news.headline,
            "source_url": news.provenance.source_url,
            "source": news.provenance.source_name,
            "category": news.category,
            "tags": news.topics,
            "status": "draft",
            "published_at": news.ingested_at.isoformat(),
            "created_at": news.ingested_at.isoformat(),
        }
        try:
            self._client.table("news").upsert(payload).execute()
        except Exception as exc:
            raise_if_schema_missing(exc, "news")
            raise

    @staticmethod
    def _to_entity(row: dict) -> News:
        created_at = _parse_dt(row.get("created_at")) or datetime.now(timezone.utc)
        provenance = NewsProvenance(
            source_name=row.get("source"),
            source_url=row.get("source_url"),
            source_published_at=None,  # honest gap — see module docstring
            source_updated_at=_parse_dt(row.get("updated_at")),
        )
        return News(
            id=NewsId.of(row["id"]),
            headline=row.get("title") or "(sin título)",
            summary=row.get("summary") or row.get("excerpt"),
            normalized_content=row.get("content"),
            provenance=provenance,
            category=row.get("category"),
            topics=row.get("tags") or [],
            entities=[],
            status=NewsStatus.INGESTED,
            ingested_at=created_at,
            legacy_web_status=row.get("status"),
        )


def _parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
