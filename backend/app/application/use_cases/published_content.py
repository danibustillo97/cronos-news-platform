"""Read-only use cases over the PUBLICATION boundary (see
app/domain/publication/entities.py). Orchestration only, same as every
other use case here -- no business logic beyond "find it or say it
doesn't exist"; there's nothing to validate on a read.
"""
from __future__ import annotations

from app.domain.publication.entities import PublishedContent
from app.domain.ports import PublishedContentRepository
from app.domain.shared.errors import NotFoundError


class GetPublishedContent:
    def __init__(self, published_content: PublishedContentRepository) -> None:
        self._published_content = published_content

    def execute(self, content_id: str) -> PublishedContent:
        content = self._published_content.find_by_id(content_id)
        if content is None:
            raise NotFoundError("PublishedContent", content_id)
        return content


class GetPublishedContentBySlug:
    def __init__(self, published_content: PublishedContentRepository) -> None:
        self._published_content = published_content

    def execute(self, slug: str) -> PublishedContent:
        content = self._published_content.find_by_slug(slug)
        if content is None:
            raise NotFoundError("PublishedContent", slug)
        return content


class ListPublishedContent:
    def __init__(self, published_content: PublishedContentRepository) -> None:
        self._published_content = published_content

    def execute(self, limit: int = 20, category: str | None = None) -> list[PublishedContent]:
        return self._published_content.list_recent(limit=limit, category=category)
