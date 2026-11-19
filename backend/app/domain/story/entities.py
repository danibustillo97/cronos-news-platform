"""STORY bounded context — the editorial unit CRONOS revolves around. A
Story can originate from one News item, several related ones, or a pure
editorial selection — but a News item never becomes a Story automatically.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum

from app.domain.shared.errors import InvalidStateTransition
from app.domain.shared.ids import NewsId, StoryId


class StoryStatus(str, Enum):
    DISCOVERED = "DISCOVERED"
    IN_PRODUCTION = "IN_PRODUCTION"
    PRODUCED = "PRODUCED"
    PUBLISHED = "PUBLISHED"


@dataclass
class StorySource:
    news_id: NewsId | None
    source_url: str | None
    label: str = "news"


@dataclass
class Story:
    id: StoryId
    headline: str
    summary: str | None
    category_ids: list[str]
    sources: list[StorySource]
    status: StoryStatus

    @staticmethod
    def open_from_news(story_id: StoryId, headline: str, source: StorySource) -> "Story":
        if not headline.strip():
            raise ValueError("Story requires a non-empty headline")
        return Story(
            id=story_id, headline=headline.strip(), summary=None,
            category_ids=[], sources=[source], status=StoryStatus.DISCOVERED,
        )

    def add_source(self, source: StorySource) -> None:
        self.sources.append(source)

    def assign_categories(self, category_ids: list[str]) -> None:
        self.category_ids = list(dict.fromkeys(category_ids))

    def refine_headline(self, headline: str) -> None:
        if headline and headline.strip():
            self.headline = headline.strip()

    def begin_production(self) -> None:
        if self.status == StoryStatus.PUBLISHED:
            raise InvalidStateTransition("Story", self.status.value, StoryStatus.IN_PRODUCTION.value)
        self.status = StoryStatus.IN_PRODUCTION

    def mark_produced(self, summary: str | None = None) -> None:
        self.status = StoryStatus.PRODUCED
        if summary:
            self.summary = summary

    def mark_published(self) -> None:
        if self.status != StoryStatus.PRODUCED:
            raise InvalidStateTransition("Story", self.status.value, StoryStatus.PUBLISHED.value)
        self.status = StoryStatus.PUBLISHED
