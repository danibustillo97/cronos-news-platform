"""Story Reel (P9) -- the manual counterpart to Quick Reel (P8). Where
Quick Reel derives a Sequence from shots LAB already produced and
ProduceStory already joined, Story Reel builds one from shots a human
editor curated directly (the "secuencia manual tipo Noris Viral" the
roadmap names -- "Noris Viral" is one value of the content_type
enumeration the product spec lists, see CRONOS - Domain Language
Alignment's P2 gap; no further structural spec exists for it beyond
"manually sequenced", so this module implements exactly that, not
anything Noris-specific).

No LAB read, no repository lookup, no Story/Composition status to check --
a human already decided what goes in and in what order, so there's no
"is this eligible" gate the way QuickReel has one. What IS enforced is
structural: a manually curated shot always carries real asset refs (a
human placed it on purpose) and a positive duration -- unlike LAB's
pipeline, there is no legitimate EXCLUDED_NO_ASSET case here, so it's
rejected outright rather than modeled as a valid disposition.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from app.domain.timeline.entities import Sequence, Timing, TimelineShot, Track, TrackKind, Transform, Transition


@dataclass(frozen=True)
class ManualShotSpec:
    """One editor-authored shot. scene_id is deliberately absent -- there
    is no MediaPlan scene backing a manually curated shot, so
    TimelineShot.scene_id is set equal to shot_id rather than inventing a
    scene concept that doesn't apply here."""
    shot_id: str
    duration_seconds: float
    asset_refs: list[str]
    transform: Transform = field(default_factory=Transform)
    transition_in: Transition = field(default_factory=Transition)

    def __post_init__(self) -> None:
        if not self.shot_id.strip():
            raise ValueError("a manually curated shot needs a non-empty shot_id")
        if self.duration_seconds <= 0:
            raise ValueError("a manually curated shot must have a positive duration")
        if not self.asset_refs:
            raise ValueError("a manually curated shot must reference at least one real asset")


def build_timeline_from_manual_shots(sequence_id: str, shot_specs: list[ManualShotSpec]) -> Sequence:
    """Lays shots out end to end in the given order -- the only layout
    rule a "secuencia manual" needs, since the human already decided the
    order and each shot's duration. Every shot is INCLUDED by
    construction (ManualShotSpec cannot be built without real asset_refs)."""
    if not shot_specs:
        raise ValueError("a Story Reel needs at least one shot")

    shot_ids = [spec.shot_id for spec in shot_specs]
    if len(shot_ids) != len(set(shot_ids)):
        raise ValueError("shot_id must be unique within a Story Reel")

    shots: list[TimelineShot] = []
    cursor = 0.0
    for spec in shot_specs:
        shots.append(TimelineShot(
            shot_id=spec.shot_id, scene_id=spec.shot_id, disposition="INCLUDED",
            timing=Timing(start_seconds=cursor, duration_seconds=spec.duration_seconds),
            declared_duration_seconds=spec.duration_seconds,
            asset_refs=list(spec.asset_refs), transform=spec.transform, transition_in=spec.transition_in,
        ))
        cursor += spec.duration_seconds

    video_track = Track(track_id=f"{sequence_id}-video", kind=TrackKind.VIDEO, shots=shots)
    return Sequence(sequence_id=sequence_id, tracks=[video_track])
