"""The one real builder today: derives a Sequence from a produced
Composition's shots (joined from LAB's Assembly+Media in P4, see CRONOS -
Domain Language Alignment). Pure function — no I/O, no LAB reads of its
own; it only re-shapes data ProduceStory already assembled.

Quick Reel (P8) and Story Reel (P9) will need their own builders that
construct a Sequence without a produced Composition to derive from (rules-
based and manual respectively) — this module intentionally doesn't
anticipate those; YAGNI until either exists.
"""
from __future__ import annotations

from app.domain.composition.entities import Composition
from app.domain.timeline.entities import Sequence, Timing, TimelineShot, Track, TrackKind


def build_timeline_from_composition(composition: Composition) -> Sequence:
    """Only INCLUDED shots advance the track cursor and occupy real
    seconds — EXCLUDED_NO_ASSET / BLOCKED_NOT_RENDERED shots keep their
    declared duration for accounting (Timing.duration_seconds == 0) but
    never displace the shots after them, matching Assembly's own
    declared-vs-included duration split (AssemblyResult.declared_duration_seconds
    vs included_duration_seconds)."""
    shots: list[TimelineShot] = []
    cursor = 0.0
    for shot in composition.content.shots:
        included = shot.disposition == "INCLUDED"
        duration = shot.duration_seconds if included else 0.0
        shots.append(TimelineShot(
            shot_id=shot.shot_id, scene_id=shot.scene_id, disposition=shot.disposition,
            timing=Timing(start_seconds=cursor, duration_seconds=duration),
            declared_duration_seconds=shot.duration_seconds,
            asset_refs=list(shot.asset_refs),
        ))
        cursor += duration

    video_track = Track(track_id=f"{composition.id}-video", kind=TrackKind.VIDEO, shots=shots)
    return Sequence(sequence_id=f"{composition.id}-sequence", tracks=[video_track])
