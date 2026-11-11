"""STUDIO — NEXUS's audiovisual production system. Turns a real, already
PUBLISHED Artifact (see app/domain/artifact/) into an editable graphic /
reel project -- never a generic video editor with invented content. A
StudioProject always traces back to one real `source_artifact_id`; every
clip that carries an asset or text either points at a real MediaRequirement
(via `source_placeholder_id`) or holds real Artifact copy (title/subtitle/
excerpt/caption) -- Phase 1 never invents narrative text (that's AI
Storyboard/Script, Phase 2 -- see CreateStudioProject's own docstring in
application/use_cases/studio.py).

Persistence is one `studio_projects` row per version, with a `content`
jsonb holding `scenes`/`clips` -- same pragmatic convention as
app/domain/composition/entities.py's `compositions.content`, not
normalized Scene/Track/Clip tables. Track is a field on each clip, not a
separate persisted entity -- the timeline UI groups by it to draw rows.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum

from app.domain.shared.ids import StudioProjectId


class StudioMode(str, Enum):
    IMAGE = "IMAGE"
    REEL = "REEL"
    LIVE = "LIVE"  # reserved -- no LIVE logic exists until Phase 4


class CompositionFormat(str, Enum):
    """Canonical master-composition formats (spec sections 10/39) --
    distinct from app/domain/distribution/entities.py's Format (that one
    describes a DELIVERY (platform, format) pair's own lifecycle; this
    describes the canvas itself). REEL_9X16/LANDSCAPE_16X9 map onto real,
    sourced per-platform safe-zone profiles already in
    distribution/safe_area.py (TikTok/Instagram Reels/Facebook Reels/
    YouTube Shorts all resolve to 9:16; YouTube long-form to 16:9).
    FEED_4X5/SQUARE_1X1 are static-post formats with no equivalent
    published per-platform UI-chrome spec (no platform overlays a
    scrolling caption bar on a static feed post the way a Reel does) --
    see get_safe_area in application/use_cases/studio.py for how those
    two are handled honestly instead of inventing platform data."""
    REEL_9X16 = "REEL_9X16"
    FEED_4X5 = "FEED_4X5"
    SQUARE_1X1 = "SQUARE_1X1"
    LANDSCAPE_16X9 = "LANDSCAPE_16X9"


CANVAS_SIZE: dict[CompositionFormat, tuple[int, int]] = {
    CompositionFormat.REEL_9X16: (1080, 1920),
    CompositionFormat.FEED_4X5: (1080, 1350),
    CompositionFormat.SQUARE_1X1: (1080, 1080),
    CompositionFormat.LANDSCAPE_16X9: (1920, 1080),
}


class TrackType(str, Enum):
    VIDEO = "VIDEO"
    IMAGE = "IMAGE"
    TEXT = "TEXT"
    VOICE = "VOICE"
    MUSIC = "MUSIC"
    SFX = "SFX"
    OVERLAY = "OVERLAY"
    CAPTION = "CAPTION"
    BRANDING = "BRANDING"


@dataclass(frozen=True)
class ClipTransform:
    """Real, editable per-clip placement -- the Inspector (section 32)
    reads and writes this directly. Defaults are a full-bleed, untouched
    clip. `focal_x`/`focal_y` (0..1) preserve an image's real focal point
    across format switches (section 12) -- never recomputed/guessed."""
    x: float = 0.0
    y: float = 0.0
    scale: float = 1.0
    rotation: float = 0.0
    opacity: float = 1.0
    focal_x: float = 0.5
    focal_y: float = 0.5


@dataclass(frozen=True)
class StudioClip:
    id: str
    track: TrackType
    start_ms: int
    duration_ms: int
    # Real provenance (section 30) -- never a fabricated asset. Set when
    # this clip's image came from the source Artifact's own
    # MediaRequirement; None for a clip built later from a
    # generated/uploaded asset (Phase 2+) or a pure text/branding clip.
    source_placeholder_id: str | None = None
    asset_id: str | None = None
    text: str | None = None
    transform: ClipTransform = field(default_factory=ClipTransform)
    locked: bool = False
    muted: bool = False
    hidden: bool = False


@dataclass(frozen=True)
class StudioScene:
    id: str
    order: int
    duration_ms: int
    clips: list[StudioClip] = field(default_factory=list)


class StudioProjectStatus(str, Enum):
    DRAFT = "DRAFT"
    READY = "READY"


@dataclass
class StudioProject:
    id: StudioProjectId
    source_artifact_id: str
    mode: StudioMode
    template_id: str
    format: CompositionFormat
    status: StudioProjectStatus
    version: int
    scenes: list[StudioScene]
    created_at: datetime
    updated_at: datetime
    parent_project_id: str | None = None  # the version this was duplicated from, if any
    title: str = ""  # project's own display name -- defaults to the source Artifact's title at creation

    def total_duration_ms(self) -> int:
        return sum(s.duration_ms for s in self.scenes)

    def replace_scenes(self, scenes: list[StudioScene], updated_at: datetime) -> None:
        """The real autosave/edit path -- a whole-scenes-array replace,
        same "trust the caller, it's an explicit editor action" precedent
        as Artifact.update_editorial_fields."""
        self.scenes = scenes
        self.updated_at = updated_at

    def set_format(self, format: CompositionFormat, updated_at: datetime) -> None:
        """Section 12: changing format never deletes/deforms content --
        recomputing each clip's transform for the new canvas is the
        frontend FormatSwitcher's job; this just records the real,
        final choice."""
        self.format = format
        self.updated_at = updated_at

    def set_template(self, template_id: str, updated_at: datetime) -> None:
        """Section 5: template changes without losing content -- scenes/
        clips are untouched, only which TemplateElement tree renders them
        changes (frontend-resolved)."""
        self.template_id = template_id
        self.updated_at = updated_at

    def duplicate(self, new_id: StudioProjectId, new_version: int, created_at: datetime) -> "StudioProject":
        """Section 21: a new, independent version -- never mutates this
        one. A version nobody edits again from this point on stays
        exactly as it was, because it's simply a different row."""
        return StudioProject(
            id=new_id, source_artifact_id=self.source_artifact_id, mode=self.mode,
            template_id=self.template_id, format=self.format, status=StudioProjectStatus.DRAFT,
            version=new_version, scenes=list(self.scenes), created_at=created_at, updated_at=created_at,
            parent_project_id=str(self.id), title=self.title,
        )
