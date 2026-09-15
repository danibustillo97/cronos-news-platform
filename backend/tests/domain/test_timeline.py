import pytest

from app.domain.composition.entities import Composition, CompositionContent, CompositionKind, CompositionShot
from app.domain.shared.ids import CompositionId, ProductionId, StoryId
from app.domain.timeline.builder import build_timeline_from_composition
from app.domain.timeline.entities import (
    Sequence,
    Timing,
    Track,
    TrackKind,
    Transform,
    Transition,
    TransitionType,
)


def test_timing_computes_end_seconds():
    t = Timing(start_seconds=2.0, duration_seconds=3.0)
    assert t.end_seconds == 5.0


def test_timing_rejects_negative_values():
    with pytest.raises(ValueError):
        Timing(start_seconds=-1.0, duration_seconds=1.0)
    with pytest.raises(ValueError):
        Timing(start_seconds=0.0, duration_seconds=-1.0)


def test_cut_transition_must_be_applied():
    with pytest.raises(ValueError):
        Transition(declared=TransitionType.CUT, applied=False)


def test_transition_cannot_be_applied_and_downgraded():
    with pytest.raises(ValueError):
        Transition(declared=TransitionType.FADE, applied=True, downgraded=True)


def test_declared_fade_not_yet_applied_is_a_legal_downgrade():
    transition = Transition(declared=TransitionType.FADE, applied=False, downgraded=True)
    assert transition.declared == TransitionType.FADE
    assert not transition.applied


def test_identity_transform_has_no_pan_zoom():
    assert Transform().is_identity
    assert not Transform(scale=1.2).is_identity


def test_track_duration_is_the_last_shot_end():
    track = Track(track_id="t1", kind=TrackKind.VIDEO)
    assert track.duration_seconds == 0.0


def test_sequence_duration_is_the_longest_track():
    long_track = Track(track_id="video", kind=TrackKind.VIDEO, shots=[])
    sequence = Sequence(sequence_id="seq1", tracks=[long_track])
    assert sequence.duration_seconds == 0.0
    assert sequence.track(TrackKind.VIDEO) is long_track
    assert sequence.track(TrackKind.AUDIO) is None


def _composition(shots):
    content = CompositionContent(
        angle="HUMAN_ANGLE", hook="hook", script=[], narrative_summary=None,
        media_summary=None, asset_refs=[], final_asset_ref="final.mp4", shots=shots,
    )
    return Composition.draft(CompositionId.new(), StoryId.of("s1"), ProductionId.new(), CompositionKind.TIKTOK, content)


def test_build_timeline_from_composition_lays_out_included_shots_sequentially():
    composition = _composition([
        CompositionShot(shot_id="shot_01", scene_id="scene_01", disposition="INCLUDED", duration_seconds=4.0, asset_refs=["a1"]),
        CompositionShot(shot_id="shot_02", scene_id="scene_02", disposition="INCLUDED", duration_seconds=3.0, asset_refs=["a2"]),
    ])
    sequence = build_timeline_from_composition(composition)
    video = sequence.track(TrackKind.VIDEO)

    assert [s.timing.start_seconds for s in video.shots] == [0.0, 4.0]
    assert [s.timing.duration_seconds for s in video.shots] == [4.0, 3.0]
    assert sequence.duration_seconds == 7.0


def test_build_timeline_excludes_shots_without_asset_from_physical_timing():
    composition = _composition([
        CompositionShot(shot_id="shot_01", scene_id="scene_01", disposition="INCLUDED", duration_seconds=4.0, asset_refs=["a1"]),
        CompositionShot(shot_id="shot_02", scene_id="scene_02", disposition="EXCLUDED_NO_ASSET", duration_seconds=5.0, asset_refs=[]),
        CompositionShot(shot_id="shot_03", scene_id="scene_03", disposition="INCLUDED", duration_seconds=2.0, asset_refs=["a3"]),
    ])
    sequence = build_timeline_from_composition(composition)
    video = sequence.track(TrackKind.VIDEO)

    excluded = video.shots[1]
    assert excluded.timing.duration_seconds == 0.0
    assert excluded.declared_duration_seconds == 5.0
    assert not excluded.is_included

    following = video.shots[2]
    assert following.timing.start_seconds == 4.0  # excluded shot did not push the cursor
    assert sequence.duration_seconds == 6.0


def test_build_timeline_ids_are_derived_from_composition_id():
    composition = _composition([])
    sequence = build_timeline_from_composition(composition)
    assert sequence.sequence_id == f"{composition.id}-sequence"
    assert sequence.tracks[0].track_id == f"{composition.id}-video"
