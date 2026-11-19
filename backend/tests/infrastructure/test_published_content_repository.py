from __future__ import annotations

from app.infrastructure.persistence.supabase.published_content_repository import (
    SupabasePublishedContentRepository,
)

_ROW = {
    "id": "news-1", "title": "Un título real", "subtitle": None, "slug": "un-titulo-real",
    "excerpt": "Extracto real", "summary": "Resumen real", "content": "Contenido real.",
    "category": "Fútbol", "tags": ["futbol"], "image_url": "https://cdn.example.com/img.jpg",
    "author": "Nexus News", "source": "Example", "source_url": "https://example.com/a",
    "status": "published", "published_at": "2026-01-01T00:00:00+00:00", "updated_at": None,
}


class _FluentQuery:
    def __init__(self, rows: list[dict], filters: dict, single: bool = False):
        self._rows = rows
        self._filters = filters
        self._single = single

    def eq(self, field, value):
        return _FluentQuery(self._rows, {**self._filters, field: value}, self._single)

    def order(self, *_args, **_kwargs):
        return self

    def limit(self, *_args):
        return self

    def maybe_single(self):
        return _FluentQuery(self._rows, self._filters, single=True)

    def execute(self):
        matches = [r for r in self._rows if all(r.get(k) == v for k, v in self._filters.items())]
        if self._single:
            return _Result(matches[0] if matches else None)
        return _Result(matches)


class _Result:
    def __init__(self, data):
        self.data = data


class _FakeTable:
    def __init__(self, rows):
        self.rows = rows

    def select(self, *_args):
        return _FluentQuery(self.rows, {})


class _FakeClient:
    def __init__(self, rows):
        self._rows = rows

    def table(self, name):
        assert name == "news"
        return _FakeTable(self._rows)


def test_find_by_id_returns_only_published_rows():
    draft_row = {**_ROW, "id": "news-2", "status": "draft"}
    client = _FakeClient([_ROW, draft_row])
    repo = SupabasePublishedContentRepository(client)

    found = repo.find_by_id("news-1")
    assert found is not None
    assert found.title == "Un título real"
    assert str(found.id) == "news-1"

    assert repo.find_by_id("news-2") is None  # draft, never returned as published


def test_find_by_slug_returns_real_content():
    client = _FakeClient([_ROW])
    repo = SupabasePublishedContentRepository(client)

    found = repo.find_by_slug("un-titulo-real")
    assert found is not None
    assert found.category == "Fútbol"
    assert found.image_url == "https://cdn.example.com/img.jpg"


def test_list_recent_filters_by_category():
    other = {**_ROW, "id": "news-3", "slug": "otro", "category": "Tecnología"}
    client = _FakeClient([_ROW, other])
    repo = SupabasePublishedContentRepository(client)

    items = repo.list_recent(limit=10, category="Fútbol")
    assert len(items) == 1
    assert items[0].category == "Fútbol"
