"""TIMELINE — the declarative Sequence->Track->Shot model CRONOS renders
and previews from, deliberately separate from COMPOSITION (P4) even though
today's only real builder (builder.py) derives one from the other. The
split matters because Quick Reel (P8) and Story Reel (P9) will construct a
Sequence directly — without ever having a produced Composition.content.shots
to derive from — so Timeline can't be a method on Composition; it has to
stand on its own.

Mirrors LAB's own declarative-plan discipline (sequence.json /
animation_plan.json: Editorial reasoning declares intent, deterministic
code executes — never re-decides, see CRONOS - Render Architecture
Decision.md): a Sequence is data, not behavior. Nothing here renders,
reads a file, or calls FFmpeg.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum


class TrackKind(str, Enum):
    VIDEO = "VIDEO"
    AUDIO = "AUDIO"
    TEXT = "TEXT"


class TransitionType(str, Enum):
    CUT = "CUT"
    FADE = "FADE"
    DISSOLVE = "DISSOLVE"


@dataclass(frozen=True)
class Transition:
    """Mirrors Assembly's own declared-vs-applied vocabulary (see CRONOS -
    Assembly.md): v1 only ever executes CUT, so FADE/DISSOLVE are legal to
    *declare* here but must carry applied=False, downgraded=True until an
    Assembly implementation exists to honor them — never silently claim a
    transition was applied when it wasn't."""
    declared: TransitionType = TransitionType.CUT
    applied: bool = True
    downgraded: bool = False

    def __post_init__(self) -> None:
        if self.declared == TransitionType.CUT and not self.applied:
            raise ValueError("CUT is always applied — there is nothing to downgrade")
        if self.applied and self.downgraded:
            raise ValueError("a transition cannot be both applied and downgraded")


@dataclass(frozen=True)
class Transform:
    """A static frame placement — identity (no pan/zoom) by default.
    LAB's Assembly design paused its Ken Burns magnitude for lacking
    editorial backing (see CRONOS - Assembly.md): it would have been an
    invented visual treatment, not a sourced decision. Timeline leaves room
    for real per-shot motion once that lands; it never fabricates motion
    today."""
    x: float = 0.0
    y: float = 0.0
    scale: float = 1.0
    rotation_degrees: float = 0.0

    @property
    def is_identity(self) -> bool:
        return self.x == 0.0 and self.y == 0.0 and self.scale == 1.0 and self.rotation_degrees == 0.0


@dataclass(frozen=True)
class Timing:
    """Position on the track's own timeline, in seconds — never wall-clock,
    never global-sequence-relative (that's a Track's job to lay out)."""
    start_seconds: float
    duration_seconds: float

    def __post_init__(self) -> None:
        if self.start_seconds < 0:
            raise ValueError("start_seconds cannot be negative")
        if self.duration_seconds < 0:
            raise ValueError("duration_seconds cannot be negative")

    @property
    def end_seconds(self) -> float:
        return self.start_seconds + self.duration_seconds


@dataclass(frozen=True)
class TimelineShot:
    """One shot placed on a Track. disposition mirrors LAB's own vocabulary
    (INCLUDED / EXCLUDED_NO_ASSET / BLOCKED_NOT_RENDERED, see
    CompositionShot) — a shot that isn't INCLUDED occupies zero physical
    seconds (Timing.duration_seconds == 0) even though it may carry a
    nonzero declared_duration_seconds for accounting, matching Assembly's
    own declared-vs-included distinction. Never given a fabricated asset to
    fill the gap."""
    shot_id: str
    scene_id: str
    disposition: str
    timing: Timing
    declared_duration_seconds: float
    asset_refs: list[str] = field(default_factory=list)
    transform: Transform = field(default_factory=Transform)
    transition_in: Transition = field(default_factory=Transition)

    @property
    def is_included(self) -> bool:
        return self.disposition == "INCLUDED"


@dataclass(frozen=True)
class Track:
    track_id: str
    kind: TrackKind
    shots: list[TimelineShot] = field(default_factory=list)

    @property
    def duration_seconds(self) -> float:
        return max((s.timing.end_seconds for s in self.shots), default=0.0)


@dataclass(frozen=True)
class Sequence:
    """The root of a Timeline. tracks are ordered but independent —
    duration_seconds is the longest track, since a shorter audio or text
    track doesn't truncate video."""
    sequence_id: str
    tracks: list[Track] = field(default_factory=list)

    @property
    def duration_seconds(self) -> float:
        return max((t.duration_seconds for t in self.tracks), default=0.0)

    def track(self, kind: TrackKind) -> Track | None:
        return next((t for t in self.tracks if t.kind == kind), None)
