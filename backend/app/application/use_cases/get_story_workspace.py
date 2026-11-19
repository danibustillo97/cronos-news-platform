"""The GET /api/stories/{id}/workspace projection — one coherent read
instead of the frontend making 15 requests. No N+1: compositions are
listed once and their distribution plans batched.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from app.domain.story.entities import Story
from app.domain.production.entities import Production
from app.domain.composition.entities import Composition
from app.domain.distribution.entities import DistributionPlan
from app.domain.ports import StoryRepository, ProductionRepository, CompositionRepository, DistributionRepository


@dataclass
class StoryWorkspace:
    story: Story
    production: Production | None
    compositions: list[Composition]
    distribution_plans: dict[str, list[DistributionPlan]] = field(default_factory=dict)


class GetStoryWorkspace:
    def __init__(
        self, stories: StoryRepository, productions: ProductionRepository,
        compositions: CompositionRepository, distributions: DistributionRepository,
    ) -> None:
        self._stories = stories
        self._productions = productions
        self._compositions = compositions
        self._distributions = distributions

    def execute(self, story_id: str) -> StoryWorkspace | None:
        story = self._stories.find_by_id(story_id)
        if story is None:
            return None

        production = self._productions.find_latest_for_story(story_id)
        compositions = self._compositions.list_for_story(story_id)
        distribution_plans = {
            str(c.id): self._distributions.list_for_composition(str(c.id)) for c in compositions
        }
        return StoryWorkspace(story=story, production=production, compositions=compositions, distribution_plans=distribution_plans)
