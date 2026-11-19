"""PUBLICATION -- the real, stable boundary between Editorial and
anything downstream of a published article (Studio, eventually; nothing
today). This is the ONLY thing a downstream consumer is meant to depend
on -- never Story, never Artifact, never Discovery.

Not a new domain invented for its own sake: app/domain/news/entities.py
already documents this split explicitly -- `News.legacy_web_status`
"belongs to the PUBLICATION bounded context, not NEWS's own lifecycle."
That context was named but never built; this is it, finally separated
from NEWS's own ingestion lifecycle (INGESTED/NORMALIZED/ARCHIVED),
which has nothing to do with what's publicly live.

Backed by the exact same pre-existing `news` table Editorial's
PublishArtifact already writes into (see app/infrastructure/publishing/
legacy_news_publisher.py) and the legacy scraper always has -- a
PublishedContent row is simply any row with status='published',
regardless of which pipeline produced it. No new table, no duplicated
storage: this only adds a read-side contract with a stable identity
(the row's own real id) that a future consumer can depend on without
ever needing to know about Story/Artifact/DiscoveryItem.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime

from app.domain.shared.ids import PublishedContentId


@dataclass(frozen=True)
class PublishedContent:
    id: PublishedContentId
    title: str
    subtitle: str | None
    slug: str
    excerpt: str | None
    summary: str | None
    content: str
    category: str | None
    tags: list[str] = field(default_factory=list)
    image_url: str | None = None
    author: str | None = None
    source_name: str | None = None
    source_url: str | None = None
    published_at: datetime | None = None
    updated_at: datetime | None = None
