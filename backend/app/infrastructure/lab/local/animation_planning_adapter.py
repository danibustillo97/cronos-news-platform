from __future__ import annotations

from app.domain.intelligence.entities import AnimationPlan
from app.domain.shared.errors import CapabilityUnavailableError
from app.infrastructure.lab.local.export_reader import LabExportReader
from app.infrastructure.lab.live.composite_reader import default_reader


class LocalAnimationPlanningAdapter:
    """Reads LAB's real animation_plan.json — LAB's Animation capability."""

    def __init__(self, reader: LabExportReader | None = None) -> None:
        self._reader = reader or default_reader()

    def plan(self, story_id: str) -> AnimationPlan:
        bundle = self._reader.read(story_id)
        if bundle is None:
            raise CapabilityUnavailableError("animation_planning", story_id, reason="item_not_found")

        doc = next(
            (d for d in bundle.documents if "animation_plan_id" in d and "sequence_id" in d and "render_plan_id" not in d),
            None,
        )
        if doc is None:
            raise CapabilityUnavailableError("animation_planning", story_id)

        return AnimationPlan(
            animation_plan_id=doc["animation_plan_id"],
            total_duration_seconds=doc.get("total_duration_seconds"),
            shot_count=len(doc.get("shots", [])),
        )
