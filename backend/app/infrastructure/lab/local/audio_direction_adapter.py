from __future__ import annotations

from app.domain.intelligence.entities import AudioDirection, AudioTrack, SilenceWindow
from app.domain.shared.errors import CapabilityUnavailableError
from app.infrastructure.lab.local.export_reader import LabExportReader
from app.infrastructure.lab.live.composite_reader import default_reader


class LocalAudioDirectionAdapter:
    """Reads LAB's real audio_plan.json — LAB's Audio capability."""

    def __init__(self, reader: LabExportReader | None = None) -> None:
        self._reader = reader or default_reader()

    def plan(self, story_id: str) -> AudioDirection:
        bundle = self._reader.read(story_id)
        if bundle is None:
            raise CapabilityUnavailableError("audio_direction", story_id, reason="item_not_found")

        doc = next((d for d in bundle.documents if isinstance(d.get("tracks"), list)), None)
        if doc is None:
            raise CapabilityUnavailableError("audio_direction", story_id)

        return AudioDirection(
            tracks=[AudioTrack(role=t["role"], beat_id=t["beat_id"]) for t in doc["tracks"]],
            silence_windows=[
                SilenceWindow(beat_id=s["beat_id"], treatment=s["treatment"]) for s in doc.get("silence_windows", [])
            ],
            ducking_priority=doc.get("ducking_rules", {}).get("priority_order", []),
        )
