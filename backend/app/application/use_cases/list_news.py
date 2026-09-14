"""ListNews — the NEW / PREPARING / PUBLISHED separation (rule: ingestion
status is not publication status). Groups by two independent signals:
whether a Story already exists for the News item, and the legacy Editorial
Desk publication status — never conflated into one field.
"""
from __future__ import annotations

from dataclasses import dataclass
from enum import Enum

from app.domain.news.entities import News
from app.domain.ports import NewsRepository, StoryRepository


class NewsWorkspaceBucket(str, Enum):
    NEW = "NEW"
    PREPARING = "PREPARING"
    PUBLISHED = "PUBLISHED"


@dataclass
class NewsWorkspaceItem:
    news: News
    bucket: NewsWorkspaceBucket
    story_id: str | None
    story_status: str | None


@dataclass
class NewsWorkspace:
    items: list[NewsWorkspaceItem]

    @property
    def counts(self) -> dict[str, int]:
        counts = {b.value: 0 for b in NewsWorkspaceBucket}
        for item in self.items:
            counts[item.bucket.value] += 1
        return counts


class ListNews:
    def __init__(self, news: NewsRepository, stories: StoryRepository) -> None:
        self._news = news
        self._stories = stories

    def execute(self, limit: int = 50) -> NewsWorkspace:
        items: list[NewsWorkspaceItem] = []
        for news_item in self._news.list_recent(limit):
            if news_item.legacy_web_status == "published":
                items.append(NewsWorkspaceItem(news_item, NewsWorkspaceBucket.PUBLISHED, None, None))
                continue

            story = self._stories.find_by_source_news_id(str(news_item.id))
            if story is not None:
                items.append(NewsWorkspaceItem(news_item, NewsWorkspaceBucket.PREPARING, str(story.id), story.status.value))
            else:
                items.append(NewsWorkspaceItem(news_item, NewsWorkspaceBucket.NEW, None, None))

        return NewsWorkspace(items=items)
