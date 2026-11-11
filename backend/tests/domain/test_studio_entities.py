from __future__ import annotations

from datetime import datetime, timezone

from app.domain.shared.ids import StudioProjectId
from app.domain.studio.entities import (
    CANVAS_SIZE, ClipTransform, CompositionFormat, StudioClip, StudioMode, StudioProject, StudioProjectStatus,
    StudioScene, TrackType,
)


def _project(**overrides) -> StudioProject:
    now = datetime(2026, 1, 1, tzinfo=timezone.utc)
    defaults = dict(
        id=StudioProjectId.new(), source_artifact_id="artifact-1", mode=StudioMode.REEL,
        template_id="nexus_editorial", format=CompositionFormat.REEL_9X16, status=StudioProjectStatus.DRAFT,
        version=1, scenes=[], created_at=now, updated_at=now, title="Confirman muerte de los cinco ocupantes",
    )
    defaults.update(overrides)
    return StudioProject(**defaults)


def test_total_duration_ms_sums_every_scene():
    project = _project(scenes=[
        StudioScene(id="s1", order=0, duration_ms=3000),
        StudioScene(id="s2", order=1, duration_ms=4000),
    ])
    assert project.total_duration_ms() == 7000


def test_replace_scenes_updates_content_and_timestamp():
    project = _project()
    before = project.updated_at
    new_scenes = [StudioScene(id="s1", order=0, duration_ms=1000)]
    project.replace_scenes(new_scenes, datetime(2026, 2, 1, tzinfo=timezone.utc))
    assert project.scenes == new_scenes
    assert project.updated_at > before


def test_set_format_changes_format_without_touching_scenes():
    clip = StudioClip(id="c1", track=TrackType.IMAGE, start_ms=0, duration_ms=1000)
    scene = StudioScene(id="s1", order=0, duration_ms=1000, clips=[clip])
    project = _project(scenes=[scene])
    project.set_format(CompositionFormat.SQUARE_1X1, datetime(2026, 2, 1, tzinfo=timezone.utc))
    assert project.format == CompositionFormat.SQUARE_1X1
    assert project.scenes == [scene]  # content untouched -- section 12


def test_duplicate_creates_independent_version_never_mutating_source():
    source = _project(version=1, scenes=[StudioScene(id="s1", order=0, duration_ms=1000)])
    new_id = StudioProjectId.new()
    copy = source.duplicate(new_id, new_version=2, created_at=datetime(2026, 3, 1, tzinfo=timezone.utc))

    assert copy.id == new_id
    assert copy.version == 2
    assert copy.parent_project_id == str(source.id)
    assert copy.status == StudioProjectStatus.DRAFT
    assert copy.scenes == source.scenes
    # Source itself is untouched by duplication.
    assert source.version == 1
    assert source.parent_project_id is None


def test_canvas_size_defined_for_every_format():
    for format in CompositionFormat:
        assert format in CANVAS_SIZE
        width, height = CANVAS_SIZE[format]
        assert width > 0 and height > 0


def test_clip_transform_defaults_are_full_bleed_centered_focal_point():
    transform = ClipTransform()
    assert (transform.x, transform.y, transform.scale, transform.rotation, transform.opacity) == (0.0, 0.0, 1.0, 0.0, 1.0)
    assert (transform.focal_x, transform.focal_y) == (0.5, 0.5)
