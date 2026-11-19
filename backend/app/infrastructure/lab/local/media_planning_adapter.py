from __future__ import annotations

from app.domain.intelligence.entities import MediaPlan, SceneMediaDecision
from app.domain.shared.errors import CapabilityUnavailableError
from app.infrastructure.lab.local.export_reader import LabExportReader
from app.infrastructure.lab.live.composite_reader import default_reader


class LocalMediaPlanningAdapter:
    """Reads LAB's real media_blueprint.json — LAB's Media capability."""

    def __init__(self, reader: LabExportReader | None = None) -> None:
        self._reader = reader or default_reader()

    def plan(self, story_id: str) -> MediaPlan:
        bundle = self._reader.read(story_id)
        if bundle is None:
            raise CapabilityUnavailableError("media_planning", story_id, reason="item_not_found")

        doc = next(
            (d for d in bundle.documents if isinstance(d.get("scenes"), list) and d["scenes"] and "media_requirement" in d["scenes"][0]),
            None,
        )
        if doc is None:
            raise CapabilityUnavailableError("media_planning", story_id)

        return MediaPlan(scenes=[
            SceneMediaDecision(
                scene_id=s["scene_id"], media_type=s["media_requirement"]["media_type"],
                generation_required=bool(s["media_requirement"].get("generation_required")),
                asset_ids=s.get("assets", []),
            )
            for s in doc["scenes"]
        ])
