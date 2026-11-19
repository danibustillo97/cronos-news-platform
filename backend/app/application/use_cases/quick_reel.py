"""QuickReel (P8) -- rules-only reel assembly, deliberately the opposite of
ProduceStory: no LAB call, no Editorial/Narrative/Audio Direction
reasoning, nothing here ever asks an LLM to reconsider anything. It takes a
Composition that's already been produced and approved and lays its
existing shots straight onto a Sequence via Timeline's real builder (P7) --
that IS the "quick" in Quick Reel.
"""
from __future__ import annotations

from dataclasses import dataclass

from app.domain.shared.errors import NotFoundError, QuickReelNotEligible
from app.domain.story.entities import StoryStatus
from app.domain.composition.entities import CompositionStatus
from app.domain.ports import CompositionRepository, StoryRepository
from app.domain.timeline.builder import build_timeline_from_composition
from app.domain.timeline.entities import Sequence


@dataclass
class QuickReelInput:
    composition_id: str


class QuickReel:
    def __init__(self, compositions: CompositionRepository, stories: StoryRepository) -> None:
        self._compositions = compositions
        self._stories = stories

    def execute(self, input: QuickReelInput) -> Sequence:
        composition = self._compositions.find_by_id(input.composition_id)
        if composition is None:
            raise NotFoundError("Composition", input.composition_id)

        story = self._stories.find_by_id(str(composition.story_id))
        if story is None:
            raise NotFoundError("Story", str(composition.story_id))

        # Deterministic eligibility rules, in the order the READY mapping
        # (CRONOS - Domain Language Alignment) states them: the Story must
        # be READY (PRODUCED) and, for this specific piece, the
        # Composition must be APPROVED.
        if story.status != StoryStatus.PRODUCED:
            raise QuickReelNotEligible(input.composition_id, reason="story_not_ready")
        if composition.status != CompositionStatus.APPROVED:
            raise QuickReelNotEligible(input.composition_id, reason="composition_not_approved")
        if not any(shot.disposition == "INCLUDED" for shot in composition.content.shots):
            raise QuickReelNotEligible(input.composition_id, reason="no_includable_shots")

        return build_timeline_from_composition(composition)
