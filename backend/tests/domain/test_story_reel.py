import pytest

from app.domain.timeline.entities import TrackKind, Transform
from app.domain.timeline.story_reel import ManualShotSpec, build_timeline_from_manual_shots


def test_manual_shot_requires_non_empty_shot_id():
    with pytest.raises(ValueError):
        ManualShotSpec(shot_id="  ", duration_seconds=3.0, asset_refs=["a1"])


def test_manual_shot_requires_positive_duration():
    with pytest.raises(ValueError):
        ManualShotSpec(shot_id="s1", duration_seconds=0.0, asset_refs=["a1"])


def test_manual_shot_requires_at_least_one_asset_ref():
    with pytest.raises(ValueError):
        ManualShotSpec(shot_id="s1", duration_seconds=3.0, asset_refs=[])


def test_build_rejects_empty_shot_list():
    with pytest.raises(ValueError):
        build_timeline_from_manual_shots("reel1", [])


def test_build_rejects_duplicate_shot_ids():
    specs = [
        ManualShotSpec(shot_id="s1", duration_seconds=2.0, asset_refs=["a1"]),
        ManualShotSpec(shot_id="s1", duration_seconds=3.0, asset_refs=["a2"]),
    ]
    with pytest.raises(ValueError):
        build_timeline_from_manual_shots("reel1", specs)


def test_build_lays_out_shots_sequentially_in_given_order():
    specs = [
        ManualShotSpec(shot_id="intro", duration_seconds=2.0, asset_refs=["a1"]),
        ManualShotSpec(shot_id="body", duration_seconds=5.0, asset_refs=["a2", "a3"]),
        ManualShotSpec(shot_id="outro", duration_seconds=1.5, asset_refs=["a4"]),
    ]
    sequence = build_timeline_from_manual_shots("reel1", specs)
    video = sequence.track(TrackKind.VIDEO)

    assert [s.shot_id for s in video.shots] == ["intro", "body", "outro"]
    assert [s.timing.start_seconds for s in video.shots] == [0.0, 2.0, 7.0]
    assert sequence.duration_seconds == 8.5


def test_every_manual_shot_is_included_and_scene_id_mirrors_shot_id():
    specs = [ManualShotSpec(shot_id="s1", duration_seconds=2.0, asset_refs=["a1"])]
    sequence = build_timeline_from_manual_shots("reel1", specs)
    shot = sequence.track(TrackKind.VIDEO).shots[0]

    assert shot.is_included
    assert shot.scene_id == "s1"
    assert shot.declared_duration_seconds == 2.0


def test_transform_and_transition_pass_through_unmodified():
    custom_transform = Transform(scale=1.2)
    specs = [ManualShotSpec(shot_id="s1", duration_seconds=2.0, asset_refs=["a1"], transform=custom_transform)]
    sequence = build_timeline_from_manual_shots("reel1", specs)
    shot = sequence.track(TrackKind.VIDEO).shots[0]

    assert shot.transform == custom_transform
    assert not shot.transform.is_identity


def test_sequence_and_track_ids_are_derived_from_sequence_id():
    specs = [ManualShotSpec(shot_id="s1", duration_seconds=2.0, asset_refs=["a1"])]
    sequence = build_timeline_from_manual_shots("reel1", specs)

    assert sequence.sequence_id == "reel1"
    assert sequence.tracks[0].track_id == "reel1-video"
