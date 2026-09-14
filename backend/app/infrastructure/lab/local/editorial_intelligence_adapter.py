from __future__ import annotations

from app.domain.intelligence.entities import EditorialIntelligence, RecommendedFormat
from app.domain.shared.errors import CapabilityUnavailableError
from app.infrastructure.lab.local.export_reader import LabExportReader
from app.infrastructure.lab.live.composite_reader import default_reader


class LocalEditorialIntelligenceAdapter:
    """Reads LAB's real understanding.json / editorial_analysis.json /
    content_plan.json for a story — LAB's Editorial Understanding capability."""

    def __init__(self, reader: LabExportReader | None = None) -> None:
        self._reader = reader or default_reader()

    def analyze(self, story_id: str) -> EditorialIntelligence:
        bundle = self._reader.read(story_id)
        if bundle is None:
            raise CapabilityUnavailableError("editorial_intelligence", story_id, reason="item_not_found")

        understanding = next((d for d in bundle.documents if isinstance(d.get("headline"), str)), None)
        analysis = next((d for d in bundle.documents if isinstance(d.get("why_it_matters"), str)), None)
        content_plan = next((d for d in bundle.documents if isinstance(d.get("recommended_formats"), list)), None)

        if not (understanding or analysis or content_plan):
            raise CapabilityUnavailableError("editorial_intelligence", story_id)

        return EditorialIntelligence(
            headline=understanding.get("headline") if understanding else None,
            what_happened=understanding.get("what_happened") if understanding else None,
            angle=analysis.get("angle") if analysis else None,
            narrative_strength=analysis.get("narrative_strength") if analysis else None,
            why_it_matters=analysis.get("why_it_matters") if analysis else None,
            recommended_formats=[
                RecommendedFormat(format=f.get("format"), reason=f.get("reason"))
                for f in (content_plan.get("recommended_formats", []) if content_plan else [])
            ],
        )
