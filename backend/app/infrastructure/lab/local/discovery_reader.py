"""Reads LAB's real ingestion output (automation/lab/workspace/incoming/
<item_id>.json, a WorkspaceItem in state INGESTED -- see automation/lab/
core/workspace.py) straight off disk. Same reasoning as export_reader.py:
LAB's real artifact is a directory of JSON files, not a database row; this
is the one place that knows the exact shape/path. Implements
DiscoveryContentReaderPort, mapping LAB's raw JSON into the domain's own
IngestedContent -- application code never sees LAB's file shape directly.
"""
from __future__ import annotations

import json
from pathlib import Path

from app.domain.discovery.entities import IngestedContent
from app.infrastructure.lab.local.export_reader import resolve_workspace_root


class LocalDiscoveryContentReader:
    def _incoming_dir(self) -> Path:
        # resolve_workspace_root() points at .../lab/workspace/exports;
        # incoming/ is exports/'s sibling under workspace/.
        return resolve_workspace_root().parent / "incoming"

    def read(self, item_id: str) -> IngestedContent | None:
        path = self._incoming_dir() / f"{item_id}.json"
        if not path.is_file():
            return None
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError):
            return None
        return IngestedContent(
            id=data["id"], title=data["title"], source_url=data["source_url"],
            source=data.get("source"), image_url=data.get("image_url"), content=data.get("content"),
            published_at=data.get("published_at"), ingested_at=data["ingested_at"],
            slug=(data.get("extra") or {}).get("slug"),
        )

    def read_many(self, item_ids: list[str]) -> list[IngestedContent]:
        items = [self.read(item_id) for item_id in item_ids]
        return [item for item in items if item is not None]
