import pytest

from app.domain.composition.entities import Composition, CompositionContent, CompositionKind
from app.domain.shared.ids import CompositionId, ProductionId, StoryId
from app.domain.shared.errors import InvalidStateTransition


def _content(final_asset_ref=None):
    return CompositionContent(
        angle="HUMAN_ANGLE", hook="hook", script=[], narrative_summary=None,
        media_summary=None, asset_refs=[], final_asset_ref=final_asset_ref,
    )


def test_draft_without_final_asset_is_draft_status():
    c = Composition.draft(CompositionId.new(), StoryId.of("s1"), ProductionId.new(), CompositionKind.TIKTOK, _content())
    assert c.status.value == "DRAFT"


def test_draft_with_final_asset_is_ready_for_review():
    c = Composition.draft(CompositionId.new(), StoryId.of("s1"), ProductionId.new(), CompositionKind.TIKTOK, _content("final.mp4"))
    assert c.status.value == "READY_FOR_REVIEW"


def test_approve_requires_ready_for_review():
    c = Composition.draft(CompositionId.new(), StoryId.of("s1"), ProductionId.new(), CompositionKind.TIKTOK, _content())
    with pytest.raises(InvalidStateTransition):
        c.approve()


def test_select_platforms_requires_approved():
    c = Composition.draft(CompositionId.new(), StoryId.of("s1"), ProductionId.new(), CompositionKind.TIKTOK, _content("final.mp4"))
    c.approve()
    c.select_platforms(["TIKTOK", "WEB", "TIKTOK"])
    assert c.target_platforms == ["TIKTOK", "WEB"]  # de-duplicated, order preserved
