from __future__ import annotations

from app.domain.intelligence.entities import AssemblyResult, AssemblyShot
from app.domain.shared.errors import CapabilityUnavailableError
from app.infrastructure.lab.local.export_reader import LabExportReader
from app.infrastructure.lab.live.composite_reader import default_reader


class LocalAssemblyAdapter:
    """Reads LAB's real assembly_plan.json — LAB's Assembly + Export
    capability. Its `output.relative_path` is the final_reel.mp4 reference,
    resolved through StoragePort by the presentation layer — never a raw
    filesystem path handed to the frontend."""

    def __init__(self, reader: LabExportReader | None = None) -> None:
        self._reader = reader or default_reader()

    def result(self, story_id: str) -> AssemblyResult:
        bundle = self._reader.read(story_id)
        if bundle is None:
            raise CapabilityUnavailableError("assembly", story_id, reason="item_not_found")

        doc = next(
            (d for d in bundle.documents if "assembly_plan_id" in d and "declared_total_duration_seconds" in d),
            None,
        )
        if doc is None:
            raise CapabilityUnavailableError("assembly", story_id)

        final_video = next((rel for role, rel in bundle.video_files if role == "final"), None)

        return AssemblyResult(
            assembly_plan_id=doc["assembly_plan_id"],
            declared_duration_seconds=doc["declared_total_duration_seconds"],
            included_duration_seconds=doc["included_duration_seconds"],
            shots=[
                AssemblyShot(
                    shot_id=s["shot_id"], scene_id=s["scene_id"],
                    disposition=s["disposition"], duration_seconds=s["duration_seconds"],
                )
                for s in doc.get("shots", [])
            ],
            final_asset_ref=final_video,
        )
