"""Integration tests against the REAL historical validation case
(793ff158b714) — no fakes, no mocks: these read the actual files LAB
produced on disk. Skipped (not failed) if that export isn't present on the
machine running the tests, since it's environment-specific real data.
"""
from __future__ import annotations

import pytest

from app.infrastructure.lab.local.export_reader import LabExportReader
from app.infrastructure.lab.local.editorial_intelligence_adapter import LocalEditorialIntelligenceAdapter
from app.infrastructure.lab.local.story_intelligence_adapter import LocalStoryIntelligenceAdapter
from app.infrastructure.lab.local.narrative_direction_adapter import LocalNarrativeDirectionAdapter
from app.infrastructure.lab.local.audio_direction_adapter import LocalAudioDirectionAdapter
from app.infrastructure.lab.local.media_planning_adapter import LocalMediaPlanningAdapter
from app.infrastructure.lab.local.sequence_planning_adapter import LocalSequencePlanningAdapter
from app.infrastructure.lab.local.animation_planning_adapter import LocalAnimationPlanningAdapter
from app.infrastructure.lab.local.render_adapter import LocalRenderAdapter
from app.infrastructure.lab.local.assembly_adapter import LocalAssemblyAdapter

STORY_ID = "793ff158b714"

reader = LabExportReader()
pytestmark = pytest.mark.skipif(not reader.is_available(STORY_ID), reason=f"LAB export for {STORY_ID} not present on this machine")


def test_editorial_intelligence_reads_real_headline():
    result = LocalEditorialIntelligenceAdapter(reader).analyze(STORY_ID)
    assert result.headline is not None
    assert result.angle == "HUMAN_ANGLE"


def test_story_intelligence_reads_real_hooks_and_concepts():
    result = LocalStoryIntelligenceAdapter(reader).discover(STORY_ID)
    assert len(result.hooks) == 3
    assert len(result.concepts) == 2


def test_narrative_direction_reads_real_beats():
    result = LocalNarrativeDirectionAdapter(reader).plan(STORY_ID)
    assert len(result.beats) == 5


def test_audio_direction_reads_real_tracks():
    result = LocalAudioDirectionAdapter(reader).plan(STORY_ID)
    assert len(result.tracks) == 9


def test_media_planning_reads_real_scene_decisions():
    result = LocalMediaPlanningAdapter(reader).plan(STORY_ID)
    assert len(result.scenes) == 5


def test_sequence_planning_reads_real_plan():
    result = LocalSequencePlanningAdapter(reader).plan(STORY_ID)
    assert result.sequence_id


def test_animation_planning_reads_real_plan():
    result = LocalAnimationPlanningAdapter(reader).plan(STORY_ID)
    assert result.animation_plan_id


def test_render_reads_real_result():
    result = LocalRenderAdapter(reader).result(STORY_ID)
    assert result.render_plan_id


def test_assembly_reads_real_result_and_final_asset():
    result = LocalAssemblyAdapter(reader).result(STORY_ID)
    assert result.assembly_plan_id
    assert result.included_duration_seconds == 4.0
    assert result.declared_duration_seconds == 17.0
    assert result.final_asset_ref is not None
    assert "final_reel.mp4" in result.final_asset_ref
