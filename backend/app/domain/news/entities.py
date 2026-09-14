"""NEWS bounded context — information discovered/ingested from external
sources. Ingestion is NOT editorial status: a News item stays here,
unopinionated, until a human explicitly turns it into a Story (rule:
INGESTED != DRAFT, INGESTED != PUBLISHED).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum

from app.domain.shared.ids import NewsId


class NewsStatus(str, Enum):
    INGESTED = "INGESTED"       # raw, just landed from a source
    NORMALIZED = "NORMALIZED"   # boilerplate/nav/CTAs stripped, quality-checked
    ARCHIVED = "ARCHIVED"       # explicitly dismissed, not worth pursuing


@dataclass
class NewsProvenance:
    """Traceability back to the original source — never discarded."""
    source_name: str | None
    source_url: str | None
    source_published_at: datetime | None
    source_updated_at: datetime | None


@dataclass
class News:
    id: NewsId
    headline: str
    summary: str | None
    normalized_content: str | None
    provenance: NewsProvenance
    category: str | None
    topics: list[str]
    entities: list[str]
    status: NewsStatus
    ingested_at: datetime
    processed_at: datetime | None = None
    # Read-only projection field from the pre-existing Editorial Desk `news`
    # table (draft/published/enhanced) — belongs to the PUBLICATION
    # bounded context, not NEWS's own lifecycle. Carried here only so
    # projections (ListNews) can group without a second round-trip.
    legacy_web_status: str | None = None

    @staticmethod
    def ingest(
        news_id: NewsId,
        headline: str,
        provenance: NewsProvenance,
        ingested_at: datetime,
        raw_content: str | None = None,
        category: str | None = None,
    ) -> "News":
        if not headline or not headline.strip():
            raise ValueError("News requires a non-empty headline")
        return News(
            id=news_id,
            headline=headline.strip(),
            summary=None,
            normalized_content=raw_content,
            provenance=provenance,
            category=category,
            topics=[],
            entities=[],
            status=NewsStatus.INGESTED,
            ingested_at=ingested_at,
        )

    def normalize(self, cleaned_content: str, summary: str | None, processed_at: datetime) -> None:
        """Marks quality/normalization as done — boilerplate stripped,
        never the raw scrape used directly as editorial content."""
        self.normalized_content = cleaned_content
        self.summary = summary
        self.status = NewsStatus.NORMALIZED
        self.processed_at = processed_at

    def archive(self) -> None:
        self.status = NewsStatus.ARCHIVED

    def assign_topics(self, topics: list[str], entities: list[str]) -> None:
        self.topics = list(dict.fromkeys(topics))
        self.entities = list(dict.fromkeys(entities))
