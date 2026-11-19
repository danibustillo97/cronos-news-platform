"""COMPOSITION bounded context — a concrete, producible piece of content.
A Story can own many Compositions (one Reel, one Article, one Carousel...);
each is built from the typed Intelligence value objects by the ProduceStory
use case, never by dumping raw LAB artifacts into a generic property.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum

from app.domain.shared.errors import InvalidStateTransition
from app.domain.shared.ids import CompositionId, ProductionId, StoryId


class CompositionKind(str, Enum):
    REEL = "REEL"
    TIKTOK = "TIKTOK"
    INSTAGRAM_REEL = "INSTAGRAM_REEL"
    FACEBOOK_REEL = "FACEBOOK_REEL"
    YOUTUBE_SHORT = "YOUTUBE_SHORT"
    YOUTUBE_LONG_FORM = "YOUTUBE_LONG_FORM"
    ARTICLE = "ARTICLE"
    CAROUSEL = "CAROUSEL"
    STORY = "STORY"
    POST = "POST"


class CompositionStatus(str, Enum):
    DRAFT = "DRAFT"
    READY_FOR_REVIEW = "READY_FOR_REVIEW"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


@dataclass(frozen=True)
class ScriptLine:
    section: str
    text: str


@dataclass(frozen=True)
class CompositionShot:
    """One shot of the Composition's timeline, joined from LAB's typed
    Intelligence value objects by scene_id (AssemblyResult.shots x
    MediaPlan.scenes) — never invented. disposition mirrors LAB's own
    vocabulary (INCLUDED / EXCLUDED_NO_ASSET / BLOCKED_NOT_RENDERED): a shot
    with no real asset is excluded, never given a fabricated placeholder."""
    shot_id: str
    scene_id: str
    disposition: str
    duration_seconds: float
    asset_refs: list[str] = field(default_factory=list)


@dataclass(frozen=True)
class CompositionContent:
    angle: str | None
    hook: str | None
    script: list[ScriptLine]
    narrative_summary: str | None
    media_summary: str | None
    asset_refs: list[str]
    final_asset_ref: str | None
    shots: list[CompositionShot] = field(default_factory=list)


@dataclass
class Composition:
    id: CompositionId
    story_id: StoryId
    production_id: ProductionId
    kind: CompositionKind
    status: CompositionStatus
    content: CompositionContent
    target_platforms: list[str]

    @staticmethod
    def draft(
        composition_id: CompositionId, story_id: StoryId, production_id: ProductionId,
        kind: CompositionKind, content: CompositionContent,
    ) -> "Composition":
        status = CompositionStatus.READY_FOR_REVIEW if content.final_asset_ref else CompositionStatus.DRAFT
        return Composition(
            id=composition_id, story_id=story_id, production_id=production_id,
            kind=kind, status=status, content=content, target_platforms=[],
        )

    def approve(self) -> None:
        if self.status != CompositionStatus.READY_FOR_REVIEW:
            raise InvalidStateTransition("Composition", self.status.value, CompositionStatus.APPROVED.value)
        self.status = CompositionStatus.APPROVED

    def reject(self, reason: str) -> None:
        if self.status != CompositionStatus.READY_FOR_REVIEW:
            raise InvalidStateTransition("Composition", self.status.value, CompositionStatus.REJECTED.value)
        self.status = CompositionStatus.REJECTED

    def select_platforms(self, platforms: list[str]) -> None:
        if self.status != CompositionStatus.APPROVED:
            raise ValueError("Composition must be APPROVED before selecting distribution platforms")
        self.target_platforms = list(dict.fromkeys(platforms))
