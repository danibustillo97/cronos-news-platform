from __future__ import annotations

from app.domain.intelligence.entities import NarrativeDirection, NarrativeBeat
from app.domain.shared.errors import CapabilityUnavailableError
from app.infrastructure.lab.local.export_reader import LabExportReader
from app.infrastructure.lab.live.composite_reader import default_reader


class LocalNarrativeDirectionAdapter:
    """Reads LAB's real narrative_direction.json — LAB's Narrative capability."""

    def __init__(self, reader: LabExportReader | None = None) -> None:
        self._reader = reader or default_reader()

    def plan(self, story_id: str) -> NarrativeDirection:
        bundle = self._reader.read(story_id)
        if bundle is None:
            raise CapabilityUnavailableError("narrative_direction", story_id, reason="item_not_found")

        doc = next((d for d in bundle.documents if isinstance(d.get("beats"), list)), None)
        if doc is None:
            raise CapabilityUnavailableError("narrative_direction", story_id)

        return NarrativeDirection(beats=[
            NarrativeBeat(
                order=b["order"], emotion=b["emotion"], emotional_intensity=b["emotional_intensity"],
                narrative_function=b["narrative_function"], pacing_intention=b["pacing_intention"],
            )
            for b in doc["beats"]
        ])
