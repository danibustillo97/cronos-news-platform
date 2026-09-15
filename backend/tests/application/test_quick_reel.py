"""Unit tests for QuickReel (P8) with in-memory test doubles -- proves the
deterministic eligibility rules and that a successful call really does
just re-shape existing Composition shots (via Timeline's real builder),
never calling out to LAB or fabricating anything.
"""
from __future__ import annotations

import pytest

from app.domain.composition.entities import Composition, CompositionContent, CompositionKind, CompositionShot
from app.domain.shared.errors import NotFoundError, QuickReelNotEligible
from app.domain.shared.ids import CompositionId, ProductionId, StoryId
from app.domain.story.entities import Story, StorySource, StoryStatus
from app.domain.timeline.entities import TrackKind
from app.application.use_cases.quick_reel import QuickReel, QuickReelInput


class InMemoryStoryRepo:
    def __init__(self):
        self.saved = {}

    def find_by_id(self, story_id):
        return self.saved.get(story_id)

    def find_by_source_news_id(self, news_id):
        return None

    def list_recent(self, limit):
        return list(self.saved.values())

    def save(self, story):
        self.saved[str(story.id)] = story


class InMemoryCompositionRepo:
    def __init__(self):
        self.saved = []

    def find_by_id(self, composition_id):
        return next((c for c in self.saved if str(c.id) == composition_id), None)

    def list_for_story(self, story_id):
        return [c for c in self.saved if str(c.story_id) == story_id]

    def save(self, composition):
        self.saved.append(composition)


def _story(status: StoryStatus) -> Story:
    story = Story.open_from_news(StoryId.new(), "Headline", StorySource(news_id=None, source_url=None))
    story.status = status
    return story


def _composition(story: Story, status_approved: bool, shots) -> Composition:
    content = CompositionContent(
        angle="HUMAN_ANGLE", hook="hook", script=[], narrative_summary=None,
        media_summary=None, asset_refs=[], final_asset_ref="final.mp4", shots=shots,
    )
    composition = Composition.draft(CompositionId.new(), story.id, ProductionId.new(), CompositionKind.TIKTOK, content)
    if status_approved:
        composition.approve()
    return composition


_INCLUDED_SHOT = CompositionShot(shot_id="s1", scene_id="sc1", disposition="INCLUDED", duration_seconds=4.0, asset_refs=["a1"])
_EXCLUDED_SHOT = CompositionShot(shot_id="s2", scene_id="sc2", disposition="EXCLUDED_NO_ASSET", duration_seconds=3.0, asset_refs=[])


def _use_case(stories: InMemoryStoryRepo, compositions: InMemoryCompositionRepo) -> QuickReel:
    return QuickReel(compositions=compositions, stories=stories)


def test_raises_not_found_for_unknown_composition():
    use_case = _use_case(InMemoryStoryRepo(), InMemoryCompositionRepo())
    with pytest.raises(NotFoundError):
        use_case.execute(QuickReelInput(composition_id="missing"))


def test_rejects_when_story_is_not_produced():
    story = _story(StoryStatus.IN_PRODUCTION)
    composition = _composition(story, status_approved=True, shots=[_INCLUDED_SHOT])
    stories, compositions = InMemoryStoryRepo(), InMemoryCompositionRepo()
    stories.save(story)
    compositions.save(composition)

    with pytest.raises(QuickReelNotEligible) as exc_info:
        _use_case(stories, compositions).execute(QuickReelInput(composition_id=str(composition.id)))
    assert exc_info.value.reason == "story_not_ready"


def test_rejects_when_composition_is_not_approved():
    story = _story(StoryStatus.PRODUCED)
    composition = _composition(story, status_approved=False, shots=[_INCLUDED_SHOT])
    stories, compositions = InMemoryStoryRepo(), InMemoryCompositionRepo()
    stories.save(story)
    compositions.save(composition)

    with pytest.raises(QuickReelNotEligible) as exc_info:
        _use_case(stories, compositions).execute(QuickReelInput(composition_id=str(composition.id)))
    assert exc_info.value.reason == "composition_not_approved"


def test_rejects_when_no_shot_has_a_real_asset():
    story = _story(StoryStatus.PRODUCED)
    composition = _composition(story, status_approved=True, shots=[_EXCLUDED_SHOT])
    stories, compositions = InMemoryStoryRepo(), InMemoryCompositionRepo()
    stories.save(story)
    compositions.save(composition)

    with pytest.raises(QuickReelNotEligible) as exc_info:
        _use_case(stories, compositions).execute(QuickReelInput(composition_id=str(composition.id)))
    assert exc_info.value.reason == "no_includable_shots"


def test_eligible_composition_produces_a_sequence_from_its_existing_shots():
    story = _story(StoryStatus.PRODUCED)
    composition = _composition(story, status_approved=True, shots=[_INCLUDED_SHOT, _EXCLUDED_SHOT])
    stories, compositions = InMemoryStoryRepo(), InMemoryCompositionRepo()
    stories.save(story)
    compositions.save(composition)

    sequence = _use_case(stories, compositions).execute(QuickReelInput(composition_id=str(composition.id)))

    video = sequence.track(TrackKind.VIDEO)
    assert [s.shot_id for s in video.shots] == ["s1", "s2"]
    assert sequence.duration_seconds == 4.0  # only the INCLUDED shot occupies real time
