import pytest

from app.domain.publication.entities import PublishedContent
from app.domain.shared.errors import NotFoundError
from app.domain.shared.ids import PublishedContentId
from app.application.use_cases.published_content import (
    GetPublishedContent, GetPublishedContentBySlug, ListPublishedContent,
)


class FakePublishedContentRepo:
    def __init__(self, items=None):
        self.items = items or []

    def find_by_id(self, content_id):
        return next((c for c in self.items if str(c.id) == content_id), None)

    def find_by_slug(self, slug):
        return next((c for c in self.items if c.slug == slug), None)

    def list_recent(self, limit=20, category=None):
        items = self.items if category is None else [c for c in self.items if c.category == category]
        return items[:limit]


def _content(content_id="c1", slug="s1", category="Fútbol"):
    return PublishedContent(
        id=PublishedContentId.of(content_id), title="T", subtitle=None, slug=slug, excerpt="e", summary="s",
        content="Contenido real.", category=category,
    )


def test_get_published_content_returns_real_item():
    repo = FakePublishedContentRepo([_content()])
    result = GetPublishedContent(repo).execute("c1")
    assert result.title == "T"


def test_get_published_content_raises_not_found():
    with pytest.raises(NotFoundError):
        GetPublishedContent(FakePublishedContentRepo()).execute("missing")


def test_get_published_content_by_slug_returns_real_item():
    repo = FakePublishedContentRepo([_content(slug="mi-slug")])
    result = GetPublishedContentBySlug(repo).execute("mi-slug")
    assert str(result.id) == "c1"


def test_get_published_content_by_slug_raises_not_found():
    with pytest.raises(NotFoundError):
        GetPublishedContentBySlug(FakePublishedContentRepo()).execute("missing")


def test_list_published_content_filters_by_category():
    repo = FakePublishedContentRepo([_content("c1", "s1", "Fútbol"), _content("c2", "s2", "Tecnología")])
    result = ListPublishedContent(repo).execute(category="Tecnología")
    assert len(result) == 1
    assert result[0].category == "Tecnología"
