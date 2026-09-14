"""PrepareContent — News -> Story. Deliberately separate from ProduceStory:
turning a News item into a Story is an editorial decision a human makes
explicitly; it does NOT automatically run any LAB capability.
"""
from __future__ import annotations

from dataclasses import dataclass

from app.domain.shared.errors import NotFoundError
from app.domain.shared.ids import StoryId
from app.domain.story.entities import Story, StorySource
from app.domain.ports import NewsRepository, StoryRepository


@dataclass
class PrepareContentInput:
    news_id: str


class PrepareContent:
    def __init__(self, news: NewsRepository, stories: StoryRepository) -> None:
        self._news = news
        self._stories = stories

    def execute(self, input: PrepareContentInput) -> Story:
        news_item = self._news.find_by_id(input.news_id)
        if news_item is None:
            raise NotFoundError("News", input.news_id)

        existing = self._stories.find_by_source_news_id(input.news_id)
        if existing is not None:
            return existing

        story = Story.open_from_news(
            StoryId.of(input.news_id),
            news_item.headline,
            StorySource(news_id=news_item.id, source_url=news_item.provenance.source_url, label="news"),
        )
        self._stories.save(story)
        return story
