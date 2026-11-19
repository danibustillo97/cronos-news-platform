"""Unit tests for GetPlatformPreview (P10) -- proves it assembles the same
Sequence/DistributionProfile that already exist rather than inventing a
parallel preview-specific model."""
from __future__ import annotations

import pytest

from app.domain.composition.entities import Composition, CompositionContent, CompositionKind, CompositionShot
from app.domain.distribution.entities import Format, Platform
from app.domain.distribution.safe_area import get_profile
from app.domain.shared.errors import NotFoundError
from app.domain.shared.ids import CompositionId, ProductionId, StoryId
from app.domain.timeline.entities import TrackKind
from app.application.use_cases.platform_preview import GetPlatformPreview, GetPlatformPreviewInput


class InMemoryCompositionRepo:
    def __init__(self):
        self.saved = []

    def find_by_id(self, composition_id):
        return next((c for c in self.saved if str(c.id) == composition_id), None)

    def list_for_story(self, story_id):
        return [c for c in self.saved if str(c.story_id) == story_id]

    def save(self, composition):
        self.saved.append(composition)


def _composition(shots):
    content = CompositionContent(
        angle="HUMAN_ANGLE", hook="hook", script=[], narrative_summary=None,
        media_summary=None, asset_refs=[], final_asset_ref="final.mp4", shots=shots,
    )
    return Composition.draft(CompositionId.new(), StoryId.of("s1"), ProductionId.new(), CompositionKind.TIKTOK, content)


_SHOT = CompositionShot(shot_id="s1", scene_id="sc1", disposition="INCLUDED", duration_seconds=4.0, asset_refs=["a1"])


def test_raises_not_found_for_unknown_composition():
    use_case = GetPlatformPreview(InMemoryCompositionRepo())
    with pytest.raises(NotFoundError):
        use_case.execute(GetPlatformPreviewInput(composition_id="missing", platform=Platform.TIKTOK, format=Format.REEL))


def test_raises_not_found_for_a_platform_format_pair_with_no_profile():
    compositions = InMemoryCompositionRepo()
    composition = _composition([_SHOT])
    compositions.save(composition)
    use_case = GetPlatformPreview(compositions)

    with pytest.raises(NotFoundError):
        use_case.execute(GetPlatformPreviewInput(composition_id=str(composition.id), platform=Platform.WEB, format=Format.ARTICLE))


def test_preview_bundles_the_real_sequence_and_the_real_distribution_profile():
    compositions = InMemoryCompositionRepo()
    composition = _composition([_SHOT])
    compositions.save(composition)
    use_case = GetPlatformPreview(compositions)

    preview = use_case.execute(GetPlatformPreviewInput(composition_id=str(composition.id), platform=Platform.TIKTOK, format=Format.REEL))

    assert preview.profile == get_profile(Platform.TIKTOK, Format.REEL)
    video = preview.sequence.track(TrackKind.VIDEO)
    assert [s.shot_id for s in video.shots] == ["s1"]
    assert preview.sequence.duration_seconds == 4.0
