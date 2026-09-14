import pytest

from app.domain.story.entities import Story, StorySource, StoryStatus
from app.domain.shared.ids import StoryId
from app.domain.shared.errors import InvalidStateTransition


def test_open_from_news_starts_discovered():
    story = Story.open_from_news(StoryId.of("s1"), "  Headline  ", StorySource(news_id=None, source_url=None))
    assert story.status == StoryStatus.DISCOVERED
    assert story.headline == "Headline"  # trimmed


def test_open_from_news_rejects_empty_headline():
    with pytest.raises(ValueError):
        Story.open_from_news(StoryId.of("s1"), "   ", StorySource(news_id=None, source_url=None))


def test_cannot_begin_production_once_published():
    story = Story.open_from_news(StoryId.of("s1"), "H", StorySource(news_id=None, source_url=None))
    story.begin_production()
    story.mark_produced()
    story.mark_published()
    with pytest.raises(InvalidStateTransition):
        story.begin_production()


def test_mark_published_requires_produced_first():
    story = Story.open_from_news(StoryId.of("s1"), "H", StorySource(news_id=None, source_url=None))
    with pytest.raises(InvalidStateTransition):
        story.mark_published()


def test_refine_headline_ignores_blank():
    story = Story.open_from_news(StoryId.of("s1"), "Original", StorySource(news_id=None, source_url=None))
    story.refine_headline("   ")
    assert story.headline == "Original"
    story.refine_headline("Refined")
    assert story.headline == "Refined"
