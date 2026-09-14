from __future__ import annotations

from dataclasses import dataclass

from app.domain.shared.errors import NotFoundError
from app.domain.shared.ids import DistributionPlanId
from app.domain.distribution.entities import DistributionPlan, DistributionStatus, Platform, Format
from app.domain.ports import CompositionRepository, DistributionRepository, PublishingAvailabilityPort

_PLATFORM_FORMAT = {
    Platform.WEB: Format.ARTICLE, Platform.TIKTOK: Format.REEL, Platform.INSTAGRAM: Format.REEL,
    Platform.FACEBOOK: Format.REEL, Platform.YOUTUBE: Format.SHORT,
}


@dataclass
class PrepareDistributionInput:
    composition_id: str
    platforms: list[Platform]
    copy: str | None = None


class PrepareDistribution:
    def __init__(
        self, compositions: CompositionRepository, distributions: DistributionRepository,
        availability: PublishingAvailabilityPort,
    ) -> None:
        self._compositions = compositions
        self._distributions = distributions
        self._availability = availability

    def execute(self, input: PrepareDistributionInput) -> list[DistributionPlan]:
        composition = self._compositions.find_by_id(input.composition_id)
        if composition is None:
            raise NotFoundError("Composition", input.composition_id)

        composition.select_platforms([p.value for p in input.platforms])
        self._compositions.save(composition)

        plans: list[DistributionPlan] = []
        for platform in input.platforms:
            connected = self._availability.is_connected(platform)
            plan = DistributionPlan.create(
                DistributionPlanId.new(), composition.id, platform, _PLATFORM_FORMAT[platform],
                DistributionStatus.READY if connected else DistributionStatus.NOT_CONNECTED,
                input.copy or composition.content.hook,
            )
            self._distributions.save(plan)
            plans.append(plan)
        return plans
