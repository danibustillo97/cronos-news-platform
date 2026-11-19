from __future__ import annotations

from app.domain.intelligence.entities import SequencePlan
from app.domain.shared.errors import CapabilityUnavailableError
from app.infrastructure.lab.local.export_reader import LabExportReader
from app.infrastructure.lab.live.composite_reader import default_reader


class LocalSequencePlanningAdapter:
    """Reads LAB's real sequence.json — LAB's Sequence capability."""

    def __init__(self, reader: LabExportReader | None = None) -> None:
        self._reader = reader or default_reader()

    def plan(self, story_id: str) -> SequencePlan:
        bundle = self._reader.read(story_id)
        if bundle is None:
            raise CapabilityUnavailableError("sequence_planning", story_id, reason="item_not_found")

        doc = next(
            (d for d in bundle.documents if "sequence_id" in d and "animation_plan_id" not in d and "shots" in d),
            None,
        )
        if doc is None:
            raise CapabilityUnavailableError("sequence_planning", story_id)

        return SequencePlan(
            sequence_id=doc["sequence_id"],
            total_duration_seconds=doc.get("total_duration_seconds"),
            shot_count=len(doc.get("shots", [])),
        )
