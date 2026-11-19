"""INTELLIGENCE bounded context — the conceptual capabilities LAB provides,
modeled as their own typed value objects (never a single JSON blob). Each
one is produced by its own capability port and persisted as its own
`story_intelligence` row (kind + payload), so the domain always knows which
capability produced what, distinctly.
"""
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class RecommendedFormat:
    format: str
    reason: str | None = None


@dataclass(frozen=True)
class EditorialIntelligence:
    """LAB Editorial Understanding -> Editorial Intelligence capability."""
    headline: str | None
    what_happened: str | None
    angle: str | None
    narrative_strength: str | None
    why_it_matters: str | None
    recommended_formats: list[RecommendedFormat] = field(default_factory=list)


@dataclass(frozen=True)
class StoryConcept:
    title: str
    summary: str
    angle: str | None = None
    provenance: str | None = None


@dataclass(frozen=True)
class Hook:
    text: str
    strategy: str | None = None


@dataclass(frozen=True)
class ScriptSection:
    section: str
    text: str


@dataclass(frozen=True)
class StoryIntelligence:
    """LAB Storycraft -> Story Intelligence / Story Context capability:
    concepts, hooks and script — how the story could be told, and the
    concrete words chosen to tell it."""
    has_story: bool
    reason_if_not: str | None
    concepts: list[StoryConcept] = field(default_factory=list)
    hooks: list[Hook] = field(default_factory=list)
    script: list[ScriptSection] = field(default_factory=list)


@dataclass(frozen=True)
class NarrativeBeat:
    order: int
    emotion: str
    emotional_intensity: str
    narrative_function: str
    pacing_intention: str


@dataclass(frozen=True)
class NarrativeDirection:
    """LAB Narrative -> Narrative Direction capability."""
    beats: list[NarrativeBeat] = field(default_factory=list)


@dataclass(frozen=True)
class AudioTrack:
    role: str
    beat_id: str


@dataclass(frozen=True)
class SilenceWindow:
    beat_id: str
    treatment: str


@dataclass(frozen=True)
class AudioDirection:
    """LAB Audio -> Audio Direction capability."""
    tracks: list[AudioTrack] = field(default_factory=list)
    silence_windows: list[SilenceWindow] = field(default_factory=list)
    ducking_priority: list[str] = field(default_factory=list)


@dataclass(frozen=True)
class SceneMediaDecision:
    scene_id: str
    media_type: str
    generation_required: bool
    asset_ids: list[str] = field(default_factory=list)


@dataclass(frozen=True)
class MediaPlan:
    """LAB Media -> Media Planning capability."""
    scenes: list[SceneMediaDecision] = field(default_factory=list)


@dataclass(frozen=True)
class SequencePlan:
    """LAB Sequence -> Sequence Planning capability."""
    sequence_id: str
    total_duration_seconds: float | None
    shot_count: int


@dataclass(frozen=True)
class AnimationPlan:
    """LAB Animation -> Animation Planning capability."""
    animation_plan_id: str
    total_duration_seconds: float | None
    shot_count: int


@dataclass(frozen=True)
class RenderResult:
    """LAB Render -> Render Execution capability."""
    render_plan_id: str
    rendered_shot_count: int
    shot_count: int


@dataclass(frozen=True)
class AssemblyShot:
    shot_id: str
    scene_id: str
    disposition: str
    duration_seconds: float


@dataclass(frozen=True)
class AssemblyResult:
    """LAB Assembly -> Assembly capability."""
    assembly_plan_id: str
    declared_duration_seconds: float
    included_duration_seconds: float
    shots: list[AssemblyShot] = field(default_factory=list)
    final_asset_ref: str | None = None
