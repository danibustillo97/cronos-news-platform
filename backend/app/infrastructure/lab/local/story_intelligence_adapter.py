from __future__ import annotations

from app.domain.intelligence.entities import StoryIntelligence, StoryConcept, Hook, ScriptSection
from app.domain.shared.errors import CapabilityUnavailableError
from app.infrastructure.lab.local.export_reader import LabExportReader
from app.infrastructure.lab.live.composite_reader import default_reader


class LocalStoryIntelligenceAdapter:
    """Reads LAB's real story_concepts.json / hooks.json / script.json for
    a story — LAB's Storycraft capability."""

    def __init__(self, reader: LabExportReader | None = None) -> None:
        self._reader = reader or default_reader()

    def discover(self, story_id: str) -> StoryIntelligence:
        bundle = self._reader.read(story_id)
        if bundle is None:
            raise CapabilityUnavailableError("story_intelligence", story_id, reason="item_not_found")

        concepts_doc = next(
            (d for d in bundle.documents if isinstance(d.get("has_story"), bool) and isinstance(d.get("concepts"), list)),
            None,
        )
        hooks_doc = next((d for d in bundle.documents if isinstance(d.get("hooks"), list)), None)
        script_doc = next((d for d in bundle.documents if isinstance(d.get("sections"), list)), None)

        if not (concepts_doc or hooks_doc or script_doc):
            raise CapabilityUnavailableError("story_intelligence", story_id)

        return StoryIntelligence(
            has_story=concepts_doc.get("has_story", True) if concepts_doc else True,
            reason_if_not=concepts_doc.get("reason_if_not") if concepts_doc else None,
            concepts=[
                StoryConcept(title=c["title"], summary=c["summary"], angle=c.get("angle"), provenance=c.get("provenance"))
                for c in (concepts_doc.get("concepts", []) if concepts_doc else [])
            ],
            hooks=[Hook(text=h["text"], strategy=h.get("strategy")) for h in (hooks_doc.get("hooks", []) if hooks_doc else [])],
            script=[ScriptSection(section=s["section"], text=s["text"]) for s in (script_doc.get("sections", []) if script_doc else [])],
        )
