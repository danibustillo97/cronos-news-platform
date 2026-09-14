from __future__ import annotations

from app.domain.intelligence.entities import RenderResult
from app.domain.shared.errors import CapabilityUnavailableError
from app.infrastructure.lab.local.export_reader import LabExportReader
from app.infrastructure.lab.live.composite_reader import default_reader

_DONE_STATUSES = {"DONE", "PENDING", "FAILED"}


class LocalRenderAdapter:
    """Reads LAB's real render_plan.json — LAB's Render capability."""

    def __init__(self, reader: LabExportReader | None = None) -> None:
        self._reader = reader or default_reader()

    def result(self, story_id: str) -> RenderResult:
        bundle = self._reader.read(story_id)
        if bundle is None:
            raise CapabilityUnavailableError("render", story_id, reason="item_not_found")

        doc = next(
            (d for d in bundle.documents if "render_plan_id" in d and "assembly_plan_id" not in d),
            None,
        )
        if doc is None:
            raise CapabilityUnavailableError("render", story_id)

        shots = doc.get("shots", [])
        rendered = sum(1 for s in shots if s.get("status") == "DONE")
        return RenderResult(render_plan_id=doc["render_plan_id"], rendered_shot_count=rendered, shot_count=len(shots))
